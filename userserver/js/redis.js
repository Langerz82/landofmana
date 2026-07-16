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

const getStoreTypeNew = function(type) {
  let sType;
  switch (type) {
    case 0: // Inventory Item
      sType = "inventory";
      break;
    case 1: // Bank Item
      sType = "bank";
      break;
    case 2: // Equipped Item
      sType = "equipment";
      break;
  }
  return sType;
};

const getItemsStoreCount = function (type) {
  if (type === 1) return 96;
  if (type === 2) return 5;
  return 50;
};

// TODO Array parseInt where appropriate.

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

  createUser(user) {
    const uKey = "u:" + user.name;

    // Check if username is taken
    this.ExistsUsername(user.name, (name, res) => {
      if (res) {
        // FIX: was closing the connection on the very first "username taken" hit, so a
        // player who fat-fingered or picked an already-registered name got booted back to a
        // dead connection with one shot at registration. The attempt-counting/lockout logic
        // now lives on User (handleUsernameTaken() in user.js, next to the equivalent
        // passwordTries handling in checkUser()) rather than here, since it's User's own
        // state (usernameTries/connection) being managed, not anything DB-specific.
        user.handleUsernameTaken();
        return;
      }

      // FIX: this whole method was check-then-act -- ExistsUsername() (an
      // async smembers scan) had to come back false before anything below
      // ran, but nothing stopped two concurrent registrations for the same
      // username from both passing that check before either had written
      // anything. Whichever one's saveUserInfo() below landed second would
      // silently overwrite the first's hash/salt, letting the last request
      // "win" the account out from under the first registrant. SADD is
      // atomic in Redis -- it returns 0 if the member was already present --
      // so use it here as the actual reservation against the same "usr" set
      // saveUserInfo() already adds to, rather than only checking it first.
      // Whichever request's SADD lands first reserves the name; the loser
      // sees added === 0 and bails before writing anything else. (The
      // ExistsUsername scan above is case-insensitive and stays in front of
      // this as a defense-in-depth check for any differently-cased legacy
      // data -- SADD itself is case-sensitive, but usernames are expected to
      // already be lowercased by the caller, user.js's handleCreateUser.)
      client.sadd("usr", user.name, (err, added) => {
        if (err) {
          console.error("createUser - usr SADD failed: " + JSON.stringify(err));
          user.handleUsernameTaken();
          return;
        }
        if (!added) {
          // Lost the race: another request reserved this exact username
          // between the ExistsUsername check above and this SADD.
          user.handleUsernameTaken();
          return;
        }

        let data = user.createDefaultValues();

        this.saveUserInfo(user.name, data, (username, data) => {
          user.hasLoggedIn = true;
          users.set(user.name, user);

          this.sendPlayers(user);
        });
      });
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

  removeUser(user) {
    const uKey = "u:" + user.name;

    //console.error("uKey:"+uKey);
    client.hgetall(uKey, (err, data) => {
      console.info("replies: " + data);
      console.info(JSON.stringify(data));
      if (data === null || !(typeof data === 'object')) {
        return;
      }

      const db_user = {
        "hash": data.hash,
        "salt": data.salt
      };

      console.info(JSON.stringify(db_user));
      console.error("USER CHECK USER");
      // FIX: checkUser() can no longer synchronously return true/false now
      // that it may need to bcrypt.compare() (inherently async) -- see the
      // FIX comment on checkUser() in user.js. Pass a callback instead.
      user.checkUser(db_user, true, (matched) => {
        if (matched) {
          console.error("USER CHECK USER SUCCESS");
          const playerNames = data.players.split(",");
          for (let i = 0; i < playerNames.length; ++i) {
            const pKey = "p:" + playerNames[i];
            client.del(pKey);
          }
          client.del(uKey);
          client.srem("usr", user.name);
          user.connection.send([Types.UserMessages.UC_ERROR, "removed_user_ok"]);
          user.connection.close();
          return;
        }
        user.connection.send([Types.UserMessages.UC_ERROR, "removed_user_fail"]);
        user.connection.close();
      });
    });
  }

  // TODO load created Player summaries too.
  loadUser(user) {
    const uKey = "u:" + user.name;
    const curTime = new Date().getTime();

    this.ExistsUsername(user.name, (name, res) => {
      if (!res) {
        user.connection.send([Types.UserMessages.UC_ERROR, "invalidlogin"]);
        return false;
      }

      client.hgetall(uKey, (err, data) => {
        console.info("replies: " + data);
        console.info(JSON.stringify(data));
        if (data === null || !(typeof data === 'object')) {
          return false;
        }
        //console.info(replies.toString());

        // FIX: this redeclared `const db_user` in the same scope --
        // SyntaxError: Identifier 'db_user' has already been declared. Since
        // this is a top-level module parse error (not something caught by a
        // try/catch at runtime), it broke loading this entire file, which
        // means the whole userserver process couldn't start. user.loadUser()
        // mutates and returns the same object it's given, so there's no
        // need for a second binding here at all -- just call it.
        const db_user = {
          "hash": data.hash,
          "salt": data.salt,
          "banTime": data.banTime,
          "banDuration": data.banDuration,
          "lastLoginTime": data.lastLoginTime,
          "membership": data.membership,
          "players": data.players,
          "ipAddresses": data.ipAddresses,
          "gems": data.gems,
          // FIX: was `"looks": data.looks2`. User.prototype.loadUser() in
          // user.js reads this field as `db_user.looks2` (to decode the
          // saved base64 appearance data) -- naming it "looks" here meant
          // that check was always undefined/falsy, so the decode branch
          // never ran and every login silently reset the player's saved
          // look to the all-zero/beginner default instead of loading what
          // they actually had saved.
          "looks2": data.looks2
        };

        user.loadUser(db_user);

        // FIX: checkUser() can no longer synchronously return true/false now
        // that it may need to bcrypt.compare() (inherently async) -- see the
        // FIX comment on checkUser() in user.js. Pass a callback instead
        // (this function's own return value was already discarded by the
        // enclosing client.hgetall callback either way).
        user.checkUser(db_user, false, (matched) => {
          if (!matched) {
            return;
          }
          const ipAddress = user.connection._connection.remoteAddress;
          // Was reading "ipAddesses" (typo) which never matched the stored
          // "ipAddresses" field, so this always fell into the first branch and
          // overwrote the IP history with just the current IP on every login.
          // Also `toString(...)` was called as a bare function rather than
          // String(data.ipAddresses)/data.ipAddresses.toString().
          if (!data.ipAddresses) {
            client.hset(uKey, "ipAddresses", ipAddress);
          } else {
            if (!String(data.ipAddresses).includes(ipAddress)) {
              client.hset(uKey, "ipAddresses", db_user.ipAddresses + "," + ipAddress);
            }
          }
          client.hset(uKey, "lastLoginTime", new Date().getTime());

          this.sendPlayers(user);
        });
      });
    });
  }

  createPlayerNameInUser(username, playerName, callback) {
    const uKey = "u:" + username;
    // Create Player Name in User account.
    client.hget(uKey, "players", (err, reply) => {
      let db_players = [];
      if (reply) {
        db_players = reply.split(",");
      }

      if (!db_players.includes(playerName)) {
        db_players.push(playerName);
        client.hset(uKey, "players", db_players.join(","));
      }
      if (callback) {
        callback();
      }
    });
  }

  sendPlayers(user) {
    const uKey = "u:" + user.name;
    client.hget(uKey, "players", (err, reply) => {
      console.info("players_reply:" + reply);
      if (reply === null || reply === "") {
        user.sendPlayers();
        return;
      }
      const playerNames = reply.split(",");
      const db_players = [];
      let count = 0;
      for (let i = 0; i < playerNames.length; ++i) {
        const pKey = "p:" + playerNames[i];
        console.info("pKey:" + pKey);
        const keyArray = ["name", "map", "exps", "colors", "sprites"];
        hgetarray(pKey, keyArray, (err, reply) => {
          if (err || !reply[0]) {
            console.info("redis - sendPlayers, err:" + JSON.stringify(err));
            ++count;
            return;
          }

          //console.info("err:"+JSON.stringify(err));
          console.info("reply:" + JSON.stringify(reply));
          const db_player = {
            "name": reply[0],
            "map": reply[1].split(",")[0], // MapIndex.
            // "pClass": reply[2] || 0,
            "exp": reply[2].split(",")[0], // Base XP.
            "colors": reply[3].split(","),
            "sprites": reply[4].split(",")
          };
          db_players.push(db_player);
          if (++count === playerNames.length) {
            user.sendPlayers(db_players);
          }
        });
      }
    });
  }

  // FIX: this only ever checked ExistsPlayerName() and reported true/false --
  // the actual reservation (sadd("player", data[0])) didn't happen until
  // savePlayerInfo(), which fires only after a full round trip through
  // worldhandler.js's createPlayerToWorld() -> gameserver load ->
  // WU_SAVE_PLAYER_DATA handshake (multiple seconds, not a single async
  // tick). Two different users could both pass the ExistsPlayerName check
  // here for the same name within that window, and whichever's
  // savePlayerInfo() landed second would silently overwrite the other's
  // "p:<name>" character data. Take out a short-lived, self-expiring
  // reservation lock right here instead (SET NX -- atomic "only if not
  // already set" -- with a TTL so an abandoned/failed creation doesn't
  // permanently squat the name forever). savePlayerInfo()'s own
  // sadd("player", data[0]) is still the real, permanent reservation once
  // creation actually succeeds; this just closes the gap before that.
  createPlayer(playerName, callback) {
    const nameLower = playerName.toLowerCase();

    // Check if playerName is already a permanent record.
    this.ExistsPlayerName(playerName, (name, res) => {
      if (res) {
        if (callback) {
          callback(playerName, false);
        }
        return;
      }

      client.set("player_pending:" + nameLower, "1", "NX", "EX", 60, (err, lockRes) => {
        if (err) {
          console.error("createPlayer - reservation lock failed: " + JSON.stringify(err));
          if (callback) {
            callback(playerName, false);
          }
          return;
        }
        if (!lockRes) {
          // Someone else is already in the middle of creating this exact
          // player name right now.
          if (callback) {
            callback(playerName, false);
          }
          return;
        }

        console.info("CREATING PLAYER");
        if (callback) {
          callback(playerName, true);
        }
      });
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

  loadPlayerUserInfo(user, callback) {
    const uKey = "u:" + user.name;

    client.multi()
      .hget(uKey, "gems")
      .hget(uKey, "looks2")
      .exec((err, data) => {
        if (data === null || !(typeof data === 'object')) {
          return;
        }

        if (data[1] === null) {
          const b64 = Utils.BinArrayToBase64(user.looks);
          data[1] = b64;
        }

        if (callback) {
          callback(user.name, data);
        }
      });
  }

  loadPlayerInfo(playerName, callback) {
    const pKey = "p:" + playerName;

    client.hdel(pKey, "skillSlots");
    client.multi()
      .hget(pKey, "name")
      .hget(pKey, "map")
      .hget(pKey, "stats")
      .hget(pKey, "exps")
      .hget(pKey, "gold")
      .hget(pKey, "skills")
      .hget(pKey, "pStats")
      .hget(pKey, "sprites")
      .hget(pKey, "colors")
      .hget(pKey, "shortcuts")
      .hget(pKey, "completeQuests")
      .exec((err, data) => {
        if (data === null || !(typeof data === 'object')) {
          return;
        }

        if (callback) {
          callback(playerName, data);
        }
      });
  }

  savePlayerInfo(playerName, data, callback) {
    const pKey = "p:" + playerName;

    client.multi()
      .sadd("player", data[0])
      .hset(pKey, "name", data[0])
      .hset(pKey, "map", data[1])
      .hset(pKey, "stats", data[2])
      .hset(pKey, "exps", data[3])
      .hset(pKey, "gold", data[4])
      .hset(pKey, "skills", data[5])
      .hset(pKey, "pStats", data[6])
      .hset(pKey, "sprites", data[7])
      .hset(pKey, "colors", data[8])
      .hset(pKey, "shortcuts", data[9])
      .hset(pKey, "completeQuests", data[10])
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

  transferOfflineGold(playerName, callback) {
    console.info("redis.transferOfflineGold: playerName:" + playerName);

    this.getGoldOffline(playerName, (playerName, addGold) => {
      this.modifyGold(playerName, addGold, 0, (playerName) => {
        this.resetGoldOffline(playerName, (playerName) => {
          if (callback) {
            callback(playerName);
          }
        });
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
  // adding/subtracting it. "gold" packs multiple currency "types" into one
  // comma-separated field, so a plain atomic op like HINCRBY can't target
  // one type in isolation -- run the whole read/split/modify/join/write as
  // a single Lua script instead, so Redis executes it with no other
  // client's command able to interleave in the middle.
  modifyGold(playerName, golddiff, type, callback) {
    console.info("redis.modifyGold: playerName:" + playerName);
    console.info("golddiff:" + golddiff);
    console.info("type:" + type);

    type = type || 0;
    golddiff = parseInt(golddiff);
    const pKey = "p:" + playerName;

    // FIX: was `string.gmatch(data, '([^,]*)')` -- the classic Lua gotcha
    // of using `*` (zero-or-more) instead of `+` (one-or-more) to split a
    // comma-separated string. `*` lets the pattern match an empty string,
    // so gmatch yields a spurious "" match at every comma boundary AND one
    // more at the end of the string -- e.g. "100,50" split this way came
    // out as {"100", "", "50", ""} (4 parts), not {"100", "50"} (2 parts).
    // table.concat then wrote that back as "100,,50," -- silently
    // corrupting the "gold" field's CSV shape on every single call to this
    // function. Downstream, something reading that corrupted 4-field
    // string positionally (expecting exactly 2 fields) picked up an empty
    // string for the real second value, which became NaN once parsed as a
    // number in JS and then got re-serialized as the literal text "NaN" --
    // producing exactly the "field 1: Invalid input: expected number,
    // received NaN" WU_SAVE_PLAYER_DATA validation failure this was
    // reported as. `+` requires at least one non-comma character per
    // match, so it can't produce empty matches and correctly yields just
    // {"100", "50"} -- this also self-heals any already-corrupted "gold"
    // field the next time this function runs for that player, since `+`
    // simply skips over the spurious empty segments already baked into it.
    const script = `
      local data = redis.call('HGET', KEYS[1], 'gold')
      if not data or data == '' then
        return nil
      end
      local parts = {}
      for part in string.gmatch(data, '([^,]+)') do
        table.insert(parts, part)
      end
      local idx = tonumber(ARGV[1]) + 1
      local cur = tonumber(parts[idx]) or 0
      parts[idx] = tostring(cur + tonumber(ARGV[2]))
      local joined = table.concat(parts, ',')
      redis.call('HSET', KEYS[1], 'gold', joined)
      return joined
    `;

    client.eval(script, 1, pKey, type, golddiff, (err, result) => {
      if (err) {
        console.warn("redis.modifyGold: save gold error " + JSON.stringify(err));
        if (callback) {
          callback(playerName, golddiff, type);
        }
        return;
      }
      if (result === null) {
        console.error("redis.modifyGold - no gold record for player '" + playerName + "' found.");
        if (callback) {
          callback(playerName, golddiff, type);
        }
        return;
      }

      console.info("modifyGold.gold: " + JSON.stringify(result));
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

  loadItems(playerName, type, callback) {
    const pKey = "p:" + playerName;

    const maxNumber = getItemsStoreCount(type);
    const sType = getStoreTypeNew(type);

    client.hget(pKey, sType, (err, data) => {
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

  saveItems(playerName, type, data, callback) {
    const pKey = "p:" + playerName;
    const sType = getStoreTypeNew(type);
    console.info("saveItems: " + data);
    console.info("pKey: " + pKey);
    console.info("sType: " + sType);
    client.hset(pKey, sType, data, (err, replies) => {
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
