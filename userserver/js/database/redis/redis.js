/* global Types, log, client */

// FIX: dropped unused `crypto`/`fs`/`bcrypt` imports (verified: none of the
// three are referenced anywhere in this file). Leftover from before this
// file's account/player business logic -- including password hashing --
// moved out to database/databaselogic.js's DatabaseLogic class (see the REFACTOR
// comment below); this file's own job is now just plain Redis reads/writes.
import redis from 'redis';

// REFACTOR: the bulk key-housekeeping scripts (replaceSkills,
// removeOldValues, insertMissingPlayerKeys, createPlayerKeys) and the
// startup data migrations (purgeStaleNewQuests, migrateGoldFields,
// migrateGold1ToUser, renameGold1ToBankGold, migrateBankToUser,
// migrateLooksToBase64) that used to live as methods on DatabaseHandler
// below have moved out to migration.js --
// see that file's header comment for the full rationale. `migrationMethods`
// is mixed onto DatabaseHandler.prototype (Object.assign, right after the
// class below) so every call site here that already does
// `this.migrateGoldFields(...)` etc. keeps working unchanged.
import { initMigrations, migrationMethods } from './migration.js';

let client;

// Gold cap -- matches userserver/js/format.js's playerGoldMax, the same
// bound WU_SAVE_PLAYER_DATA's numberField(0, playerGoldMax) enforces on
// every gold_0/gold_1 save. Duplicated here rather than imported since this
// file already duplicates small cross-cutting constants like this rather
// than reaching into format.js's validation layer (which is a different
// concern -- payload shape/range checking -- from this file's plain Redis
// reads/writes). Used below by modifyGold()/addPlayerGoldOffline(), and
// handed into migration.js's initMigrations() (see the constructor) for
// migrateGold1ToUser() to clamp combined per-account totals to the same cap.
//
// Note: bankSlots, the equivalent cap for bank items, used to be duplicated
// here too -- it moved to migration.js along with migrateBankToUser(), its
// only remaining caller.
const playerGoldMax = 999999999;

// Gems cap -- unlike gold, there's no format.js wire-level validation for
// gems (no client message ever submits a raw "gems" value directly; it only
// ever moves via modifyGems()'s atomic HINCRBY below, driven server-side by
// staged "gemsoffline" credits/debits). Chosen to match playerGoldMax's
// value/style for consistency. Used by modifyGems() below to clamp the
// persisted "gems" balance into range after every increment.
const gemsMax = 999999999;

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

// FIX: replaces every `client.keys(pattern, callback)` call in this file.
// KEYS walks the entire keyspace in one blocking pass before returning
// anything -- Redis is single-threaded, so every other command (every other
// player's login/save/gameplay action touching Redis) queues up and waits
// for the whole scan to finish. That's fine at small key counts (sub-second,
// unnoticeable) but becomes a real, growing pause on every server restart as
// the player base grows -- several call sites below already carried FIX/
// NOTE comments flagging exactly this and describing SCAN as the proper
// fix. SCAN does the same "find keys matching this pattern" job
// incrementally: fetch a batch + cursor, repeat until the cursor comes back
// to '0', with each individual call cheap enough not to block other clients.
// Same `(err, keys)` callback signature as `client.keys()` -- a drop-in
// replacement, no call site needed to change its own logic, just swap which
// method it calls.
//
// No consistency guarantee across the full walk (a key added/removed
// mid-scan may or may not be included) -- irrelevant for every caller here,
// which are one-time startup migrations/maintenance passes over
// already-existing keys, not reads that need a point-in-time snapshot.
const scanKeys = function (pattern, callback) {
    let cursor = '0';
    let found = [];

    const scanOnce = function () {
        client.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            1000,
            (err, reply) => {
                if (err) {
                    callback(err);
                    return;
                }

                cursor = reply[0];
                found = found.concat(reply[1]);

                if (cursor === '0') {
                    callback(null, found);
                } else {
                    scanOnce();
                }
            }
        );
    };

    scanOnce();
};

// TODO Array parseInt where appropriate.

