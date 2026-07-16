/* global require, module, log, DBH, Accounts */

import crypto from 'crypto';
import formatChecker from "./format.js";
import UserMessages from "./usermessage.js";
// FIX: this file used `Types.UserMessages.*` (in the `listener` below) and
// `Utils.ArrayParseInt` (in sendLooksToWorld) with no import for either --
// same missing-import pattern just fixed in format.js, and for the same
// reason it didn't already blow up: every reference here lives inside a
// runtime callback (the connection listener, or a DBH.* callback), not at
// module-load time, so by the time any of them actually run, main.js has
// long since imported common.js and set global.Types/global.Utils. Safe in
// practice, but still a hidden load-order dependency for no reason -- Types
// and Utils are both static, already-resolved exports from common.js with
// no import cycle back to this file (unlike MainConfig/DBH/users/
// worldHandlers below, which really are runtime-populated globals owned by
// main.js -- see the note above the class for why those are left as-is).
import { Types, Utils } from './common.js';

// FIX: added for handleGameServerInfo()'s shared-secret comparison below --
// plain `===` on a password/secret string short-circuits on the first
// mismatched character, a timing side channel against the boundary that
// decides which connections are trusted as a real gameserver (and so get
// handed auction/looks/ban data). Not added to the shared Utils
// (shared/js/utils.js) since that file is also bundled into the browser
// client, where Node's `crypto` module isn't available.
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length)
    return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// NOTE: MainConfig (used in handleGameServerInfo), DBH (used throughout),
// users (used in handlePlayerLoggedIn), and worldHandlers are still
// referenced as bare globals, not imports. Unlike Types/Utils above, these
// are genuinely mutable runtime state owned by userserver/js/main.js (see
// `global.MainConfig = null` / `global.DBH = null` / `global.users = new
// Map()` there, populated later as config loads and connections come in),
// and main.js is this file's own importer -- importing back from it would
// be a real circular dependency, not just a missing static import. Left as
// the same global-object pattern the rest of this codebase already uses
// for this kind of shared mutable state, rather than restructuring the
// startup sequence as part of a packet-validation pass.
class WorldHandler {
    constructor(main, connection) {
        const self = this;

        this.main = main;
        this.connection = connection;
        this.world = null;

        this.SAVED_AUCTIONS = false;
        this.SAVED_LOOKS = false;
        this.SAVED_BANS = false;
        this.SAVED_PLAYERS = true;
        this.playerSaveData = {};
        this.playerLoadData = {};
        this.playerCreateData = {};
        this.loggedInUsers = new Map();

        // FIX: this WorldHandler instance is a singleton shared by every
        // player logging into this world (one instance per connected
        // gameserver -- see main.js's `worldHandlers` array), not one per
        // player. sendPlayerToWorld()/createPlayerToWorld() used to stash
        // the player's `user` object on the shared `this.user` field while
        // several async DB calls (DBH.loadPlayerUserInfo, etc.) were still
        // in flight. If a second player logged in before the first
        // player's DB calls resolved, `this.user` got overwritten with the
        // second player's `user` -- so the first player's load-data
        // package (and the eventual WorldReady reply routed via
        // sendClient()) got stamped with the WRONG user's hash/connection.
        // The gameserver then failed to find that (mismatched) hash in its
        // `hashes` map and disconnected the client -- exactly the
        // "second player logs in, another connection closes" symptom.
        // `playerLoadData`/`playerCreateData` above already avoid this by
        // being keyed per-playername; `pendingLogins` does the same for
        // the `user` object itself, so concurrent logins can no longer
        // clobber each other.
        this.pendingLogins = new Map();

        this.block = false;
        this.listener = function(message) {
          console.info("recv[0]="+message);
          const action = parseInt(message[0]);
          if (!action)
            return;

          if(!formatChecker.check(message)) {
              self.connection.close("Invalid value "+action+" packet format: "+message);
              return;
          }
          message.shift();

          if (action === Types.UserMessages.WU_GAMESERVER_INFO) {
            self.handleGameServerInfo(message);
            return;
          }

          if (!self.game_server)
            return;

          if (action === Types.UserMessages.WU_UPDATE_PLAYER_COUNT) {
              self.handleUpdatePlayerCount(message);
              return;
          }
          else if (action === Types.UserMessages.WU_SAVE_PLAYER_DATA) {
              self.handleSavePlayerData(message);
              return;
          }
          else if (action === Types.UserMessages.WU_PLAYER_LOGGED_IN) {
              self.handlePlayerLoggedIn(message);
              return;
          }
          else if (action === Types.UserMessages.WU_SAVE_PLAYERS_LIST) {
              self.handleSavePlayersList(message);
              return;
          }
          else if (action === Types.UserMessages.WU_PLAYER_LOADED) {
              self.handlePlayerLoaded(message);
              return;
          }
          else if (action === Types.UserMessages.WU_SAVE_PLAYER_AUCTIONS) {
              self.handleSavePlayerAuctions(message);
              return
          }
          else if (action === Types.UserMessages.WU_SAVE_PLAYER_LOOKS) {
              self.handleSavePlayerLooks(message);
              return;
          }
          else if (action === Types.UserMessages.WU_SAVE_USER_BANS) {
              self.handleSaveUserBans(message);
              return;
          }
          else if (action === Types.UserMessages.WU_ADD_PLAYER_GOLD) {
              self.handleAddPlayerGold(message);
              return;
          }
        };
        this.connection.listen(this.listener);
    }

