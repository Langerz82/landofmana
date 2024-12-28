
var Messages = require("./message.js");
//var NpcPlayer = require("./npcplayer.js");

module.exports = Party = Class.extend({
  init: function(player1, player2){
    this.players = [player1, player2];
    if(player1.party){ player1.party.removePlayer(player1); }
    if(player2.party){ player2.party.removePlayer(player2); }
    player1.party = this;
    player2.party = this;
    this.leader = player1;

    this.sendMembersName();
  },

  addPlayer: function(player){
    if(player){
      this.players.push(player);
      if(player.party){
        player.party.removePlayer(player);
      }
      player.party = this;
    }
    this.sendMembersName();
  },

  removePlayer: function(player){
    var i=0;
    if (player == this.leader)
    	    this.leader = this.players[0];
    if(player){
      for(i=0; i<this.players.length; i++){
        if(player === this.players[i]){
          if (player instanceof Player)
          	  this.players[i].send([Types.Messages.PARTY]);
          this.players[i].party = null;
          this.players.splice(i, 1);
          this.sendMembersName();
          break;
        }
      }
    }
  },

  sendMembersName: function(){
    var i=0;
    var names = [];

    var players = this.players;

    if(players.length > 1){
      names.push(this.leader.name);
      for(i=0; i<players.length; i++){
        if (players[i] !== this.leader)
            names.push(players[i].name);
      }
    }
    //console.info("msg="+JSON.stringify(msg));
    for(i=0; i<players.length; i++){
       if (players[i] instanceof Player)
       	   players[i].map.entities.pushToPlayer(players[i], new Messages.Party(names));
    }
  },

  sumTotalLevel: function(){
    var i=0;
    var sum=0;
    for(i=0; i<this.players.length; i++){
      sum += this.players[i].level;
    }
    return sum+1;
  },

  getHighestLevel: function(){
    var i=0;
    var highestLevel = 0;
    for(i=0; i<this.players.length; i++){
      if(highestLevel < this.players[i].level){
        highestLevel = this.players[i].level;
      }
    }
    return highestLevel;
  },
  getLowestLevel: function(){
    var i=0;
    var lowestLevel = 999;
    for(i=0; i<this.players.length; i++){
      if(lowestLevel > this.players[i].level){
        lowestLevel = this.players[i].level;
      }
    }
    return lowestLevel;
  }
});
