/* global Types, log, client */

import crypto from 'crypto';
import fs from 'fs';
import redis from 'redis';
import bcrypt from 'bcrypt';

let client;

// Bank capacity -- matches userserver/js/format.js's getItemSlots(1) (type
// 1 = bank -> 96 slots). Duplicated here rather than imported since this
// file already duplicates small cross-cutting constants like this rather
// than reaching into format.js's validation layer (which is a different
// concern -- payload shape/range checking -- from this file's plain
// Redis reads/writes). Used by migrateBankToUser() below to decide whether
// an account's combined per-character bank items fit in one shared bank
// at the same size the gameserver/format.js already enforce per
// character.
const bankSlots = 96;

// Gold cap -- matches userserver/js/format.js's playerGoldMax, the same
// bound WU_SAVE_PLAYER_DATA's numberField(0, playerGoldMax) enforces on
// every gold_0/gold_1 save. Duplicated here for the same reason bankSlots
// above is (see that comment). Used by migrateGold1ToUser() below to
// decide whether an account's combined per-character gold_1 total still
// fits under the cap a future save could ever pass validation with.
const playerGoldMax = 999999999;

const hgetarray = function (hash, key, callback) {
    if (Array.isArray(key)) {
        const m = client.multi();
        for (let i = 0; i < key.length; ++i) {
            m.hget(hash, key[i]);
        }
        m.exec(callback);
    } else {
        client.hget(hash, key, callback);
    }
};

// TODO Array parseInt where appropriate.

