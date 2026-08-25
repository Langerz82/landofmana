/* global client, Utils, AppearanceData */

// Bulk key-housekeeping / one-off maintenance scripts and the startup data
// migrations that used to live inline in redis.js's DatabaseHandler class.
// Split out here because none of them touch `user`/`users`/`worldHandlers`
// or any other app-level object -- like the rest of redis.js's data layer,
// they only ever read/write raw Redis keys via the shared `client` (plus,
// for the two SCAN-based helpers, the `hgetarray`/`scanKeys` shims redis.js
// attaches to it) -- but unlike the plain CRUD primitives that make up the
// rest of that file, every function below either mutates the keyspace in
// bulk (replaceSkills, removeOldValues, insertMissingPlayerKeys,
// createPlayerKeys, resetLegacyLooksToDefault, wipeAllNewQuests) or exists
// purely to move already-saved data from an old storage scheme to a new
// one, once, at startup (purgeStaleNewQuests, migrateGoldFields,
// migrateGold1ToUser, renameGold1ToBankGold, migrateBankToUser,
// migrateLooksToBase64). Most of the bulk-mutation group runs automatically
// too (see migrationReady, redis.js), but three -- replaceSkills,
// resetLegacyLooksToDefault, and wipeAllNewQuests -- are deliberately
// manual/on-demand instead; see each one's own comment for why.
//
// These are exported as `migrationMethods` and mixed onto
// DatabaseHandler.prototype (see the bottom of redis.js) rather than kept
// as a separate class/instance, so `this.migrateGoldFields(...)` etc. from
// redis.js's constructor -- and the cross-calls between these functions
// themselves (migrateGoldFields -> migrateGold1ToUser ->
// renameGold1ToBankGold) -- keep working unchanged. Since these are plain
// functions here rather than class methods, the cross-calls below invoke
// each other directly (e.g. `migrateGold1ToUser(callback)`, not
// `this.migrateGold1ToUser(callback)`); that's only safe because none of
// these functions rely on `this` for anything else, which redis.js's
// DatabaseHandler class no longer does either, once these are removed from
// it.
//
// `client` (the shared node-redis client) and `playerGoldMax` (the gold cap
// migrateGold1ToUser() clamps combined balances to -- also enforced
// separately by redis.js's own modifyGold()/addPlayerGoldOffline(), so it
// stays defined once in redis.js and is handed in here) are both supplied
// via initMigrations() below, called from the DatabaseHandler constructor
// right after it creates `client` -- mirroring the module-scoped `let
// client` pattern redis.js itself uses, rather than threading `client`
// through every call site here.
//
// `Utils` and `AppearanceData` (used only by migrateLooksToBase64() below)
// are not threaded through initMigrations() the way `client`/
// `playerGoldMax` are -- they're referenced as bare globals instead, the
// same way userserver's database/databaselogic.js already does (see the
// NOTE comment at the top of that file): both are set on the Node global
// object once, at startup, by common.js (`global.Utils`/
// `global.AppearanceData`), which main.js imports before it ever
// constructs a DatabaseHandler -- so they're guaranteed to already be
// populated by the time any migration below can run.

let client;

// Bank capacity -- matches userserver/js/format.js's getItemSlots(1) (type
// 1 = bank -> 96 slots). Duplicated here rather than imported since this
// file already duplicates small cross-cutting constants like this rather
// than reaching into format.js's validation layer (which is a different
// concern -- payload shape/range checking -- from this file's plain Redis
// reads/writes). Used by migrateBankToUser() below to decide whether an
// account's combined per-character bank items fit in one shared bank at
// the same size the gameserver/format.js already enforce per character.
// Moved here from redis.js along with migrateBankToUser() -- its only
// caller -- rather than left behind and threaded through initMigrations()
// like playerGoldMax, since nothing in redis.js needs it once
// migrateBankToUser() is gone from that file.
const bankSlots = 96;

// Gold cap migrateGold1ToUser() below clamps combined per-account gold_1
// totals to -- see that function's FIX comment. Unlike bankSlots above,
// this can't just move here wholesale: redis.js's own modifyGold()/
// addPlayerGoldOffline() enforce the exact same cap on live, non-migration
// gold writes, so playerGoldMax stays defined once in redis.js (with the
// full rationale/duplication comment there) and is handed in via
// initMigrations() below instead of being redeclared here.
let playerGoldMax;

// Called once from the DatabaseHandler constructor (redis.js), right after
// it creates `client` (and attaches the hgetarray/scanKeys shims to it) --
// same "module-scoped state set up once, read by every function below"
// pattern redis.js itself uses for its own `client` variable.
export function initMigrations(deps) {
    client = deps.client;
    playerGoldMax = deps.playerGoldMax;
}

// FIX: `let j` was redeclared to 0 at the top of every outer-loop
// iteration, so `keys[j++]` inside the async hget() callback always
// resolved to `keys[0]` -- whichever player's callback happened to
// fire, this reset keys[0]'s "skills" field, not the current key's.
// Redis reply callbacks don't necessarily fire back in the same order
// the requests were issued, so this wasn't even consistently "reset
// the first player" -- it was reset-whoever's-callback-won-the-race,
// every time, for every matching key. Using the already-captured
// `key` (this iteration's own closure variable, not a shared/reset
// counter re-deriving an index into `keys`) fixes that -- each
// callback now always resets the same key it was looked up from.
// Also restored the `count !== 7` guard (previously commented out,
// and shadowing the outer loop's own `len` under the same name):
// without it this unconditionally wipes every matching player's
// skills back to zero on every run, not just the malformed ones this
// migration exists to repair. Still unused (see the commented-out
// call site in the constructor above) -- left disabled; this just
// corrects the bug for whenever it's actually needed again.
function replaceSkills() {
    client.scanKeys('p:*', (err, keys) => {
        if (err) return console.log(err);

        for (let i = 0, len = keys.length; i < len; i++) {
            const key = keys[i];
            console.info(key);
            if (key.startsWith('p:')) {
                client.hget(key, 'skills', (err, data) => {
                    if (err || !data) return;
                    const count = data.split(',').length;
                    if (count !== 7) {
                        client.hset(key, 'skills', '0,0,0,0,0,0,0');
                    }
                });
            }
        }
    });
}

