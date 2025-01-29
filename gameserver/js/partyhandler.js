var Messages = require("./message.js");

module.exports = PartyHandler = Class.extend({
  init: function(packetHandler){
    this.ph = packetHandler;
    this.world = this.ph.world;
    this.player = this.ph.player;
  },

  getPlayer: function (name) {
    name = name.toLowerCase();
    var player = this.world.getPlayerByName(name);
    if (!player) {
      this.player.sendPlayer(new Messages.Notify("CHAT", "NO_PLAYER_EXIST", [name]));
      return null;
    }
    return player;
  },

  handleInvite: function(msg) {
    var name = msg[0];
    var player2 = this.getPlayer(name);
    if (!player2) {
      return;
    }

    var status = msg[1];

    var curParty = this.player.party;

    if (this.player == player2)
      return;

    if (status == 0) {

      if (curParty && curParty.players.length >= 5) {
        this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_MAX_PLAYERS"));
        return;
      }
      if ((!curParty || curParty.leader) && player2 instanceof Player) {
        this.player.sendToPlayer(player2, new Messages.PartyInvite(this.player.id));
        this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_PLAYER_INVITE_SENT", [player2.name]));
      }
    } else if (status == 1) {
      if (player2.party) {
        player2.party.removePlayer(player2);
        //this.handlePartyAbandoned(player2.party);
      }
      if (curParty) {
        if (curParty.players.length >= 5) {
          this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_MAX_PLAYERS"));
          return;
        }
        curParty.addPlayer(player2);
      } else {
        if (this.world && this.world.party)
          this.world.party.addParty(player2, this.player);
        else {
          console.warn("no world or no world party.");
        }
      }

      if (player2) {
        this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_PLAYER_JOINED", [this.player.name]));
        this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_PLAYER_ADDED", [player2.name]));
      }
    } else if (status == 2) {
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_YOU_REJECTED_INVITE", [player2.name]));
      this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_THEY_REJECTED_INVITE", [player2.name]));
    }

  },

  handleKick: function(msg) {
    var name = msg[0];
    var player2 = this.getPlayer(name);
    if (!player2) {
      return;
    }
    if (this.player == player2)
      return;

    var party = this.player.party;

    if (!party) {
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_CANNOT_KICK"));
      return;
    }

    if (this.player == party.leader) {
      party.removePlayer(player2);
      if (player2 instanceof Player)
        this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_PLAYER_KICKED"));
      this.handlePartyAbandoned(party);
    } else {
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_CANNOT_KICK"));
    }
  },

  handleLeader: function(msg) {
    var name = msg[0];
    var player2 = this.getPlayer(name);
    if (!player2) {
      return;
    }

    if (this.player == player2)
      return;

    var party = this.player.party;
    if (!party) {
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_NOT_LEADER"));
      return;
    }

    if (this.player == party.leader) {
      party.leader = player2;

      this.player.sendToPlayer(player2, new Messages.Notify("CHAT", "PARTY_YOU_LEADER"));
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_PLAYER_LEADER", [party.leader.name]));
    } else {
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_IS_LEADER", [party.leader.name]));
    }
    party.sendMembersName();
  },

  handleLeave: function(msg) {
    var party = this.player.party;
    var leader = (party) ? party.leader : null;

    if (leader == null)
      return;

    if (!party) {
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_NOT_IN"));
      return;
    }

    party.removePlayer(this.player);
    this.handleAbandoned(party);

    this.player.sendToPlayer(leader, new Messages.Notify("CHAT", "PARTY_PLAYER_LEFT", [this.player.name]));

    if (this.player != leader)
      this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_YOU_LEFT", [leader.name]));

  },

  handleAbandoned: function(party) {
    if (party.players.length != 1)
      return;

    this.player.sendPlayer(new Messages.Notify("CHAT", "PARTY_ALL_LEFT"));
    this.player.sendPlayer(new Messages.Party([]));
    if (this.player !== party.players[0] && party.players[0] instanceof Player) {
      this.player.sendToPlayer(party.players[0], new Messages.Notify("CHAT", "PARTY_ALL_LEFT"));
      this.player.sendToPlayer(party.players[0], new Messages.Party([]));
    }
    if (this.world && this.world.party)
      this.world.party.removeParty(party);
    else {
      console.warn("no world or no world party.");
    }
  },

});
