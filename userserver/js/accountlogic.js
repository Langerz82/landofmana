/* global Types, Utils, users, log */

// REFACTOR: split out of redis.js's DatabaseHandler class. This is the
// account/player *business logic* layer -- registration and login
// orchestration, player creation, offline-gold-transfer sequencing, and
// data sanitization decisions -- as opposed to redis.js, which is now just
// the data store/retrieval layer (plain Redis reads/writes, plus the
// Redis-native atomic primitives this class calls into rather than
// reimplementing). See the REFACTOR comment at the top of redis.js for the
// full split rationale, especially why a few operations (username/player-
// name reservation, gold updates) stay as atomic primitives in redis.js
// instead of moving here.
//
// Instantiated once in main.js as `global.Accounts` (right after `DBH` is
// created), taking the `DBH` instance via constructor injection so it only
// ever talks to Redis through DatabaseHandler's public methods -- never a
// raw client. `Types`/`Utils`/`users` are referenced as bare globals here
// the same way the rest of this codebase does (see the equivalent NOTE
// comments in user.js/worldhandler.js): they're static, already-resolved
// exports from common.js (Types, Utils) or runtime-populated globals owned
// by main.js (users), not a circular import back to this file.

// FIX: moved here from redis.js's loadPlayerInfo() -- see loadPlayerInfo()
// below for how it's used. Repairs a malformed "gold" field (wrong field
// count, non-numeric entries, or the literal text "NaN") before it's ever
// handed to a gameserver. A prior bug in modifyGold()'s Lua script (see
// redis.js) could corrupt this field into an uneven-field-count CSV string
// (e.g. "100,,50,"), and once a gameserver loaded that malformed data, an
// in-memory NaN on its side could round-trip straight back here as the
// literal text "NaN" on the next save -- producing the
// "field 1: Invalid input: expected number, received NaN"
// WU_SAVE_PLAYER_DATA validation failure. Note: if a field was already
// corrupted, its real prior value is unrecoverable at this point (it was
// already overwritten upstream), so this resets that field to 0 rather
// than restoring lost gold.
const sanitizeGoldField = (raw) => {
  const parts = (typeof raw === 'string' ? raw.split(',') : []);
  let changed = (parts.length !== 2);
  const clean = [0, 1].map((i) => {
    const n = parseInt(parts[i], 10);
    if (!Number.isFinite(n) || n < 0) {
      changed = true;
      return 0;
    }
    return n;
  });
  return { value: clean.join(','), changed };
};

class AccountLogic {
  constructor(dbh) {
    this.dbh = dbh;
  }

  // FIX: this whole method was check-then-act -- ExistsUsername() (an
  // async smembers scan) had to come back false before anything below
  // ran, but nothing stopped two concurrent registrations for the same
  // username from both passing that check before either had written
  // anything. Whichever one's saveUserInfo() below landed second would
  // silently overwrite the first's hash/salt, letting the last request
  // "win" the account out from under the first registrant. SADD is
  // atomic in Redis -- it returns 0 if the member was already present --
  // so reserveUsername() (redis.js) uses it as the actual reservation
  // against the same "usr" set saveUserInfo() already adds to, rather
  // than only checking it first. Whichever request's SADD lands first
  // reserves the name; the loser sees added === false and bails before
  // writing anything else. (The ExistsUsername scan above is
  // case-insensitive and stays in front of this as a defense-in-depth
  // check for any differently-cased legacy data -- SADD itself is
  // case-sensitive, but usernames are expected to already be lowercased
  // by the caller, user.js's handleCreateUser.)
  createUser(user) {
    this.dbh.ExistsUsername(user.name, (name, res) => {
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

      this.dbh.reserveUsername(user.name, (name, added, err) => {
        if (err) {
          console.error("AccountLogic.createUser - usr SADD failed: " + JSON.stringify(err));
          user.handleUsernameTaken();
          return;
        }
        if (!added) {
          // Lost the race: another request reserved this exact username
          // between the ExistsUsername check above and this SADD.
          user.handleUsernameTaken();
          return;
        }

        const data = this.createUserValues(user);

        this.dbh.saveUserInfo(user.name, data, (username, data) => {
          user.hasLoggedIn = true;
          users.set(user.name, user);

          this.sendPlayers(user);
        });
      });
    });
  }