    send(message) {
      this.connection.send(message);
    }

    // FIX: used to read the shared `this.user` singleton instead of taking
    // the target user explicitly -- see the `pendingLogins` comment in the
    // constructor. That meant a reply could get routed to whichever
    // player's login happened to be the most recent, not necessarily the
    // player the message was actually about.
    sendClient(user, message) {
      if (user)
        user.connection.send(message.serialize());
      else {
        console.warn("sendClient called without user set: "+JSON.stringify(message.serialize()))
      }
    }

    sendMessage(message) {
      this.connection.send(message.serialize());
    }

    handleSavePlayersList (msg) {
      console.info("handleSavePlayersList: "+JSON.stringify(msg));
      if (msg[0].length === 0) {
        this.SAVED_PLAYERS = true;
        return;
      }
      this.SAVED_PLAYERS = false;
    }

    handleSavePlayerAuctions (msg) {
      console.info("worldHandler, handleSavePlayerAuctions: "+JSON.stringify(msg));
      const self = this;
      if (!this.world) {
        console.warn("handleSavePlayerAuctions: world is not set.");
        return;
      }
      if (Array.isArray(msg) && msg.length === 0) {
        self.SAVED_AUCTIONS = true;
        return;
      }

      DBH.saveAuctions(this.world.key, msg, function (key, data) {
        self.SAVED_AUCTIONS = true;
      });
    }

    handleSavePlayerLooks (msg) {
      console.info("worldHandler, handleSavePlayerLooks: "/*+JSON.stringify(msg)*/);
      const self = this;
      if (!this.world) {
        console.warn("handleSavePlayerLooks: world is not set.");
        return;
      }
      // NOTE (checked, not changed): `msg` here is always a single-element
      // array wrapping the full looks CSV string (see world/looks.js's
      // `this.prices.join(",")` on the sending side, and format.js's
      // WU_SAVE_PLAYER_LOOKS special case, which validates `message[0]` as
      // that CSV string). redis.js's saveLooks(worldKey, looks, callback)
      // calls `looks.join(",")` on its second argument -- i.e. it requires
      // an ARRAY, not a raw string (strings have no .join method). Passing
      // `msg` (the array) is correct: Array.prototype.join on a
      // single-element array just stringifies that one element with no
      // separator, so `[csvString].join(",")` reconstructs `csvString`
      // exactly. An earlier pass here "fixed" this to `msg[0]` (the bare
      // string) on the theory that unwrapping it was clearer -- that's
      // wrong: `msg[0].join is not a function` throws on every save,
      // confirmed with a quick check. Reverted; `msg` is the correct call.
      DBH.saveLooks(this.world.key, msg, function (key, data) {
        self.SAVED_LOOKS = true;
      });
    }

