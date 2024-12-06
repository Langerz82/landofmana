
/* global require, module, log, DBH */

var cls = require("./lib/class"),
    _ = require("underscore"),
    Utils = require("./utils"),
    Types = require("../shared/js/gametypes"),
//    Main = require("./main"),
//    Messages = require("./message"),
    AppearanceData = require("./data/appearancedata");
//    TaskHandler = require("./taskhandler");

module.exports = UserHandler = cls.Class.extend({
    init: function(main, server, world, connection) {
        var self = this;

        this.main = main;
        this.server = server;
        this.world = world;
        this.connection = connection;

        this.currentPlayer = null;

        this.connection.listen(function(message) {
          console.info("recv="+JSON.stringify(message));
          var action = parseInt(message[0]);
          message.shift();

          switch (action) {
            case Types.UserMessages.UW_LOAD_PLAYER_DATA:
              self.handleLoadPlayerData(message);
              return;
            case Types.UserMessages.UW_LOAD_PLAYER_AUCTIONS:
              self.handleLoadPlayerAuctions(message);
              return;
            case Types.UserMessages.UW_LOAD_PLAYER_LOOKS:
              self.handleLoadPlayerLooks(message);
              return;
            case Types.UserMessages.UW_WORLD_SAVE:
              self.handleWorldSave(message);
              return;
            case Types.UserMessages.UW_WORLD_CLOSE:
              self.handleWorldClose(message);
              return;
          }

        });

        this.loadedUser = false;
        this.loadedPlayer = false;

        this.looks = new Array(AppearanceData.Data.length);

        this.gems = 0;

        this.lastPacketTime = Date.now();
    },

    onClose: function (save) {
      console.warn("User.onClose - called.")
      if (this.name) {
        console.warn("name:"+this.name);
        users[this.name] = 0;
      }
      save = save || false;

      var p = this.player;
      if (save && p)
      {
        if (this.loadedPlayer)
          p.save();
        players.splice(players.indexOf(p),1);
        //console.warn(JSON.stringify(players));
        delete this.currentPlayer;
      }
      delete users[this.name];
      console.warn(JSON.stringify(users));
      this.connection.close("closing connection");
      delete this;
    },

    onExit: function() {
    },

    send: function(message) {
      this.connection.send(message);
    },

    /*loginPlayer: function (worldIndex, playerSummary)
    {
      if (worldIndex < 0 && worldIndex >= worlds.length)
        return false;

      console.info("worldIndex: "+worldIndex);
      var world = worlds[worldIndex];
      //console.info(JSON.stringify(world));

// TODO FIND OUT PLAYER CONNECTION
      var player = new Player(this.world, this, this.connection);

      //player.start();
      player.name = playerSummary.name;
      player.hasLoggedIn = true;
      player.packetHandler.loadedPlayer = true;

      world.connect_callback(player);
      this.currentPlayer = player;

      this.loadedPlayer = true;
      return true;
    },*/

    handleWorldSave: function (msg) {
      console.info("handleWorldSave.");
      //this.world.save();
      this.main.saveServer();
    },

    handleWorldClose: function (msg) {
      console.info("handleWorldClose.");
      this.main.safe_exit();
    },

    handleLoadPlayerAuctions: function (msg) {
      console.info("handleLoadPlayerAuctions: "+JSON.stringify(msg));

      if (!msg)
        return;

      this.world.auction.load(msg);
    },

    handleLoadPlayerLooks: function (msg) {
      console.info("handleLoadPlayerLooks: "+JSON.stringify(msg));

      if (!msg)
        return;

      this.world.looks.load(msg);
    },

    handleLoadPlayerData: function (msg) {
        var playerName = msg[0];
        var data = msg[1];
        console.info("handleLoadPlayerData data: "+JSON.stringify(data));
        this.handleLoadUserInfo(playerName, data[0]);
        this.handleLoadPlayerInfo(data[1]);
        this.handleLoadPlayerQuests(data[2]);
        this.handleLoadPlayerAchievements(data[3]);
        this.handleLoadPlayerItems(0, data[4]);
        this.handleLoadPlayerItems(1, data[5]);
        this.handleLoadPlayerItems(2, data[6]);

        var player = this.player;
        console.info("player hash: "+player.hash);
        hashes[player.hash] = player;
        this.player = null;
        this.send([Types.UserMessages.WU_PLAYER_LOADED,
          MainConfig.protocol,MainConfig.address,MainConfig.port]);
    },

    handleLoadUserInfo: function (playerName, msg) {
      console.info("handleLoadUserInfo: "+JSON.stringify(msg));

      var username = msg[0],
          hash = msg[1],
          gems = parseInt(msg[2]),
          looks = msg[3];

      var conn = this.connection;
      var user = {};
      user.hashChallenge = conn.hash;
      user.world = this.world;
      user.conn = conn;

      this.server.enterWorld(conn);
      //var user = {gems: gems,
        //looks: Utils.HexToBin(looks)};
      user.gems = gems;
      user.looks = Utils.HexToBin(looks);
      user.name = username;
      //user.world = this;

      player = new Player(this.world, user, conn);
      //player.start(this.connection);
      //player.name = playerSummary.name;
      //player.hasLoggedIn = true;
      player.name = playerName;
      player.hash = hash;
      player.loaded = 0;
      player.worldHandler = user.worldHandler;
      this.player = player;

      this.world.connect_callback(player);
      //this.currentPlayer = player;

      this.loadedPlayer = true;
    },

    handleLoadPlayerInfo: function (msg) {
      console.info("handleLoadPlayerInfo: "+JSON.stringify(msg));
      var player = this.player;
      //player.name = msg.shift();
      //console.info(msg.toString());
      var data_player = {
          "name": msg[0],
          "map": msg[1].split(","),
          "stats": msg[2].split(","),
          "exps": msg[3].split(","),
          "gold": msg[4].split(","),
          "skills": msg[5].split(","),
          "pStats": msg[6].split(","),
          "sprites": msg[7].split(","),
          "colors": msg[8].split(","),
          "shortcuts": msg[9],
          "completeQuests": msg[10]
        };

      console.info("shortcuts: "+JSON.stringify(data_player.shortcuts));
      console.info("completeQuests: "+JSON.stringify(data_player.completeQuests));

      if (data_player.shortcuts) {
        data_player.shortcuts = JSON.parse(data_player.shortcuts);
      }

      if (data_player.completeQuests) {
        data_player.completeQuests = JSON.parse(data_player.completeQuests);
      }

      player.fillPlayerInfo(data_player);
      //player.hasLoggedIn = true;
      //player.packetHandler.loadedPlayer = true;

      //this.handlePlayerLoaded();
    },

    handleLoadPlayerQuests: function (msg) {
      console.info("handleLoadPlayerQuests: "+JSON.stringify(msg));
      var player = this.player;
      //var playerName = msg.shift();
      var quests = [];
      console.info("msg="+msg);
      dataJSON = JSON.parse(msg);
      for (var i = 0; i < dataJSON.length; i++) {
        var questData = dataJSON[i];
        if (questData) {
          console.info(JSON.stringify(questData));
          var quest = new Quest(questData.splice(0,7));
          if (questData.length > 0)
            quest.object = getQuestObject(questData.splice(0,6));
          if (questData.length > 0)
            quest.object2 = getQuestObject(questData.splice(0,6));
          player.quests.push(quest);
        }
      }
      //this.handlePlayerLoaded();
    },

    handleLoadPlayerAchievements: function (msg) {
      console.info("handleLoadPlayerAchievements: "+JSON.stringify(msg));
      var player = this.player;
      //var playerName = msg.shift();

      var achievements = getInitAchievements();
      var rec = msg.split(',');
      var len = ~~(rec.length / 3);
      for (var i=0; i < len; ++i)
      {
        var achievement = getSavedAchievement(rec.splice(0,3));
        player.achievements.push(achievement);
      }
      for (var i=len; i < achievements.length; ++i)
      {
        player.achievements.push(achievements[i]);
      }
      //this.handlePlayerLoaded();
    },

    handleLoadPlayerItems: function (type, msg) {
      console.info("handleLoadPlayerItems: "+JSON.stringify(msg));
      var player = this.player;
      //var playerName = msg.shift();
      var items = [];
      //console.info(pKey);
      console.info("getItems - data="+msg);
      dataJSON = JSON.parse(msg);
      for (var itemData of dataJSON) {
        if (itemData) {
          var item = new ItemRoom(
            parseInt(itemData[1]),
            parseInt(itemData[2]),
            parseInt(itemData[3]),
            parseInt(itemData[4]),
            parseInt(itemData[5]));
          item.slot = parseInt(itemData[0]);
          items.push(item);
        }
      }
      var storeType = null;
      if (type == 0){
        player.inventory = new Inventory(player, 48, items);
        storeType = player.inventory;
      }
      else if (type == 1){
        player.bank = new Bank(player, 96, items);
        storeType = player.bank;
      }
      else if (type == 2){
        player.equipment = new Equipment(player, 5, items);
        storeType = player.equipment;
        player.equipment.setItem = function (index, item) {
          player.equipment._setItem(index, item);
          player.setRange();
        };
      }
      player.itemStore[type] = storeType;
      //this.handlePlayerLoaded();
    },

    /*handlePlayerLoaded: function () {
        var player = this.player;
        player.loaded++;
        if (player.loaded == 6) {
          //this.main.send([500, "Hello"]);
          //player.initPacketHandler();
          //player.sendPlayerToClient();
          //players.push(player);
          //player.sendPlayer(db_player);
          console.info("player hash: "+player.hash);
          hashes[player.hash] = player;
          this.send([Types.UserMessages.WU_PLAYER_LOADED,
            MainConfig.protocol,MainConfig.address,MainConfig.port]);
        }
    },*/

    sendToUserServer: function (msg) {
      if (this.connection)
        this.connection.send(msg.serialize());
      else
        console.info("userHandler: sendToUserServer called without connection being set: "+JSON.stringify(msg.serialize()));
    },

    sendWorldInfo: function (config) {
      var msg = new UserMessages.ServerInfo(config.world_name, 0, config.nb_players_per_world, config.address, config.port, config.user_password);
      this.sendToUserServer( msg);
    },

    sendAuctionsData: function (data) {
      this.sendToUserServer( new UserMessages.SavePlayerAuctions(data));
    },

    sendLooksData: function (data) {
      this.sendToUserServer( new UserMessages.SavePlayerLooks(data));
    },

    sendPlayersList: function (data) {
      console.info("userHandler - sendPlayersList: "+JSON.stringify(data));
      this.sendToUserServer( new UserMessages.SavePlayersList(data));
    },

});
