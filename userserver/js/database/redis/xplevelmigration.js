// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

// XP-CURVE MIGRATION -- the "xplevels" console command (main.js).
//
// Run this after changing the XP-per-level table in shared/js/gametypes.js
// (Types.expForLevel and friends). Only raw XP is saved (p:<name> "exps"),
// and levels are recalculated from it, so a new curve can move every
// existing character up or down a level. Two saved things depend on the
// level and are fixed here:
//
//   1. "stats" (attack,defense,health,energy,luck,free). The gameserver's
//      playerpersistence.js _loadPStats() checks the stat total against the
//      level (10 per level up to 9, then 5 per level) and, if it doesn't
//      match, resets the player to the default layout. This migration
//      resets EVERY character to that default layout for their new level
//      (same values levelUp() would have given them):
//        - level 9 or below: each stat = 2 * level, free = 0.
//        - level 10+: each stat = 18, free = 5 * (level - 9), for the
//          player to spend again.
//      Characters already exactly on the default layout are left alone.
//   2. "equipment". Equipment.canEquip() only checks the level when an
//      item is put on, so a character who drops a level keeps wearing gear
//      they no longer qualify for. Such items are moved to the lowest free
//      inventory slot (30), else the lowest free bank slot (the shared
//      u:<user> "bank" if the account has one, else the legacy p:<name>
//      "bank" -- same rule as migrateInventorySize()), else left equipped
//      and reported. Nothing is ever deleted.
//
// Everything else derived from XP (attack/defense/move/weapon/skill levels,
// leaderboard levels, HP/EP max) is recalculated on load and needs nothing.
//
// SAFETY
//   - "xplevels" / "xplevels dry" writes nothing; it prints what would
//     change.
//   - Accounts are processed one at a time, and each account's writes go
//     out in a single MULTI (atomic).
//   - Before anything is written, the original values are copied into the
//     migrations:xplevels_backup hash (HSETNX, so repeat runs never
//     overwrite the first, pre-migration copy). "xplevels undo confirm"
//     restores them. Only undo right after a run: it puts back the old
//     inventory/bank too, so anything a player gained since would be lost.
//   - Refuses to run while anyone is online (their in-memory stats would be
//     saved straight back over the fix). With "force" it runs anyway and
//     skips every account that's online, checked again right before each
//     account is written.
//   - Re-running resets stat points again, so players who have re-spent
//     their free points since the last run would have to spend them again.
//
// The gameserver must be running the SAME gametypes.js as this userserver,
// or the gameserver will compute different levels and reset stats anyway.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKUP_KEY = 'migrations:xplevels_backup';
const CURVE_KEY = 'migrations:xplevels_curve';
const LOG = 'xplevels';

const inventorySlots = 30; // format.js getItemSlots(0)
const bankSlots = 96; // format.js getItemSlots(1)
const weaponSlot = 4; // gameserver equipment.js

let client;

export function initXpLevelMigration(deps) {
    client = deps.client;
}

// ---------------------------------------------------------------- helpers

const redisCall = (fn, ...args) =>
    new Promise((resolve, reject) => {
        fn.call(client, ...args, (err, res) => (err ? reject(err) : resolve(res)));
    });

const execMulti = (multi) =>
    new Promise((resolve, reject) => {
        multi.exec((err, res) => (err ? reject(err) : resolve(res)));
    });

const scanKeys = (pattern) =>
    new Promise((resolve, reject) => {
        client.scanKeys(pattern, (err, keys) => (err ? reject(err) : resolve(keys)));
    });

// Item level requirements, built the same way gameserver/js/data/itemdata.js
// does: armour uses `level` (falling back to `modifier`), weapons use
// ItemTypes.getWeaponLevel() which is `modifier`. Loaded lazily so a
// missing file only disables the equipment check instead of the server.
let itemReqCache = null;
function getItemRequirements() {
    if (itemReqCache) return itemReqCache;
    const file = path.join(__dirname, '../../../shared/data/items2.json');
    try {
        const items = JSON.parse(fs.readFileSync(file, 'utf8'));
        itemReqCache = {};
        for (const it of items) {
            const modifier = it.modifier ? it.modifier : 0;
            itemReqCache[it.id] = {
                name: it.name,
                armour: it.level !== undefined ? it.level : modifier,
                weapon: modifier
            };
        }
    } catch (e) {
        console.warn(
            LOG + ': could not read ' + file + ' (' + e.message +
                ') -- equipment level check disabled for this run.'
        );
        itemReqCache = null;
    }
    return itemReqCache;
}