function removeOldValues() {
    client.del('b:bans');
    client.del('s:auction');
    client.del('l:looks');

    client.scanKeys('b:bans-*', (err, keys) => {
        if (err) return console.log(err);

        for (const key of keys) {
            client.del(key);
        }
    });

    client.scanKeys('s:auction-*', (err, keys) => {
        if (err) return console.log(err);

        for (const key of keys) {
            client.del(key);
        }
    });

    client.scanKeys('l:looks-*', (err, keys) => {
        if (err) return console.log(err);

        for (const key of keys) {
            client.del(key);
        }
    });

    client.scanKeys('p:*', (err, keys) => {
        if (err) return console.log(err);

        for (let i = 0, len = keys.length; i < len; i++) {
            const key = keys[i];
            console.info(key);
            if (key.startsWith('p:')) {
                // 'newquests'/'newquests2' used to be wiped here too, but
                // that made them a manual, config-gated, *repeatable* wipe
                // (this whole function only runs when an admin opts in via
                // remove_old_values, with no memory of ever having run
                // before) -- fine for the other one-off keys above, but
                // wrong for 'newquests': it's the live saveQuests()/
                // loadQuests() field, so wiping it on every opted-in
                // restart would also erase perfectly valid quests saved
                // after the very first wipe. That's now handled by
                // purgeStaleNewQuests() instead (see below and the
                // constructor), which runs unconditionally but only ever
                // actually purges once, self-disabling via the
                // 'migrations:newquests_purged' flag.
                client.hdel(key, 'completeQuests');
                client.hdel(key, 'completeQuests2');
            }
        }
    });
}

// One-time (run-once-ever, never re-run) startup migration. The
// npcQuestId scheme changed from "shared by every NPC of the same kind"
// to "globally unique per NPC instance" (see gameserver's
// entity/npcstatic.js / entity/npcmove.js). Every already-saved
// 'newquests' entry (a player's active/in-progress quest list -- see
// saveQuests()/loadQuests() below) was written under the old scheme, so
// its stored npcQuestId can never match any NPC again -- those quests
// are permanently stuck, un-completable dead weight rather than harmless
// leftovers. This clears 'newquests'/'newquests2' for every player
// exactly once -- the first startup after this migration exists -- and
// never touches them again afterward.
//
// Unlike removeOldValues() above (config-gated via remove_old_values,
// and re-runs in full every time an admin opts in -- fine for that
// function's other one-off keys, wrong for a *live* field), this always
// runs, every startup, same as migrateGoldFields()/migrateBankToUser()
// below -- but the 'migrations:newquests_purged' flag makes the *work*
// run only once ever: a plain top-level key (not a per-player hash
// field, since "does this player already have newquests" isn't a valid
// signal -- a legitimately-saved post-migration quest looks identical to
// a stale pre-migration one), checked before doing anything and set only
// after every player has been purged. A server that's already migrated
// skips the whole client.keys('p:*', ...) scan on every subsequent
// restart, no matter how many quests get saved under the new scheme in
// between.
//
// `callback(err)` fires once every player has been checked (or
// immediately, if the flag shows this already ran).
function purgeStaleNewQuests(callback) {
    const flagKey = 'migrations:newquests_purged';

    client.get(flagKey, (err, already) => {
        if (err) {
            console.error(
                'purgeStaleNewQuests: flag read failed: ' +
                    JSON.stringify(err)
            );
            if (callback) callback(err);
            return;
        }

        if (already) {
            console.info('purgeStaleNewQuests: already run, skipping.');
            if (callback) callback(null);
            return;
        }

        client.scanKeys('p:*', (err2, keys) => {
            if (err2) {
                if (callback) callback(err2);
                return;
            }

            if (keys.length === 0) {
                console.info(
                    'purgeStaleNewQuests: no players found, nothing to purge.'
                );
                client.set(flagKey, '1', (err3) => {
                    if (callback) callback(err3 || null);
                });
                return;
            }

            let remaining = keys.length;
            let firstError = null;

            const checkDone = () => {
                remaining--;
                if (remaining === 0) {
                    console.info(
                        'purgeStaleNewQuests: complete -- cleared stale newquests for ' +
                            keys.length +
                            ' player(s).'
                    );
                    client.set(flagKey, '1', (err4) => {
                        if (callback) callback(firstError || err4 || null);
                    });
                }
            };

            for (const pKey of keys) {
                client
                    .multi()
                    .hdel(pKey, 'newquests')
                    .hdel(pKey, 'newquests2')
                    .exec((err5) => {
                        if (err5) {
                            console.error(
                                'purgeStaleNewQuests: hdel failed for ' +
                                    pKey +
                                    ': ' +
                                    JSON.stringify(err5)
                            );
                            firstError = firstError || err5;
                        }
                        checkDone();
                    });
            }
        });
    });
}

function insertMissingPlayerKeys() {
    client.scanKeys('p:*', (err, keys) => {
        if (err) return console.log(err);

        client.smembers('player', (err, reply) => {
            for (let pName of keys) {
                pName = pName.substr(2);
                if (!reply.includes(pName)) {
                    client.sadd('player', pName);
                }
            }
        });
    });
}

function createPlayerKeys() {
    client.scanKeys('p:*', (err, arr) => {
        for (const rec of arr) {
            console.info('rec=' + rec);
            const playerName = rec.substr(2);
            if (playerName.length > 0) {
                client.sadd('player', playerName);
            }
        }
    });
}