  createUserValues(user) {
    const lenLooks = AppearanceData.Data.length;
    user.looks = new Uint8Array(lenLooks);
    for (let i = 0; i < lenLooks; ++i) {
      user.looks[i] = 0;
    }

    user.looks[0] = 1;
    user.looks[50] = 1;
    user.looks[77] = 1;
    user.looks[151] = 1;

    user.gems = 2000;

    const curTime = new Date().getTime();
    const data = [
      user.hash,
      user.salt,
      0,
      '',
      curTime,
      0,
      '',
      user.gems,
      Utils.BinArrayToBase64(user.looks),
      user.connection._connection.remoteAddress
    ];

    return data;
  }

  removeUser(user) {
    this.dbh.loadUserInfo(user.name, (username, data) => {
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
            this.dbh.deletePlayerRecord(playerNames[i]);
          }
          this.dbh.deleteUserRecord(user.name);
          this.dbh.unreserveUsername(user.name);
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
    this.dbh.ExistsUsername(user.name, (name, res) => {
      if (!res) {
        user.connection.send([Types.UserMessages.UC_ERROR, "invalidlogin"]);
        return;
      }

      this.dbh.loadUserInfo(user.name, (username, data) => {
        /*const db_user = {
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
        };*/

        this.loadUserData(user, data);

        // FIX: checkUser() can no longer synchronously return true/false now
        // that it may need to bcrypt.compare() (inherently async) -- see the
        // FIX comment on checkUser() in user.js. Pass a callback instead
        // (this function's own return value was already discarded by the
        // enclosing loadUserInfo callback either way).
        user.checkUser(data, false, (matched) => {
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
            this.dbh.setUserIpAddresses(user.name, ipAddress);
          } else {
            if (!String(data.ipAddresses).includes(ipAddress)) {
              this.dbh.setUserIpAddresses(user.name, data.ipAddresses + "," + ipAddress);
            }
          }
          this.dbh.setUserLastLoginTime(user.name, new Date().getTime());

          this.sendPlayers(user);
        });
      });
    });
  }

  loadUserData(user, data) {
    if (!data.gems) {
      data.gems = 2000;
    } else {
      data.gems = parseInt(data.gems);
    }

    const len = AppearanceData.Data.length;
    data.looks = new Uint8Array(len);
    if (data.looks2) {
      data.looks = Utils.Base64ToBinArray(data.looks2, len);
    }

    // [77,0,151,50] - Beginner Looks values.
    data.looks[0] = 1;
    data.looks[50] = 1;
    data.looks[77] = 1;
    data.looks[151] = 1;

    console.info(JSON.stringify(data));

    // FIX: was `user.looks = ...` / `user.gems = ...` -- `user` isn't
    // defined anywhere in this method's scope (no such parameter or local),
    // so this threw ReferenceError: user is not defined on every login.
    // Should be `this`, same as the equivalent assignments in
    // createDefaultValues() above.
    user.looks = data.looks;
    user.gems = data.gems;

    return data;
  }

  createPlayerNameInUser(username, playerName, callback) {
    // Create Player Name in User account.
    this.dbh.getUserPlayerNames(username, (username, reply) => {
      let db_players = [];
      if (reply) {
        db_players = reply.split(",");
      }

      if (!db_players.includes(playerName)) {
        db_players.push(playerName);
        this.dbh.setUserPlayerNames(username, db_players.join(","));
      }
      if (callback) {
        callback();
      }
    });
  }