    handleSaveUserBans (msg) {
      console.info("worldHandler, handleSaveUserBans: "/*+JSON.stringify(msg)*/);
      const self = this;
      if (!this.world) {
        console.warn("handleSaveUserBans: world is not set.");
        return;
      }
      if (Array.isArray(msg[0]) && msg[0].length === 0) {
        self.SAVED_BANS = true;
        return;
      }

      DBH.saveBans(this.world.key, msg[0], function (key, data) {
        self.SAVED_BANS = true;
      });
    }

    release () {
        console.info("worldHandler released.");
        for (const tmp of this.loggedInUsers) {
          console.info("releasing user: "+tmp);
        }
        delete this.loggedInUsers;
        delete this.pendingLogins;
        // FIX: `delete this;` is a no-op -- delete only removes properties
        // from an object via a property reference; `this` itself isn't a
        // deletable binding, so this line never did anything. Removed.
    }

    handlePlayerLoggedIn (msg) {
      console.info("handlePlayerLoggedIn: "+JSON.stringify(msg));
      const status = Number(msg[0]);
      const username = msg[1];
      const playerName = msg[2];

      if (status === 1) {
        this.loggedInUsers.set(username, users.get(username));
      }
      else {
        this.loggedInUsers.delete(username);
      }
    }

    handleGameServerInfo (msg) {
      console.info("handleGameServerInfo: "+JSON.stringify(msg));
      const self = this;

      const world = {
        name: msg[0],
        count: parseInt(msg[1]),
        maxCount: parseInt(msg[2]),
        ipAddress: msg[3],
        port: parseInt(msg[4]),
        password: msg[5],
        key: msg[6]
      };

      if (safeCompare(world.password, MainConfig.user_password)) {
        this.game_server = true;
      }
      else {
        return;
      }

      this.world = world;

      self.sendAuctionsToWorld(self.worldIndex);
      self.sendLooksToWorld(self.worldIndex);
      self.sendBansToWorld(self.worldIndex);
    }

    handleUpdatePlayerCount (msg) {
      this.world.count = parseInt(msg[0]);
      this.world.maxCount = parseInt(msg[1]);
    }

    // TODO FIX - Add playername in packet.

