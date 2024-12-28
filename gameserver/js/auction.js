var cls = require("./lib/class"),
    BaseItem = require("./items/baseitem"),
    Messages = require("./message");

module.exports = AuctionRecord = cls.Class.extend({
    init: function (index, playerName, price, item) {
      this.index = index;
      this.playerName = playerName;
      this.price = price;
      this.item = item;
    },

    save: function () {
        return [this.playerName,
          this.price].join(",") + "," + this.item.toArrayNoSlot().join(",");
    },

    toArray: function () {
      var cols = [this.index,
        this.playerName,
        this.price];
      cols = cols.concat(this.item.toArray());
      return cols;
    }
});

module.exports = Auction = cls.Class.extend({
    init: function(){
        this.auctions = [];
    },

    load: function (data)
    {
      var self = this;
      console.info("auction - load: "+JSON.stringify(data));

      if (Array.isArray(data) && data.length === 0)
        return;

      auctions = [];
      var i=0;
      for (var rec of data)
      {
        var sData = rec.split(",");
        var record = new AuctionRecord(i,
          sData[0],
          parseInt(sData[1]),
          new ItemRoom([
             parseInt(sData[2]),
             parseInt(sData[3]),
             parseInt(sData[4]),
             parseInt(sData[5]),
             parseInt(sData[6])])
          );
        auctions.push(record);
      }
      if (auctions)
        this.auctions = auctions;
    },

    save: function (world)
    {
      console.info("auction - save: "+JSON.stringify(this.auctions));

      var data = [];
      for(var auction of this.auctions) {
        if (auction)
          data.push(auction.save());
      }

      if (world.userHandler) {
        world.userHandler.sendAuctionsData(data);
      } else {
        console.info("save: world.userHandler not set.");
      }
    },

    add: function(player, item, price, invIndex) {
        var index = Object.keys(this.auctions).length;
        var auction = new AuctionRecord(index, player.name, price, item);
        this.auctions.push(auction);
        player.inventory.setItem(invIndex, null);
        player.map.entities.pushToPlayer(player, new Messages.Notify("AUCTION","AUCTION_ADDED"));
    },

    remove: function (index) {
      this.auctions[index] = null;
    },

    putItem: function (player, item) {
      //var itemRoom = new ItemRoom(item.toArray());
      return player.inventory.putItem(item) >= 0;

    },

    list: function (player, type) {
      var msg = [Types.Messages.WC_AUCTIONOPEN, type, 0];
      var recCount = 0;
      for (var auction of this.auctions) {
        if (!auction) {
          continue;
        }
        var kind = auction.item.itemKind;
        var pc = player.name === auction.playerName;
        if ((type === 1 && !pc && ItemTypes.isArmor(kind)) ||
          (type === 2 && !pc && ItemTypes.isWeapon(kind)) ||
          (type === 0 && pc))
        {
          msg = msg.concat(auction.toArray());
          ++recCount;
        }
      }
      msg[2] = recCount;
      player.map.entities.pushToPlayer(player, new Messages.AuctionOpen(msg));
    }
});