// Runs once at every server startup -- kicked off unconditionally from
// the constructor above (see migrationReady there), which main.js awaits
// before it opens itself up to new connections (see migrationComplete in
// main.js). Does the legacy "gold" -> gold_0/gold_1 split for every
// player in one pass, rather than leaving it to whichever player happened
// to log in next. Uses the same scanKeys('p:*', ...) helper as
// removeOldValues()/insertMissingPlayerKeys() above (see its FIX comment
// for why this is SCAN-based rather than a single blocking KEYS call).
//
// `callback(err)` fires once every player key has been checked (err is
// null on success) AND every account's gold_1 combine pass
// (migrateGold1ToUser() below) has also finished -- this runs the legacy
// "gold" -> gold_0/gold_1 per-character split first, then chains straight
// into migrateGold1ToUser() once every player is done, since that second
// pass needs every character's gold_1 to already exist before it can sum
// them per account. Players that already have gold_0/gold_1 -- either
// already migrated on a previous startup, or created fresh straight into
// the new format -- are left untouched by this first pass.
function migrateGoldFields(callback) {
    client.scanKeys('p:*', (err, keys) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (keys.length === 0) {
            console.info(
                'migrateGoldFields: no players found, nothing to migrate.'
            );
            migrateGold1ToUser(callback);
            return;
        }

        let remaining = keys.length;
        let migratedCount = 0;
        let firstError = null;

        const checkDone = () => {
            remaining--;
            if (remaining === 0) {
                console.info(
                    'migrateGoldFields: complete -- migrated ' +
                        migratedCount +
                        ' of ' +
                        keys.length +
                        ' player(s).'
                );
                // Per-character gold_0/gold_1 now guaranteed to exist for every
                // player -- safe to combine gold_1 per account.
                migrateGold1ToUser((err2) => {
                    if (callback) callback(firstError || err2);
                });
            }
        };

        for (const pKey of keys) {
            client
                .multi()
                .hget(pKey, 'gold')
                .hget(pKey, 'gold_0')
                .hget(pKey, 'gold_1')
                .exec((err, raw) => {
                    if (err) {
                        console.error(
                            'migrateGoldFields: read failed for ' +
                                pKey +
                                ': ' +
                                JSON.stringify(err)
                        );
                        firstError = firstError || err;
                        checkDone();
                        return;
                    }

                    const [legacyGold, gold0, gold1] = raw;

                    // FIX: this skip check used to be commented out entirely, so
                    // this loop unconditionally re-derived gold_0/gold_1 from the
                    // legacy "gold" field on EVERY startup -- including players
                    // who'd already been split (or created fresh straight into
                    // gold_0/gold_1, never having had a "gold" field at all).
                    // Since "gold" is deleted the first time a player is actually
                    // split (see the hdel(pKey, "gold") below), every subsequent
                    // restart found no legacy field, computed legacyParts as [],
                    // and silently overwrote gold_0/gold_1 with 0 -- wiping real
                    // currency on every restart after the first. This was
                    // especially damaging for migrateGold1ToUser()'s
                    // abort-and-fallback accounts (see the FIX comment there):
                    // their per-character gold_1 IS the real, currently-active
                    // balance for an over-cap account, and this bug reset it to 0
                    // right before migrateGold1ToUser() re-summed it, letting an
                    // over-cap account silently "succeed" on the next restart with
                    // a bogus zeroed total instead of staying correctly aborted.
                    //
                    // gold_0 alone is a reliable "already split" signal: it's one
                    // of the two fields this function's own write below always
                    // sets together (in the same multi/exec), and it's also always
                    // set directly by a normal player save
                    // (DatabaseLogic.savePlayerInfo() -> this.savePlayerInfo()
                    // above) once a player exists at all -- so if it's present,
                    // there's nothing left to derive from a legacy "gold" field.
                    // gold_1 is deliberately NOT part of this check: unlike
                    // gold_0, migrateGold1ToUser() below intentionally deletes a
                    // player's per-character gold_1 once it's been successfully
                    // combined into the shared account-level field (see the
                    // Cleanup comment there), so a missing gold_1 on an
                    // already-split player just means that combine succeeded, not
                    // that this split still needs to run.
                    if (gold0 != null) {
                        checkDone();
                        return;
                    }

                    const legacyParts =
                        typeof legacyGold === 'string'
                            ? legacyGold.split(',')
                            : [];
                    const newGold0 = parseInt(legacyParts[0], 10) || 0;
                    const newGold1 = parseInt(legacyParts[1], 10) || 0;

                    client
                        .multi()
                        .hset(pKey, 'gold_0', newGold0)
                        .hset(pKey, 'gold_1', newGold1)
                        .hdel(pKey, 'gold')
                        .exec((err) => {
                            if (err) {
                                console.error(
                                    'migrateGoldFields: write failed for ' +
                                        pKey +
                                        ': ' +
                                        JSON.stringify(err)
                                );
                                firstError = firstError || err;
                            } else {
                                migratedCount++;
                            }
                            checkDone();
                        });
                });
        }
    });
}

