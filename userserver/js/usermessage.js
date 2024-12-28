var _ = require('underscore');
var cls = require('./lib/class');
//var Quest = require('./quest');

var UserMessages = {};
module.exports = UserMessages;

var Message = cls.Class.extend({

});

UserMessages.WorldReady = Message.extend({
    init: function (user, protocol, address, port) {
    	this.user = user;
      this.protocol = protocol;
      this.address = address;
      this.port = port;
    },
    serialize: function () {
        return [Types.UserMessages.UC_WORLD_READY,
          this.user.name,
          this.user.playerName,
          this.user.hash,
          this.protocol,
          this.address,
          this.port];
    }
});

UserMessages.LoadPlayerAuctions = Message.extend({
    init: function (data) {
      this.data = data;
    },
    serialize: function () {
        return [Types.UserMessages.UW_LOAD_PLAYER_AUCTIONS].concat(this.data);
    }
});

UserMessages.LoadPlayerLooks = Message.extend({
    init: function (data) {
      this.data = data;
    },
    serialize: function () {
        return [Types.UserMessages.UW_LOAD_PLAYER_LOOKS].concat(this.data);
    }
});

UserMessages.LoadUserBans = Message.extend({
    init: function (data) {
      this.data = data;
    },
    serialize: function () {
        return [Types.UserMessages.UW_LOAD_USER_BANS].concat(this.data);
    }
});

UserMessages.SendLoadPlayerData = Message.extend({
    init: function (playerName, playerData) {
    	this.playerName = playerName;
      this.playerData = playerData;
    },
    serialize: function () {
        return [Types.UserMessages.UW_LOAD_PLAYER_DATA, this.playerName,
          this.playerData];
    }
});
