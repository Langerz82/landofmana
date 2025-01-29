var Party = require("./party");

module.exports = PartyManager = Class.extend({
  init: function (world) {
    this.world = world;
    this.party = [];
  },

  addParty: function(player1, player2)
  {
      var party = new Party(player1, player2);
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
        party.removePlayer(player);
        player.packetHandler.partyHandler.handlePartyAbandoned(party);
    }
  },


});