// One-time (idempotent, re-run-safe) migration: combines every user's
// characters' individual gold_1 values (already guaranteed to exist by
// the per-character pass above) into one shared account-level gold_1
// (u:<username> "gold_1" field) -- mirrors migrateBankToUser()'s
// account-level bank field, for the same reason: an account's characters
// now share one gold_1 pool instead of each holding their own. Chained
// automatically from the end of migrateGoldFields() above (see there),
// every startup, and is safe to run repeatedly: any user that already has
// a "gold_1" field is left untouched, so accounts already combined on a
// previous startup (or created fresh straight into the new scheme) are
// skipped.
//
// REFACTOR: this is now purely a one-time backfill for accounts that
// existed before saveUserInfo() started seeding "gold_1" at account
// creation (see that function's FIX comment) -- every account created
// since already has u:<username> "gold_1" from its first save, so this
// scan finds nothing left to do for them (existingGold1 != null skip
// below) and only ever touches genuinely pre-existing, not-yet-combined
// accounts.
//
// Combine strategy: every character's own gold_1 is summed (order doesn't
// matter here the way it does for migrateBankToUser()'s items -- plain
// numbers have no slot to collide over, only a total).
//
// FIX: if the combined total would exceed playerGoldMax
// (userserver/js/format.js) -- the same cap WU_SAVE_PLAYER_DATA's
// numberField(0, playerGoldMax) already enforces on every future gold_1
// save -- writing that total as-is would leave the account with a value
// no legitimate save could ever pass validation with again. This used to
// abort instead (leave "gold_1" unset entirely, keeping the account on
// its existing per-character fields), retried every startup in case the
// account later dropped under the cap on its own. That left some
// accounts permanently stuck un-combined -- an account that stays over
// the cap (which nothing in the game actually prevents, since gold_1 is
// only cap-checked on write, not decremented on its own) would simply
// never migrate. Now clamps instead: the combined total is capped at
// playerGoldMax and written as the account's shared "gold_1", same as
// the normal case below, so every account ends up combined and the
// "gold_1 must fit under playerGoldMax" invariant every future save
// relies on holds for every account, not just the ones that happened to
// be under the cap already. This does mean an over-cap account
// permanently loses whatever gold sat above playerGoldMax -- logged as a
// warning below since it's a real, irreversible loss, not just a
// deferral the way the old abort-and-retry was.
//
// Cleanup: once a combine succeeds for an account -- always, now, since
// there's no more abort path -- every combined character's now-redundant
// p:<playerName> "gold_1" field is deleted; there's no fallback reason
// left to keep it once the shared "gold_1" field exists.
//
// Uses the same scanKeys(...) helper as removeOldValues()/
// insertMissingPlayerKeys()/migrateGoldFields()/migrateBankToUser()
// above.
//
// `callback(err)` fires once every user has been checked (err is null on
// success).
function migrateGold1ToUser(callback) {
    client.scanKeys('u:*', (err, userKeys) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (userKeys.length === 0) {
            console.info(
                'migrateGold1ToUser: no users found, nothing to migrate.'
            );
            if (callback) callback(null);
            return;
        }

        let remaining = userKeys.length;
        let migratedCount = 0;
        let clampedCount = 0;
        let firstError = null;

        const checkDone = () => {
            remaining--;
            if (remaining === 0) {
                console.info(
                    'migrateGold1ToUser: complete -- combined ' +
                        migratedCount +
                        ' of ' +
                        userKeys.length +
                        ' user(s) (' +
                        clampedCount +
                        ' clamped down to the ' +
                        playerGoldMax +
                        ' cap).'
                );
                // Chain straight into renameGold1ToBankGold() below --
                // see that function's comment for why it has to run
                // after this one specifically, not just "at some point
                // during startup."
                renameGold1ToBankGold((err2) => {
                    if (callback) callback(firstError || err2);
                });
            }
        };

        for (const uKey of userKeys) {
            client
                .multi()
                .hget(uKey, 'gold_1')
                .hget(uKey, 'players')
                .hget(uKey, 'bank_gold')
                .exec((err, raw) => {
                    if (err) {
                        console.error(
                            'migrateGold1ToUser: read failed for ' +
                                uKey +
                                ': ' +
                                JSON.stringify(err)
                        );
                        firstError = firstError || err;
                        checkDone();
                        return;
                    }

                    const [existingGold1, playersCsv, existingBankGold] = raw;

                    // FIX: this used to only check "gold_1" for the
                    // already-migrated signal. But renameGold1ToBankGold()
                    // (below) deletes "gold_1" the moment it successfully
                    // renames it to "bank_gold" -- so on every subsequent
                    // restart, an already-fully-migrated account has no
                    // "gold_1" left, this skip check missed it, and the
                    // combine below re-ran from scratch. Every character's
                    // own p:<playerName> "gold_1" was *also* already deleted
                    // by that same earlier successful migration (see the
                    // Cleanup block below), so the "re-combine" always summed
                    // to 0, wrote a fresh "gold_1" of 0 back onto the
                    // account, and renameGold1ToBankGold() then immediately
                    // overwrote the account's real "bank_gold" balance with
                    // that 0 -- silently zeroing every account's shared gold
                    // on every single server restart. Checking "bank_gold"
                    // too (the migration's actual terminal state, produced by
                    // renameGold1ToBankGold()) fixes that: an account that's
                    // already fully migrated is skipped here regardless of
                    // whether "gold_1" happens to still exist.
                    if (existingGold1 != null || existingBankGold != null) {
                        // Already on the new field, or already renamed to
                        // "bank_gold" -- nothing to combine.
                        checkDone();
                        return;
                    }

                    const playerNames =
                        typeof playersCsv === 'string' && playersCsv !== ''
                            ? playersCsv.split(',')
                            : [];

                    if (playerNames.length === 0) {
                        // No characters at all yet -- nothing to combine, just seed a
                        // zero shared balance so this account counts as migrated.
                        client.hset(uKey, 'gold_1', 0, (err) => {
                            if (err) {
                                console.error(
                                    'migrateGold1ToUser: write failed for ' +
                                        uKey +
                                        ': ' +
                                        JSON.stringify(err)
                                );
                                firstError = firstError || err;
                            } else {
                                migratedCount++;
                                console.debug(
                                    'migrateGold1ToUser: [debug] migrated ' +
                                        uKey +
                                        ' -- no characters yet, seeded zero shared gold_1.'
                                );
                            }
                            checkDone();
                        });
                        return;
                    }

                    let playersRemaining = playerNames.length;
                    let total = 0;

                    playerNames.forEach((playerName) => {
                        client.hget(
                            'p:' + playerName,
                            'gold_1',
                            (err, value) => {
                                if (err) {
                                    console.error(
                                        'migrateGold1ToUser: read failed for p:' +
                                            playerName +
                                            ': ' +
                                            JSON.stringify(err)
                                    );
                                }

                                total += parseInt(value, 10) || 0;

                                playersRemaining--;
                                if (playersRemaining === 0) {
                                    // FIX: clamp rather than abort when the
                                    // combined total is over the cap -- see
                                    // this function's FIX comment above for
                                    // the full rationale. `total` (summed
                                    // from non-negative per-character
                                    // gold_1 fields, so never itself
                                    // negative) only needs a ceiling here,
                                    // not the Math.max(0, ...) floor
                                    // modifyGold()/modifyGems() also apply.
                                    if (total > playerGoldMax) {
                                        console.warn(
                                            'migrateGold1ToUser: ' +
                                                uKey +
                                                ' has a combined gold_1 total of ' +
                                                total +
                                                ' across ' +
                                                playerNames.length +
                                                ' character(s), more than the ' +
                                                playerGoldMax +
                                                ' cap -- clamping to ' +
                                                playerGoldMax +
                                                ' and combining anyway. This account permanently loses ' +
                                                (total - playerGoldMax) +
                                                ' gold.'
                                        );
                                        clampedCount++;
                                        total = Math.min(
                                            total,
                                            playerGoldMax
                                        );
                                    }

                                    client.hset(
                                        uKey,
                                        'gold_1',
                                        total,
                                        (err) => {
                                            if (err) {
                                                console.error(
                                                    'migrateGold1ToUser: write failed for ' +
                                                        uKey +
                                                        ': ' +
                                                        JSON.stringify(err)
                                                );
                                                firstError =
                                                    firstError || err;
                                                checkDone();
                                                return;
                                            }

                                            migratedCount++;
                                            console.debug(
                                                'migrateGold1ToUser: [debug] migrated ' +
                                                    uKey +
                                                    ' -- combined ' +
                                                    total +
                                                    ' gold across ' +
                                                    playerNames.length +
                                                    ' character(s): [' +
                                                    playerNames.join(
                                                        ', '
                                                    ) +
                                                    '].'
                                            );

                                            // The shared account-level gold_1 is now the source of
                                            // truth for this account -- each character's own
                                            // p:<playerName> "gold_1" field is redundant from here
                                            // on, so clean up the stale per-character copies rather
                                            // than leaving them behind.
                                            let deleteRemaining =
                                                playerNames.length;
                                            playerNames.forEach(
                                                (playerName) => {
                                                    client.hdel(
                                                        'p:' + playerName,
                                                        'gold_1',
                                                        (err2) => {
                                                            if (err2) {
                                                                console.warn(
                                                                    'migrateGold1ToUser: failed to delete stale p:' +
                                                                        playerName +
                                                                        ' gold_1 field: ' +
                                                                        JSON.stringify(
                                                                            err2
                                                                        )
                                                                );
                                                            }
                                                            deleteRemaining--;
                                                            if (
                                                                deleteRemaining ===
                                                                0
                                                            ) {
                                                                checkDone();
                                                            }
                                                        }
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            }
                        );
                    });
                });
        }
    });
}

// One-time (idempotent, re-run-safe) migration: renames the
// account-level "gold_1" field (u:<username>) to "bank_gold" -- a pure
// field rename, no value changes. "gold_1" was originally named to
// match gold_0/gold_1's per-character "currency type" scheme
// (WU_SAVE_PLAYER_DATA's two flat gold elements), but now that it's
// been fully account-level (a shared bank-style balance, not a second
// per-character currency) since migrateGold1ToUser() above started
// combining it, "bank_gold" is what the field actually represents.
//
// Chained automatically straight after migrateGold1ToUser() finishes
// (see that function's checkDone -- not just placed elsewhere in the
// same startup sequence) because it depends specifically on that
// function's result: every account's combined (or newly-seeded-zero)
// balance sitting under u:<username> "gold_1" is exactly what this
// renames. Running any earlier -- e.g. in parallel with
// migrateGoldFields()/migrateGold1ToUser() rather than strictly after --
// would race an account whose "gold_1" hasn't been combined yet, or
// isn't seeded yet, and either rename nothing (leaving that account
// needing another full restart to catch up) or, worse, rename an
// in-progress account's "gold_1" out from under migrateGold1ToUser()
// while it's still reading/writing it.
//
// migrateGold1ToUser() above is deliberately left writing "gold_1"
// itself, not "bank_gold" directly -- it's the migration that produces
// the pre-rename field this one consumes, so the two-step handoff (old
// migration writes the old name, this one renames it) works regardless
// of whether an account's "gold_1" was combined just now on this
// startup or was already sitting there from a previous deployment of
// this codebase, before "bank_gold" existed. saveUserInfo()/
// loadPlayerInfo()/savePlayerInfo() below, by contrast, are the
// steady-state read/write paths a player's own save/load actually goes
// through -- those are updated to use "bank_gold" directly, since by
// the time any of them can run, main.js has already awaited the full
// migrationReady chain (this function included), so "bank_gold" is
// guaranteed to be the current, populated field.
//
// Safe to run repeatedly: any user with no "gold_1" field left -- either
// already renamed on a previous startup (deleted as part of the rename
// below), or created fresh straight into "bank_gold" via
// saveUserInfo()'s creation-time seed -- is left untouched.
//
// `callback(err)` fires once every user has been checked (err is null
// on success).
function renameGold1ToBankGold(callback) {
    client.scanKeys('u:*', (err, userKeys) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (userKeys.length === 0) {
            console.info(
                'renameGold1ToBankGold: no users found, nothing to rename.'
            );
            if (callback) callback(null);
            return;
        }

        let remaining = userKeys.length;
        let renamedCount = 0;
        let firstError = null;

        const checkDone = () => {
            remaining--;
            if (remaining === 0) {
                console.info(
                    'renameGold1ToBankGold: complete -- renamed ' +
                        renamedCount +
                        ' of ' +
                        userKeys.length +
                        ' user(s).'
                );
                if (callback) callback(firstError);
            }
        };

        for (const uKey of userKeys) {
            client
                .multi()
                .hget(uKey, 'gold_1')
                .hget(uKey, 'bank_gold')
                .exec((err, raw) => {
                    if (err) {
                        console.error(
                            'renameGold1ToBankGold: read failed for ' +
                                uKey +
                                ': ' +
                                JSON.stringify(err)
                        );
                        firstError = firstError || err;
                        checkDone();
                        return;
                    }

                    const [gold1, existingBankGold] = raw;

                    if (gold1 == null) {
                        // Nothing left to rename -- already renamed on a
                        // previous startup, or created fresh straight
                        // into "bank_gold".
                        checkDone();
                        return;
                    }

                    // Defensive: shouldn't normally happen (an account
                    // is either still on "gold_1" or already renamed to
                    // "bank_gold", never both), but if it does, don't
                    // silently discard whichever value loses -- log it
                    // so it can be investigated, then proceed with
                    // "gold_1" (the field every other migration/read/
                    // write path in this file still treats as the
                    // not-yet-renamed signal) as the source of truth.
                    if (existingBankGold != null) {
                        console.warn(
                            'renameGold1ToBankGold: ' +
                                uKey +
                                ' has both a "gold_1" (' +
                                gold1 +
                                ') and an existing "bank_gold" (' +
                                existingBankGold +
                                ') -- overwriting "bank_gold" with "gold_1" ' +
                                'and deleting "gold_1".'
                        );
                    }

                    client
                        .multi()
                        .hset(uKey, 'bank_gold', gold1)
                        .hdel(uKey, 'gold_1')
                        .exec((err2) => {
                            if (err2) {
                                console.error(
                                    'renameGold1ToBankGold: write failed for ' +
                                        uKey +
                                        ': ' +
                                        JSON.stringify(err2)
                                );
                                firstError = firstError || err2;
                                checkDone();
                                return;
                            }

                            renamedCount++;
                            checkDone();
                        });
                });
        }
    });
}

// REFACTOR: this file used to also have a migrateOfflineGold() migration
// here, run once at startup right after migrateGoldFields(), sweeping any
// pre-existing "goldoffline" balance into the shared account-level
// gold_1. Removed along with addGoldOffline()/transferOfflineGold() --
// offline gold's destination is a player's own gold_0, not gold_1, and
// "goldoffline" now gets read, atomically cleared, and folded into gold_0
// (DatabaseLogic.loadPlayerInfo(), database/databaselogic.js, using the raw value
// loadPlayerInfo() above hands back) for any player the moment they next
// load, migrated account or not, so there's no leftover balance a
// separate startup sweep still needs to catch, and no gold_1-shaped
// migration left to write.


// One-time (idempotent, re-run-safe) migration: consolidates every user's
// existing per-character bank contents (p:<playerName> "bank" field, one
// per character) into the new shared account-level bank (u:<username>
// "bank" field) -- see the REFACTOR comment on loadItems() and the
// comment on loadUserBank()/saveUserBank() above for why bank moved to
// the account level. Runs automatically at every startup (see
// migrationReady in the constructor, same "blocking, before accepting
// connections" pattern as migrateGoldFields()), and is safe to run
// repeatedly: any user that already has a "bank" field is left
// untouched, so accounts already migrated on a previous startup (or
// created fresh straight into the new scheme) are skipped.
//
// Merge strategy (an explicit product decision, not a default picked
// here): every character's bank items are combined into the one shared
// bank, in the order the characters appear in the user's "players" list
// (i.e. creation order). Re-slotting (each item's slot renumbered
// sequentially starting from 0) only happens when there are 2 or more
// characters -- that's the only case where it's actually needed, since
// each character independently used its own 0..(bankSlots-1) slot
// numbering, so simply concatenating raw items from more than one
// character would collide multiple characters' items onto the same slot
// number. A single-character account has no such collision risk (that
// character's own slot numbering is already valid and collision-free),
// so its items are carried over with their existing slots untouched.
//
// FIX: this used to merge unconditionally and drop (with a log) any
// items beyond the bankSlots (96) cap -- silently discarding a player's
// items on a routine startup migration is a real data-loss risk. Instead,
// the combined item count across every character is checked against
// bankSlots *before* anything is merged: if it doesn't fit, this
// account's migration is aborted outright (nothing is written, "bank"
// stays unset) rather than truncated. loadUserBank()/saveUserBank()
// above both fall back to each character's own pre-existing
// p:<playerName> "bank" field whenever the account has no merged "bank"
// field, so an aborted account keeps working exactly as it did before
// this refactor -- it just doesn't get the shared-across-characters
// bank until it no longer needs the fallback. Since the "already
// migrated" skip check above is the "bank" field's presence, an aborted
// account is retried automatically on every subsequent startup, so one
// that later drops enough items to fit gets merged on a future restart
// with no manual intervention.
//
// Cleanup: once a merge actually succeeds for an account, every merged
// character's now-redundant p:<playerName> "bank" field is deleted (see
// mergeAndWrite() below) -- there's no fallback reason left to keep it
// once the shared "bank" field exists. An aborted account's
// per-character "bank" fields are deliberately left alone, since those
// are still the active data for that account.
//
// Uses the same scanKeys(...) helper as removeOldValues()/
// insertMissingPlayerKeys()/migrateGoldFields() above -- this one is
// heavier still (one extra read per character, not just per user), so
// avoiding a single blocking KEYS call matters even more here.
//
// `callback(err)` fires once every user has been checked (err is null on
// success).
function migrateBankToUser(callback) {
    client.scanKeys('u:*', (err, userKeys) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (userKeys.length === 0) {
            console.info(
                'migrateBankToUser: no users found, nothing to migrate.'
            );
            if (callback) callback(null);
            return;
        }

        let remaining = userKeys.length;
        let migratedCount = 0;
        let abortedCount = 0;
        let firstError = null;

        const checkDone = () => {
            remaining--;
            if (remaining === 0) {
                console.info(
                    'migrateBankToUser: complete -- migrated ' +
                        migratedCount +
                        ' of ' +
                        userKeys.length +
                        ' user(s), ' +
                        abortedCount +
                        ' left on the legacy per-character bank (too many combined items to fit one shared bank).'
                );
                if (callback) callback(firstError);
            }
        };

        for (const uKey of userKeys) {
            client
                .multi()
                .hget(uKey, 'bank')
                .hget(uKey, 'players')
                .exec((err, raw) => {
                    if (err) {
                        console.error(
                            'migrateBankToUser: read failed for ' +
                                uKey +
                                ': ' +
                                JSON.stringify(err)
                        );
                        firstError = firstError || err;
                        checkDone();
                        return;
                    }

                    const [existingBank, playersCsv] = raw;

                    if (existingBank != null) {
                        // Already on the new field -- nothing to migrate.
                        checkDone();
                        return;
                    }

                    const playerNames =
                        typeof playersCsv === 'string' && playersCsv !== ''
                            ? playersCsv.split(',')
                            : [];

                    if (playerNames.length === 0) {
                        // No characters at all yet -- nothing to merge, just seed an
                        // empty shared bank so this account counts as migrated.
                        client.hset(uKey, 'bank', '[]', (err) => {
                            if (err) {
                                console.error(
                                    'migrateBankToUser: write failed for ' +
                                        uKey +
                                        ': ' +
                                        JSON.stringify(err)
                                );
                                firstError = firstError || err;
                            } else {
                                migratedCount++;
                                console.debug(
                                    'migrateBankToUser: [debug] migrated ' +
                                        uKey +
                                        ' -- no characters yet, seeded empty shared bank.'
                                );
                            }
                            checkDone();
                        });
                        return;
                    }

                    let playersRemaining = playerNames.length;
                    const perPlayerBanks = new Array(playerNames.length);

                    const mergeAndWrite = () => {
                        // Check the combined total *before* merging anything -- see
                        // the FIX comment above migrateBankToUser() for why this
                        // aborts rather than truncates when it doesn't fit.
                        const totalItems = perPlayerBanks.reduce(
                            (sum, items) => sum + items.length,
                            0
                        );

                        if (totalItems > bankSlots) {
                            console.warn(
                                'migrateBankToUser: ' +
                                    uKey +
                                    ' has ' +
                                    totalItems +
                                    ' combined bank item(s) across ' +
                                    playerNames.length +
                                    ' character(s), more than the ' +
                                    bankSlots +
                                    '-slot shared ' +
                                    'bank can hold -- leaving this account on its existing ' +
                                    'per-character bank storage instead of merging.'
                            );
                            abortedCount++;
                            checkDone();
                            return;
                        }

                        let merged;
                        if (playerNames.length >= 2) {
                            // 2+ characters -- re-slot every item sequentially starting
                            // from 0 across all of them combined. item[0] was that
                            // character's own independent slot index, which would
                            // otherwise collide with an item already placed from an
                            // earlier character in this same merge.
                            merged = [];
                            for (const items of perPlayerBanks) {
                                for (const item of items) {
                                    merged.push([
                                        merged.length,
                                        ...item.slice(1)
                                    ]);
                                }
                            }
                        } else {
                            // Exactly one character -- nothing to collide with, so its
                            // existing slot numbering is carried over unchanged.
                            merged = perPlayerBanks[0].slice();
                        }

                        client.hset(
                            uKey,
                            'bank',
                            JSON.stringify(merged),
                            (err) => {
                                if (err) {
                                    console.error(
                                        'migrateBankToUser: write failed for ' +
                                            uKey +
                                            ': ' +
                                            JSON.stringify(err)
                                    );
                                    firstError = firstError || err;
                                    checkDone();
                                    return;
                                }

                                migratedCount++;
                                console.debug(
                                    'migrateBankToUser: [debug] migrated ' +
                                        uKey +
                                        ' -- merged ' +
                                        merged.length +
                                        ' item(s) across ' +
                                        playerNames.length +
                                        ' character(s): [' +
                                        playerNames.join(', ') +
                                        '].'
                                );

                                // The shared account-level bank is now the source of truth
                                // for this account -- each character's own p:<playerName>
                                // "bank" field is redundant from here on (loadUserBank()/
                                // saveUserBank() only ever fall back to it when the account
                                // has no "bank" field at all, which is no longer true), so
                                // clean up the stale per-character copies rather than
                                // leaving them behind.
                                let deleteRemaining = playerNames.length;
                                playerNames.forEach((playerName) => {
                                    client.hdel(
                                        'p:' + playerName,
                                        'bank',
                                        (err2) => {
                                            if (err2) {
                                                console.warn(
                                                    'migrateBankToUser: failed to delete stale p:' +
                                                        playerName +
                                                        ' bank field: ' +
                                                        JSON.stringify(err2)
                                                );
                                            }
                                            deleteRemaining--;
                                            if (deleteRemaining === 0) {
                                                checkDone();
                                            }
                                        }
                                    );
                                });
                            }
                        );
                    };

                    playerNames.forEach((playerName, i) => {
                        client.hget(
                            'p:' + playerName,
                            'bank',
                            (err, bankJson) => {
                                if (err) {
                                    console.error(
                                        'migrateBankToUser: read failed for p:' +
                                            playerName +
                                            ': ' +
                                            JSON.stringify(err)
                                    );
                                }

                                let items = [];
                                if (
                                    typeof bankJson === 'string' &&
                                    bankJson !== ''
                                ) {
                                    try {
                                        const parsed = JSON.parse(bankJson);
                                        if (Array.isArray(parsed)) {
                                            items = parsed;
                                        }
                                    } catch (parseErr) {
                                        console.warn(
                                            'migrateBankToUser: p:' +
                                                playerName +
                                                "'s bank JSON was invalid, treating as empty: " +
                                                parseErr.message
                                        );
                                    }
                                }
                                perPlayerBanks[i] = items;

                                playersRemaining--;
                                if (playersRemaining === 0) {
                                    mergeAndWrite();
                                }
                            }
                        );
                    });
                });
        }
    });
}

// One-time (idempotent, re-run-safe) migration: converts every user's
// account-level appearance data from the old u:<username> "looks2" field to
// the new "looks_b64" field. Pure re-encode, no value changes: the old
// field held Utils.LegacyBinArrayToBase64()'s comma-joined-32-bit-decimal-
// chunk format (shared/js/utils.js), and every stored string is decoded
// with Utils.LegacyBase64ToBinArray() -- the exact function (bugs and all)
// that has actually been reading this field in production, kept verbatim
// specifically so this migration reproduces it faithfully rather than
// "fixing" it and changing what a player sees (see the comment on
// Utils.LegacyBase64ToBinArray() itself, shared/js/utils.js, for why it's
// deliberately not corrected) -- then immediately re-encoded with
// Utils.BinArrayToBase64(), the new bit-packed-then-base64 codec, and
// written to "looks_b64". Whatever appearance a player currently sees is
// exactly what they'll still see after this runs; only the storage format
// underneath changes (roughly half the string length for the same data).
//
// Runs automatically at every startup (see migrationReady in the
// constructor, alongside migrateGoldFields()/migrateBankToUser()/
// purgeStaleNewQuests()), and is safe to run repeatedly: any user that
// already has a "looks_b64" field -- migrated on a previous startup, or
// created fresh straight into it (database/databaselogic.js's
// createUserValues() seeds new accounts directly with
// Utils.BinArrayToBase64()) -- is left untouched. An account with neither
// field (no character/appearance saved yet) is left alone too: there's
// nothing to convert, and DatabaseLogic.loadPlayerUserInfo()
// (database/databaselogic.js) already fills that gap from the in-memory
// user.looks default the moment such an account's player next saves.
//
// Same scanKeys('u:*', ...) shape as renameGold1ToBankGold()/
// migrateGold1ToUser()/migrateBankToUser() above, and independent of all
// three (a different field entirely) -- see the looksMigration Promise in
// the constructor (redis.js) for how it's chained alongside them rather
// than after any of them.
//
// `callback(err)` fires once every user has been checked (err is null on
// success).
function migrateLooksToBase64(callback) {
    client.scanKeys('u:*', (err, userKeys) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (userKeys.length === 0) {
            console.info(
                'migrateLooksToBase64: no users found, nothing to migrate.'
            );
            if (callback) callback(null);
            return;
        }

        let remaining = userKeys.length;
        let migratedCount = 0;
        let firstError = null;

        const checkDone = () => {
            remaining--;
            if (remaining === 0) {
                console.info(
                    'migrateLooksToBase64: complete -- migrated ' +
                        migratedCount +
                        ' of ' +
                        userKeys.length +
                        ' user(s).'
                );
                if (callback) callback(firstError);
            }
        };

        for (const uKey of userKeys) {
            client
                .multi()
                .hget(uKey, 'looks2')
                .hget(uKey, 'looks_b64')
                .exec((err, raw) => {
                    if (err) {
                        console.error(
                            'migrateLooksToBase64: read failed for ' +
                                uKey +
                                ': ' +
                                JSON.stringify(err)
                        );
                        firstError = firstError || err;
                        checkDone();
                        return;
                    }

                    const [looks2, existingLooksB64] = raw;

                    if (looks2 == null) {
                        // Nothing to convert -- already migrated (no
                        // "looks2" left), or a brand-new/never-saved account
                        // with no appearance data at all yet.
                        checkDone();
                        return;
                    }

                    // Defensive: shouldn't normally happen (an account is
                    // either still on "looks2" or already migrated to
                    // "looks_b64", never both), but if it does, don't
                    // silently discard whichever value loses -- log it so it
                    // can be investigated, then proceed with "looks2" (the
                    // field this migration exists to consume) as the source
                    // of truth, same as renameGold1ToBankGold() above does
                    // for its own equivalent case.
                    if (existingLooksB64 != null) {
                        console.warn(
                            'migrateLooksToBase64: ' +
                                uKey +
                                ' has both a "looks2" and an existing ' +
                                '"looks_b64" -- overwriting "looks_b64" with ' +
                                'the re-encoded "looks2" value and deleting ' +
                                '"looks2".'
                        );
                    }

                    let looksB64;
                    try {
                        const bits = Utils.LegacyBase64ToBinArray(
                            looks2,
                            AppearanceData.Data.length
                        );
                        looksB64 = Utils.BinArrayToBase64(bits);
                    } catch (decodeErr) {
                        console.error(
                            'migrateLooksToBase64: failed to decode "looks2" for ' +
                                uKey +
                                ', leaving it unmigrated: ' +
                                decodeErr.message
                        );
                        firstError = firstError || decodeErr;
                        checkDone();
                        return;
                    }

                    client
                        .multi()
                        .hset(uKey, 'looks_b64', looksB64)
                        .hdel(uKey, 'looks2')
                        .exec((err2) => {
                            if (err2) {
                                console.error(
                                    'migrateLooksToBase64: write failed for ' +
                                        uKey +
                                        ': ' +
                                        JSON.stringify(err2)
                                );
                                firstError = firstError || err2;
                                checkDone();
                                return;
                            }

                            migratedCount++;
                            checkDone();
                        });
                });
        }
    });
}

// ONE-TIME, MANUAL, ADMIN-TRIGGERED -- unlike every migration above, this is
// NOT wired into migrationReady (redis.js's constructor) and does not run on
// its own at startup. It's invoked explicitly, once, via the userserver
// admin console's "fixlegacylooks" command (see main.js) whenever an
// operator confirms it's actually needed -- same "defined here, deliberately
// not auto-run" shape as replaceSkills() above (which is also mixed into
// migrationMethods but only ever called manually).
//
// Handles accounts stuck on an appearance-data scheme older than
// "looks_b64": a plain u:<username> "looks" field (predating "looks2" too,
// and of unknown/undocumented format -- nothing in this codebase today
// reads or writes it) and/or a "looks2" field (the known
// comma-joined-32-bit-decimal-chunk format migrateLooksToBase64() above
// normally converts). In practice, by the time an operator can reach this
// through the admin console (main.js's "fixlegacylooks" command),
// migrateLooksToBase64() has already run at startup and converted every
// "looks2" it found -- so this exists for the accounts that fall through
// that anyway: ones a prior, narrower version of this function skipped
// because they had "looks2" as well as "looks" (see git history), or any
// other straggler that still has "looks" and/or "looks2" sitting around by
// the time this runs.
//
// Unlike migrateLooksToBase64(), this does NOT try to decode and preserve
// whatever's in "looks"/"looks2" -- "looks" isn't in a format any current
// code understands, and by design this function's job is to unconditionally
// clear out both legacy fields wherever they're found, not cherry-pick which
// one to trust. An account that has either field and no "looks_b64" yet is
// seeded with the same beginner-default appearance
// database/databaselogic.js's createUserValues() gives a brand-new account
// (item indices 0/50/77/151 "on", everything else "off"), encoded through
// the current Utils.BinArrayToBase64() codec, so it ends up in exactly the
// shape a fresh registration would have. An account that already has
// "looks_b64" (so it's already on the current scheme) keeps that value
// untouched -- only the stray "looks"/"looks2" leftovers are deleted from
// it.
//
// Every account with either legacy field, regardless of what else it has,
// gets both "looks" and "looks2" deleted (hdel on a field that isn't
// present is a harmless no-op, so this doesn't need to branch on which of
// the two actually exists).
//
// Safe to run repeatedly: an account with neither legacy field is skipped
// entirely (nothing to clean up), though it's expected to only ever need
// running once.
//
// `callback(err)` fires once every user has been checked (err is null on
// success).
function resetLegacyLooksToDefault(callback) {
    client.scanKeys('u:*', (err, userKeys) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (userKeys.length === 0) {
            console.info(
                'resetLegacyLooksToDefault: no users found, nothing to reset.'
            );
            if (callback) callback(null);
            return;
        }

        let remaining = userKeys.length;
        let resetCount = 0;
        let cleanedCount = 0;
        let firstError = null;

        const checkDone = () => {
            remaining--;
            if (remaining === 0) {
                console.info(
                    'resetLegacyLooksToDefault: complete -- reset ' +
                        resetCount +
                        ' of ' +
                        userKeys.length +
                        ' user(s) to the default appearance, and cleaned up ' +
                        cleanedCount +
                        ' already-migrated account(s) with a stray legacy field.'
                );
                if (callback) callback(firstError);
            }
        };

        for (const uKey of userKeys) {
            client
                .multi()
                .hget(uKey, 'looks')
                .hget(uKey, 'looks2')
                .hget(uKey, 'looks_b64')
                .exec((err, raw) => {
                    if (err) {
                        console.error(
                            'resetLegacyLooksToDefault: read failed for ' +
                                uKey +
                                ': ' +
                                JSON.stringify(err)
                        );
                        firstError = firstError || err;
                        checkDone();
                        return;
                    }

                    const [legacyLooks, looks2, looksB64] = raw;

                    // Nothing to do: neither legacy field present.
                    if (legacyLooks == null && looks2 == null) {
                        checkDone();
                        return;
                    }

                    // Always clear out both legacy fields wherever found
                    // (hdel on an absent field is a no-op) -- see the
                    // function comment above for why this doesn't try to
                    // decode/preserve either one.
                    const multi = client
                        .multi()
                        .hdel(uKey, 'looks')
                        .hdel(uKey, 'looks2');

                    // Only seed a default if this account doesn't already
                    // have a current "looks_b64" value -- an already-current
                    // account just gets its stray legacy field(s) cleaned up,
                    // not its real appearance overwritten.
                    const needsDefault = looksB64 == null;
                    if (needsDefault) {
                        const len = AppearanceData.Data.length;
                        const bits = new Uint8Array(len);
                        bits[0] = 1;
                        bits[50] = 1;
                        bits[77] = 1;
                        bits[151] = 1;
                        multi.hset(uKey, 'looks_b64', Utils.BinArrayToBase64(bits));
                    }

                    multi.exec((err2) => {
                        if (err2) {
                            console.error(
                                'resetLegacyLooksToDefault: write failed for ' +
                                    uKey +
                                    ': ' +
                                    JSON.stringify(err2)
                            );
                            firstError = firstError || err2;
                            checkDone();
                            return;
                        }

                        if (needsDefault) {
                            resetCount++;
                        } else {
                            cleanedCount++;
                        }
                        checkDone();
                    });
                });
        }
    });
}

// ONE-OFF, MANUAL, ADMIN-TRIGGERED, REPEATABLE -- unlike purgeStaleNewQuests()
// above, this is NOT wired into migrationReady (redis.js's constructor),
// doesn't run on its own at startup, and isn't gated behind a "run once
// ever" flag. It's invoked explicitly (see main.js's "wipenewquests" admin
// console command) whenever an operator wants to unconditionally clear
// every player's in-progress quest list right now -- e.g. after a
// quest-content change that leaves currently-saved 'newquests'/'newquests2'
// entries pointing at quest/NPC data that no longer exists or no longer
// matches, the same class of problem purgeStaleNewQuests() was built to
// clean up once for the npcQuestId format change, but here triggered on
// demand and re-runnable, rather than tied to that one historical migration
// and its self-disabling 'migrations:newquests_purged' flag.
//
// Deliberately has no flag and no staleness check -- every call wipes
// whatever's currently saved, not just leftovers from before some cutoff.
// That's the whole point (an operator decides when it's needed), so don't
// add a "already run" guard here the way purgeStaleNewQuests() has one --
// doing so would silently turn the second and every later intentional call
// into a no-op.
//
// Deletes both 'newquests' (the live saveQuests()/loadQuests() field) and
// 'newquests2' for every player key found via scanKeys('p:*', ...) -- same
// scan/multi-hdel shape as purgeStaleNewQuests() above. hdel on a field
// that isn't present is a harmless no-op, so players with no in-progress
// quests are simply skipped over (still counted, not treated as an error).
//
// `callback(err)` fires once every player has been checked -- err is the
// first error encountered, if any (every player is still attempted even if
// an earlier one fails).
function wipeAllNewQuests(callback) {
    client.scanKeys('p:*', (err, keys) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (keys.length === 0) {
            console.info(
                'wipeAllNewQuests: no players found, nothing to wipe.'
            );
            if (callback) callback(null);
            return;
        }

        let remaining = keys.length;
        let firstError = null;

        const checkDone = () => {
            remaining--;
            if (remaining === 0) {
                console.info(
                    'wipeAllNewQuests: complete -- wiped newquests for ' +
                        keys.length +
                        ' player(s).'
                );
                if (callback) callback(firstError);
            }
        };

        for (const pKey of keys) {
            client
                .multi()
                .hdel(pKey, 'newquests')
                .hdel(pKey, 'newquests2')
                .exec((err2) => {
                    if (err2) {
                        console.error(
                            'wipeAllNewQuests: hdel failed for ' +
                                pKey +
                                ': ' +
                                JSON.stringify(err2)
                        );
                        firstError = firstError || err2;
                    }
                    checkDone();
                });
        }
    });
}

// Mixed onto DatabaseHandler.prototype in redis.js (Object.assign, right
// after the class declaration) rather than exported/used individually, so
// every function above keeps running as an instance method -- called as
// `this.migrateGoldFields(...)` etc. from the constructor, exactly as
// before this file split out of redis.js.
export const migrationMethods = {
    replaceSkills,
    removeOldValues,
    purgeStaleNewQuests,
    insertMissingPlayerKeys,
    createPlayerKeys,
    migrateGoldFields,
    migrateGold1ToUser,
    renameGold1ToBankGold,
    migrateBankToUser,
    migrateLooksToBase64,
    resetLegacyLooksToDefault,
    wipeAllNewQuests
};
