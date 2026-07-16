/* global require, module, log, DBH, MainConfig */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import CryptoJS from "crypto-js";

import UserMessages from "./usermessage.js";
import formatChecker from "./format.js";
// FIX: same missing-import pattern fixed in format.js and worldhandler.js
// -- Types (used throughout this file's listener/handlers, e.g.
// Types.UserMessages.CU_CREATE_USER) and Utils (Utils.sanitize/btoa/
// checkInputName) were referenced with no import, relying on
// global.Types/global.Utils having already been set by common.js by the
// time any of these runtime handlers fire. Safe in practice for the same
// reason as worldhandler.js (nothing here runs at module-load time), but
// still a hidden dependency on main.js's import order for no reason, since
// both are static, non-circular exports from common.js.
import { Types, Utils } from './common.js';

// FIX: added for checkUser()'s password-hash comparison below -- plain
// `!==` on a hash string short-circuits on the first mismatched character,
// a timing side channel against a real auth boundary. Not added to the
// shared Utils (shared/js/utils.js) since that file is also bundled into
// the browser client, where Node's `crypto` module isn't available.
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length)
    return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// NOTE: DBH, users, and worldHandlers are still referenced as bare globals
// below (e.g. DBH.createUser, users.has, worldHandlers.length) -- same
// reasoning as the equivalent note in worldhandler.js: these are mutable
// runtime state owned by main.js (global.DBH = null / global.users = new
// Map() / global.worldHandlers = [], populated as the app starts up and
// connections come in), and main.js is this file's own importer, so
// pulling them in via import would be a real circular dependency rather
// than a missing static import. Left as-is.

class PlayerSummary {
  constructor(index, db_player) {
    this.index = index;
    this.name = db_player.name;
    this.exp = db_player.exp;
    this.colors = db_player.colors;
    this.sprites = db_player.sprites;
  }

  toArray() {
    return [
      this.index,
      this.name,
      this.exp,
      this.colors[0],
      this.colors[1],
      this.sprites[0],
      this.sprites[1]
    ];
  }

  toString() {
    return this.toArray().join(",");
  }
}

class User {   // Assuming `cls` is still available globally or via require
  constructor(main, connection) {
    const self = this;

    this.main = main;
    this.connection = connection;
    this.hashChallenge = connection.hash;
    connection.user = this;

    this.worldConnection = null;

    this.currentPlayer = null;
    this.players = [];

    this.loadedUser = false;
    this.loadedPlayer = false;
    this.player_loggedin = false;

    // Initialize Looks Array.
    this.looks = new Uint8Array(AppearanceData.Data.length);
    this.looks[0] = 1;
    this.looks[50] = 1;
    this.looks[77] = 1;
    this.looks[151] = 1;

    this.gems = 0;

    // Must start at 0 -- checkUser() does `++this.passwordTries`, and
    // incrementing an undefined value produces NaN forever, which made
    // `NaN > 3` always false and disabled the lockout-after-3-tries check.
    this.passwordTries = 0;

    // Same reasoning as passwordTries above - must start at 0. Counts
    // "username already taken" hits during registration (see
    // DatabaseHandler.createUser in redis.js), which now allows a
    // configurable number of retries (MainConfig.max_username_attempts)
    // before actually closing the connection, instead of disconnecting on
    // the very first taken name.
    this.usernameTries = 0;

    this.lastPacketTime = Date.now();

    this.listener = function (message) {
      console.info("recv[0]=" + message);
      const action = parseInt(message[0]);
      if (!action) return;

      if (!formatChecker.check(message)) {
        self.connection.close("Invalid value " + action + " packet format: " + message);
        return;
      }
      message.shift();

      switch (action) {
        case Types.UserMessages.CU_CREATE_USER:
          self.handleCreateUser(message);
          return;
        case Types.UserMessages.CU_LOGIN_USER:
          self.handleLoginUser(message);
          return;
      }

      if (!self.loadedUser) {
        console.info("Cannot Login User: " + message);
        return;
      }

      switch (action) {
        case Types.UserMessages.CU_CREATE_PLAYER:
          self.handleCreatePlayer(message);
          return;
        case Types.UserMessages.CU_LOGIN_PLAYER:
          self.handleLoginPlayer(message);
          return;
        case Types.UserMessages.CU_REMOVE_USER:
          self.handleRemoveUser(message);
          return;
      }

      if (!self.loadedPlayer) {
        console.info("Cannot Login: " + message);
        return;
      }
    };

    this.connection.listen(this.listener);
  }