  sendPlayers(user) {
    this.dbh.getUserPlayerNames(user.name, (username, reply) => {
      console.info("players_reply:" + reply);
      if (reply === null || reply === "") {
        user.sendPlayers();
        return;
      }
      const playerNames = reply.split(",");
      const db_players = [];
      let count = 0;
      for (let i = 0; i < playerNames.length; ++i) {
        this.dbh.getPlayerSummaryFields(playerNames[i], (playerName, err, reply) => {
          if (err || !reply[0]) {
            console.info("AccountLogic.sendPlayers, err:" + JSON.stringify(err));
            ++count;
            return;
          }

          console.info("reply:" + JSON.stringify(reply));
          const db_player = {
            "name": reply[0],
            "map": reply[1].split(",")[0], // MapIndex.
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
  // savePlayerInfo() (redis.js), which fires only after a full round trip
  // through worldhandler.js's createPlayerToWorld() -> gameserver load ->
  // WU_SAVE_PLAYER_DATA handshake (multiple seconds, not a single async
  // tick). Two different users could both pass the ExistsPlayerName check
  // here for the same name within that window, and whichever's
  // savePlayerInfo() landed second would silently overwrite the other's
  // "p:<name>" character data. Take out a short-lived, self-expiring
  // reservation lock right here instead via reservePlayerNameLock()
  // (redis.js's atomic SET NX EX) -- with a TTL so an abandoned/failed
  // creation doesn't permanently squat the name forever. savePlayerInfo()'s
  // own sadd("player", data[0]) is still the real, permanent reservation
  // once creation actually succeeds; this just closes the gap before that.
  createPlayer(playerName, callback) {
    this.dbh.ExistsPlayerName(playerName, (name, res) => {
      if (res) {
        if (callback) {
          callback(playerName, false);
        }
        return;
      }

      this.dbh.reservePlayerNameLock(playerName, 60, (name, acquired, err) => {
        if (err) {
          console.error("AccountLogic.createPlayer - reservation lock failed: " + JSON.stringify(err));
          if (callback) {
            callback(playerName, false);
          }
          return;
        }
        if (!acquired) {
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

  transferOfflineGold(playerName, callback) {
    console.info("AccountLogic.transferOfflineGold: playerName:" + playerName);

    this.dbh.getGoldOffline(playerName, (playerName, addGold) => {
      this.dbh.modifyGold(playerName, addGold, 0, (playerName) => {
        this.dbh.resetGoldOffline(playerName, (playerName) => {
          if (callback) {
            callback(playerName);
          }
        });
      });
    });
  }

  // FIX: the "looks2 missing -> default-fill from user.looks" decision used
  // to live inline in redis.js's loadPlayerUserInfo(), which took the whole
  // `user` object just to read user.name/user.looks. That default-fill is a
  // business-logic decision, not a data-retrieval concern -- redis.js's
  // loadPlayerUserInfo() now just takes a plain username and hands back the
  // raw [gems, looks2] pair; this applies the same fallback on top of it.
  loadPlayerUserInfo(user, callback) {
    this.dbh.loadPlayerUserInfo(user.name, (username, data) => {
      if (data[1] === null) {
        const b64 = Utils.BinArrayToBase64(user.looks);
        data[1] = b64;
      }

      if (callback) {
        callback(username, data);
      }
    });
  }

  // FIX: see sanitizeGoldField() above -- repair a malformed "gold" field
  // before it's ever handed to a gameserver, and persist the repair back to
  // Redis (via setPlayerGold()) so this doesn't need to be re-detected on
  // every subsequent load. This decision used to live inline in redis.js's
  // loadPlayerInfo(); that method now just hands back raw hget results.
  loadPlayerInfo(playerName, callback) {
    this.dbh.loadPlayerInfo(playerName, (playername, data) => {
      const goldFix = sanitizeGoldField(data[4]);
      if (goldFix.changed) {
        console.warn("AccountLogic.loadPlayerInfo - repairing malformed gold field for '" + playername + "': " + JSON.stringify(data[4]) + " -> " + goldFix.value);
        this.dbh.setPlayerGold(playername, goldFix.value);
      }
      data[4] = goldFix.value;

      if (callback) {
        callback(playername, data);
      }
    });
  }
}

export default AccountLogic;
