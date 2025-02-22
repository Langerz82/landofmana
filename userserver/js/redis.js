/* global Types, log, client */


var crypto = require('crypto');
var fs = require('fs');
var redis = require("redis");
var bcrypt = require("bcrypt");

var Utils = require('./utils');
//var Auction = require('./auction');

var client;

var hgetarray = function (hash, key, callback)
{
  if (Array.isArray(key))
  {
    var m = client.multi();
    for (var i = 0; i < key.length; ++i)
      m.hget(hash, key[i])
    m.exec(callback);
  }
  else {
    client.hget(hash, key, callback);
  }
};

var getStoreType = function(type)
{
  var sType;
  switch (type)
  {
      case 0: // Inventory Item
        sType = "iItem_";
        break;
      case 1: // Bank Item
        sType = "bItem_";
        break;
      case 2: // Equipped Item
        sType = "eItem_";
        break;
  }
  return sType;
};

var getStoreTypeNew = function(type) {
  var sType;
  switch (type)
  {
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

var getItemsStoreCount = function (type) {
  if (type == 1) return 96;
  if (type == 2) return 5;
  return 48;
};

// TODO Array parseInt where appropriate.

module.exports = DatabaseHandler = cls.Class.extend({
  init: function(config) {
    var self = this;
    // You may now connect a client to the Redis
    // server bound to port 6379.
    client = redis.createClient(config.redis_port, config.redis_host, {
      socket_nodelay: true
    });
    client.auth(config.redis_password);
    client.on('error', function(err) {
     console.error('Redis error: ' + err);
    });
    // client.connect(); // v4

    client.hgetarray = hgetarray;
    this.ready = true;

    if (config.remove_old_values == 1)
        this.removeOldValues();

    //this.replaceSkills();
    this.insertMissingPlayerKeys();
  },

  replaceSkills: function () {
    var self = this;

    client.keys('p:*', function (err, keys) {
      if (err) return console.log(err);

      for(var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        console.info(key);
        if (key.startsWith("p:"))
        {
          var j=0;
          client.hget(key, "skills", function (err, data) {
            //console.info(JSON.stringify(err));
            var len = data.split(",").length;
            //console.info("skills count:"+len);
            //if (len !== 7) {
              var key = keys[j++];
              //console.info("resetting skills." + key);
              client.hset(key, "skills", "0,0,0,0,0,0,0");
            //}
          });
        }
      }
    });
  },

  removeOldValues: function () {
    var self = this;

    client.del('b:bans');
    client.del('s:auction');
    client.del('l:looks');

    client.keys('b:bans-*', function (err, keys) {
      if (err) return console.log(err);

      for (var key of keys) {
        client.del(key);
      }
    });

    client.keys('s:auction-*', function (err, keys) {
      if (err) return console.log(err);

      for (var key of keys) {
        client.del(key);
      }
    });

    client.keys('l:looks-*', function (err, keys) {
      if (err) return console.log(err);

      for (var key of keys) {
        client.del(key);
      }
    });

    client.keys('p:*', function (err, keys) {
      if (err) return console.log(err);

      for(var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        console.info(key);
        if (key.startsWith("p:"))
        {
          client.hdel(key, "newquests");
          client.hdel(key, "newquests2");
          client.hdel(key, "completeQuests");
          client.hdel(key, "completeQuests2");
        }
      }
    });
  },

  insertMissingPlayerKeys: function () {
    client.keys('p:*', function (err, keys) {
      if (err) return console.log(err);

      client.smembers("player", function (err, reply) {
        for (var pName of keys) {
          var pName = pName.substr(2);
          if (!reply.includes(pName)) {
            client.sadd("player", pName);
          }
        }
      });
    });
  },

  createPlayerKeys: function () {
    client.keys('p:*', function (err, arr) {
      for (var rec of arr) {
        console.info("rec="+rec);
        var playerName = rec.substr(2);
        if (playerName.length > 0)
          client.sadd("player", playerName);
      }
    });
  },

  ExistsUsername: function (name, callback) {
    return this.isNameInSet("usr", name, callback);
  },

  ExistsPlayerName: function (name, callback) {
    return this.isNameInSet("player", name, callback);
  },

  isNameInSet: function (setName, name, callback) {
    var nameLower = name.toLowerCase();
    client.smembers(setName, function (err, reply) {
      reply = reply.map(function (rec) { return rec.toLowerCase(); });
      //var res = reply.findIndex(function (rec) { return (rec == nameLower); })
      if (callback)
        callback(name, reply.includes(nameLower));
    });
  },

  createUser: function(user) {
    var self = this;
    var uKey = "u:" + user.name;

    // Check if username is taken
    this.ExistsUsername(user.name, function(name, res) {
      if (res) {
        user.connection.send([Types.UserMessages.UC_ERROR,"userexists"]);
        user.connection.close("Username not available: " + user.name);
        return;
      }

      var lenLooks = AppearanceData.Data.length;
      user.looks = new Uint8Array(lenLooks);
      for(var i=0; i < lenLooks; ++i)
        user.looks[i] = 0;

      user.looks[0] = 1;
      user.looks[50] = 1;
      user.looks[77] = 1;
      user.looks[151] = 1;

      user.gems = 2000;

      var curTime = new Date().getTime();
      var data = [
        user.hash,
        user.salt,
        0,
        '',
        curTime,
        0,
        '',
        user.gems,
        Utils.BinArrayToBase64(user.looks),
        user.connection._connection.remoteAddress];

      self.saveUserInfo(user.name, data, function (username, data) {
        user.hasLoggedIn = true;
        users[user.name] = 1;
        loggedInUsers[user.name] = 1;

        self.sendPlayers(user);
      });
    });
  },

  savePlayerUserInfo: function (username, playerName, data, callback) {
    var uKey = "u:" + username;
    client.multi()
      .sadd("usr", username)
      .hset(uKey, "gems", data[0])
      .hset(uKey, "looks2", data[1])
      .exec(function(err, replies) {
        if (callback)
          callback(username, playerName, data);
      });
  },

  saveUserInfo: function(username, data, callback) {
    var uKey = "u:" + username;

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
        .exec(function(err, replies) {
          if (callback)
            callback(username, data);
        });
  },

  savePassword: function(username, hash) {
    var uKey = "u:" + username;
    client.hset(uKey, "hash", hash);
  },

  removeUser: function (user) {
    var self = this;
    var uKey = "u:" + user.name;

    //console.error("uKey:"+uKey);
    client.hgetall(uKey, function(err, data) {
      console.info("replies: "+data);
      console.info(JSON.stringify(data));
      if (data === null || !(typeof data === 'object'))
        return;

      var db_user = {
        "hash": data.hash,
        "salt": data.salt
      };

      console.info(JSON.stringify(db_user));
      console.error("USER CHECK USER");
      if(user.checkUser(db_user, true)) {
        console.error("USER CHECK USER SUCCESS");
        var playerNames = data.players.split(",");
        for(var i=0; i < playerNames.length; ++i)
        {
          var pKey = "p:"+playerNames[i];
          client.del(pKey);
        }
        client.del(uKey);
        client.srem("usr", user.name);
        user.connection.send([Types.UserMessages.UC_ERROR,"removed_user_ok"]);
        user.connection.close();
        return;
      }
      user.connection.send([Types.UserMessages.UC_ERROR,"removed_user_fail"]);
      user.connection.close();
    });
  },

// TODO load created Player summaries too.
  loadUser: function(user) {
    var self = this;
    var uKey = "u:" + user.name;
    var curTime = new Date().getTime();

    this.ExistsUsername(user.name, function(name, res) {
        if (!res) {
          user.connection.send([Types.UserMessages.UC_ERROR,"invalidlogin"]);
          return false;
        }

        client.hgetall(uKey, function(err, data) {
          console.info("replies: "+data);
          console.info(JSON.stringify(data));
          if (data === null || !(typeof data === 'object'))
            return false;
          //console.info(replies.toString());

          var db_user = {
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

          if (!data.gems)
            db_user.gems = 1000;
          else
            db_user.gems = parseInt(data.gems);

          var len = AppearanceData.Data.length;
          db_user.looks = new Uint8Array(len);
          /*if (!data.looks2 || parseInt(data.looks2, 16) === 0 || data.looks2.toLowerCase().includes("nan")) {
            db_user.looks = new Uint8Array(len);
            for(var i=0; i < len; ++i)
              db_user.looks[i] = 0;
          }*/
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

          if(user.checkUser(db_user)) {
            var ipAddress = user.connection._connection.remoteAddress;
            if (!data.ipAddesses)
              client.hset(uKey, "ipAddresses", ipAddress);
            else {
              if (!toString(data.ipAddesses).includes(ipAddress))
                client.hset(uKey, "ipAddresses", db_user.ipAddresses + "," + ipAddress);
            }
            client.hset(uKey, "lastLoginTime", new Date().getTime());

            self.sendPlayers(user);
            return true;
          }
          return false;
        });
    });
  },

  createPlayerNameInUser: function (username, playerName, callback) {
    var uKey = "u:" + username;
    // Create Player Name in User account.
    client.hget(uKey, "players", function (err, reply) {
      var db_players = [];
      if (reply)
        db_players = reply.split(",");

      if (!db_players.includes(playerName))
      {
        db_players.push(playerName);
        client.hset(uKey, "players", db_players.join(","));
      }
      if (callback)
        callback();
    });
  },

  sendPlayers: function (user) {
    var uKey = "u:" + user.name;
    client.hget(uKey, "players", function (err, reply) {
      console.info("players_reply:"+reply);
      if (reply == null || reply === "")
      {
        user.sendPlayers();
        return;
      }
      var playerNames = reply.split(",");
      var db_players = [];
      var count = 0;
      for(var i=0; i < playerNames.length; ++i)
      {
        var pKey = "p:"+playerNames[i];
        console.info("pKey:"+pKey);
        var keyArray = ["name","map","exps","colors","sprites"];
        hgetarray(pKey, keyArray, function(err, reply) {
          if (err || !reply[0]) {
            console.info("redis - sendPlayers, err:"+JSON.stringify(err));
            ++count;
            return;
          }

          //console.info("err:"+JSON.stringify(err));
          console.info("reply:"+JSON.stringify(reply));
          var db_player = {
            "name": reply[0],
            "map": reply[1].split(",")[0], // MapIndex.
//            "pClass": reply[2] || 0,
            "exp": reply[2].split(",")[0], // Base XP.
            "colors": reply[3].split(","),
            "sprites": reply[4].split(",")
          };
          db_players.push(db_player);
          if (++count == playerNames.length)
            user.sendPlayers(db_players);
        });
      }
    });
  },

  createPlayer: function(playerName, callback) {
    var self = this;

    // Check if playerName is taken
    this.ExistsPlayerName(playerName, function (name, res) {
      if (res) {
        if (callback)
          callback(playerName, false);
        return;
      }
      console.info("CREATING PLAYER");
      if (callback)
        callback(playerName, true);
    });
  },

  loadUserInfo: function(username, callback) {
    var uKey = "u:" + username;

    client.hgetall(uKey, function(err, data) {
      console.info("replies: "+data);
      console.info(JSON.stringify(data));
      if (data === null || !(typeof data === 'object'))
        return;

      if (callback)
        callback(username, data);
    });
  },

  loadPlayerUserInfo: function(user, callback) {
    var uKey = "u:" + user.name;

    client.multi()
      .hget(uKey, "gems")
      .hget(uKey, "looks2")

      .exec(function(err, data) {
        if (data === null || !(typeof data === 'object'))
          return;

        if (data[1] === null) {
          var b64 = Utils.BinArrayToBase64(user.looks);
          data[1] = b64;
        }

        if (callback)
          callback(user.name, data);
      });
  },

  loadPlayerInfo: function(playerName, callback) {
    var pKey = "p:" + playerName;

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
      .exec(function(err, data) {
        if (data === null || !(typeof data === 'object'))
          return;

        if (callback)
          callback(playerName, data);
      });
  },

  savePlayerInfo: function(playerName, data, callback) {
    var pKey = "p:" + playerName;

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

      .exec(function(err, replies) {
        if (err) {
          console.warn(err);
          console.warn(JSON.stringify(replies));
          return;
        }

        if (callback)
          callback(playerName);
      });
  },

  addPlayerGoldOffline: function (playerName, goldAmount) {
    console.info("redis.addPlayerGoldOffline: playerName:"+playerName);
    console.info("goldAmount:"+goldAmount);

    var pKey = "p:" + playerName;
    client.hget(pKey, "goldoffline", function (err, data) {
      console.info("modifyGold.gold: "+JSON.stringify(data));
      if (!data) {
        console.error("redis.addPlayerGoldOffline - no goldoffline record for player '"+playerName+"' found.");
        return;
      }
      if (err || !data || data == "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        return;
      }

      var currentGold = parseInt(data);
      console.info("currentGold:"+currentGold);
      var totalGold = Math.max(0, (currentGold+goldAmount));

      client.hset(pKey, "goldoffline", totalGold, function (err) {
        if (err)
          console.warn("redis.addPlayerGoldOffline: save error, "+JSON.stringify(err));
      });
    });
  },

  transferOfflineGold: function (playerName, callback) {
    console.info("redis.transferOfflineGold: playerName:"+playerName);

    var self = this;
    this.getGoldOffline(playerName, function (playerName, addGold) {
      self.modifyGold(playerName, addGold, 0, function (playerName) {
        self.resetGoldOffline(playerName, function (playerName) {
          if (callback)
            callback(playerName);
        })
      });
    });
  },

  resetGoldOffline: function(playerName, callback) {
      console.info("redis.resetGoldOffline: playerName:"+playerName);
      var pKey = "p:" + playerName;
      client.hset(pKey, "goldoffline", 0, function (err, data) {
        if (err) {
          console.info("redis.resetGoldOffline: "+JSON.stringify(err));
        }
        if (callback)
          callback(playerName);
      })
  },

  getGoldOffline: function(playerName, callback) {
    console.info("redis.getGoldOffline: playerName:"+playerName);
    var type = type || 0;
    var golddiff = parseInt(golddiff);
    var pKey = "p:" + playerName;
    //console.info(pKey+","+golddiff+","+type);
    client.hget(pKey, "goldoffline", function (err, data)
    {
      console.info("getGoldOffline.gold: "+JSON.stringify(data));
      if (!data) {
        console.error("redis.getGoldOffline - no gold record for player '"+playerName+"' found.");
        if (callback)
          callback(playerName, 0);
        return;
      }
      if (err || !data || data == "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        return;
      }

      var gold = data.split(",");
      if (callback)
        callback(playerName, parseInt(gold[0]));
    });
  },

  modifyGold: function(playerName, golddiff, type, callback) {
    console.info("redis.modifyGold: playerName:"+playerName);
    console.info("golddiff:"+golddiff);
    console.info("type:"+type);

    var type = type || 0;
    var golddiff = parseInt(golddiff);
    var pKey = "p:" + playerName;
    //console.info(pKey+","+golddiff+","+type);
    client.hget(pKey, "gold", function (err, data)
    {
      console.info("modifyGold.gold: "+JSON.stringify(data));
      if (!data) {
        console.error("redis.modifyGold - no gold record for player '"+playerName+"' found.");
        if (callback)
          callback(playerName, golddiff, type);
        return;
      }
      if (err || !data || data == "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        if (callback)
          callback(playerName, golddiff, type);
        return;
      }

      var gold = data.split(",");
      gold[type] = parseInt(gold[type])+golddiff;
      client.hset(pKey, "gold", gold.join(","), function (err) {
        if (err) {
          console.warn("redis.modifyGold: save gold error "+JSON.stringify(err));
        }
        if (callback)
          callback(playerName, golddiff, type);
      });
    });
  },

  modifyGems: function(username, diff) {
    var uKey = "u:" + username;
    var diff = parseInt(diff);

    client.hget(uKey, "gems", function (err, data)
    {
      var gems = parseInt(data);
      gems += diff;
      client.hset(uKey, "gems", gems);
    });
  },

// ITEMS - BEGIN. New item store functions.


  loadItems: function (playerName, type, callback) {
    var self = this;
    var pKey = "p:" + playerName;

    var maxNumber = getItemsStoreCount(type);
    var sType = getStoreTypeNew(type);

    client.hget(pKey, sType, function (err, data) {
        if (err || !data || data == "") {
          console.warn(err);
          console.warn(JSON.stringify(data));
          return;
        }
        if (callback)
          callback(playerName, data);
    });
  },

  saveItems: function(playerName, type, data, callback)
  {
    var pKey = "p:" + playerName;
    var sType = getStoreTypeNew(type);
    console.info("saveItems: "+data);
    console.info("pKey: "+pKey);
    console.info("sType: "+sType);
    client.hset(pKey, sType, data,
      function(err, replies) {
        if (err || !data || data == "") {
          console.warn(err);
          console.warn(JSON.stringify(replies));
          console.warn(JSON.stringify(data));
          return;
        }
        if (callback)
          callback(playerName);
    });
  },

// ITEMS - END. End of Item Functions.

// QUESTS - BEGIN. - TODO - Check quests variables (repeat needs to be removed.)
// TODO - Just do new save rather than appending to key "quests".

  // example {id: id, type: 2, npcId: this.id, objectId: topEntity.kind, count: mobCount, repeat: repeat}
  saveQuests: function(playerName, data, callback) {
    var pKey = "p:" + playerName;

    client.hset(pKey, "newquests", data,
      function(err, replies) {
        if (err || !data || data == "") {
          console.warn(err);
          console.warn(JSON.stringify(replies));
          console.warn(JSON.stringify(data));
          return;
        }
        if (callback)
          callback(playerName);
    });
  },

  loadQuests: function(playerName, callback) {
    var self = this;
    console.info("loadQuest");
    var pKey = "p:" + playerName;
    var multi = client.multi();
    var indexes;

    client.hget(pKey, "newquests", function (err, data) {
        if (err || !data || data == "") {
          console.warn(err);
          console.warn(JSON.stringify(data));
          data = [];
        }
        console.info(pKey);
        console.info("getItems - data="+data);
        if (callback)
          callback(playerName, data);
    });
  },
// QUESTS - END.


// ACHIEVEMENTS - START.
saveAchievements: function(playerName, data, callback) {
  console.info("saveAchievement");
  var pKey = "p:" + playerName;
  client.hset(pKey, "achievements", data,
    function(err, replies) {
      if (err) {
        console.warn(err);
        console.warn(JSON.stringify(replies));
        console.warn(JSON.stringify(data));
        return;
      }
      if (callback)
        callback(playerName);
  });
},

loadAchievements: function(playerName, callback) {
  console.info("loadAchievement");
  var pKey = "p:" + playerName;
  client.hget(pKey, "achievements", function (err, data) {
      if (err || !data || data == "") {
        console.warn(err);
        console.warn(JSON.stringify(data));
        return;
      }
      if (callback)
        callback(playerName, data);
  });
},
// ACHIEVEMENTS - END.

// AUCTION DATABASE CALLS.
  loadAuctions: function(worldKey, callback) {
    var key = 's:auction-'+worldKey;
    client.smembers(key, function(err, reply) {
      if (err || reply === null || !(typeof reply === 'object'))
      {
        console.warn("loadAuctions - err: "+JSON.stringify(err));
        console.warn("loadAuctions - data: "+JSON.stringify(reply));
        return;
      }
      if (callback)
        callback(worldKey, reply);
      return;
    });
  },

  saveAuctions: function(worldKey, data, callback) {
    console.info("redis - saveAuctions: "+JSON.stringify(data));
    var key = 's:auction-'+worldKey;
    client.del(key);
    var multi = client.multi();
    var exec = (data.length > 0);
    for (var i = 0; i < data.length; ++i) {
        multi.sadd(key, data[i]);
    }
    if (exec) {
      multi.exec(function(err, reply) {
        if (err) {
          console.error("redis - saveAuctions: "+JSON.stringify(err));
          return;
        }
        if (callback)
          callback(worldKey, reply);
      });
    }
  },
// END AUCTION DB CALLS.

// START LOOKS DB CALLS.
  loadLooks: function (worldKey, callback) {
    var key = 'l:looks-'+worldKey;
    client.hget(key, "prices", function (err, reply)
    {
      if (err || !reply || reply == "") {
        console.warn(err);
        console.warn(JSON.stringify(reply));
        return;
      }
      if (reply) {
        //data = data.split(",");
        if (callback)
          callback(worldKey, reply);
      }
    });
  },

  saveLooks: function (worldKey, looks, callback) {
    console.info("redis - saveLooks: "/*+JSON.stringify(looks)*/);
    var key = 'l:looks-'+worldKey;
    client.del(key);
    client.hset(key, 'prices', looks.join(","), function(err, reply) {
      if (err) {
        console.error("redis - saveLooks:" + JSON.stringify(err));
        return;
      }
      if (callback)
        callback(worldKey, reply);
    });
  },
// END LOOKS DB CALLS.

// BANNED USERS
  loadBans: function(worldKey, callback) {
    var key = 'b:bans-'+worldKey;
    client.smembers(key, function(err, reply) {
      if (err || reply === null || !(typeof reply === 'object'))
      {
        console.warn("loadBans - err: "+JSON.stringify(err));
        console.warn("loadBans - data: "+JSON.stringify(reply));
        return;
      }
      if (callback)
        callback(worldKey, reply);
      return;
    });
  },

  saveBans: function(worldKey, data, callback) {
    console.info("redis - saveBans: "/*+JSON.stringify(data)*/);

    var key = 'b:bans-'+worldKey;
    client.del(key);
    if (data.length === 0)
      return;
    console.warn("data:"+JSON.stringify(data));
    var multi = client.multi();
    for (var i = 0; i < data.length; ++i) {
        multi.sadd(key, data[i]);
    }
    multi.exec(function(err, reply) {
      if (err) {
        console.error("redis - saveBans: "+JSON.stringify(err));
        return;
      }
      if (callback)
        callback(worldKey, reply);
    });
  },
// END BANNED USERS
});
