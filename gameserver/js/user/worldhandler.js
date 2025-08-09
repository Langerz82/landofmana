
/* global require, module, log, DBH */

var formatCheck = require("../format").check,
    UserMessages = require("./usermessage"),
    Messages = require("../message");

module.exports = WorldHandler = cls.Class.extend({
    init: function(main, connection) {
        var self = this;

        this.main = main;
        this.connection = connection;
        //this.userHandler = userHandler;

        this.playerSaveData = {};

        this.connection.listen(function(message) {
          console.info("recv="+JSON.stringify(message));
          var action = parseInt(message[0]);

          if (action)
          if(!formatCheck(message)) {
              self.connection.close("Invalid "+Types.getMessageTypeAsString(action)+" message format: "+message);
              return;
          }
          message.shift();

          if (action === Types.Messages.CW_LOGIN_PLAYER) {
            self.handleLoginPlayer(message);
            return;
          }

        });
    },

    onExit: function() {
    },

    sendPlayer: function(message) {
      this.connection.send(message);
    },

    sendPlayerMessage: function(msg) {
      this.connection.send(msg.serialize());
    },

    handleLoginPlayer: function (msg) {
      console.info("worldHandler, handleLoginPlayer: "+JSON.stringify(msg));
      var playerName = msg[0],
        playerHash = msg[1];

      var player = null;
      if (hashes.hasOwnProperty(playerHash))
        player = hashes[playerHash];

      if (!player) {
        console.info("player hash does not exist.");
        this.connection.disconnect();
        return;
      }

      var username = player.user.name;
      if (users.hasOwnProperty(username)) {
        console.info("player user is already logged in.");
        this.sendPlayerMessage(new Messages.Error("user already logged in."));
        this.connection.disconnect();
        return;
      }
      users[username] = playerName;

      if (player.world && player.world.ban) {
        if (player.world.ban.isUserBanned(username)) {
          console.info("player user is banned from server.");
          this.sendPlayerMessage(new Messages.Error("user is banned."));
          this.connection.disconnect();
          return;
        }
      } else {
        console.warn("handleLoginPlayer: world or world ban not set");
        return;
      }

      player.start(this.connection);

      this.sendToUserServer(new UserMessages.playerLoggedIn(player.user.name, playerName));
    },

    loadPlayerDataUserInfo: function (player, callback) {
      var user = player.user;
      var data = [
        user.name,
        user.hash,
        Number(user.gems),
        Utils.BinArrayToBase64(user.looks)];

      if (callback)
        callback(user.name, data);
    },

    loadPlayerDataInfo: function (player, callback) {
      var stats = [
        player.stats.attack,
        player.stats.defense,
        player.stats.health,
        player.stats.energy,
        player.stats.luck,
        player.stats.free];

      var exps = [
        Utils.NaN2Zero(player.exp.base),
        Utils.NaN2Zero(player.exp.attack),
        Utils.NaN2Zero(player.exp.defense),
        Utils.NaN2Zero(player.exp.move),
        Utils.NaN2Zero(player.exp.sword),
        Utils.NaN2Zero(player.exp.bow),
        Utils.NaN2Zero(player.exp.hammer),
        Utils.NaN2Zero(player.exp.axe),
        Utils.NaN2Zero(player.exp.logging),
        Utils.NaN2Zero(player.exp.mining),
      ];

      var map = [
        player.map.index,
        player.x,
        player.y,
        player.orientation];

      var skillexps = [];
      for (var i =0 ; i < player.skills.length; ++i)
        skillexps[i] = player.skills[i].skillXP;

      //var completeQuests = (Object.keys(player.completeQuests).length > 0) ? JSON.stringify(player.completeQuests) : 0;

      var hexLooks = Utils.BinArrayToBase64(player.user.looks);

      var data = [
        player.name,
        map.join(","),
        stats.join(","),
        exps.join(","),
        player.gold.join(","),
        skillexps.join(","),
        player.pStats.join(","),
        player.sprites.join(","),
        player.colors.join(","),
        JSON.stringify(player.shortcuts),
        JSON.stringify(player.quests.completeQuests)];

      if (callback)
        callback(player.name, data);
    },

    loadPlayerDataQuests: function (player, callback) {
      var quests = [];
      //if (!player.quests.quests)
        //player.quests = [];
      for (var quest of player.quests.quests)
      {
        if (!quest || quest.status === QuestStatus.COMPLETE  || _.isEmpty(quest))
          continue;
        quests.push(quest.toArray().join(','));
      }

      if (callback)
        callback(player.name, quests);
    },

    loadPlayerDataAchievements: function (player, callback) {
      var data = "";
      for (var achievement of player.achievements)
      {
          data += achievement.toRedis(achievement).join(',') + ",";
      }
      data = data.slice(0,-1);

      if (callback)
        callback(player.name, data);
    },

    loadPlayerDataItems: function (player, type, callback) {
      if (callback)
        callback(player.name, type, player.itemStore[type].toStringJSON());
    },

    sendToUserServer: function (msg) {
      if (this.userConnection)
        this.userConnection.send(msg.serialize());
      else
        console.info("worldHandler: sendToUserServer called without userConnection being set: "+JSON.stringify(msg.serialize()));
    },

    savePlayer: function (player, update) {
      console.info("worldHandler - savePlayer, name:"+player.name);
      var self = this;

      //console.info("SAVING PLAYER: "+player.name);
      //try { throw new Error(); } catch(err) { console.info(err.stack); }
      var username = player.user.name;
      var playerName = player.name;

      var checkLoadDataFull = function (index, data) {
        var objData = self.playerSaveData[playerName];
        objData.count++;
        objData.data[index] = data;
        if (objData.count === 7)
        {
          var msg = new UserMessages.SavePlayerData(playerName, objData.data, update);
          self.sendToUserServer(msg);
          delete self.playerSaveData[playerName];
        }
        else {
          self.playerSaveData[playerName] = objData;
        }
      };

      this.loadPlayerDataUserInfo(player, function (userName, data) {
        var objData = {};
        objData.data = new Array(7);
        objData.count = 0;

        self.playerSaveData[playerName] = objData;

        checkLoadDataFull(0, data);

        self.loadPlayerDataInfo(player, function (pn, data) {
          checkLoadDataFull(1, data);
        });

        self.loadPlayerDataQuests(player, function (pn, data) {
          checkLoadDataFull(2, data);
        });
        self.loadPlayerDataAchievements(player, function (pn, data) {
          checkLoadDataFull(3, data);
        });

        self.loadPlayerDataItems(player, 0, function (pn, type, data) {
          checkLoadDataFull(4, data);
        });
        self.loadPlayerDataItems(player, 1, function (pn, type, data) {
          checkLoadDataFull(5, data);
        });
        self.loadPlayerDataItems(player, 2, function (pn, type, data) {
          checkLoadDataFull(6, data);
        });
      });
    },

});