  onClose() {
    console.info("onClose - called");
    clearTimeout(this.disconnectTimeout);

    console.warn("User.onClose - called.");

    if (this.hasLoggedIn) {
      users.delete(this.name);
    }
    // FIX: `delete this;` is a no-op -- delete only removes properties from
    // an object via a property reference; `this` itself isn't a deletable
    // binding, so this line never did anything. Removed.
  }

  send(message) {
    this.connection.send(message);
  }

  sendWorld(message) {
    this.worldConnection.send(message);
  }

  handleCreateUser(message) {
    const self = this;
    let name = Utils.sanitize(message[0]);
    let hash = Utils.sanitize(message[1]);
    hash = Utils.btoa(hash);

    console.info("Starting Client/Server Handshake");

    self.name = name.substr(0, 16).trim().toLowerCase();
    console.info("self.user.name=" + self.name);

    const bytes = CryptoJS.AES.decrypt(hash, this.hashChallenge);
    const decrypt = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    const current_date = (new Date()).valueOf().toString();
    const random = Math.random().toString();
    const salt = crypto.createHash('sha1').update(current_date + random).digest('hex');
    hash = crypto.createHash('sha1').update(decrypt + salt).digest('hex');

    try {
      if (!Utils.checkInputName(self.name)) {
        self.connection.send([Types.UserMessages.UC_ERROR, "invalidusername"]);
        return;
      }
      self.hash = hash;
      self.salt = salt;
      self.loggedInDate = Date.now();

      DBH.createUser(self);
    } catch (e) {
      console.info('message=' + e.message);
      console.info('stack=' + e.stack);
    }
  }

  // Records a failed "username already taken" registration attempt (called from
  // DatabaseHandler.createUser in redis.js) and enforces the configurable
  // MainConfig.max_username_attempts lockout (defaults to 5 if unset/non-numeric - `0` is
  // honored as an explicit "lock out immediately" value). Mirrors checkUser()'s
  // passwordTries handling below, just for registration instead of login. Sends the
  // UC_ERROR itself (with however many attempts remain as the 3rd element) and only closes
  // the connection once attempts are exhausted.
  handleUsernameTaken() {
    const configuredMaxUsernameAttempts = (typeof MainConfig !== "undefined" && MainConfig) ?
        MainConfig.max_username_attempts : undefined;
    const maxAttempts = (typeof configuredMaxUsernameAttempts === "number") ?
        configuredMaxUsernameAttempts : 5;
    const triesRemaining = maxAttempts - (++this.usernameTries);

    if (triesRemaining <= 0) {
      this.connection.send([Types.UserMessages.UC_ERROR, "userexists", 0]);
      this.connection.close("Username not available: " + this.name + " (max attempts reached)");
    } else {
      this.connection.send([Types.UserMessages.UC_ERROR, "userexists", triesRemaining]);
    }
  }

  handleLoginUser(message) {
    let name = Utils.sanitize(message[0]);
    let hash = Utils.sanitize(message[1]);
    hash = Utils.btoa(hash);

    console.info("Starting Client/Server Handshake");

    this.name = name.substr(0, 16).trim().toLowerCase();

    console.info("self.name=" + this.name);
    try {
      // Validate the username
      // FIX: `Types.UserMessages.SC_ERROR` doesn't exist anywhere in
      // shared/js/gametypes.js's UserMessages enum (only UC_ERROR does --
      // see the identical `Types.UserMessages.UC_ERROR` sends immediately
      // below this and throughout this file/handleCreateUser above). Since
      // `Types.UserMessages.SC_ERROR` reads as `undefined`, this was
      // sending `[undefined, "invalidname"]` to the client on an invalid
      // login username instead of a real UC_ERROR packet -- the client had
      // no defined message type to route that to, so the rejection was
      // silently lost instead of showing the user why their login failed.
      if (!Utils.checkInputName(this.name)) {
        this.connection.send([Types.UserMessages.UC_ERROR, "invalidname"]);
        return;
      }
      if (users.has(this.name)) {
        this.connection.send([Types.UserMessages.UC_ERROR, "loggedin"]);
        this.connection.close("user logged in.");
        return;
      }

      this.hash = hash;
      this.loggedInDate = Date.now();

      DBH.loadUser(this);
    } catch (e) {
      console.info('message=' + e.message);
      console.info('stack=' + e.stack);
    }
  }

