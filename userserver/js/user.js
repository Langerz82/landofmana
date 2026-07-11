/* global require, module, log, DBH */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import CryptoJS from "crypto-js";

import UserMessages from "./usermessage.js";
import formatChecker from "./format.js";

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

  handleLoginUser(message) {
    let name = Utils.sanitize(message[0]);
    let hash = Utils.sanitize(message[1]);
    hash = Utils.btoa(hash);

    console.info("Starting Client/Server Handshake");

    this.name = name.substr(0, 16).trim().toLowerCase();

    console.info("self.name=" + this.name);
    try {
      // Validate the username
      if (!Utils.checkInputName(this.name)) {
        this.connection.send([Types.UserMessages.SC_ERROR, "invalidname"]);
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
    if (hash !== db_user.hash) {
      this.connection.send([Types.UserMessages.UC_ERROR, "invalidlogin"]);
      if (++this.passwordTries > 3)
        this.connection.close("Wrong Password: " + this.name);
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