const parseCsvInts = (csv) => {
    if (typeof csv !== 'string' || csv === '') return null;
    const out = csv.split(',').map((v) => parseInt(v, 10));
    return out.some((v) => Number.isNaN(v)) ? null : out;
};

const parseItems = (json) => {
    if (typeof json !== 'string' || json === '') return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed)
            ? parsed.filter((it) => Array.isArray(it) && it.length > 0)
            : [];
    } catch (e) {
        return null; // invalid -- caller leaves this store alone
    }
};

const requiredStatTotal = (lvl) => (lvl < 10 ? lvl * 10 : 90 + 5 * (lvl - 9));

// Same function the gameserver uses, with a guard: getLevel(NaN) returns 50.
const levelFromExp = (exp) =>
    Number.isFinite(exp) && exp > 0 ? global.Types.getLevel(exp) : 1;

// Default stat layout for `lvl` -- [atk,def,hp,ep,luck,free] -- or null
// when the saved stats already are exactly that.
function fixStats(stats, lvl) {
    const layout =
        lvl < 10
            ? [lvl * 2, lvl * 2, lvl * 2, lvl * 2, lvl * 2, 0]
            : [18, 18, 18, 18, 18, 5 * (lvl - 9)];
    if (layout.every((v, i) => v === stats[i])) return null;
    return { stats: layout };
}

function takeFreeSlot(items, max) {
    const used = new Set(items.map((it) => Number(it[0])));
    for (let i = 0; i < max; i++) if (!used.has(i)) return i;
    return -1;
}

// ------------------------------------------------------------- the pass