    handleSavePlayerData (msg) {
      console.info("handleSavePlayerData: "+JSON.stringify(msg));

      const self = this;

      // NOTE: this whole handler runs synchronously inside this connection's
      // socket.io 'message' dispatch. Previously nothing here was guarded, so
      // any exception (e.g. malformed msg/data shape) would go uncaught,
      // propagate up through socket.io's internal dispatch for this specific
      // gameserver connection, and could tear the connection down instead of
      // just failing this one save. Wrapping in try/catch turns that into a
      // logged error instead of a dropped connection, and the logged stack
      // pinpoints exactly what's malformed if this is in fact firing.
      try {
        const playerName = msg[0];

        const data = msg[1];

        const update = (parseInt(msg[2]) === 1);

        // FIX: this used to `return` here -- silently discarding the whole
        // save payload (all 7 DB writes below) -- whenever playerName
        // wasn't already a key in playerSaveData. That guard was meant to
        // catch stale saves for a player this WorldHandler never loaded,
        // but it also fires for two legitimate cases where the gameserver
        // is holding perfectly good save data:
        //   1. This WorldHandler instance is per gameserver *connection*
        //      (see `new WorldHandler(...)` in main.js), not per player. If
        //      the gameserver reconnects mid-session, a brand new instance
        //      with an empty playerSaveData is created here, but players
        //      already logged in on the gameserver side don't re-run the
        //      load handshake -- so their next save arrives "unregistered"
        //      even though they're a normal connected player.
        //   2. A save can race ahead of the load handshake finishing (the
        //      handshake sets playerSaveData[playerName] only after all 7
        //      load pieces are collected -- see sendPlayerToWorld/
        //      createPlayerToWorld above).
        // In both cases the incoming data[] is valid and safe to persist,
        // so instead of dropping it we self-register the player here and
        // fall through to the normal save path. Downgraded to console.info
        // since this is now a handled/recovered case, not a lost save.
        if (!this.playerSaveData.hasOwnProperty(playerName)) {
          console.info("handleSavePlayerData: "+playerName+" was not registered in playerSaveData (likely a gameserver reconnect or a save that raced the load handshake) -- self-registering and continuing with save instead of dropping it.");
        }

        this.playerSaveData[playerName] = 0;

        // NOTE - Remove the userame and hash from the data.
        const username = data[0].shift();
        const hash = data[0].shift();

        const checkPlayerSaved = function (playerName) {
            try {
              self.playerSaveData[playerName]++;
              if (self.playerSaveData[playerName] === 7) {
                Accounts.createPlayerNameInUser(username, playerName);
                // FIX: this transferOfflineGold call used to be gated on the
                // ENTIRE playerSaveData map being empty, rather than on this
                // specific player's save finishing. With more than one player
                // connected through this WorldHandler, the map only empties
                // once every player has logged out (delete only happens
                // below, and only when `!update`) -- so a given player's
                // offline-earned gold (e.g. from an auction sale settled
                // while they were offline) was effectively only ever
                // transferred on the rare case they happened to be the last
                // one to disconnect. Fire it right here, per player, as soon
                // as their own save has actually completed. (Left the
                // `self.SAVED_PLAYERS = true` assignment out of this
                // callback -- that flag is a separate "every connected
                // player's save is fully done" signal used by
                // savedWorldState() to gate a graceful shutdown; it's set by
                // the map-empty check below, which still only becomes true
                // once every player has actually logged out. Note: that
                // check now fires as soon as the map empties, rather than
                // waiting for the last player's transferOfflineGold DB write
                // to actually confirm -- a small (single Redis round-trip)
                // window versus before, traded for actually firing this call
                // for every player instead of almost never.)
                Accounts.transferOfflineGold(playerName, function (playerName) {});
                if (!update) {
                  delete self.playerSaveData[playerName];
                  users.delete(username);
                }
              }
              if (Object.keys(self.playerSaveData).length === 0) {
                self.SAVED_PLAYERS = true;
              }
            } catch (err) {
              console.error("handleSavePlayerData - checkPlayerSaved failed for "+playerName+": "+err.stack);
            }
        };

        DBH.savePlayerUserInfo(username, playerName, data[0], function (username, playerName, data) {
          checkPlayerSaved(playerName);
        });

        DBH.savePlayerInfo(playerName, data[1], function (playerName) {
          checkPlayerSaved(playerName);
        });

        DBH.saveQuests(playerName, JSON.stringify(data[2]), function (playerName) {
          checkPlayerSaved(playerName);
        });

        DBH.saveAchievements(playerName, data[3], function (playerName) {
          checkPlayerSaved(playerName);
        });

        DBH.saveItems(playerName, 0, "inventory", data[4], function (playerName) {
          checkPlayerSaved(playerName);
        });

        DBH.saveItems(playerName, 1, "bank", data[5], function (playerName) {
          checkPlayerSaved(playerName);
        });

        DBH.saveItems(playerName, 2, "equipment", data[6], function (playerName) {
          checkPlayerSaved(playerName);
        });
      } catch (err) {
        console.error("handleSavePlayerData failed: "+err.stack);
      }
    }