// REFACTOR: this file used to also hold account/player *business logic*
// (createUser, removeUser, loadUser, createPlayer, createPlayerNameInUser,
// sendPlayers, transferOfflineGold, and the "gold" field sanitization
// decision) mixed in with plain Redis reads/writes. That logic now lives in
// accountlogic.js's AccountLogic class (exposed as the global `Accounts`,
// set up in main.js next to `DBH`), which calls back into the primitives
// below rather than touching `client` directly. DatabaseHandler here is
// meant to be just the data store/retrieval layer: given fixed parameters,
// do a Redis read or write and hand back the (mostly) raw result.
//
// Two categories of exception, both left in this file on purpose:
//  1. Redis-native *atomic* operations (modifyGold()'s HINCRBY,
//     addPlayerGoldOffline()'s HINCRBY, reserveUsername()/
//     reservePlayerNameLock()'s SADD/SET NX) -- these exist specifically to
//     avoid race conditions that were real, previously-fixed bugs in this
//     codebase (see the FIX comments on each). Their correctness depends on
//     running as a single Redis-side operation; pulling the surrounding
//     computation out into a separate JS-side "logic" layer that does a
//     plain get-then-set would silently reintroduce those races. The
//     *decision to call* them still lives in AccountLogic -- only the
//     atomic primitive itself stays here.
//  2. Bulk key-housekeeping/migration scripts (replaceSkills,
//     removeOldValues, insertMissingPlayerKeys, createPlayerKeys) -- these
//     only ever touch raw Redis keys (client.keys/del/hdel/sadd), never
//     reference `user`/`users`/`worldHandlers` or any app-level object, so
//     they're data-layer maintenance rather than account/session business
//     logic.
class DatabaseHandler {
    constructor(config) {
        // You may now connect a client to the Redis server bound to port 6379.
        client = redis.createClient(config.redis_port, config.redis_host, {
            socket_nodelay: true
        });
        client.auth(config.redis_password);
        client.on('error', (err) => {
            console.error('Redis error: ' + err);
        });
        // client.connect(); // v4

        client.hgetarray = hgetarray;
        this.ready = true;

        if (config.remove_old_values === 1) {
            this.removeOldValues();
            // FIX: this ran unconditionally on every server start (unlike
            // removeOldValues() above, which is opt-in via config). It calls
            // client.keys('p:*'), a blocking O(N) full-keyspace scan that stalls
            // the single-threaded Redis server proportional to key count -- with
            // any non-trivial player base this pauses Redis (and anything sharing
            // that instance) on every restart. Gated behind the same
            // remove_old_values flag as its sibling maintenance/migration task
            // above, since that's the existing "opt-in startup migration" pattern
            // in this file. A proper fix would use cursor-based SCAN instead of
            // KEYS regardless of whether it's gated.
            this.insertMissingPlayerKeys();
        }

        //this.replaceSkills();

        // Startup migrations -- unlike removeOldValues()/insertMissingPlayerKeys()
        // above, none of these are gated behind a config flag. Those are
        // opt-in housekeeping; these guarantee player data is on the current
        // storage scheme before anything can touch it, so they always run,
        // every startup. Constructing a DatabaseHandler is now the single place
        // that kicks them all off -- no call site elsewhere can forget to run
        // them.
        //
        // A constructor can't be awaited, so the in-progress migrations are
        // handed back as a single Promise instead of a constructor callback:
        // main.js does `await global.DBH.migrationReady` right after
        // `new DatabaseHandlerClass(config)` and doesn't proceed to accept
        // connections until it resolves (rejects straight through if either
        // migrateGoldFields()/migrateBankToUser() reports an error).
        //
        // REFACTOR: this used to also chain a migrateOfflineGold() step after
        // migrateGoldFields(), sweeping any "goldoffline" balance into the
        // shared account-level gold_1 in one startup pass. Removed: offline
        // gold's real destination is a player's own gold_0, not the shared
        // gold_1, and that fold now happens per-player at *load* time instead
        // (see loadPlayerInfo()'s FIX comment) -- which handles every account
        // eventually, migrated or not, online-only or not, without needing a
        // separate startup sweep or an account/gold_1-shaped migration at all.
        const goldMigration = new Promise((resolve, reject) => {
            this.migrateGoldFields((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        const bankMigration = new Promise((resolve, reject) => {
            this.migrateBankToUser((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        this.migrationReady = Promise.all([goldMigration, bankMigration]);
    }

    replaceSkills() {
        client.keys('p:*', (err, keys) => {
            if (err) return console.log(err);

            for (let i = 0, len = keys.length; i < len; i++) {
                const key = keys[i];
                console.info(key);
                if (key.startsWith('p:')) {
                    let j = 0;
                    client.hget(key, 'skills', (err, data) => {
                        //console.info(JSON.stringify(err));
                        const len = data.split(',').length;
                        //console.info("skills count:"+len);
                        //if (len !== 7) {
                        const k = keys[j++];
                        //console.info("resetting skills." + k);
                        client.hset(k, 'skills', '0,0,0,0,0,0,0');
                        //}
                    });
                }
            }
        });
    }

    removeOldValues() {
        client.del('b:bans');
        client.del('s:auction');
        client.del('l:looks');

        client.keys('b:bans-*', (err, keys) => {
            if (err) return console.log(err);

            for (const key of keys) {
                client.del(key);
            }
        });

        client.keys('s:auction-*', (err, keys) => {
            if (err) return console.log(err);

            for (const key of keys) {
                client.del(key);
            }
        });

        client.keys('l:looks-*', (err, keys) => {
            if (err) return console.log(err);

            for (const key of keys) {
                client.del(key);
            }
        });

        client.keys('p:*', (err, keys) => {
            if (err) return console.log(err);

            for (let i = 0, len = keys.length; i < len; i++) {
                const key = keys[i];
                console.info(key);
                if (key.startsWith('p:')) {
                    client.hdel(key, 'newquests');
                    client.hdel(key, 'newquests2');
                    client.hdel(key, 'completeQuests');
                    client.hdel(key, 'completeQuests2');
                }
            }
        });
    }

    insertMissingPlayerKeys() {
        client.keys('p:*', (err, keys) => {
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

    createPlayerKeys() {
        client.keys('p:*', (err, arr) => {
            for (const rec of arr) {
                console.info('rec=' + rec);
                const playerName = rec.substr(2);
                if (playerName.length > 0) {
                    client.sadd('player', playerName);
                }
            }
        });
    }

    ExistsUsername(name, callback) {
        return this.isNameInSet('usr', name, callback);
    }

    ExistsPlayerName(name, callback) {
        return this.isNameInSet('player', name, callback);
    }

    isNameInSet(setName, name, callback) {
        const nameLower = name.toLowerCase();
        client.smembers(setName, (err, reply) => {
            reply = reply.map((rec) => rec.toLowerCase());
            if (callback) {
                callback(name, reply.includes(nameLower));
            }
        });
    }

    // FIX: extracted straight out of createUser() (formerly in this file, now
    // AccountLogic.createUser() in accountlogic.js) so the atomic SADD -- the
    // actual fix for the username-registration race, see the FIX comment that
    // used to sit here -- stays a single Redis-side primitive. SADD is atomic
    // in Redis (returns 0 if the member was already present), which is what
    // makes it safe as a "reserve this name" operation under concurrent
    // requests; a non-atomic check-then-write in a separate logic layer would
    // reintroduce that race.
    reserveUsername(name, callback) {
        client.sadd('usr', name, (err, added) => {
            if (callback) {
                callback(name, !err && !!added, err);
            }
        });
    }

    unreserveUsername(name, callback) {
        client.srem('usr', name, (err, removed) => {
            if (callback) {
                callback(name, !err, err);
            }
        });
    }

    savePlayerUserInfo(username, playerName, data, callback) {
        const uKey = 'u:' + username;
        client
            .multi()
            .sadd('usr', username)
            .hset(uKey, 'gems', data[0])
            .hset(uKey, 'looks2', data[1])
            .exec((err, replies) => {
                if (callback) {
                    callback(username, playerName, data);
                }
            });
    }

    saveUserInfo(username, data, callback) {
        const uKey = 'u:' + username;

        client
            .multi()
            .sadd('usr', username)
            .hset(uKey, 'username', username)
            .hset(uKey, 'hash', data[0])
            .hset(uKey, 'salt', data[1])
            .hset(uKey, 'banTime', data[2])
            .hset(uKey, 'banDuration', data[3])
            .hset(uKey, 'lastLoginTime', data[4])
            .hset(uKey, 'membership', data[5])
            .hset(uKey, 'players', data[6])
            .hset(uKey, 'gems', data[7])
            .hset(uKey, 'looks2', data[8])
            .hset(uKey, 'ipAddresses', data[9])
            .exec((err, replies) => {
                if (callback) {
                    callback(username, data);
                }
            });
    }

    // FIX: only ever saved `hash`, never `salt`. checkUser() (user.js) verifies
    // logins as sha1(password + db_user.salt), using whatever salt is already
    // on the account -- so a hash computed with a brand-new salt (as main.js's
    // changePassword admin command now does, matching createUser()'s pattern
    // of always minting a fresh salt for a fresh credential) would never
    // verify against the old salt still stored here. Save both together so
    // the two stay consistent.
    savePassword(username, hash, salt) {
        const uKey = 'u:' + username;
        client.hset(uKey, 'hash', hash);
        client.hset(uKey, 'salt', salt);
    }

    deleteUserRecord(username, callback) {
        const uKey = 'u:' + username;
        client.del(uKey, (err) => {
            if (callback) {
                callback(username, !err, err);
            }
        });
    }

    deletePlayerRecord(playerName, callback) {
        const pKey = 'p:' + playerName;
        client.del(pKey, (err) => {
            if (callback) {
                callback(playerName, !err, err);
            }
        });
    }

    loadUserInfo(username, callback) {
        const uKey = 'u:' + username;

        client.hgetall(uKey, (err, data) => {
            console.info('replies: ' + data);
            console.info(JSON.stringify(data));
            if (data === null || !(typeof data === 'object')) {
                return;
            }

            if (callback) {
                callback(username, data);
            }
        });
    }

    getUserPlayerNames(username, callback) {
        const uKey = 'u:' + username;
        client.hget(uKey, 'players', (err, reply) => {
            if (callback) {
                callback(username, reply);
            }
        });
    }

    setUserPlayerNames(username, csv, callback) {
        const uKey = 'u:' + username;
        client.hset(uKey, 'players', csv, (err) => {
            if (callback) {
                callback(username, !err, err);
            }
        });
    }

    getPlayerSummaryFields(playerName, callback) {
        const pKey = 'p:' + playerName;
        const keyArray = ['name', 'map', 'exps', 'colors', 'sprites'];
        hgetarray(pKey, keyArray, (err, reply) => {
            if (callback) {
                callback(playerName, err, reply);
            }
        });
    }

    setUserIpAddresses(username, value, callback) {
        const uKey = 'u:' + username;
        client.hset(uKey, 'ipAddresses', value, (err) => {
            if (callback) {
                callback(username, !err, err);
            }
        });
    }

    setUserLastLoginTime(username, value, callback) {
        const uKey = 'u:' + username;
        client.hset(uKey, 'lastLoginTime', value, (err) => {
            if (callback) {
                callback(username, !err, err);
            }
        });
    }

    // FIX: extracted straight out of createPlayer() (formerly in this file,
    // now AccountLogic.createPlayer() in accountlogic.js) so the atomic SET
    // NX EX -- the actual fix for the player-name-registration race, see the
    // FIX comment that used to sit here -- stays a single Redis-side
    // primitive. A short-lived, self-expiring reservation lock (NX = only if
    // not already set, EX = auto-expire) is what closes the multi-second
    // window between checking a name is free and that player's data actually
    // being saved; a non-atomic check-then-write in a separate logic layer
    // would reintroduce that race.
    reservePlayerNameLock(name, ttlSeconds, callback) {
        const nameLower = name.toLowerCase();
        client.set(
            'player_pending:' + nameLower,
            '1',
            'NX',
            'EX',
            ttlSeconds,
            (err, lockRes) => {
                if (callback) {
                    callback(name, !err && !!lockRes, err);
                }
            }
        );
    }

    // FIX: used to take the full `user` object (reading user.name/user.looks
    // directly) and apply a default-fill for a missing "looks2" value inline.
    // That default-fill is a business-logic decision (accountlogic.js's
    // AccountLogic.loadPlayerUserInfo() now makes it, using the same
    // user.looks fallback), not a data-retrieval concern -- this just takes a
    // plain username and hands back the raw [gems, looks2] pair.
    loadPlayerUserInfo(username, callback) {
        const uKey = 'u:' + username;

        client
            .multi()
            .hget(uKey, 'gems')
            .hget(uKey, 'looks2')
            .exec((err, data) => {
                if (data === null || !(typeof data === 'object')) {
                    return;
                }

                if (callback) {
                    callback(username, data);
                }
            });
    }

    // FIX: used to also repair a malformed "gold" field inline -- that repair
    // decision moved out to AccountLogic.loadPlayerInfo() (accountlogic.js)
    // and has since been removed there entirely (there's no remaining path
    // that can put a negative/malformed value into gold_0/gold_1 in the
    // first place -- see the FIX comment on AccountLogic.loadPlayerInfo() for
    // the full reasoning). This just hands back the raw hget results.
    //
    // REFACTOR: "gold" used to be a single Redis hash field packing both
    // currency types into one CSV string ("100,50"), which is why modifyGold()
    // below needed a full Lua script instead of a plain atomic HINCRBY --
    // HINCRBY can't target "just type 1" inside a packed string. Storage is
    // now two separate integer fields, gold_0/gold_1, each of which HINCRBY
    // can update natively and atomically with no scripting at all.
    //
    // REFACTOR: gold_1 (unlike gold_0) is account-level now (u:<username>
    // "gold_1" field), shared across every character on the account, the same
    // way bank moved to the account level -- see migrateGold1ToUser() below
    // for the one-time migration that combines each account's existing
    // per-character gold_1 values into this shared field, and the FIX comment
    // there for why some accounts stay on the legacy per-character field
    // instead. `username` is needed here (in addition to `playerName`) purely
    // to read that shared field; if the account has no merged "gold_1" yet
    // (not migrated, or migrateGold1ToUser() aborted for it), this falls back
    // to this character's own pre-existing p:<playerName> "gold_1" field so
    // nothing appears to have vanished -- same fallback pattern as
    // loadUserBank() below.
    //
    // gold_0/gold_1 are handed back completely unparsed here -- whatever's
    // actually stored, string or null. Parsing them into real ints is a
    // data-manipulation decision, so it happens in
    // AccountLogic.loadPlayerInfo() (accountlogic.js), not here -- matching
    // this file's "primitives only" convention (see the REFACTOR comment at
    // the top of this file). The WU_SAVE_PLAYER_DATA wire format and
    // gameserver's userhandler.js/player.js read gold_0/gold_1 as two flat
    // elements now (not a combined string, and not a nested array either), so
    // the shape handed back here -- gold_0/gold_1 as two separate positions in
    // the same 12-element record as before -- already matches the wire format
    // 1:1; AccountLogic.loadPlayerInfo() only needs to convert the two raw
    // strings to numbers, no reshaping, even though gold_1's underlying Redis
    // key is now sometimes a different hash than the rest of this record.
    //
    // Migration: this used to also detect-and-repair a still-legacy player
    // right here on read (split the packed "gold" field and persist gold_0/
    // gold_1 the first time that player loaded). That per-load fallback is
    // gone now -- migrateGoldFields() below runs a one-time full-keyspace
    // pass at every server startup, and main.js blocks accepting any new
    // connection until it finishes (see migrationComplete in main.js). By the
    // time any player can log in and reach this function, gold_0/gold_1 are
    // guaranteed to already exist somewhere (account-level or per-character),
    // so there's nothing left to detect or repair here.
    //
    // FIX: also reads "goldoffline" (addPlayerGoldOffline(), below) here, in
    // the same multi/exec as the rest of this record, and atomically clears
    // it in that same multi (the hdel is unconditional and a no-op if
    // nothing was staged) -- handed back raw as a 13th array element rather
    // than folded into gold_0 here. Reading and clearing together, in one
    // multi, is what actually matters at this primitives layer: it closes
    // the race takeGoldOffline()/addGoldOffline() used to exist to close (a
    // concurrent addPlayerGoldOffline() HINCRBY landing in the gap between a
    // separate "read" and a separate "clear" would get silently wiped out by
    // that clear, never folded in). What to *do* with that raw amount --
    // adding it to gold_0 and persisting the credit -- is a data-manipulation
    // decision, so it's left to AccountLogic.loadPlayerInfo() (accountlogic.js)
    // to make, matching this file's "primitives only" convention (see the
    // REFACTOR comment at the top of this file, and the one further up this
    // function for gold_0/gold_1 themselves).
    loadPlayerInfo(username, playerName, callback) {
        const pKey = 'p:' + playerName;
        const uKey = 'u:' + username;

        client.hdel(pKey, 'skillSlots');
        client
            .multi()
            .hget(pKey, 'name')
            .hget(pKey, 'map')
            .hget(pKey, 'stats')
            .hget(pKey, 'exps')
            .hget(pKey, 'gold_0')
            .hget(uKey, 'gold_1')
            .hget(pKey, 'gold_1')
            .hget(pKey, 'goldoffline')
            .hdel(pKey, 'goldoffline')
            .hget(pKey, 'skills')
            .hget(pKey, 'pStats')
            .hget(pKey, 'sprites')
            .hget(pKey, 'colors')
            .hget(pKey, 'shortcuts')
            .hget(pKey, 'completeQuests')
            .exec((err, raw) => {
                if (raw === null || !(typeof raw === 'object')) {
                    return;
                }

                const [
                    name,
                    map,
                    stats,
                    exps,
                    gold0,
                    userGold1,
                    legacyGold1,
                    goldOffline,
                    ,
                    /* hdel("goldoffline") reply, unused */ skills,
                    pStats,
                    sprites,
                    colors,
                    shortcuts,
                    completeQuests
                ] = raw;

                // Prefer the shared account-level value; fall back to this
                // character's own legacy field if the account hasn't been merged
                // (see the REFACTOR comment above).
                const gold1 = userGold1 != null ? userGold1 : legacyGold1;

                // Same 12-element shape as before (matches the WU_SAVE_PLAYER_DATA
                // wire format 1:1 -- see the REFACTOR comment above), plus the raw
                // "goldoffline" value appended as a 13th element purely for
                // AccountLogic.loadPlayerInfo() to consume; that caller trims it
                // back off before this ever reaches the wire (see its own comment).
                const result = [
                    name,
                    map,
                    stats,
                    exps,
                    gold0,
                    gold1,
                    skills,
                    pStats,
                    sprites,
                    colors,
                    shortcuts,
                    completeQuests,
                    goldOffline
                ];

                if (callback) {
                    callback(playerName, result);
                }
            });
    }

    // Runs once at every server startup -- kicked off unconditionally from
    // the constructor above (see migrationReady there), which main.js awaits
    // before it opens itself up to new connections (see migrationComplete in
    // main.js). Does the legacy "gold" -> gold_0/gold_1 split for every
    // player in one pass, rather than leaving it to whichever player happened
    // to log in next. Same client.keys('p:*', ...) full-keyspace scan already
    // used by removeOldValues()/insertMissingPlayerKeys() above (same caveat:
    // this blocks the single-threaded Redis server for O(N) key count -- fine
    // at the player counts this codebase has run with, would want
    // cursor-based SCAN instead of KEYS at much larger scale).
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
    migrateGoldFields(callback) {
        client.keys('p:*', (err, keys) => {
            if (err) {
                if (callback) callback(err);
                return;
            }

            if (keys.length === 0) {
                console.info(
                    'migrateGoldFields: no players found, nothing to migrate.'
                );
                this.migrateGold1ToUser(callback);
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
                    this.migrateGold1ToUser((err2) => {
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
                        // (AccountLogic.savePlayerInfo() -> this.savePlayerInfo()
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
    // Combine strategy: every character's own gold_1 is summed (order doesn't
    // matter here the way it does for migrateBankToUser()'s items -- plain
    // numbers have no slot to collide over, only a total).
    //
    // FIX-equivalent (same shape as migrateBankToUser()'s slot-cap check): if
    // the combined total would exceed playerGoldMax (userserver/js/format.js)
    // -- the same cap WU_SAVE_PLAYER_DATA's numberField(0, playerGoldMax)
    // already enforces on every future gold_1 save -- writing that total
    // would leave the account with a value no legitimate save could ever pass
    // validation with again. So exactly like the bank's slot-cap case, this
    // aborts (leaves "gold_1" unset) rather than writing an out-of-range
    // total; loadPlayerInfo()/savePlayerInfo() above both fall back to each
    // character's own p:<playerName> "gold_1" field whenever the account has
    // no merged field, so an aborted account keeps working exactly as it did
    // before. Retried automatically every startup (same "gold_1" field
    // presence check), so an account that later drops enough gold to fit
    // combines on a future restart with no manual intervention.
    //
    // Cleanup: once a combine actually succeeds for an account, every
    // combined character's now-redundant p:<playerName> "gold_1" field is
    // deleted -- there's no fallback reason left to keep it once the shared
    // "gold_1" field exists. An aborted account's per-character "gold_1"
    // fields are deliberately left alone, since those are still the active
    // data for that account.
    //
    // Same client.keys(...) full-keyspace scan caveat as
    // removeOldValues()/insertMissingPlayerKeys()/migrateGoldFields()/
    // migrateBankToUser() above.
    //
    // `callback(err)` fires once every user has been checked (err is null on
    // success).
    migrateGold1ToUser(callback) {
        client.keys('u:*', (err, userKeys) => {
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
            let abortedCount = 0;
            let firstError = null;

            const checkDone = () => {
                remaining--;
                if (remaining === 0) {
                    console.info(
                        'migrateGold1ToUser: complete -- combined ' +
                            migratedCount +
                            ' of ' +
                            userKeys.length +
                            ' user(s), ' +
                            abortedCount +
                            ' left on the legacy per-character gold_1 (combined total exceeds ' +
                            playerGoldMax +
                            ').'
                    );
                    if (callback) callback(firstError);
                }
            };

            for (const uKey of userKeys) {
                client
                    .multi()
                    .hget(uKey, 'gold_1')
                    .hget(uKey, 'players')
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

                        const [existingGold1, playersCsv] = raw;

                        if (existingGold1 != null) {
                            // Already on the new field -- nothing to combine.
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
                                                    ' cap -- leaving this account on its existing per-character ' +
                                                    'gold_1 instead of combining.'
                                            );
                                            abortedCount++;
                                            checkDone();
                                            return;
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

                                                // The shared account-level gold_1 is now the source of
                                                // truth for this account -- each character's own
                                                // p:<playerName> "gold_1" field is redundant from here
                                                // on (loadPlayerInfo()/savePlayerInfo() only ever fall
                                                // back to it when the account has no "gold_1" field at
                                                // all, which is no longer true), so clean up the stale
                                                // per-character copies rather than leaving them behind.
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

    // REFACTOR: this file used to also have a migrateOfflineGold() migration
    // here, run once at startup right after migrateGoldFields(), sweeping any
    // pre-existing "goldoffline" balance into the shared account-level
    // gold_1. Removed along with addGoldOffline()/transferOfflineGold() --
    // offline gold's destination is a player's own gold_0, not gold_1, and
    // "goldoffline" now gets read, atomically cleared, and folded into gold_0
    // (AccountLogic.loadPlayerInfo(), accountlogic.js, using the raw value
    // loadPlayerInfo() above hands back) for any player the moment they next
    // load, migrated account or not, so there's no leftover balance a
    // separate startup sweep still needs to catch, and no gold_1-shaped
    // migration left to write.

    // REFACTOR: expects gold already split into two elements -- data[4] =
    // gold_0, data[5] = gold_1 -- matching the WU_SAVE_PLAYER_DATA wire
    // format, which now sends gold_0/gold_1 as two flat elements (not a
    // combined "100,50" string, and not a nested array either -- see
    // gameserver's worldhandler.js and userserver/js/format.js's gold check).
    // Since the wire shape and this function's expected shape are identical,
    // AccountLogic.savePlayerInfo() (accountlogic.js) -- the only caller (see
    // worldhandler.js, which calls Accounts.savePlayerInfo() rather than this
    // method directly) -- is now a pure passthrough with no parsing or
    // reshaping of its own. The legacy "gold" field is intentionally left
    // untouched (not written) going forward now that gold_0/gold_1 are the
    // source of truth.
    //
    // REFACTOR: gold_1 is account-level now -- see the REFACTOR comment on
    // loadPlayerInfo() above for the full rationale. `username` is needed
    // here (in addition to `playerName`) to know which hash gold_1 belongs
    // in: the shared u:<username> "gold_1" field if this account has been
    // merged, or this character's own legacy p:<playerName> "gold_1" field if
    // not (mirroring saveUserBank()'s existing/legacy check below). Every
    // character on a merged account writes to the same shared field, so
    // whichever character saves last "wins" -- the same last-write-wins
    // tradeoff saveUserBank() already accepts for the shared bank.
    savePlayerInfo(username, playerName, data, callback) {
        const pKey = 'p:' + playerName;
        const uKey = 'u:' + username;

        client.hget(uKey, 'gold_1', (err, existingGold1) => {
            if (err) {
                console.warn('redis.savePlayerInfo: ' + JSON.stringify(err));
            }

            const gold1Key = existingGold1 != null ? uKey : pKey;

            client
                .multi()
                .sadd('player', data[0])
                .hset(pKey, 'name', data[0])
                .hset(pKey, 'map', data[1])
                .hset(pKey, 'stats', data[2])
                .hset(pKey, 'exps', data[3])
                .hset(pKey, 'gold_0', data[4])
                .hset(gold1Key, 'gold_1', data[5])
                .hset(pKey, 'skills', data[6])
                .hset(pKey, 'pStats', data[7])
                .hset(pKey, 'sprites', data[8])
                .hset(pKey, 'colors', data[9])
                .hset(pKey, 'shortcuts', data[10])
                .hset(pKey, 'completeQuests', data[11])
                .exec((err2, replies) => {
                    if (err2) {
                        console.warn(err2);
                        console.warn(JSON.stringify(replies));
                        return;
                    }

                    if (callback) {
                        callback(playerName);
                    }
                });
        });
    }

    // FIX: was hget -> compute new value in JS -> hset, a classic
    // read-modify-write race. Two concurrent calls for the same player (e.g.
    // two auction settlements landing close together) could both read the
    // same starting value, and the second write clobbers the first's change --
    // a lost update that silently drops gold instead of adding it. HINCRBY is
    // atomic in Redis, so use it instead of a manual get-then-set round trip.
    //
    // FIX: used to check the field exists first via hexists (HINCRBY on a
    // missing field would just create it at goldAmount, which used to mask a
    // real "no record for this player" error condition, back when
    // "goldoffline" was expected to already exist on every real player). That
    // assumption no longer holds: loadPlayerInfo() (below) now hdels this
    // field entirely on every login (not resets it to 0) as part of reading
    // it -- so a real player can legitimately have no "goldoffline" field at
    // all between logging in and the next credit landing here. Requiring it
    // to pre-exist would silently drop exactly the credits this function
    // exists to stage. HINCRBY on a missing field self-heals by creating it
    // at goldAmount instead -- same tradeoff modifyGold() below already
    // accepts, and for the same reason: a genuinely bogus playerName here
    // would still fail well before this call (there's no path that reaches
    // WU_ADD_PLAYER_GOLD for a name nothing ever created).
    //
    // REFACTOR: this used to be a two-step design -- stage into "goldoffline"
    // here, then a separate getGoldOffline()/resetGoldOffline() (later
    // takeGoldOffline()/addGoldOffline()) pair read it back out and credited
    // gold_0 once the player's next save completed. That whole second half is
    // gone: "goldoffline" is now read back out and atomically cleared by
    // loadPlayerInfo() below (part of its normal per-login read), and folded
    // into gold_0 by AccountLogic.loadPlayerInfo() (accountlogic.js) --
    // see loadPlayerInfo()'s FIX comment (below) for why load time, not save
    // time, is what actually closes the "live session's autosave clobbers the
    // credit" race. This function's own job hasn't changed -- still just
    // atomically add goldAmount to "goldoffline" -- there's simply no
    // separate addGoldOffline()/transferOfflineGold() left to call afterward.
    addPlayerGoldOffline(playerName, goldAmount) {
        console.info('redis.addPlayerGoldOffline: playerName:' + playerName);
        console.info('goldAmount:' + goldAmount);

        const pKey = 'p:' + playerName;
        client.hincrby(pKey, 'goldoffline', goldAmount, (err, total) => {
            if (err) {
                console.warn(
                    'redis.addPlayerGoldOffline: save error, ' +
                        JSON.stringify(err)
                );
                return;
            }
            // Preserve the previous Math.max(0, ...) clamp -- goldAmount can be
            // negative (a deduction), and this field should never go below 0.
            if (total < 0) {
                client.hset(pKey, 'goldoffline', 0, (err) => {
                    if (err) {
                        console.warn(
                            'redis.addPlayerGoldOffline: clamp error, ' +
                                JSON.stringify(err)
                        );
                    }
                });
            }
        });
    }

    // FIX: was hget -> compute new CSV string in JS -> hset, a classic
    // read-modify-write race. Two concurrent modifyGold calls for the same
    // player (e.g. two auction settlements landing close together) could both
    // read the same starting "gold" string and the second write clobbers the
    // first's change -- a lost update that silently drops gold instead of
    // adding/subtracting it. This originally needed a Lua script instead of a
    // plain HINCRBY because both currency types were packed into one
    // comma-separated "gold" field, and HINCRBY can't target "just type 1"
    // inside a packed string.
    //
    // REFACTOR: now that each type is its own real storage field
    // (gold_0/gold_1 -- see the REFACTOR comment on loadPlayerInfo() above),
    // HINCRBY is natively atomic in Redis on its own -- same guarantee as the
    // Lua script (no other client's command can interleave with a single
    // Redis command any more than it could with a Lua script), one round
    // trip, no scripting, and no CSV parsing left to get wrong (the Lua
    // gmatch `*`-vs-`+` bug this used to have a FIX comment about is no
    // longer possible -- there's no string to split/join here at all).
    modifyGold(playerName, golddiff, type, callback) {
        console.info('redis.modifyGold: playerName:' + playerName);
        console.info('golddiff:' + golddiff);
        console.info('type:' + type);

        type = type || 0;
        golddiff = parseInt(golddiff);
        const pKey = 'p:' + playerName;
        const field = 'gold_' + type;

        client.hincrby(pKey, field, golddiff, (err, total) => {
            if (err) {
                console.warn(
                    'redis.modifyGold: save gold error ' + JSON.stringify(err)
                );
                if (callback) {
                    callback(playerName, golddiff, type);
                }
                return;
            }

            // NOTE: unlike the old Lua version's `if not data ... return nil`
            // check, HINCRBY on a field that doesn't exist yet simply creates it
            // starting from 0 rather than reporting "no record" -- gold_0/gold_1
            // are always created by savePlayerInfo()/loadPlayerInfo()'s migration
            // path before a real player ever reaches this call, so this is a
            // behavior improvement (self-heals a missing field instead of
            // silently no-op'ing the update) rather than a loss of a check that
            // was actually relied on.
            console.info('modifyGold.gold: ' + JSON.stringify(total));
            if (callback) {
                callback(playerName, golddiff, type);
            }
        });
    }

    modifyGems(username, diff) {
        const uKey = 'u:' + username;
        diff = parseInt(diff);

        client.hget(uKey, 'gems', (err, data) => {
            let gems = parseInt(data);
            gems += diff;
            client.hset(uKey, 'gems', gems);
        });
    }

    // ITEMS - BEGIN. New item store functions.

    // FIX: worldhandler.js's call sites (inventory/bank/equipment, back when
    // all three were per-character) briefly passed a 5th "maxNumber" argument
    // -- (playername, type, storeType, maxNumber, callback) -- while this
    // only declared 4 params, which silently bound maxNumber (e.g. 50) to
    // this method's `callback` parameter and dropped the real callback
    // function entirely, throwing "callback is not a function" on every
    // player login. worldhandler.js's call sites no longer pass maxNumber (it
    // was never used here anyway), so this stays at 4 params to match.
    //
    // REFACTOR: bank moved to the account level (see loadUserBank()/
    // saveUserBank()/migrateBankToUser() below) -- this is now only used for
    // inventory and equipment, both still genuinely per-character.
    loadItems(playerName, type, storeType, callback) {
        const pKey = 'p:' + playerName;

        client.hget(pKey, storeType, (err, data) => {
            if (err || !data || data === '') {
                console.warn(err);
                console.warn(JSON.stringify(data));
                return;
            }
            if (callback) {
                callback(playerName, data);
            }
        });
    }

    saveItems(playerName, type, storeType, data, callback) {
        const pKey = 'p:' + playerName;
        console.info('saveItems: ' + data);
        console.info('pKey: ' + pKey);
        console.info('storeType: ' + storeType);
        client.hset(pKey, storeType, data, (err, replies) => {
            if (err || !data || data === '') {
                console.warn(err);
                console.warn(JSON.stringify(replies));
                console.warn(JSON.stringify(data));
                return;
            }
            if (callback) {
                callback(playerName);
            }
        });
    }

    // BANK -- account-level (u:<username> "bank" field) for accounts
    // migrateBankToUser() below was able to merge, not per-character. A user
    // can have up to maxPlayersPerUser (format.js) characters, and bank is
    // meant to be shared across all of them rather than siloed per character
    // the way inventory/equipment (loadItems()/saveItems() above) still are.
    // See migrateBankToUser() below for the one-time migration that
    // consolidates each account's existing per-character bank contents into
    // this shared field, and worldhandler.js's createPlayerToWorld()/
    // sendPlayerToWorld()/handleSavePlayerData() for the call sites.
    //
    // Not every account necessarily ends up on the shared field, though:
    // migrateBankToUser() refuses to merge (and leaves the "bank" field
    // unset) for an account whose characters' combined bank items don't fit
    // in one shared bank -- see the FIX comment on mergeAndWrite() there.
    // loadUserBank()/saveUserBank() both need `playerName` (in addition to
    // `username`) so they can fall back to that one character's own
    // p:<playerName> "bank" field in that case -- the account keeps working
    // exactly as it did before this refactor, just without the
    // shared-across-characters convenience.
    //
    // FIX: unlike loadItems() -- which is only ever called for a character
    // that's always already had "[]" (or real item JSON) saved for it --
    // this can legitimately be called for a brand-new user account with no
    // "bank" field yet (the very first character ever created on that
    // account, in createPlayerToWorld()). Silently not calling back on
    // missing data (loadItems()'s convention, meant for data that should
    // always already exist) would hang that character's create handshake
    // forever (checkLoadDataFull() would never reach its count of 7), so
    // this always calls back, defaulting to an empty bank rather than
    // treating "no bank yet" as an error.
    loadUserBank(username, playerName, callback) {
        const uKey = 'u:' + username;

        client.hget(uKey, 'bank', (err, data) => {
            if (err) {
                console.warn('redis.loadUserBank: ' + JSON.stringify(err));
            }

            if (data != null) {
                // Migrated -- the shared account-level bank is the source of
                // truth for this account.
                if (callback) {
                    callback(username, data);
                }
                return;
            }

            // No account-level bank yet: either this account hasn't been
            // migrated (migrateBankToUser() runs at every startup, so in
            // practice this means it just aborted the merge for this account --
            // see the FIX comment on mergeAndWrite() below), or this is a
            // brand-new account with no characters at all yet. Either way, this
            // character's own pre-existing p:<playerName> "bank" field is the
            // right place to read from, so nothing appears to have vanished.
            const pKey = 'p:' + playerName;
            client.hget(pKey, 'bank', (err2, legacyData) => {
                if (err2) {
                    console.warn(
                        'redis.loadUserBank (legacy fallback): ' +
                            JSON.stringify(err2)
                    );
                }
                if (callback) {
                    callback(username, legacyData || '[]');
                }
            });
        });
    }

    saveUserBank(username, playerName, data, callback) {
        const uKey = 'u:' + username;

        // Save wherever the matching loadUserBank() call would read from, so
        // the two stay consistent for an account migrateBankToUser() left on
        // the legacy per-character scheme -- see the comment above
        // loadUserBank() for why that can happen.
        client.hget(uKey, 'bank', (err, existing) => {
            if (err) {
                console.warn('redis.saveUserBank: ' + JSON.stringify(err));
            }

            const key = existing != null ? uKey : 'p:' + playerName;

            console.info('saveUserBank: ' + data);
            client.hset(key, 'bank', data, (err2, replies) => {
                if (err2 || !data || data === '') {
                    console.warn(err2);
                    console.warn(JSON.stringify(replies));
                    console.warn(JSON.stringify(data));
                    return;
                }
                if (callback) {
                    callback(username);
                }
            });
        });
    }

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
    // Same client.keys(...) full-keyspace scan caveat as
    // removeOldValues()/insertMissingPlayerKeys()/migrateGoldFields() above:
    // blocks the single-threaded Redis server for O(N) key count, and this
    // one is heavier still (one extra read per character, not just per
    // user) -- fine at the account/character counts this codebase has run
    // with, would want cursor-based SCAN instead of KEYS at much larger
    // scale.
    //
    // `callback(err)` fires once every user has been checked (err is null on
    // success).
    migrateBankToUser(callback) {
        client.keys('u:*', (err, userKeys) => {
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

    // ITEMS - END. End of Item Functions.

    // QUESTS - BEGIN. - TODO - Check quests variables (repeat needs to be removed.)
    // TODO - Just do new save rather than appending to key "quests".

    // example {id: id, type: 2, npcId: this.id, objectId: topEntity.kind, count: mobCount, repeat: repeat}
    saveQuests(playerName, data, callback) {
        const pKey = 'p:' + playerName;

        client.hset(pKey, 'newquests', data, (err, replies) => {
            if (err || !data || data === '') {
                console.warn(err);
                console.warn(JSON.stringify(replies));
                console.warn(JSON.stringify(data));
                return;
            }
            if (callback) {
                callback(playerName);
            }
        });
    }

    loadQuests(playerName, callback) {
        console.info('loadQuest');
        const pKey = 'p:' + playerName;

        client.hget(pKey, 'newquests', (err, data) => {
            if (err || !data || data === '') {
                console.warn(err);
                console.warn(JSON.stringify(data));
                data = [];
            }
            console.info(pKey);
            console.info('getItems - data=' + data);
            if (callback) {
                callback(playerName, data);
            }
        });
    }
    // QUESTS - END.

    // ACHIEVEMENTS - START.
    saveAchievements(playerName, data, callback) {
        console.info('saveAchievement');
        const pKey = 'p:' + playerName;
        client.hset(pKey, 'achievements', data, (err, replies) => {
            if (err) {
                console.warn(err);
                console.warn(JSON.stringify(replies));
                console.warn(JSON.stringify(data));
                return;
            }
            if (callback) {
                callback(playerName);
            }
        });
    }

    loadAchievements(playerName, callback) {
        console.info('loadAchievement');
        const pKey = 'p:' + playerName;
        client.hget(pKey, 'achievements', (err, data) => {
            if (err || !data || data === '') {
                console.warn(err);
                console.warn(JSON.stringify(data));
                return;
            }
            if (callback) {
                callback(playerName, data);
            }
        });
    }
    // ACHIEVEMENTS - END.

    // AUCTION DATABASE CALLS.
    loadAuctions(worldKey, callback) {
        const key = 's:auction-' + worldKey;
        client.smembers(key, (err, reply) => {
            if (err || reply === null || !(typeof reply === 'object')) {
                console.warn('loadAuctions - err: ' + JSON.stringify(err));
                console.warn('loadAuctions - data: ' + JSON.stringify(reply));
                return;
            }
            if (callback) {
                callback(worldKey, reply);
            }
            return;
        });
    }

    saveAuctions(worldKey, data, callback) {
        console.info('redis - saveAuctions: ' + JSON.stringify(data));
        const key = 's:auction-' + worldKey;
        client.del(key);
        const multi = client.multi();
        const exec = data.length > 0;
        for (let i = 0; i < data.length; ++i) {
            multi.sadd(key, data[i]);
        }
        if (exec) {
            multi.exec((err, reply) => {
                if (err) {
                    console.error(
                        'redis - saveAuctions: ' + JSON.stringify(err)
                    );
                    return;
                }
                if (callback) {
                    callback(worldKey, reply);
                }
            });
        }
    }
    // END AUCTION DB CALLS.

    // START LOOKS DB CALLS.
    loadLooks(worldKey, callback) {
        const key = 'l:looks-' + worldKey;
        client.hget(key, 'prices', (err, reply) => {
            if (err || !reply || reply === '') {
                console.warn(err);
                console.warn(JSON.stringify(reply));
                return;
            }
            if (reply) {
                //data = data.split(",");
                if (callback) {
                    callback(worldKey, reply);
                }
            }
        });
    }

    saveLooks(worldKey, looks, callback) {
        console.info('redis - saveLooks: ' /*+JSON.stringify(looks)*/);
        const key = 'l:looks-' + worldKey;
        client.del(key);
        client.hset(key, 'prices', looks.join(','), (err, reply) => {
            if (err) {
                console.error('redis - saveLooks:' + JSON.stringify(err));
                return;
            }
            if (callback) {
                callback(worldKey, reply);
            }
        });
    }
    // END LOOKS DB CALLS.

    // BANNED USERS
    loadBans(worldKey, callback) {
        const key = 'b:bans-' + worldKey;
        client.smembers(key, (err, reply) => {
            if (err || reply === null || !(typeof reply === 'object')) {
                console.warn('loadBans - err: ' + JSON.stringify(err));
                console.warn('loadBans - data: ' + JSON.stringify(reply));
                return;
            }
            if (callback) {
                callback(worldKey, reply);
            }
            return;
        });
    }

    saveBans(worldKey, data, callback) {
        console.info('redis - saveBans: ' /*+JSON.stringify(data)*/);

        const key = 'b:bans-' + worldKey;
        client.del(key);
        if (data.length === 0) {
            return;
        }
        console.warn('data:' + JSON.stringify(data));
        const multi = client.multi();
        for (let i = 0; i < data.length; ++i) {
            multi.sadd(key, data[i]);
        }
        multi.exec((err, reply) => {
            if (err) {
                console.error('redis - saveBans: ' + JSON.stringify(err));
                return;
            }
            if (callback) {
                callback(worldKey, reply);
            }
        });
    }
    // END BANNED USERS
}

export default DatabaseHandler;