  handleRemoveUser(message) {
    const self = this;
    let hash = Utils.sanitize(message[1]);
    hash = Utils.btoa(hash);

    console.info("self.name=" + self.name);
    try {
      self.hash = hash;

      DBH.removeUser(self);
    } catch (e) {
      console.info('message=' + e.message);
      console.info('stack=' + e.stack);
    }
  }

  checkUser(db_user, skip_logged_in = false) {
    const curTime = Date.now();
    // FIX: db_user.* fields come from Redis hgetall(), which always returns
    // strings. "+" on two strings concatenates instead of summing -- e.g.
    // "1700000000000" + "3600000" produced a ~20-digit number, so any real
    // ban (non-empty banDuration) computed an expiry astronomically larger
    // than curTime, making the ban effectively permanent. Only "worked" by
    // coincidence because createUser seeds banDuration as ''.
    const banTime = parseInt(db_user.banTime, 10) + parseInt(db_user.banDuration, 10);
    if (banTime > curTime) {
      this.connection.send([Types.UserMessages.UC_ERROR, "ban"]);
      this.connection.close("Closing connection to: " + (this.currentPlayer ? this.currentPlayer.name : this.name));
      return false;
    }

    // FIX: redis.js only ever stores/loads a "membership" field (see
    // loadUser()/createUser() in redis.js) -- "membershipTime" is never set
    // anywhere, so this was always undefined and membership could never
    // activate. The earlier fix here addressed the `this` vs `user` typo but
    // missed that the field name itself was wrong too.
    if (db_user.membership > curTime) {
      this.membership = true;
    }

    // Check Password
    const bytes = CryptoJS.AES.decrypt(this.hash, this.hashChallenge);
    const decrypt = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    const hash = crypto.createHash('sha1').update(decrypt + db_user.salt).digest('hex');

    console.info("checkUser: " + hash + " !== " + db_user.hash);
    // FIX: plain `!==` on a stored password hash short-circuits on the first
    // mismatched character -- a timing side channel against a value that
    // gates authentication. Compare in constant time instead.
    if (!safeCompare(hash, db_user.hash)) {
      // FIX: was hardcoded `> 3`, which (since it fires strictly *after* the increment)
      // actually allowed 4 wrong attempts before closing, not 3 as the old comment above
      // this.passwordTries claimed. Made configurable via MainConfig.max_password_attempts
      // (defaults to 3) and switched to the same "triesRemaining reaches 0" shape as
      // usernameTries above/DatabaseHandler.createUser in redis.js, so a configured value of
      // 3 means exactly 3 real attempts before lockout. Also now tells the client how many
      // attempts remain (data[1]) so it can show that instead of just "incorrect".
      //
      // FIX: was `MainConfig.max_password_attempts || 3`, which also falls back to 3 for an
      // explicit `0` (0 is falsy in JS) - meaning an admin who deliberately configured "no
      // retries, lock out immediately" would silently get 3 retries instead. Check for
      // "unset" with typeof so 0 is honored as a real value and only a missing/non-numeric
      // config key falls back to the default.
      const configuredMaxPasswordAttempts = (typeof MainConfig !== "undefined" && MainConfig) ?
          MainConfig.max_password_attempts : undefined;
      const maxAttempts = (typeof configuredMaxPasswordAttempts === "number") ?
          configuredMaxPasswordAttempts : 3;
      const triesRemaining = maxAttempts - (++this.passwordTries);

      if (triesRemaining <= 0) {
        this.connection.send([Types.UserMessages.UC_ERROR, "invalidlogin", 0]);
        this.connection.close("Wrong Password: " + this.name);
      } else {
        this.connection.send([Types.UserMessages.UC_ERROR, "invalidlogin", triesRemaining]);
      }
      return false;
    }

    console.info("LOGIN: " + this.name);
    if (users.has(this.name)) {
      this.connection.send([Types.UserMessages.UC_ERROR, "loggedin"]);
      return false;
    }

    for (const wh of worldHandlers) {
      // FIX: loggedInUsers is a Map (see worldhandler.js), not a plain
      // object -- hasOwnProperty() checks for an own JS property on the Map
      // object itself, not an entry in the Map's storage, so this always
      // returned false. The duplicate-login-across-worlds guard was dead.
      if (wh.loggedInUsers.has(this.name)) {
        this.connection.send([Types.UserMessages.UC_ERROR, "loggedin"]);
        return false;
      }
    }

    users.set(this.name, this);
    this.hasLoggedIn = true;

    return true;
  }

