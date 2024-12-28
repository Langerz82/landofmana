var Messages = require("./message");


module.exports = Looks = cls.Class.extend({
    init: function(){
        this.prices = [];
        this.reset();
    },

    reset: function ()
    {
        console.info("LOOKS INIT");

        var length = AppearanceData.Data.length;
        for (var i = 0; i < length; i++) {
          this.prices.push(500);
        }
        this.prices[0] = 0; // Sword1
        this.prices[50] = 0; // WoodenBow
        this.prices[77] = 0; // Cloth armor
        this.prices[151] = 0; // Cloth armor
    },

    load: function (data)
    {
      var self = this;
      //console.info("LOOKS LOAD: "+JSON.stringify(data));

      if (!data)
        this.reset();

      this.prices = data.parseInt();
    },

    save: function (world)
    {
      console.info("LOOKS SAVED");

      if (!this.prices)
        return;

      data = this.prices.join(",");
      if (world.userHandler) {
        world.userHandler.sendLooksData(data);
      }
    },

    modPrice: function (index, modPrice) {
      this.prices[index] += modPrice;
    },

    pricesToString: function () {
      return this.prices.join(',');
    },

    sendLooks: function (player) {
      player.map.entities.pushToPlayer(player, new Messages.AppearanceList(player.user, this));
    }
});
