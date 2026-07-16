/* global Types, log, client */

import crypto from 'crypto';
import fs from 'fs';
import redis from "redis";
import bcrypt from "bcrypt";

let client;

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

    // Gold field migration -- unlike removeOldValues()/insertMissingPlayerKeys()
    // above, this is NOT gated behind a config flag. Those are opt-in
    // housekeeping; this one guarantees every player's currency is on the
    // gold_0/gold_1 fields before anything can touch it, so it always runs,
    // every startup. Constructing a DatabaseHandler is now the single place
    // that kicks this off -- no call site elsewhere can forget to run it.
    //
    // A constructor can't be awaited, so the in-progress migration is handed
    // back as a Promise instead of a constructor callback: main.js does
    // `await global.DBH.migrationReady` right after `new DatabaseHandlerClass(config)`
    // and doesn't proceed to accept connections until it resolves (rejects
    // straight through if migrateGoldFields() reports an error).
    this.migrationReady = new Promise((resolve, reject) => {
      this.migrateGoldFields((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  replaceSkills() {
    client.keys('p:*', (err, keys) => {
      if (err) return console.log(err);

      for (let i = 0, len = keys.length; i < len; i++) {
        const key = keys[i];
        console.info(key);
        if (key.startsWith("p:")) {
          let j = 0;
          client.hget(key, "skills", (err, data) => {
            //console.info(JSON.stringify(err));
            const len = data.split(",").length;
            //console.info("skills count:"+len);
            //if (len !== 7) {
            const k = keys[j++];
            //console.info("resetting skills." + k);
            client.hset(k, "skills", "0,0,0,0,0,0,0");
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
        if (key.startsWith("p:")) {
          client.hdel(key, "newquests");
          client.hdel(key, "newquests2");
          client.hdel(key, "completeQuests");
          client.hdel(key, "completeQuests2");
        }
      }
    });
  }

  insertMissingPlayerKeys() {
    client.keys('p:*', (err, keys) => {
      if (err) return console.log(err);

      client.smembers("player", (err, reply) => {
        for (let pName of keys) {
          pName = pName.substr(2);
          if (!reply.includes(pName)) {
            client.sadd("player", pName);
          }
        }
      });
    });
  }

  createPlayerKeys() {
    client.keys('p:*', (err, arr) => {
      for (const rec of arr) {
        console.info("rec=" + rec);
        const playerName = rec.substr(2);
        if (playerName.length > 0) {
          client.sadd("player", playerName);
        }
      }
    });
  }

  ExistsUsername(name, callback) {
    return this.isNameInSet("usr", name, callback);
  }

  ExistsPlayerName(name, callback) {
    return this.isNameInSet("player", name, callback);
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
    client.sadd("usr", name, (err, added) => {
      if (callback) {
        callback(name, !err && !!added, err);
      }
    });
  }

  unreserveUsername(name, callback) {
    client.srem("usr", name, (err, removed) => {
      if (callback) {
        callback(name, !err, err);
      }
    });
  }

  savePlayerUserInfo(username, playerName, data, callback) {
    const uKey = "u:" + username;
    client.multi()
      .sadd("usr", username)
      .hset(uKey, "gems", data[0])
      .hset(uKey, "looks2", data[1])
      .exec((err, replies) => {
        if (callback) {
          callback(username, playerName, data);
        }
      });
  }

  saveUserInfo(username, data, callback) {
    const uKey = "u:" + username;

    client.multi()
      .sadd("usr", username)
      .hset(uKey, "username", username)
      .hset(uKey, "hash", data[0])
      .hset(uKey, "salt", data[1])
      .hset(uKey, "banTime", data[2])
      .hset(uKey, "banDuration", data[3])
      .hset(uKey, "lastLoginTime", data[4])
      .hset(uKey, "membership", data[5])
      .hset(uKey, "players", data[6])
      .hset(uKey, "gems", data[7])
      .hset(uKey, "looks2", data[8])
      .hset(uKey, "ipAddresses", data[9])
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
    const uKey = "u:" + username;
    client.hset(uKey, "hash", hash);
    client.hset(uKey, "salt", salt);
  }

  deleteUserRecord(username, callback) {
    const uKey = "u:" + username;
    client.del(uKey, (err) => {
      if (callback) {
        callback(username, !err, err);
      }
    });
  }

  deletePlayerRecord(playerName, callback) {
    const pKey = "p:" + playerName;
    client.del(pKey, (err) => {
      if (callback) {
        callback(playerName, !err, err);
      }
    });
  }

  loadUserInfo(username, callback) {
    const uKey = "u:" + username;

    client.hgetall(uKey, (err, data) => {
      console.info("replies: " + data);
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
    const uKey = "u:" + username;
    client.hget(uKey, "players", (err, reply) => {
      if (callback) {
        callback(username, reply);
      }
    });
  }

  setUserPlayerNames(username, csv, callback) {
    const uKey = "u:" + username;
    client.hset(uKey, "players", csv, (err) => {
      if (callback) {
        callback(username, !err, err);
      }
    });
  }

  getPlayerSummaryFields(playerName, callback) {
    const pKey = "p:" + playerName;
    const keyArray = ["name", "map", "exps", "colors", "sprites"];
    hgetarray(pKey, keyArray, (err, reply) => {
      if (callback) {
        callback(playerName, err, reply);
      }
    });
  }

  setUserIpAddresses(username, value, callback) {
    const uKey = "u:" + username;
    client.hset(uKey, "ipAddresses", value, (err) => {
      if (callback) {
        callback(username, !err, err);
      }
    });
  }

  setUserLastLoginTime(username, value, callback) {
    const uKey = "u:" + username;
    client.hset(uKey, "lastLoginTime", value, (err) => {
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
    client.set("player_pending:" + nameLower, "1", "NX", "EX", ttlSeconds, (err, lockRes) => {
      if (callback) {
        callback(name, !err && !!lockRes, err);
      }
    });
  }

  // FIX: used to take the full `user` object (reading user.name/user.looks
  // directly) and apply a default-fill for a missing "looks2" value inline.
  // That default-fill is a business-logic decision (accountlogic.js's
  // AccountLogic.loadPlayerUserInfo() now makes it, using the same
  // user.looks fallback), not a data-retrieval concern -- this just takes a
  // plain username and hands back the raw [gems, looks2] pair.
  loadPlayerUserInfo(username, callback) {
    const uKey = "u:" + username;

    client.multi()
      .hget(uKey, "gems")
      .hget(uKey, "looks2")
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
  // gold_0/gold_1 (raw[4]/raw[5]) are handed back completely unparsed here
  // -- whatever's actually stored, string or null. Parsing them into real
  // ints is a data-manipulation decision, so it happens in
  // AccountLogic.loadPlayerInfo() (accountlogic.js), not here -- matching
  // this file's "primitives only" convention (see the REFACTOR comment at
  // the top of this file). The WU_SAVE_PLAYER_DATA wire format and
  // gameserver's userhandler.js/player.js read gold_0/gold_1 as two flat
  // elements now (not a combined string, and not a nested array either), so
  // this raw shape -- gold_0/gold_1 as two separate positions -- already
  // matches the wire format 1:1; AccountLogic.loadPlayerInfo() only needs
  // to convert the two raw strings to numbers, no reshaping.
  //
  // Migration: this used to also detect-and-repair a still-legacy player
  // right here on read (split the packed "gold" field and persist gold_0/
  // gold_1 the first time that player loaded). That per-load fallback is
  // gone now -- migrateGoldFields() below runs a one-time full-keyspace
  // pass at every server startup, and main.js blocks accepting any new
  // connection until it finishes (see migrationComplete in main.js). By the
  // time any player can log in and reach this function, gold_0/gold_1 are
  // guaranteed to already exist, so there's nothing left to detect or
  // repair here.
  loadPlayerInfo(playerName, callback) {
    const pKey = "p:" + playerName;

    client.hdel(pKey, "skillSlots");
    client.multi()
      .hget(pKey, "name")
      .hget(pKey, "map")
      .hget(pKey, "stats")
      .hget(pKey, "exps")
      .hget(pKey, "gold_0")
      .hget(pKey, "gold_1")
      .hget(pKey, "skills")
      .hget(pKey, "pStats")
      .hget(pKey, "sprites")
      .hget(pKey, "colors")
      .hget(pKey, "shortcuts")
      .hget(pKey, "completeQuests")
      .exec((err, raw) => {
        if (raw === null || !(typeof raw === 'object')) {
          return;
        }

        if (callback) {
          callback(playerName, raw);
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
  // null on success). Players that already have gold_0/gold_1 -- either
  // already migrated on a previous startup, or created fresh straight into
  // the new format -- are left untouched.
  migrateGoldFields(callback) {
    client.keys('p:*', (err, keys) => {
      if (err) {
        if (callback) callback(err);
        return;
      }

      if (keys.length === 0) {
        console.info("migrateGoldFields: no players found, nothing to migrate.");
        if (callback) callback(null);
        return;
      }

      let remaining = keys.length;
      let migratedCount = 0;
      let firstError = null;

      const checkDone = () => {
        remaining--;
        if (remaining === 0) {
          console.info("migrateGoldFields: complete -- migrated " + migratedCount +
            " of " + keys.length + " player(s).");
          if (callback) callback(firstError);
        }
      };

      for (const pKey of keys) {
        client.multi()
          .hget(pKey, "gold")
          .hget(pKey, "gold_0")
          .hget(pKey, "gold_1")
          .exec((err, raw) => {
            if (err) {
              console.error("migrateGoldFields: read failed for " + pKey + ": " + JSON.stringify(err));
              firstError = firstError || err;
              checkDone();
              return;
            }

            const [legacyGold, gold0, gold1] = raw;
/*
            if (gold0 != null && gold1 != null) {
              // Already on the new fields -- nothing to migrate.
              checkDone();
              return;
            }
*/
            const legacyParts = (typeof legacyGold === 'string') ? legacyGold.split(',') : [];
            const newGold0 = parseInt(legacyParts[0], 10) || 0;
            const newGold1 = parseInt(legacyParts[1], 10) || 0;

            client.multi()
              .hset(pKey, "gold_0", newGold0)
              .hset(pKey, "gold_1", newGold1)
              .hdel(pKey, "gold")
              .exec((err) => {
                if (err) {
                  console.error("migrateGoldFields: write failed for " + pKey + ": " + JSON.stringify(err));
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
  savePlayerInfo(playerName, data, callback) {
    const pKey = "p:" + playerName;

    client.multi()
      .sadd("player", data[0])
      .hset(pKey, "name", data[0])
      .hset(pKey, "map", data[1])
      .hset(pKey, "stats", data[2])
      .hset(pKey, "exps", data[3])
      .hset(pKey, "gold_0", data[4])
      .hset(pKey, "gold_1", data[5])
      .hset(pKey, "skills", data[6])
      .hset(pKey, "pStats", data[7])
      .hset(pKey, "sprites", data[8])
      .hset(pKey, "colors", data[9])
      .hset(pKey, "shortcuts", data[10])
      .hset(pKey, "completeQuests", data[11])
      .exec((err, replies) => {
        if (err) {
          console.warn(err);
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
  // Still check the field exists first (HINCRBY on a missing field would
  // just create it at goldAmount, silently masking what used to be a real
  // "no record for this player" error condition).
  addPlayerGoldOffline(playerName, goldAmount) {
    console.info("redis.addPlayerGoldOffline: playerName:" + playerName);
    console.info("goldAmount:" + goldAmount);

    const pKey = "p:" + playerName;
    client.hexists(pKey, "goldoffline", (err, exists) => {
      if (err || !exists) {
        if (err) {
          console.warn("redis.addPlayerGoldOffline: " + JSON.stringify(err));
        } else {
          console.error("redis.addPlayerGoldOffline - no goldoffline record for player '" + playerName + "' found.");
        }
        return;
      }

      client.hincrby(pKey, "goldoffline", goldAmount, (err, total) => {
        if (err) {
          console.warn("redis.addPlayerGoldOffline: save error, " + JSON.stringify(err));
          return;
        }
        // Preserve the previous Math.max(0, ...) clamp -- goldAmount can be
        // negative (a deduction), and this field should never go below 0.
        if (total < 0) {
          client.hset(pKey, "goldoffline", 0, (err) => {
            if (err) {
              console.warn("redis.addPlayerGoldOffline: clamp error, " + JSON.stringify(err));
            }
          });
        }
      });
    });
  }

  resetGoldOffline(playerName, callback) {
    console.info("redis.resetGoldOffline: playerName:" + playerName);
    const pKey = "p:" + playerName;
    client.hset(pKey, "goldoffline", 0, (err, data) => {
      if (err) {
        console.info("redis.resetGoldOffline: " + JSON.stringify(err));
      }
      if (callback) {
        callback(playerName);
      }
    });
  }

  getGoldOffline(playerName, callback) {
    console.info("redis.getGoldOffline: playerName:" + playerName);
    const pKey = "p:" + playerName;
    //console.info(pKey+","+golddiff+","+type);
    client.hget(pKey, "goldoffline", (err, data) => {
      console.info("getGoldOffline.gold: " + JSON.stringify(data));
      if (!data) {
        console.error("redis.getGoldOffline - no gold record for player '" + playerName + "' found.");
        if (callback) {
          callback(playerName, 0);
        }
        return;
      }
      if (err || !data || data === "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        return;
      }

      const gold = data.split(",");
      if (callback) {
        callback(playerName, parseInt(gold[0]));
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
    console.info("redis.modifyGold: playerName:" + playerName);
    console.info("golddiff:" + golddiff);
    console.info("type:" + type);

    type = type || 0;
    golddiff = parseInt(golddiff);
    const pKey = "p:" + playerName;
    const field = "gold_" + type;

    client.hincrby(pKey, field, golddiff, (err, total) => {
      if (err) {
        console.warn("redis.modifyGold: save gold error " + JSON.stringify(err));
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
      console.info("modifyGold.gold: " + JSON.stringify(total));
      if (callback) {
        callback(playerName, golddiff, type);
      }
    });
  }

  modifyGems(username, diff) {
    const uKey = "u:" + username;
    diff = parseInt(diff);

    client.hget(uKey, "gems", (err, data) => {
      let gems = parseInt(data);
      gems += diff;
      client.hset(uKey, "gems", gems);
    });
  }

  // ITEMS - BEGIN. New item store functions.

  // FIX: worldhandler.js's 3 call sites (inventory/bank/equipment) briefly
  // passed a 5th "maxNumber" argument -- (playername, type, storeType,
  // maxNumber, callback) -- while this only declared 4 params, which
  // silently bound maxNumber (e.g. 50) to this method's `callback` parameter
  // and dropped the real callback function entirely, throwing "callback is
  // not a function" on every player login. worldhandler.js's call sites no
  // longer pass maxNumber (it was never used here anyway), so this stays at
  // 4 params to match.
  loadItems(playerName, type, storeType, callback) {
    const pKey = "p:" + playerName;

    client.hget(pKey, storeType, (err, data) => {
      if (err || !data || data === "") {
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
    const pKey = "p:" + playerName;
    console.info("saveItems: " + data);
    console.info("pKey: " + pKey);
    console.info("storeType: " + storeType);
    client.hset(pKey, storeType, data, (err, replies) => {
      if (err || !data || data === "") {
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

  // ITEMS - END. End of Item Functions.

  // QUESTS - BEGIN. - TODO - Check quests variables (repeat needs to be removed.)
  // TODO - Just do new save rather than appending to key "quests".

  // example {id: id, type: 2, npcId: this.id, objectId: topEntity.kind, count: mobCount, repeat: repeat}
  saveQuests(playerName, data, callback) {
    const pKey = "p:" + playerName;

    client.hset(pKey, "newquests", data, (err, replies) => {
      if (err || !data || data === "") {
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
    console.info("loadQuest");
    const pKey = "p:" + playerName;

    client.hget(pKey, "newquests", (err, data) => {
      if (err || !data || data === "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        data = [];
      }
      console.info(pKey);
      console.info("getItems - data=" + data);
      if (callback) {
        callback(playerName, data);
      }
    });
  }
  // QUESTS - END.

  // ACHIEVEMENTS - START.
  saveAchievements(playerName, data, callback) {
    console.info("saveAchievement");
    const pKey = "p:" + playerName;
    client.hset(pKey, "achievements", data, (err, replies) => {
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
    console.info("loadAchievement");
    const pKey = "p:" + playerName;
    client.hget(pKey, "achievements", (err, data) => {
      if (err || !data || data === "") {
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
        console.warn("loadAuctions - err: " + JSON.stringify(err));
        console.warn("loadAuctions - data: " + JSON.stringify(reply));
        return;
      }
      if (callback) {
        callback(worldKey, reply);
      }
      return;
    });
  }

  saveAuctions(worldKey, data, callback) {
    console.info("redis - saveAuctions: " + JSON.stringify(data));
    const key = 's:auction-' + worldKey;
    client.del(key);
    const multi = client.multi();
    const exec = (data.length > 0);
    for (let i = 0; i < data.length; ++i) {
      multi.sadd(key, data[i]);
    }
    if (exec) {
      multi.exec((err, reply) => {
        if (err) {
          console.error("redis - saveAuctions: " + JSON.stringify(err));
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
    client.hget(key, "prices", (err, reply) => {
      if (err || !reply || reply === "") {
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
    console.info("redis - saveLooks: " /*+JSON.stringify(looks)*/);
    const key = 'l:looks-' + worldKey;
    client.del(key);
    client.hset(key, 'prices', looks.join(","), (err, reply) => {
      if (err) {
        console.error("redis - saveLooks:" + JSON.stringify(err));
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
        console.warn("loadBans - err: " + JSON.stringify(err));
        console.warn("loadBans - data: " + JSON.stringify(reply));
        return;
      }
      if (callback) {
        callback(worldKey, reply);
      }
      return;
    });
  }

  saveBans(worldKey, data, callback) {
    console.info("redis - saveBans: " /*+JSON.stringify(data)*/);

    const key = 'b:bans-' + worldKey;
    client.del(key);
    if (data.length === 0) {
      return;
    }
    console.warn("data:" + JSON.stringify(data));
    const multi = client.multi();
    for (let i = 0; i < data.length; ++i) {
      multi.sadd(key, data[i]);
    }
    multi.exec((err, reply) => {
      if (err) {
        console.error("redis - saveBans: " + JSON.stringify(err));
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