  sendPlayers(db_players) {
    this.loadedUser = true;
    if (!Array.isArray(db_players)) {
      this.connection.send([Types.UserMessages.UC_PLAYER_SUM, "0"]);
      return;
    }

    const sendMsg = [Types.UserMessages.UC_PLAYER_SUM, db_players.length];
    for (let i = 0; i < db_players.length; ++i) {
      const dbp = db_players[i];
      const playerSum = new PlayerSummary(i, dbp);
      this.players.push(playerSum);
      sendMsg.push(...playerSum.toArray());
    }
    this.connection.send(sendMsg);
  }

  handleCreatePlayer(message) {
    const self = this;
    const worldIndex = parseInt(message[0]);
    let name = Utils.sanitize(message[1]);

    const worldHandler = this.getWorldHandler(worldIndex);

    const tmpPlayer = { name };

    console.info("Starting Client/Server Handshake");

    tmpPlayer.name = tmpPlayer.name.substr(0, 16).trim();

    if (!Utils.checkInputName(tmpPlayer.name)) {
      this.connection.send([Types.UserMessages.UC_ERROR, "invalidname"]); // Fixed: was `user.`
      return;
    }

    const db_player = {
      name: tmpPlayer.name,
      map: 0,
      exp: 0,
      colors: [0, 0],
      sprites: [0, 0]
    };

    const playerSummary = new PlayerSummary(this.players.length, db_player);
    this.players.push(playerSummary);

    console.info("self.player.name=" + db_player.name);

    try {
      DBH.createPlayer(db_player.name, (playername, res) => {
        // FIX: getWorldHandler() can return null (worldIndex out of the
        // *currently connected* worldHandlers range -- format.js only
        // validates against the static maxWorldCount, not the live
        // connected-world count). That null wasn't checked here, unlike the
        // equivalent loginPlayer() path just below, which does guard it.
        // Once this async DB callback fired, `worldHandler.createPlayerToWorld`
        // threw an uncaught TypeError instead of reporting a clean error to
        // the client.
        if (!worldHandler) {
          self.connection.send([Types.UserMessages.UC_ERROR, "noworldhandler"]);
          return;
        }
        if (res) {
          worldHandler.createPlayerToWorld(self, self.name, playername);
        } else {
          self.connection.send([Types.UserMessages.UC_ERROR, "playerexists"]);
        }
      });
    } catch (e) {
      console.info('message=' + e.message);
      console.info('stack=' + e.stack);
    }
  }

  handleLoginPlayer(message) {
    console.info("user.handleLoginPlayer - called.");
    const worldIndex = parseInt(message[0]);
    const playerIndex = parseInt(message[1]);

    if (playerIndex < 0 || playerIndex >= this.players.length) return false;

    const user = users.get(this.name);
    if (user) {
      const elapsedTime = Date.now() - user.loggedInDate;
      console.info("user.handleLoginPlayer - elapsedTime: " + elapsedTime);
      if (elapsedTime > 60000) {
        this.connection.send([Types.UserMessages.UC_ERROR, "timeout"]);
        this.connection.close("user elapsed time");
        return;
      }
    } else {
      this.connection.send([Types.UserMessages.UC_ERROR, "loggedin"]);
      this.connection.close("user logged in.");
      return;
    }

    this.loginPlayer(worldIndex, this.players[playerIndex]);
  }

  getWorldHandler(worldIndex) {
    if (worldIndex < 0 || worldIndex >= worldHandlers.length) {
      console.info("getWorldHandler - worldIndex out of range.");
      return null;
    }

    console.info("worldIndex: " + worldIndex);
    const worldHandler = worldHandlers[worldIndex];
    if (!worldHandler) {
      console.info("No world Handler!");
      this.connection.close("no world handler.");
      return null;
    }
    return worldHandler;
  }

  loginPlayer(worldIndex, playerSummary) {
    console.info("user.loginPlayer - called");
    const worldHandler = this.getWorldHandler(worldIndex);

    const playerName = playerSummary.name;
    this.playerName = playerName;

    if (worldHandler) {
      worldHandler.sendPlayerToWorld(this, this.name, playerName);
    } else {
      console.info("No world Handler!");
    }
    return true;
  }
}

export default User;