// mode: 'dry' | 'run'. isOnline(username) -> bool, checked right before
// each account is written.
async function runXpLevelPass(mode, isOnline) {
    const apply = mode === 'run';
    const reqs = getItemRequirements();
    const userKeys = await scanKeys('u:*');

    const totals = {
        accounts: userKeys.length, players: 0,
        statsFixed: 0, gearToInventory: 0, gearToBank: 0,
        gearKept: 0, skippedOnline: 0, skippedBadData: 0, errors: 0
    };

    for (const uKey of userKeys) {
        const username = uKey.slice(2);
        try {
            const [playersCsv, accountBankJson] = await execMulti(
                client.multi().hget(uKey, 'players').hget(uKey, 'bank')
            );
            const names =
                typeof playersCsv === 'string' && playersCsv !== ''
                    ? playersCsv.split(',').filter((n) => n !== '')
                    : [];
            if (names.length === 0) continue;

            const reads = client.multi();
            for (const n of names) {
                const pKey = 'p:' + n;
                reads.hget(pKey, 'stats').hget(pKey, 'exps')
                    .hget(pKey, 'equipment').hget(pKey, 'inventory')
                    .hget(pKey, 'bank');
            }
            const raw = await execMulti(reads);

            const hasSharedBank = accountBankJson != null;
            const sharedBank = hasSharedBank ? parseItems(accountBankJson) : null;
            let sharedBankChanged = false;

            const writes = []; // { pKey, field, value, original }
            const lines = [];
            // Counted here and only added to `totals` once this account is
            // actually reported/written (not when it's skipped as online).
            const acct = {
                players: 0, statsFixed: 0, gearToInventory: 0,
                gearToBank: 0, gearKept: 0, skippedBadData: 0
            };

            names.forEach((name, idx) => {
                acct.players++;
                const pKey = 'p:' + name;
                const [statsCsv, expsCsv, equipJson, invJson, pBankJson] =
                    raw.slice(idx * 5, idx * 5 + 5);

                const exps = parseCsvInts(expsCsv);
                const stats = parseCsvInts(statsCsv);
                if (!exps || !stats || stats.length !== 6) {
                    acct.skippedBadData++;
                    lines.push('  ' + name + ': skipped (missing/invalid stats or exps)');
                    return;
                }

                const lvl = levelFromExp(exps[0]);
                const notes = [];

                // 1. stats
                const fixed = fixStats(stats, lvl);
                if (fixed) {
                    acct.statsFixed++;
                    notes.push(
                        'stats reset ' + statsCsv + ' -> ' + fixed.stats.join(',')
                    );
                    writes.push({ pKey, field: 'stats', value: fixed.stats.join(','), original: statsCsv });
                }

                // 2. equipment above the new level
                const equip = reqs ? parseItems(equipJson) : null;
                if (reqs && equip === null) {
                    notes.push('equipment JSON invalid -- left alone');
                }
                if (equip && equip.length > 0) {
                    const inventory = parseItems(invJson);
                    const ownBank = hasSharedBank ? null : parseItems(pBankJson);
                    const bank = hasSharedBank ? sharedBank : ownBank;
                    let equipChanged = false, invChanged = false, ownBankChanged = false;

                    for (const item of [...equip]) {
                        const slot = Number(item[0]);
                        const req = reqs[Number(item[1])];
                        if (!req) continue;
                        const need = slot === weaponSlot ? req.weapon : req.armour;
                        if (!(need > lvl)) continue;

                        const label = req.name + ' (needs ' + need + ')';
                        let dest = null;
                        if (inventory) {
                            const s = takeFreeSlot(inventory, inventorySlots);
                            if (s >= 0) {
                                inventory.push([s, ...item.slice(1)]);
                                invChanged = true;
                                dest = 'inventory slot ' + s;
                                acct.gearToInventory++;
                            }
                        }
                        if (!dest && bank) {
                            const s = takeFreeSlot(bank, bankSlots);
                            if (s >= 0) {
                                bank.push([s, ...item.slice(1)]);
                                if (hasSharedBank) sharedBankChanged = true;
                                else ownBankChanged = true;
                                dest = 'bank slot ' + s;
                                acct.gearToBank++;
                            }
                        }
                        if (dest) {
                            equip.splice(equip.indexOf(item), 1);
                            equipChanged = true;
                            notes.push('unequipped ' + label + ' -> ' + dest);
                        } else {
                            acct.gearKept++;
                            notes.push('KEPT ' + label + ' equipped -- inventory and bank full');
                        }
                    }

                    if (equipChanged) writes.push({ pKey, field: 'equipment', value: JSON.stringify(equip), original: equipJson });
                    if (invChanged) writes.push({ pKey, field: 'inventory', value: JSON.stringify(inventory), original: invJson });
                    if (ownBankChanged) writes.push({ pKey, field: 'bank', value: JSON.stringify(ownBank), original: pBankJson });
                }

                if (notes.length > 0) {
                    lines.push('  ' + name + ' (level ' + lvl + '): ' + notes.join('; '));
                }
            });

            if (sharedBankChanged) {
                writes.push({ pKey: uKey, field: 'bank', value: JSON.stringify(sharedBank), original: accountBankJson });
            }

            const merge = (keys) => {
                for (const k of keys) totals[k] += acct[k];
            };

            if (writes.length === 0) {
                merge(['players', 'skippedBadData', 'gearKept']);
                for (const l of lines) if (/KEPT|skipped|invalid/.test(l)) console.info(LOG + ': ' + username + ' -- ' + l.trim());
                continue;
            }

            if (isOnline(username)) {
                totals.players += acct.players;
                totals.skippedOnline++;
                console.info(LOG + ': ' + username + ' is online -- skipped (run again once they log out).');
                continue;
            }

            merge(Object.keys(acct));
            console.info(LOG + ': ' + username + (apply ? '' : ' (dry run)'));
            for (const l of lines) console.info(l);

            if (!apply) continue;

            // Backup + writes in one MULTI. Backup is per key, original
            // values only, and HSETNX keeps the very first copy.
            const backups = {};
            for (const w of writes) {
                backups[w.pKey] = backups[w.pKey] || {};
                backups[w.pKey][w.field] = w.original === undefined ? null : w.original;
            }
            const m = client.multi();
            for (const key of Object.keys(backups)) {
                m.hsetnx(BACKUP_KEY, key, JSON.stringify(backups[key]));
            }
            for (const w of writes) m.hset(w.pKey, w.field, w.value);
            await execMulti(m);
        } catch (e) {
            totals.errors++;
            console.error(LOG + ': ' + uKey + ' failed: ' + (e && e.message ? e.message : JSON.stringify(e)));
        }
    }

    // Only record the curve as migrated once every account was handled.
    if (apply && totals.errors === 0 && totals.skippedOnline === 0) {
        await redisCall(client.set, CURVE_KEY, JSON.stringify(global.Types.expForLevel));
    }
    return totals;
}

