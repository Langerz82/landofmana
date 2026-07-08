import Messages from "./message.js";
//import Utils from './utils.js';

class PlayerGroup {
  constructor(leader, group, allowOnce) {
    this.players = [];
    this.allowOnce = allowOnce;
    this.group = group;
    this.world = leader.world;

    this.addName(leader.name);
    this.setLeader(leader.name);
  }

  containsName(playerName) {
    return this.players.includes(playerName);
  }

  setLeader(playerName) {
      this.leader = playerName;
      var index = this.players.indexOf(this.leader);
      if (index != 0)
        Utils.SwapElements(this.players, 0, index);
  }

  addName(playerName) {
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
  }

  getPlayer(playerName) {
    if(playerName) {
      var player = this.world.getPlayerByName(playerName);
      if (player)
        return player;
    }
    return null;
  }

  sendPlayers(msg, sendOwner) {
    var self = this;
    this.forEachName(function (playerName) {
      if (sendOwner && this.leader === playerName)
        return;

      if(playerName) {
        var player = self.getPlayer(playerName);
        if (player)
          player.sendPlayer(msg);
      }
    })
  }

  forEachName(callback) {
    var length = this.players.length;
    for(var i=0; i < length; ++i){
      if (callback)
        callback(this.players[i]);
    }
  }

  forEachPlayer(callback) {
    var length = this.players.length;
    for(var i=0; i < length; ++i){
      if (callback) {
        var player = this.getPlayer(this.players[i]);
        if (player)
          callback(player);
      }
    }
  }

  removeName(playerName) {
    if (playerName === this.leader)
    	this.leader = this.players[0];
    if (playerName) {
      if (this.containsName(playerName)) {
        var player = this.getPlayer(playerName);
        if (player) {
          player[this.group] = null;
        }
        this.players.removeVal(playerName);
        //this.players.splice(this.players.indexOf(playerName), 1);
      }
      this.sendMembersName();
    }
  }

  setMemberMessage(msg) {
    this.memberMessage = msg;
  }

  sendMembersName() {
    if (this.memberMessage)
      this.sendPlayers(new this.memberMessage(this.players), true);
  }

}

export default PlayerGroup;