    handlePlayerLoaded (msg) {
        console.info("handlePlayerLoaded");
        // FIX: the gameserver now includes playerName as the first field
        // (see gameserver/js/user/userhandler.js's handleLoadPlayerData) so
        // this response can be matched back to the right pending login via
        // `pendingLogins` instead of assuming it's whichever user happens
        // to be sitting in the old shared `this.user` field.
        const playerName = msg[0],
            protocol = msg[1],
            address = msg[2],
            port = msg[3];

        const user = this.pendingLogins.get(playerName);
        if (!user) {
            console.warn("handlePlayerLoaded: no pending login for player "+playerName);
            return;
        }
        this.pendingLogins.delete(playerName);

        this.sendClient(user, new UserMessages.WorldReady(user,
          protocol, address, port));
        this.block = false;
    }

    // FIX: if the client disconnects from the userserver while a login is
    // still mid-flight -- after sendPlayerToWorld()/createPlayerToWorld()
    // kicked off the async DBH.* calls but before this world's gameserver
    // confirms with WU_PLAYER_LOADED (handlePlayerLoaded above) -- nothing
    // was ever removing that player's entries from pendingLogins,
    // playerLoadData, playerCreateData, or playerSaveData. They'd sit in
    // memory, keyed by playername, until this whole WorldHandler is
    // released (i.e. the gameserver itself reconnects/restarts), holding a
    // reference to the now-dead `user`/connection the whole time.
    // main.js's conn.onClose calls this for every disconnecting client so
    // any login that was abandoned mid-load gets cleared out immediately
    // instead of leaking.
    //
    // FIX: this used to run all three deletes unconditionally, on the claim
    // that each is "a safe no-op if that player already finished loading."
    // That's true for playerLoadData/playerCreateData -- they're deleted
    // the moment the 7-piece load handshake completes (see
    // sendPlayerToWorld/createPlayerToWorld above) -- but it's false for
    // playerSaveData: that entry is set up at the *end* of that same
    // handshake and stays alive for as long as the player is in-game,
    // getting reused on every autosave and on the final logout save (see
    // handleSavePlayerData above). Since main.js's conn.onClose calls this
    // for *every* disconnect -- not just abandoned mid-login ones -- a
    // normal logout was hitting this too. And a normal logout is exactly
    // when the gameserver is asynchronously gathering that player's data to
    // send a final WU_SAVE_PLAYER_DATA. The client's userserver-side
    // connection closing and the gameserver's async save prep are two
    // independent races with no ordering guarantee between them, so this
    // cleanup would routinely win the race and delete
    // playerSaveData[playername] out from under an in-flight (or
    // about-to-arrive) save -- producing "CANNOT SAVE PLAYER AS NOT SENT TO
    // GAME SERVER" on what should have been an ordinary logout save.
    // This function's actual job is cleaning up an *abandoned* login: one
    // that never reached the pendingLogins/WU_PLAYER_LOADED handshake (see
    // handlePlayerLoaded above). If pendingLogins doesn't have this
    // playername, the player already finished logging in, so none of this
    // per-login state is stale -- playerSaveData in particular may be
    // actively in use -- and none of it should be touched here.
    abandonPendingLogin(playername) {
      if (!playername)
        return;

      if (!this.pendingLogins.has(playername))
        return;

      console.info("abandonPendingLogin: clearing pending login for "+playername);
      this.pendingLogins.delete(playername);
      delete this.playerLoadData[playername];
      delete this.playerCreateData[playername];
      delete this.playerSaveData[playername];
    }

    handleCreatePlayerInfo (playername) {
      console.info("handleCreatePlayerInfo");
      const data = [
        playername,                          // name
        "0,0,0,0",                           // map
        "2,2,2,2,2,0",                       // stats
        "0,0,0,0,0,0,0,0,0,0",               // exps
        "0,0",                               // gold
        "0,0,0,0,0,0,0",                     // skills
        "0,0",                               // pStats
        "77,0,151,50",                       // sprites
        "0,0",                               // colors
        "{}",                        // shortcuts
        "{}"                                   // completeQuests
      ];

      return data;
    }

