var PlayerGroup = require("./playergroup");
var Message = require("./message");

module.exports = PartyManager = Class.extend({
  init: function (world) {
    this.world = world;
    this.party = [];
  },

  addParty: function(player1, player2)
  {
      var party = new PlayerGroup(player1, "party", true);
      party.setMemberMessage(Message.Party);
      party.addName(player2.name);
      this.party.push(party);
      return party;
  },

  removeParty: function(party)
  {
      this.party = _.reject(this.party, function(el)
      {
          return el === party;
      });
      delete party;
  },

  removePlayer: function (player) {
    if (player.hasOwnProperty("party") && player.party)
    {
        var party = player.party;
        party.removeName(player.name);
        player.packetHandler.partyHandler.handlePartyAbandoned(party);
    }
  },


});