function printTotals(mode, t) {
    console.info(
        LOG + ': ' + (mode === 'run' ? 'DONE' : 'DRY RUN (nothing written)') +
            ' -- ' + t.players + ' character(s) on ' + t.accounts + ' account(s) checked. ' +
            'Stat points reset: ' + t.statsFixed + '. ' +
            'Over-level gear moved: ' + t.gearToInventory + ' to inventory, ' +
            t.gearToBank + ' to bank, ' + t.gearKept + ' kept (no space). ' +
            'Skipped: ' + t.skippedOnline + ' online account(s), ' +
            t.skippedBadData + ' character(s) with bad data. Errors: ' + t.errors + '.'
    );
    if (mode === 'run' && t.errors > 0) {
        console.info(LOG + ': some accounts failed -- fix the cause and run "xplevels run" again (stat points are reset again for everyone).');
    }
    if (mode !== 'run' && (t.statsFixed > 0 || t.gearToInventory + t.gearToBank + t.gearKept > 0)) {
        console.info(LOG + ': type "xplevels run" to apply.');
    }
}

// --------------------------------------------------- public entry points

async function curveStatus() {
    const saved = await redisCall(client.get, CURVE_KEY);
    const now = JSON.stringify(global.Types.expForLevel);
    if (!saved) return 'no previous xplevels run recorded';
    return saved === now
        ? 'current XP curve matches the last migrated curve'
        : 'XP curve has CHANGED since the last migration';
}

// callback(err, totals)
function migrateXpLevels(mode, isOnline, callback) {
    const online = typeof isOnline === 'function' ? isOnline : () => false;
    (async () => {
        console.info(LOG + ': ' + (await curveStatus()) + '.');
        const totals = await runXpLevelPass(mode, online);
        printTotals(mode, totals);
        return totals;
    })().then(
        (t) => callback && callback(t.errors > 0 ? new Error('xplevels had errors') : null, t),
        (e) => {
            console.error(LOG + ': aborted: ' + (e && e.message ? e.message : JSON.stringify(e)));
            if (callback) callback(e);
        }
    );
}

// Restores every value saved in the backup hash, then deletes it.
// callback(err, restoredKeyCount)
function undoXpLevels(isOnline, callback) {
    const online = typeof isOnline === 'function' ? isOnline : () => false;
    (async () => {
        const backup = await redisCall(client.hgetall, BACKUP_KEY);
        const keys = backup ? Object.keys(backup) : [];
        if (keys.length === 0) {
            console.info(LOG + ': no backup found, nothing to undo.');
            return 0;
        }

        // Map p:<name> -> owning username, to skip online accounts.
        const owner = {};
        for (const uKey of await scanKeys('u:*')) {
            const csv = await redisCall(client.hget, uKey, 'players');
            if (typeof csv === 'string') {
                for (const n of csv.split(',')) if (n) owner['p:' + n] = uKey.slice(2);
            }
        }

        let restored = 0;
        const leftOver = [];
        for (const key of keys) {
            const user = key.startsWith('u:') ? key.slice(2) : owner[key];
            if (user && online(user)) {
                leftOver.push(key);
                continue;
            }
            let fields;
            try {
                fields = JSON.parse(backup[key]);
            } catch (e) {
                console.error(LOG + ': backup for ' + key + ' is invalid, left in place.');
                leftOver.push(key);
                continue;
            }
            const m = client.multi();
            for (const [field, value] of Object.entries(fields)) {
                if (value === null) m.hdel(key, field);
                else m.hset(key, field, value);
            }
            m.hdel(BACKUP_KEY, key);
            await execMulti(m);
            restored++;
            console.info(LOG + ': restored ' + key + ' (' + Object.keys(fields).join(', ') + ')');
        }
        if (leftOver.length > 0) {
            console.info(LOG + ': ' + leftOver.length + ' key(s) not restored (online or invalid): ' + leftOver.join(', '));
        } else {
            await redisCall(client.del, CURVE_KEY);
        }
        console.info(LOG + ': undo complete -- restored ' + restored + ' key(s).');
        return restored;
    })().then(
        (n) => callback && callback(null, n),
        (e) => {
            console.error(LOG + ': undo aborted: ' + (e && e.message ? e.message : JSON.stringify(e)));
            if (callback) callback(e);
        }
    );
}

function clearXpLevelsBackup(callback) {
    client.del(BACKUP_KEY, (err, n) => {
        if (!err) console.info(LOG + ': backup ' + (n ? 'deleted.' : 'was already empty.'));
        if (callback) callback(err || null);
    });
}

export const xpLevelMigrationMethods = {
    migrateXpLevels,
    undoXpLevels,
    clearXpLevelsBackup
};
