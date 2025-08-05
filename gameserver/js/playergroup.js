var Messages = require("./message.js");

module.exports = PlayerGroup = Class.extend({
  init: function(leader, group, allowOnce) {
    this.players = [];
    this.allowOnce = allowOnce;
    this.group = group;
    this.world = leader.world;

    this.addName(leader.name);
    this.setLeader(leader.name);
  },

  containsName: function (playerName) {
    return this.players.includes(playerName);
  },

  setLeader: function(playerName) {
      this.leader = playerName;
      var index = this.players.indexOf(this.leader);
      if (index != 0)
        Utils.SwapElements(this.players, 0, index);
  },

  addName: function(playerName) {
    if(playerName){
      if (this.players.length === 0) {
        this.leader = playerName;
      }
      if (!this.containsName(playerName)) {
        this.players.push(playerName);
      }

      var player = this.getPlayer(playerName);
      if (player) {
        if(this.allowOnce && player[this.group]) {
          player[this.group].removeName(playerName);
        }
        player[this.group] = this;
      }
    }
    this.sendMembersName();
  },

  getPlayer: function (playerName) {
    if(playerName) {
      var player = this.world.getPlayerByName(playerName);
      if (player)
        return player;
    }
    return null;
  },

  sendPlayers: function (msg, sendOwner) {
    var self = this;
    this.forEachName(function (playerName) {
      if (sendOwner && this.leader === playerName)
        return;

      if(playerName) {
        var player = self.getPlayer(playerName);
        if (player)
          player.sendToPlayer(player, msg);
      }
    })
  },

  forEachName: function (callback) {
    var length = this.players.length;
    for(var i=0; i < length; ++i){
      if (callback)
        callback(this.players[i]);
    }
  },

  forEachPlayer: function (callback) {
    var length = this.players.length;
    for(var i=0; i < length; ++i){
      if (callback) {
        var player = this.getPlayer(this.players[i]);
        if (player)
          callback(player);
      }
    }
  },

  removeName: function(playerName) {
    if (playerName === this.leader)
    	this.leader = this.players[0];
    if (playerName) {
      if (this.containsName(playerName)) {
        var player = this.getPlayer(playerName);
        if (player) {
          player[this.group] = null;
        }
        this.players.splice(this.players.indexOf(playerName), 1);
      }
      this.sendMembersName();
    }
  },

  setMemberMessage: function (msg) {
    this.memberMessage = msg;
  },

  sendMembersName: function() {
    if (this.memberMessage)
      this.sendPlayers(new this.memberMessage(this.players), true);
  },

});
