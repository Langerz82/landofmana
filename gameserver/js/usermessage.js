var _ = require('underscore');
var cls = require('./lib/class');

var UserMessages = {};
module.exports = UserMessages;

var Message = cls.Class.extend({

});

UserMessages.UpdatePlayerCount = Message.extend({
    init: function (count, maxCount) {
      this.count = count;
      this.maxCount = maxCount;
    },
    serialize: function () {
        return [Types.UserMessages.WU_UPDATE_PLAYER_COUNT,
          this.count,
          this.maxCount];
    }
});

UserMessages.SendPlayerGold = Message.extend({
    init: function (name, gold) {
      this.name = name;
      this.gold = gold;
    },
    serialize: function () {
        return [Types.UserMessages.WU_ADD_PLAYER_GOLD,
          this.name,
          this.gold];
    }
});

UserMessages.SavePlayerAuctions = Message.extend({
    init: function (data) {
      this.data = data;
    },
    serialize: function () {
        return [Types.UserMessages.WU_SAVE_PLAYER_AUCTIONS].concat(this.data);
    }
});

UserMessages.SavePlayerLooks = Message.extend({
    init: function (data) {
      this.data = data;
    },
    serialize: function () {
        return [Types.UserMessages.WU_SAVE_PLAYER_LOOKS].concat(this.data);
    }
});

UserMessages.SaveUserBans = Message.extend({
    init: function (data) {
      this.data = data;
    },
    serialize: function () {
        return [Types.UserMessages.WU_SAVE_USER_BANS,this.data];
    }
});

UserMessages.ServerInfo = Message.extend({
    init: function (config, count) {
    	this.config = config;
      this.count = count || 0;
    },
    serialize: function () {
        return [Types.UserMessages.WU_GAMESERVER_INFO,
          this.config.world_name,
          this.count,
          this.config.nb_players_per_world,
          this.config.address,
          this.config.port,
          this.config.user_password,
          this.config.world_key];
    }
});

UserMessages.SavePlayersList = Message.extend({
    init: function (data) {
        this.data = data;
    },
    serialize: function () {
        return [Types.UserMessages.WU_SAVE_PLAYERS_LIST,this.data];
    }
});


UserMessages.playerLoggedIn = Message.extend({
    init: function (username, playerName) {
      this.username = username;
    	this.playerName = playerName;
    },
    serialize: function () {
        return [Types.UserMessages.WU_PLAYER_LOGGED_IN, this.username,
          this.playerName];
    }
});

UserMessages.SavePlayerData = Message.extend({
    init: function (playerName, playerData, update) {
    	this.playerName = playerName;
      this.playerData = playerData;
      this.update = update;
    },
    serialize: function () {
        var um = (this.update) ? Types.UserMessages.WU_UPDATE_PLAYER_DATA :
          Types.UserMessages.WU_SAVE_PLAYER_DATA;
        return [um, this.playerName, this.playerData];
    }
});