// REFACTOR: this file used to also hold account/player *business logic*
// (createUser, removeUser, loadUser, createPlayer, createPlayerNameInUser,
// sendPlayers, transferOfflineGold, and the "gold" field sanitization
// decision) mixed in with plain Redis reads/writes. That logic now lives in
// database/databaselogic.js's DatabaseLogic class (exposed as the global `DBLogic`,
// set up in main.js next to `DBH`), which calls back into the primitives
// below rather than touching `client` directly. DatabaseHandler here is
// meant to be just the data store/retrieval layer: given fixed parameters,
// do a Redis read or write and hand back the (mostly) raw result.
//
// One category of exception, left in this file on purpose: Redis-native
// *atomic* operations (modifyGold()'s HINCRBY, addPlayerGoldOffline()'s
// HINCRBY, reserveUsername()/reservePlayerNameLock()'s SADD/SET NX) -- these
// exist specifically to avoid race conditions that were real,
// previously-fixed bugs in this codebase (see the FIX comments on each).
// Their correctness depends on running as a single Redis-side operation;
// pulling the surrounding computation out into a separate JS-side "logic"
// layer that does a plain get-then-set would silently reintroduce those
// races. The *decision to call* them still lives in DatabaseLogic -- only
// the atomic primitive itself stays here.
//
// REFACTOR: this file used to also keep the bulk key-housekeeping/migration
// scripts (replaceSkills, removeOldValues, insertMissingPlayerKeys,
// createPlayerKeys, purgeStaleNewQuests, migrateGoldFields,
// migrateGold1ToUser, renameGold1ToBankGold, migrateBankToUser,
// migrateLooksToBase64) as methods here too, on the reasoning that -- like
// the atomic operations above --
// they only ever touch raw Redis keys, never `user`/`users`/`worldHandlers`
// or any other app-level object. They've since moved out to migration.js
// (mixed onto DatabaseHandler.prototype at the bottom of this file) since,
// unlike the atomic operations, none of them need to run as a single
// Redis-side operation -- they're just a different *kind* of data-layer
// work (bulk/one-off maintenance and migration, not per-request reads and
// writes) that was making this file harder to navigate mixed in with the
// rest.
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
        client.scanKeys = scanKeys;
        this.ready = true;

        // Hands migration.js the shared `client` (with hgetarray/scanKeys
        // already attached above) and playerGoldMax, so
        // replaceSkills()/removeOldValues()/purgeStaleNewQuests()/
        // insertMissingPlayerKeys()/createPlayerKeys()/migrateGoldFields()/
        // migrateGold1ToUser()/renameGold1ToBankGold()/migrateBankToUser()
        // below have what they need before any of them can run.
        initMigrations({ client, playerGoldMax });

        if (config.remove_old_values === 1) {
            this.removeOldValues();
            // FIX: this ran unconditionally on every server start (unlike
            // removeOldValues() above, which is opt-in via config). Gated
            // behind the same remove_old_values flag as its sibling
            // maintenance/migration task above, since that's the existing
            // "opt-in startup migration" pattern in this file.
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
        // See purgeStaleNewQuests() (migration.js): unlike the two migrations
        // above (which are always safe to re-run and re-check their own
        // per-player "already done" signal), this one is a run-once-ever
        // flag-gated purge of the pre-npcQuestId-format-change 'newquests'
        // data.
        const newQuestsPurge = new Promise((resolve, reject) => {
            this.purgeStaleNewQuests((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        // Converts every account's appearance data from the old "looks2"
        // field to the new "looks_b64" field (see migrateLooksToBase64()'s
        // comment, migration.js, for the full rationale) -- independent of
        // the gold/bank/newquests migrations above (different fields
        // entirely), so it just runs alongside them rather than chained
        // after any of them.
        const looksMigration = new Promise((resolve, reject) => {
            this.migrateLooksToBase64((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        this.migrationReady = Promise.all([
            goldMigration,
            bankMigration,
            newQuestsPurge,
            looksMigration
        ]);
    }


    ExistsUsername(name, callback) {
        return this.isNameInSet('usr', name, callback);
    }

    ExistsPlayerName(name, callback) {
        return this.isNameInSet('player', name, callback);
    }

    // PERF: this used to unconditionally SMEMBERS the *entire* set --
    // every registered username, or every existing player name in the
    // game -- on every single call, then walk the full result in JS to
    // do a case-insensitive match. Both callers (ExistsUsername/
    // ExistsPlayerName above) sit on the hottest paths in this server:
    // ExistsUsername runs on every login and every registration attempt,
    // ExistsPlayerName on every character-creation attempt. Redis is
    // single-threaded, so SMEMBERS on a keyspace-sized set blocks every
    // other client's command for the duration of the fetch, and that cost
    // only grows as the account/character count grows -- unlike a normal
    // key lookup, this doesn't stay flat with player-base size.
    //
    // SISMEMBER against the exact, as-given name is an O(1) Redis-side
    // check and covers the overwhelmingly common case cheaply: a login
    // for an existing username, or a "name already taken" retry during
    // registration/character-creation, is normally checking a name in
    // exactly the case it was originally stored under (SADD is
    // case-sensitive; both callers already normalize case before this is
    // ever reached -- user.js lowercases usernames, and reservePlayerNameLock
    // above already keys its own lock off name.toLowerCase() for the same
    // reason). Only the genuine "name truly doesn't exist yet" path
    // (successful new registration/creation, the far less frequent case)
    // or a differently-cased legacy record falls through to the full
    // case-insensitive SMEMBERS scan below -- kept exactly as it was, as
    // the defense-in-depth check it already served as, just no longer
    // paid on every call.
    isNameInSet(setName, name, callback) {
        const nameLower = name.toLowerCase();

        client.sismember(setName, name, (err, exact) => {
            if (!err && exact) {
                if (callback) {
                    callback(name, true);
                }
                return;
            }

            client.smembers(setName, (err2, reply) => {
                reply = (reply || []).map((rec) => rec.toLowerCase());
                if (callback) {
                    callback(name, reply.includes(nameLower));
                }
            });
        });
    }

    // FIX: extracted straight out of createUser() (formerly in this file, now
    // DatabaseLogic.createUser() in database/databaselogic.js) so the atomic SADD -- the
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

    // FIX: data[2] = bank_gold, written to the shared u:<username>
    // "bank_gold" field -- this is now the ONLY place in this file that
    // writes "bank_gold" on a normal player save; savePlayerInfo() (below)
    // used to also write it (from its own data[5]) but that's been removed
    // (see savePlayerInfo()'s REFACTOR comment) now that worldhandler.js's
    // (gameserver) loadPlayerDataUserInfo() sends the value here instead.
    //
    // REFACTOR: used to guard this write on `data[2] !== undefined`, back
    // when this method's only caller (userserver's worldhandler.js) could
    // still pass a 2-element [gems, looks_b64] array. That's no longer
    // possible: message[1][0] on the wire (this method's `data`, minus the
    // username/hash worldhandler.js shifts off first) is validated by
    // format.js as a strict 5-field tuple -- [username, hash, gems, looks,
    // bankGold] -- so any message that reaches this call already has
    // data[2]. Written unconditionally now; a future caller that somehow
    // omits it would hset "bank_gold" to the *string* "undefined" with no
    // guard to catch it, but nothing in this codebase does that today.
    //
    // REFACTOR: writes "looks_b64" now, not "looks2" -- shared/js/utils.js's
    // Utils.BinArrayToBase64() (whatever encoded `data[1]`, upstream) packs
    // 8 boolean flags per byte and base64-encodes the result now, instead of
    // the old comma-joined-32-bit-decimal-chunk format "looks2" held. Renamed
    // the field alongside the format change so an old-format value already
    // in Redis is never misread as new-format data (or vice versa) --
    // migration.js's migrateLooksToBase64() converts every pre-existing
    // "looks2" value to "looks_b64" once, at startup, before any player can
    // reach this method.
    savePlayerUserInfo(username, playerName, data, callback) {
        const uKey = 'u:' + username;
        client
            .multi()
            .sadd('usr', username)
            .hset(uKey, 'gems', data[0])
            .hset(uKey, 'looks_b64', data[1])
            .hset(uKey, 'bank_gold', data[2])
            .exec((err, replies) => {
                if (callback) {
                    callback(username, playerName, data);
                }
            });
    }

    // FIX: seeds "bank_gold" at 0 here now, on every brand-new account --
    // see loadPlayerInfo()'s REFACTOR comments below for the full rationale
    // (savePlayerInfo() below no longer touches "bank_gold" at all -- see
    // its own REFACTOR comment). This is the one call site that makes "the
    // account's shared gold always lives on u:<username>" actually true
    // from a character's very first save, rather than merely true for
    // accounts that have survived one server restart's
    // migrateGold1ToUser()/renameGold1ToBankGold() pass. This is the only
    // call site for saveUserInfo() (new-account registration,
    // database/databaselogic.js's createUser()), so an unconditional hset here can't
    // ever clobber a real, already-existing account's balance.
    //
    // REFACTOR: seeds directly under "bank_gold" -- not "gold_1" -- since a
    // brand-new account has no legacy data to migrate through; it can go
    // straight to the field's current name. See renameGold1ToBankGold()'s
    // comment (migration.js) for the full rename rationale.
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
            .hset(uKey, 'looks_b64', data[8])
            .hset(uKey, 'ipAddresses', data[9])
            .hset(uKey, 'bank_gold', data[10])
            .hset(uKey, 'bank', data[11])
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

    // FIX: also atomically clears "gemsoffline" (addUserGemsOffline(),
    // below) here, in the same multi/exec as the HGETALL -- same race
    // loadPlayerInfo()'s "goldoffline" handling above closes (see that
    // function's FIX comment): reading (HGETALL) and clearing (HDEL)
    // separately would let a concurrent addUserGemsOffline() HINCRBY landing
    // in the gap between the two get silently wiped out by the unconditional
    // clear, never folded in. The HGETALL still runs first inside the multi,
    // so "gemsoffline" (if any) is already present in `data` exactly as
    // HGETALL would have returned it on its own -- this only changes when
    // the field gets cleared, not what's handed back. What to *do* with
    // that raw amount -- adding it to "gems" and persisting the credit -- is
    // a data-manipulation decision, so it's left to
    // DatabaseLogic.loadUserData() (database/databaselogic.js) to make, matching this
    // file's "primitives only" convention (see the REFACTOR comment at the
    // top of this file).
    loadUserInfo(username, callback) {
        const uKey = 'u:' + username;

        client
            .multi()
            .hgetall(uKey)
            .hdel(uKey, 'gemsoffline')
            .exec((err, raw) => {
                if (raw === null || !(typeof raw === 'object')) {
                    return;
                }

                const [data] = raw;
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
    // now DatabaseLogic.createPlayer() in database/databaselogic.js) so the atomic SET
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
    // directly) and apply a default-fill for a missing "looks_b64" value
    // inline. That default-fill is a business-logic decision
    // (database/databaselogic.js's DatabaseLogic.loadPlayerUserInfo() now
    // makes it, using the same user.looks fallback), not a data-retrieval
    // concern -- this just takes a plain username and hands back the raw
    // [gems, looks_b64] pair.
    //
    // REFACTOR: reads "looks_b64" here now, not "looks2" -- see
    // savePlayerUserInfo()'s REFACTOR comment above for the full rationale.
    // By the time any player can reach this call, main.js has already
    // awaited migrationReady (which now includes migrateLooksToBase64()),
    // so "looks_b64" is guaranteed to already hold whatever appearance data
    // this account has.
    loadPlayerUserInfo(username, callback) {
        const uKey = 'u:' + username;

        client
            .multi()
            .hget(uKey, 'gems')
            .hget(uKey, 'looks_b64')
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
    // decision moved out to DatabaseLogic.loadPlayerInfo() (database/databaselogic.js)
    // and has since been removed there entirely (there's no remaining path
    // that can put a negative/malformed value into gold_0/gold_1 in the
    // first place -- see the FIX comment on DatabaseLogic.loadPlayerInfo() for
    // the full reasoning). This just hands back the raw hget results.
    //
    // REFACTOR: "gold" used to be a single Redis hash field packing both
    // currency types into one CSV string ("100,50"), which is why modifyGold()
    // below needed a full Lua script instead of a plain atomic HINCRBY --
    // HINCRBY can't target "just type 1" inside a packed string. Storage is
    // now two separate integer fields, gold_0/gold_1, each of which HINCRBY
    // can update natively and atomically with no scripting at all.
    //
    // REFACTOR: gold_1 (data[5]) is account-level now, shared across every
    // character on the account, the same way bank moved to the account
    // level. `username` is needed here (in addition to `playerName`) purely
    // to read that shared field. Kept naming this local var/array position
    // `gold1` throughout this file, matching the WU_SAVE_PLAYER_DATA wire
    // format's data[5] -- only the underlying Redis field name changed (see
    // the REFACTOR comment below), not this in-memory/wire concept.
    //
    // FIX: this used to also fall back to this character's own legacy
    // p:<playerName> "gold_1" field whenever the account had no merged
    // "gold_1" yet (an account not yet reached by migrateGold1ToUser()'s
    // one-time startup pass, or one that pass had left aborted over the
    // gold cap -- see its old FIX comment). That fallback is gone now that
    // every account is guaranteed a shared field from the moment it's
    // created (saveUserInfo() above seeds it, and migrateGold1ToUser()
    // backfills it for every pre-existing account on the next startup,
    // clamping rather than aborting -- see that function's FIX comment) --
    // so u:<username> is now always the right (and only) place to read
    // gold_1 from, and a second hget plus a JS-side fallback would just be
    // dead weight on every single login.
    //
    // REFACTOR: reads "bank_gold" here now, not "gold_1" --
    // renameGold1ToBankGold() (migration.js) renames the account-level field
    // as its own dedicated one-time migration, chained immediately after
    // migrateGold1ToUser() finishes producing it (see that function's
    // comment for the full rename rationale). By the time any player can
    // reach this call, main.js has already awaited migrationReady (which
    // now includes renameGold1ToBankGold()), so "bank_gold" is guaranteed
    // to already be the account's current field -- there's never a "gold_1
    // hasn't been renamed yet" case left to handle here.
    //
    // gold_0/gold_1 are handed back completely unparsed here -- whatever's
    // actually stored, string or null. Parsing them into real ints is a
    // data-manipulation decision, so it happens in
    // DatabaseLogic.loadPlayerInfo() (database/databaselogic.js), not here -- matching
    // this file's "primitives only" convention (see the REFACTOR comment at
    // the top of this file). The WU_SAVE_PLAYER_DATA wire format and
    // gameserver's userhandler.js/player.js read gold_0/gold_1 as two flat
    // elements now (not a combined string, and not a nested array either), so
    // the shape handed back here -- gold_0/gold_1 as two separate positions in
    // the same 12-element record as before -- already matches the wire format
    // 1:1; DatabaseLogic.loadPlayerInfo() only needs to convert the two raw
    // strings to numbers, no reshaping, even though gold_1's underlying Redis
    // key/field is now sometimes different from the rest of this record.
    //
    // Migration: this used to also detect-and-repair a still-legacy player
    // right here on read (split the packed "gold" field and persist gold_0/
    // gold_1 the first time that player loaded). That per-load fallback is
    // gone now -- migrateGoldFields() (migration.js) runs a one-time
    // full-keyspace pass at every server startup, and main.js blocks
    // accepting any new connection until it finishes (see migrationComplete
    // in main.js). By the time any player can log in and reach this
    // function, gold_0 is guaranteed to already exist on p:<playerName> and
    // gold_1 (as "bank_gold") on u:<username> (see the REFACTOR/FIX comments
    // above), so there's nothing left to detect or repair here.
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
    // decision, so it's left to DatabaseLogic.loadPlayerInfo() (database/databaselogic.js)
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
            .hget(uKey, 'bank_gold')
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
                    bank_gold,
                    goldOffline,
                    ,
                    /* hdel("goldoffline") reply, unused */ skills,
                    pStats,
                    sprites,
                    colors,
                    shortcuts,
                    completeQuests
                ] = raw;

                // Same 12-element shape as before (matches the WU_SAVE_PLAYER_DATA
                // wire format 1:1 -- see the REFACTOR comment above), plus the raw
                // "goldoffline" value appended as a 13th element purely for
                // DatabaseLogic.loadPlayerInfo() to consume; that caller trims it
                // back off before this ever reaches the wire (see its own comment).
                const result = [
                    name,
                    map,
                    stats,
                    exps,
                    gold0,
                    bank_gold,
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

    // REFACTOR: expects gold_0 as a flat element -- data[4] -- matching the
    // WU_SAVE_PLAYER_DATA wire format (not a combined "100,50" string, and
    // not a nested array either -- see gameserver's worldhandler.js and
    // userserver/js/format.js's gold check). Since the wire shape and this
    // function's expected shape are identical, DatabaseLogic.savePlayerInfo()
    // (database/databaselogic.js) -- the only caller (see worldhandler.js, which calls
    // DBLogic.savePlayerInfo() rather than this method directly) -- is a
    // pure passthrough with no parsing or reshaping of its own. The legacy
    // "gold" field is intentionally left untouched (not written) going
    // forward now that gold_0 is the source of truth for this record.
    //
    // REFACTOR: no longer takes `username` or writes "bank_gold" -- gold_1/
    // bank_gold (the account-level shared gold) used to be data[5] here,
    // written to u:<username>, but that made this per-character save also
    // reach into account-level state, and needed `username` (in addition to
    // `playerName`) purely to build that one key. It's since moved entirely
    // to savePlayerUserInfo() (above), which now optionally writes
    // "bank_gold" from its own 3rd data element -- see that method's FIX
    // comment, and worldhandler.js's (gameserver) loadPlayerDataUserInfo(),
    // which is what actually supplies it. Every field from skills onward
    // shifts one index earlier (data[6]->data[5] etc.) to fill the gap left
    // by gold_1's removal -- see the matching REFACTOR comment on
    // userserver/js/format.js's message[1][1] length check.
    savePlayerInfo(playerName, data, callback) {
        const pKey = 'p:' + playerName;

        client
            .multi()
            .sadd('player', data[0])
            .hset(pKey, 'name', data[0])
            .hset(pKey, 'map', data[1])
            .hset(pKey, 'stats', data[2])
            .hset(pKey, 'exps', data[3])
            .hset(pKey, 'gold_0', data[4])
            .hset(pKey, 'skills', data[5])
            .hset(pKey, 'pStats', data[6])
            .hset(pKey, 'sprites', data[7])
            .hset(pKey, 'colors', data[8])
            .hset(pKey, 'shortcuts', data[9])
            .hset(pKey, 'completeQuests', data[10])
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
    // into gold_0 by DatabaseLogic.loadPlayerInfo() (database/databaselogic.js) --
    // see loadPlayerInfo()'s FIX comment (below) for why load time, not save
    // time, is what actually closes the "live session's autosave clobbers the
    // credit" race. This function's own job hasn't changed -- still just
    // atomically add goldAmount to "goldoffline" -- there's simply no
    // separate addGoldOffline()/transferOfflineGold() left to call afterward.
    //
    // NOTE: "goldoffline" is deliberately left unclamped here -- same
    // reasoning as "gemsoffline" on addUserGemsOffline() below: it's just a
    // signed staging delta (goldAmount can be negative, a deduction)
    // accumulating until the next login folds it into the real gold_0
    // balance, not a balance in its own right, so there's nothing wrong
    // with it sitting negative in between. This used to re-clamp the field
    // to a floor of 0 here, which database/databaselogic.js's loadPlayerInfo() FIX
    // comment specifically relied on to guarantee gold_0 could never go
    // negative -- that guarantee now comes from modifyGold()'s own
    // [0, playerGoldMax] clamp instead (see that function's FIX comment),
    // which covers the actual gold_0 balance regardless of whether the
    // delta folded into it was negative, so clamping this intermediate
    // delta too would be redundant.
    addPlayerGoldOffline(playerName, goldAmount) {
        console.info('redis.addPlayerGoldOffline: playerName:' + playerName);
        console.info('goldAmount:' + goldAmount);

        const pKey = 'p:' + playerName;
        client.hincrby(pKey, 'goldoffline', goldAmount, (err) => {
            if (err) {
                console.warn(
                    'redis.addPlayerGoldOffline: save error, ' +
                        JSON.stringify(err)
                );
                return;
            }
        });
    }

    // Lets admins credit gems to an account that isn't necessarily online
    // right now (WU_ADD_PLAYER_GOLD's gems equivalent) -- same staging
    // pattern as addPlayerGoldOffline() above: atomically add `amount` to
    // "gemsoffline" here, and loadUserInfo() above reads it back out and
    // atomically clears it as part of its own per-login HGETALL/HDEL multi.
    // DatabaseLogic.loadUserData() (database/databaselogic.js) is what actually folds
    // that raw amount into "gems" and persists the credit via modifyGems() --
    // see loadUserInfo()'s FIX comment above for the full race-safety
    // rationale (same one addPlayerGoldOffline()/loadPlayerInfo() already
    // rely on for gold).
    //
    // NOTE: unlike addPlayerGoldOffline()'s "goldoffline" above,
    // "gemsoffline" is deliberately left unclamped here -- it's just a
    // signed staging delta (an admin credit or, via a negative `amount`, a
    // debit) accumulating until the next login folds it into the real
    // "gems" balance, not a balance in its own right, so there's nothing
    // wrong with it sitting negative in between (it simply means net
    // debits are currently staged). Clamping the actual account balance
    // into [0, gemsMax] happens once, at the point that balance is really
    // written -- modifyGems() below -- rather than being (redundantly, and
    // incorrectly) enforced on this intermediate delta too.
    addUserGemsOffline(userName, amount) {
        console.info('redis.addUserGemsOffline: userName:' + userName);
        console.info('amount:' + amount);

        const uKey = 'u:' + userName;
        client.hincrby(uKey, 'gemsoffline', amount, (err) => {
            if (err) {
                console.warn(
                    'redis.addUserGemsOffline: save error, ' +
                        JSON.stringify(err)
                );
                return;
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
    //
    // FIX: this used to leave gold_0/gold_1 completely unbounded here --
    // same gap modifyGems() above used to have, and fixed the same way. A
    // large enough negative golddiff could push the field below 0 (this is
    // now the *only* thing keeping that guarantee: addPlayerGoldOffline()'s
    // own floor clamp on "goldoffline" was removed -- see that function's
    // NOTE comment -- specifically because this clamp now covers it,
    // including the case DatabaseLogic.loadPlayerInfo() (database/databaselogic.js)
    // relies on, where a possibly-negative "goldoffline" value is folded in
    // straight through this function), and nothing capped the high end
    // either -- a large enough offline credit could push gold_0 above
    // playerGoldMax with nothing catching it until this player's next full
    // save, which would then fail format.js's WU_SAVE_PLAYER_DATA
    // validation and close the whole connection. Same read-back-then-correct
    // pattern as modifyGems(): HINCRBY's returned `total` is checked against
    // [0, playerGoldMax] and, if it falls outside that range, immediately
    // corrected with a follow-up hset. Same narrow concurrent-reader window
    // as modifyGems()/addPlayerGoldOffline() accept, for the same reason
    // (no clamped-increment primitive in Redis).
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

            if (total < 0 || total > playerGoldMax) {
                const clamped = Math.max(0, Math.min(total, playerGoldMax));
                client.hset(pKey, field, clamped, (err) => {
                    if (err) {
                        console.warn(
                            'redis.modifyGold: clamp error ' +
                                JSON.stringify(err)
                        );
                    }
                });
            }

            if (callback) {
                callback(playerName, golddiff, type);
            }
        });
    }

    // FIX: was hget -> compute new value in JS -> hset, the same
    // read-modify-write race already fixed for modifyGold()/
    // addPlayerGoldOffline() above (see those FIX comments) -- two
    // concurrent modifyGems() calls for the same user could both read the
    // same starting "gems" value, and the second write clobbers the
    // first's change, silently dropping a gems credit/debit instead of
    // applying it. HINCRBY is atomic in Redis, so use it instead of a
    // manual get-then-set round trip; also self-heals a missing "gems"
    // field by creating it at `diff` rather than producing NaN from
    // parseInt(null).
    //
    // FIX: this used to leave "gems" completely unbounded -- a large enough
    // negative `diff` (an over-eager admin debit, or some future purchase
    // path) could push it below 0, and nothing capped it on the high end
    // either. Same read-back-then-correct pattern addPlayerGoldOffline()
    // above already uses for its own floor clamp, extended to both ends:
    // HINCRBY's returned `total` is checked against [0, gemsMax] and, if it
    // falls outside that range, immediately corrected with a follow-up
    // hset. This can't be done atomically in the same HINCRBY call (Redis
    // has no clamped-increment primitive), so there's a narrow window where
    // an out-of-range value is briefly visible to a concurrent reader --
    // same tradeoff/window addPlayerGoldOffline()'s floor clamp already
    // accepts.
    modifyGems(username, diff) {
        const uKey = 'u:' + username;
        diff = parseInt(diff, 10) || 0;

        client.hincrby(uKey, 'gems', diff, (err, total) => {
            if (err) {
                console.warn(
                    'redis.modifyGems: save error ' + JSON.stringify(err)
                );
                return;
            }

            if (total < 0 || total > gemsMax) {
                const clamped = Math.max(0, Math.min(total, gemsMax));
                client.hset(uKey, 'gems', clamped, (err) => {
                    if (err) {
                        console.warn(
                            'redis.modifyGems: clamp error ' +
                                JSON.stringify(err)
                        );
                    }
                });
            }
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
    // saveUserBank() below and migrateBankToUser() in migration.js) -- this
    // is now only used for inventory and equipment, both still genuinely
    // per-character.
    //
    // FIX: used to silently `return` without invoking `callback` at all on
    // missing/empty data, on the assumption (see the old comment this
    // replaces, and the one on loadUserBank() below) that a character
    // calling this always already has "[]" (or real item JSON) saved for it.
    // That assumption isn't actually guaranteed: worldhandler.js's
    // createPlayerToWorld() only returns handleCreatePlayerItems()'s "[]" as
    // in-memory data for the brand-new character's initial
    // SendLoadPlayerData -- it never persists that to Redis. Any character
    // that hasn't been through a real save yet (server restart/crash, or
    // simply logging out right after creation, before an autosave lands) has
    // no `storeType` field in Redis at all, so the very next login silently
    // skipped calling back here and hung that login's checkLoadDataFull()
    // forever waiting for its count of 7 -- the same class of bug already
    // fixed for loadQuests()/loadUserBank() elsewhere in this file. Now
    // defaults to an empty item list and always calls back instead.
    loadItems(playerName, type, storeType, callback) {
        const pKey = 'p:' + playerName;

        client.hget(pKey, storeType, (err, data) => {
            if (err || !data || data === '') {
                console.warn(err);
                console.warn(JSON.stringify(data));
                data = '[]';
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
    // migrateBankToUser() (migration.js) was able to merge, not
    // per-character. A user can have up to maxPlayersPerUser (format.js)
    // characters, and bank is meant to be shared across all of them rather
    // than siloed per character the way inventory/equipment (loadItems()/
    // saveItems() above) still are. See migrateBankToUser() (migration.js)
    // for the one-time migration that consolidates each account's existing
    // per-character bank contents into this shared field, and
    // worldhandler.js's createPlayerToWorld()/sendPlayerToWorld()/
    // handleSavePlayerData() for the call sites.
    //
    // Not every account necessarily ends up on the shared field, though:
    // migrateBankToUser() refuses to merge (and leaves the "bank" field
    // unset) for an account whose characters' combined bank items don't fit
    // in one shared bank -- see the FIX comment on mergeAndWrite() there
    // (migration.js).
    // loadUserBank()/saveUserBank() both need `playerName` (in addition to
    // `username`) so they can fall back to that one character's own
    // p:<playerName> "bank" field in that case -- the account keeps working
    // exactly as it did before this refactor, just without the
    // shared-across-characters convenience.
    //
    // NOTE: this can legitimately be called for a brand-new user account with
    // no "bank" field yet (the very first character ever created on that
    // account, in createPlayerToWorld()). Always calls back, defaulting to an
    // empty bank rather than treating "no bank yet" as an error -- the same
    // defensive convention loadItems()/loadAchievements() (see their own FIX
    // comments) were brought in line with after the same missing-field/hang
    // bug turned out to affect them too.
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
                // FIX: was `data = []` -- a real array, not a JSON string.
                // This value goes straight over the wire to the gameserver's
                // handleLoadPlayerQuests() (userhandler.js), which does
                // `JSON.parse(msg)`. JSON.parse coerces a non-string argument
                // via ToString first, so JSON.parse([]) becomes
                // JSON.parse("") -- "Unexpected end of JSON input" on every
                // login for any player with no "newquests" field (e.g. every
                // player after purgeStaleNewQuests() wipes it). saveQuests()
                // always stores a JSON string, and the brand-new-player path
                // (handleCreatePlayerQuests() in worldhandler.js) already
                // returns the string '[]' -- match that shape here too.
                data = '[]';
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

    // FIX: used to silently `return` without invoking `callback` at all on
    // missing/empty data -- but handleCreatePlayerAchievements() (worldhandler.js)
    // only returns '[]' as in-memory data for a brand-new character's initial
    // SendLoadPlayerData, it never persists that to Redis. Any character that
    // hasn't been through a real save yet has no 'achievements' field at all,
    // so the very next login silently skipped calling back here and hung that
    // login's checkLoadDataFull() forever waiting for its count of 7 -- the
    // same class of bug already fixed for loadQuests()/loadUserBank()/
    // loadItems() elsewhere in this file. Now defaults to an empty
    // achievements list and always calls back instead.
    loadAchievements(playerName, callback) {
        console.info('loadAchievement');
        const pKey = 'p:' + playerName;
        client.hget(pKey, 'achievements', (err, data) => {
            if (err || !data || data === '') {
                console.warn(err);
                console.warn(JSON.stringify(data));
                data = '[]';
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

// Mixes replaceSkills/removeOldValues/purgeStaleNewQuests/
// insertMissingPlayerKeys/createPlayerKeys/migrateGoldFields/
// migrateGold1ToUser/renameGold1ToBankGold/migrateBankToUser/
// migrateLooksToBase64/resetLegacyLooksToDefault/wipeAllNewQuests
// (migration.js) onto DatabaseHandler.prototype, so every `this.<name>(...)`
// call above --
// in the constructor, and between these functions themselves -- keeps
// resolving exactly as it did back when they were defined as methods
// directly on this class.
Object.assign(DatabaseHandler.prototype, migrationMethods);

export default DatabaseHandler;