    handleCreatePlayerQuests (playername) {
      console.info("handleCreatePlayerQuests");
      return "[]";
    }

    handleCreatePlayerAchievements (playername) {
      console.info("handleCreatePlayerAchievements");
      return "[]";
    }

    handleCreatePlayerItems (playername) {
      console.info("handleCreatePlayerItems");
      return "[]";
    }

    createPlayerToWorld(user, username, playername) {
      console.info("createPlayerToWorld");
      const self = this;

      this.block = true;
      user.playerName = playername;
      // FIX: was `this.user = user` -- see the `pendingLogins` comment in
      // the constructor for why stashing this on the shared instance
      // corrupted concurrent logins.
      this.pendingLogins.set(playername, user);
      // Lets main.js's conn.onClose (userserver/js/main.js) find its way
      // back to this WorldHandler if the client disconnects mid-load, so
      // it can clean up this player's pendingLogins/playerCreateData
      // entries instead of leaking them -- see abandonPendingLogin() below.
      user.worldHandler = this;

      console.info("SENDING USERNAME: "+username);
      console.info("SENDING PLAYER: "+playername);

      const playerName = playername;
      const checkLoadDataFull = function (index, data) {
        const objData = self.playerCreateData[playerName];
        objData.count++;
        objData.data[index] = data;
        if (objData.count === 7)
        {
          self.playerSaveData[playerName] = 0;
          self.sendMessage( new UserMessages.SendLoadPlayerData(playerName, objData.data));
          delete self.playerCreateData[playerName];
        }
        else {
          self.playerCreateData[playerName] = objData;
        }
      };

      Accounts.loadPlayerUserInfo(user, function (username, data) {
        const objData = {};
        objData.data = new Array(7);
        objData.count = 0;

        self.playerCreateData[playerName] = objData;

        // FIX: was `self.user.hash` -- `user` is this call's own closure
        // parameter (unique per invocation), while `self.user` was the
        // shared instance field that a concurrent login could have already
        // overwritten by the time this async DB callback fires. Using the
        // closure-captured `user` makes this immune to that race.
        // Little bit of a workaround to marshal user data across.
        data.unshift(user.hash);
        data.unshift(username);

        checkLoadDataFull(0, data);

        data = self.handleCreatePlayerInfo(playerName);
        checkLoadDataFull(1, data);

        data = self.handleCreatePlayerQuests(playerName);
        checkLoadDataFull(2, data);

        data = self.handleCreatePlayerAchievements(playerName);
        checkLoadDataFull(3, data);

        data = self.handleCreatePlayerItems(playerName);
        checkLoadDataFull(4, data);

        data = self.handleCreatePlayerItems(playerName);
        checkLoadDataFull(5, data);

        data = self.handleCreatePlayerItems(playerName);
        checkLoadDataFull(6, data);
      });
    }

    sendAuctionsToWorld (worldindex) {
      const self = this;
      if (!this.world) {
        console.warn("sendAuctionsToWorld - no world set.");
        return;
      }
      DBH.loadAuctions(this.world.key, function (key, db_data) {
        console.info("sendAuctionsToWorld: "+JSON.stringify(db_data));
        self.sendMessage( new UserMessages.LoadPlayerAuctions(db_data));
      });
    }

    sendLooksToWorld (worldindex) {
      const self = this;
      if (!this.world) {
        console.warn("sendLooksToWorld - no world set.");
        return;
      }
      DBH.loadLooks(this.world.key, function (key, db_data) {
        let data = db_data.split(',');
        data = Utils.ArrayParseInt(data);
        self.sendMessage( new UserMessages.LoadPlayerLooks(data));
      });
    }

    sendBansToWorld (worldindex) {
      const self = this;
      if (!this.world) {
        console.warn("sendLooksToWorld - no world set.");
        return;
      }
      DBH.loadBans(this.world.key, function (key, db_data) {
        self.sendMessage( new UserMessages.LoadUserBans(db_data));
      });
    }

