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
    }

    //this.replaceSkills();
    this.insertMissingPlayerKeys();
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
        user.connection.send([Types.UserMessages.UC_ERROR, "userexists"]);
        user.connection.close("Username not available: " + user.name);
        return;
      }

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

      this.saveUserInfo(user.name, data, (username, data) => {
        user.hasLoggedIn = true;
        users.set(user.name, user);

        this.sendPlayers(user);
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

  savePassword(username, hash) {
    const uKey = "u:" + username;
    client.hset(uKey, "hash", hash);
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
      if (user.checkUser(db_user, true)) {
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
        };

        if (!data.gems) {
          db_user.gems = 2000;
        } else {
          db_user.gems = parseInt(data.gems);
        }

        const len = AppearanceData.Data.length;
        db_user.looks = new Uint8Array(len);
        if (data.looks2) {
          db_user.looks = Utils.Base64ToBinArray(data.looks2, len);
        }

        // [77,0,151,50] - Beginner Looks values.
        db_user.looks[0] = 1;
        db_user.looks[50] = 1;
        db_user.looks[77] = 1;
        db_user.looks[151] = 1;

        console.info(JSON.stringify(db_user));

        user.looks = db_user.looks;
        user.gems = db_user.gems;

        if (user.checkUser(db_user)) {
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
          return true;
        }
        return false;
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

  createPlayer(playerName, callback) {
    // Check if playerName is taken
    this.ExistsPlayerName(playerName, (name, res) => {
      if (res) {
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

  addPlayerGoldOffline(playerName, goldAmount) {
    console.info("redis.addPlayerGoldOffline: playerName:" + playerName);
    console.info("goldAmount:" + goldAmount);

    const pKey = "p:" + playerName;
    client.hget(pKey, "goldoffline", (err, data) => {
      console.info("modifyGold.gold: " + JSON.stringify(data));
      if (!data) {
        console.error("redis.addPlayerGoldOffline - no goldoffline record for player '" + playerName + "' found.");
        return;
      }
      if (err || !data || data === "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        return;
      }

      const currentGold = parseInt(data);
      console.info("currentGold:" + currentGold);
      const totalGold = Math.max(0, (currentGold + goldAmount));

      client.hset(pKey, "goldoffline", totalGold, (err) => {
        if (err) {
          console.warn("redis.addPlayerGoldOffline: save error, " + JSON.stringify(err));
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

  modifyGold(playerName, golddiff, type, callback) {
    console.info("redis.modifyGold: playerName:" + playerName);
    console.info("golddiff:" + golddiff);
    console.info("type:" + type);

    type = type || 0;
    golddiff = parseInt(golddiff);
    const pKey = "p:" + playerName;
    //console.info(pKey+","+golddiff+","+type);
    client.hget(pKey, "gold", (err, data) => {
      console.info("modifyGold.gold: " + JSON.stringify(data));
      if (!data) {
        console.error("redis.modifyGold - no gold record for player '" + playerName + "' found.");
        if (callback) {
          callback(playerName, golddiff, type);
        }
        return;
      }
      if (err || !data || data === "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        if (callback) {
          callback(playerName, golddiff, type);
        }
        return;
      }

      const gold = data.split(",");
      gold[type] = parseInt(gold[type]) + golddiff;
      client.hset(pKey, "gold", gold.join(","), (err) => {
        if (err) {
          console.warn("redis.modifyGold: save gold error " + JSON.stringify(err));
        }
        if (callback) {
          callback(playerName, golddiff, type);
        }
      });
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