    handleAddPlayerGold (msg) {
        const playerName = msg[0];
        const goldAmount = parseInt(msg[1]);
        DBH.addPlayerGoldOffline(playerName, goldAmount);
    }

    sendWorldSave () {
      console.info("worldHandler - UW_WORLD_SAVE.");
      this.send([Types.UserMessages.UW_WORLD_SAVE]);
    }

    sendWorldClose () {
      console.info("worldHandler - UW_WORLD_CLOSE.");
      this.send([Types.UserMessages.UW_WORLD_CLOSE]);
    }

    savedWorldState () {
      console.info("WorldHandler, savedWorldState");
      console.info("SAVED_PLAYERS: "+ this.SAVED_PLAYERS);
      console.info("SAVED_LOOKS: "+ this.SAVED_LOOKS);
      console.info("SAVED_AUCTIONS: "+ this.SAVED_AUCTIONS);
      console.info("SAVED_BANS: "+ this.SAVED_BANS);
      return this.SAVED_PLAYERS && this.SAVED_LOOKS
        && this.SAVED_AUCTIONS && this.SAVED_BANS;
    }

    sendPlayerToWorld (user, username, playername) {
      console.info("sendPlayerToWorld");
      const self = this;

      user.playerName = playername;
      // FIX: was `this.user = user` -- see the `pendingLogins` comment in
      // the constructor. This is the exact race from the reported bug:
      // Player A calls sendPlayerToWorld(), its DB load starts (async);
      // Player B calls sendPlayerToWorld() before A's DB load finishes and
      // overwrites `this.user`; when A's DB callback below finally runs,
      // `self.user.hash` would resolve to B's hash, not A's -- so A's
      // player data (and A's eventual WorldReady reply) got stamped with
      // B's identity, and the gameserver would reject A's real hash later.
      this.pendingLogins.set(playername, user);
      // See the matching comment in createPlayerToWorld() above.
      user.worldHandler = this;

      console.info("SENDING USERNAME: "+username);
      console.info("SENDING PLAYER: "+playername);

      const checkLoadDataFull = function (index, db_data) {
        const objData = self.playerLoadData[playername];
        objData.count++;
        objData.data[index] = db_data;
        if (objData.count === 7)
        {
          self.playerSaveData[playername] = 0;
          self.sendMessage( new UserMessages.SendLoadPlayerData(playername, objData.data));
          delete self.playerLoadData[playername];
        }
        else {
          self.playerLoadData[playername] = objData;
        }
      };

      Accounts.loadPlayerUserInfo(user, function (username, db_data) {
        const objData = {};
        objData.data = new Array(7);
        objData.count = 0;

        self.playerLoadData[playername] = objData;

        // FIX: was `self.user.hash` -- see the FIX comment above this
        // function. `user` is this call's own closure parameter and can't
        // be clobbered by a concurrent login the way `self.user` could.
        // Little bit of a workaround to marshal user data across.
        db_data.unshift(user.hash);
        db_data.unshift(username);
        checkLoadDataFull(0, db_data);

        Accounts.loadPlayerInfo(playername, function (playername, db_data) {
          checkLoadDataFull(1, db_data);
        });
        DBH.loadQuests(playername, function (playername, db_data) {
          checkLoadDataFull(2, db_data);
        });
        DBH.loadAchievements(playername, function (playername, db_data) {
          checkLoadDataFull(3, db_data);
        });
        // INVENTORY
        DBH.loadItems(playername, 0, "inventory", function (playername, db_data) {
          checkLoadDataFull(4, db_data);
        });
        // BANK
        DBH.loadItems(playername, 1, "bank", function (playername, db_data) {
          checkLoadDataFull(5, db_data);
        });
        // EQUIPMENT
        DBH.loadItems(playername, 2, "equipment", function (playername, db_data) {
          checkLoadDataFull(6, db_data);
        });
      });
    }
}

export default WorldHandler;
