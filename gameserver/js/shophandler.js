var Messages = require("./message.js");

module.exports = ShopHandler = Class.extend({
  init: function(packetHandler){
    this.ph = packetHandler;
    this.world = this.ph.world;
    this.player = this.ph.player;
  },

  handleStoreSell: function(message) {
    var type = parseInt(message[0]);
    var itemIndex = parseInt(message[1]);

    var item = this.player.itemStore[0].rooms[itemIndex];
    if (!item)
      return;

    //this.player.tut.buy = true;
    //this.player.tut.buy2 = true;

    var kind = item.itemKind;
    if (ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind))
      return;

    var price = ItemTypes.getEnchantSellPrice(item);
    if (price < 0)
      return;

    var itemKind = item.itemKind;
    //gold = this.player.gold[0];
    this.player.inventory.makeEmptyItem(itemIndex);
    this.player.modifyGold(price);
    var itemName = ItemTypes.KindData[itemKind].name;
    this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_SOLD", [itemName]));
  },

// TODO - Revise beloww!!!!!!!!!!!!!!
  handleAuctionSell: function(message) {
    var itemIndex = parseInt(message[0]),
        price = parseInt(message[1]);
    if (price < 0 || itemIndex < 0 || itemIndex >= this.player.inventory.maxNumber)
      return;

    var item = this.player.inventory.rooms[itemIndex];
    console.info(JSON.stringify(item));

    var kind = item.itemKind;
    if (ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind))
      return;

    if (kind) {
      this.world.auction.add(this.player, item, price, itemIndex);
      this.world.auction.list(this.player, 0);
      this.player.inventory.setItem(itemIndex, null);
    }
  },

  handleAuctionOpen: function(message) {
    var type = parseInt(message[0]);
    if (type >= 0 && type <= 3)
      this.world.auction.list(this.player, type);
  },

  handleAuctionBuy: function(message) {
    var auctionIndex = parseInt(message[0]),
        type = parseInt(message[1]);
    if (auctionIndex < 0 || auctionIndex >= this.world.auction.auctions.length)
      return;
    if (type < 0 || type > 3)
      return;

    var auctions = this.world.auction;
    var auction = this.world.auction.auctions[auctionIndex];
    if (!auction)
      return;
    if (auction.playerName == this.player.name)
      return;

    var price = auction.price;
    if (price < 0)
      return;

    var goldCount = this.player.gold[0];

    if (goldCount < price) {
      this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
      return;
    }

    if (!this.player.inventory.hasRoom()) {
      this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_NOSPACE"));
      return;
    }

    var itemKind = auction.item.itemKind;
    if (auctions.putItem(this.player, auction.item)) {
      this.player.modifyGold(-price);
      var itemName = ItemTypes.KindData[itemKind].name;
      this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_SOLD", [itemName]));

      var auctionPlayer = this.world.getPlayerByName(auction.playerName);
      if (auctionPlayer) {
        auctionPlayer.modifyGold(price);
      } else {
        if (this.world.userHandler)
          this.world.userHandler.sendPlayerGold(auction.playerName, price);
        else {
          console.warn("packetHander handleAuctionBuy: no world userHandler.");
        }
      }
      this.world.auction.remove(auctionIndex);
      this.world.auction.list(this.player, type);
    }
  },

  handleAuctionDelete: function(message) {
    var auctionIndex = parseInt(message[0]),
        type = parseInt(message[1]);
    if (auctionIndex < 0 || auctionIndex >= this.world.auction.auctions.length)
      return;
    if (type < 0 || type > 3)
      return;

    var auctions = this.world.auction;
    var auction = auctions.auctions[auctionIndex];
    if (!auction)
      return;

    if (auction.playerName !== this.player.name) {
      return;
    }

    if (!this.player.inventory.hasRoom()) {
      this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOSPACE"));
      return;
    }

    var itemKind = auction.item.itemKind;
    if (auctions.putItem(this.player, auction.item))
    {
      var itemName = ItemTypes.KindData[itemKind].name;
      this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_REMOVED", [itemName]));
      this.world.auction.remove(auctionIndex);
      this.world.auction.list(this.player, type);
    }
  },

  handleStoreModItem: function (msg) {
      var modType = parseInt(msg[0]),
          type = parseInt(msg[1]),
          itemIndex = parseInt(msg[2]);

      //console.info("type=" + type + ",invNumber=" + inventoryNumber1);
      if (type == 0 || type == 2) {
        var itemStore = this.player.itemStore[type];
        if (itemIndex < 0 && itemIndex >= itemStore.maxNumber)
          return;
        var item = this.player.itemStore[type].rooms[itemIndex];
        //console.info("item=" + JSON.stringify(item));
        if (modType == 0)
          this._repairItem(type, item, itemIndex);
        if (modType == 1)
          this._enchantItem(type, item, itemIndex);
      }
  },

  _repairItem: function(type, item, index) {
    var itemKind = null,
      price = 0;

    if (!(item && item.itemKind))
      return;

    if (!ItemTypes.isEquipment(item.itemKind))
      return;

    if (item.itemDurability == item.itemDurabilityMax)
      return;

    price = ~~(ItemTypes.getRepairPrice(item));
    if (price <= 0)
      return;

    goldCount = this.player.gold[0];
    //console.info("goldCount="+goldCount+",price="+price);
    if (goldCount < price) {
      this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
      return;
    }

    item.itemDurabilityMax -= 50;
    item.itemDurability = item.itemDurabilityMax;
    if (item.itemDurabilityMax <= 0) {
      item = null;
      this.player.itemStore[type].makeEmptyItem(index);
    } else {
      console.info("itemNumber=" + item.itemNumber);
      this.player.modifyGold(-price);
    }
    item.slot = index;

    this.ph.sendPlayer(new Messages.ItemSlot(type, [item]));
    var itemName = ItemTypes.KindData[item.itemKind].name;
    this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_REPAIRED", [itemName]));
  },

  _enchantItem: function(type, item, index) {
    var itemKind = null,
      price = 0;

    if (!(item && item.itemKind))
      return;

    if (!ItemTypes.isEquipment(item.itemKind))
      return;

    price = ItemTypes.getEnchantPrice(item);
    if (price <= 0)
      return;

    goldCount = this.player.gold[0];
    //console.info("goldCount="+goldCount+",price="+price);
    if (goldCount < price) {
      this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOGOLD"));
      return;
    }

    item.itemExperience = ItemTypes.itemExpForLevel[item.itemNumber - 1];
    item.itemNumber++;

    item.slot = index;

    this.ph.sendPlayer(new Messages.ItemSlot(type, [item]));
    console.info("itemNumber=" + item.itemNumber);
    this.player.modifyGold(-price);
    var itemName = ItemTypes.KindData[item.itemKind].name;
    this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_ENCHANTED", [itemName]));
  },

  handleStoreBuy: function(message) {
    var itemType = parseInt(message[0]),
      itemKind = parseInt(message[1]),
      itemCount = parseInt(message[2]),
      itemName = null,
      price = 0,
      goldCount = 0,
      buyCount = 0;

    if (!itemKind || itemCount <= 0) {
      return;
    }

    if (itemKind < 0 || itemKind >= ItemTypes.KindData.length)
      return;

    //console.info("itemKind="+itemKind);
    //console.info(JSON.stringify(ItemTypes));
    var itemData = ItemTypes.KindData[itemKind];

    var itemName = itemData.name;
    price = ItemTypes.getBuyPrice(itemKind);
    if (price > 0) {
      if (ItemTypes.Store.isBuyMultiple(itemKind)) {
        itemCount = itemData.buycount;
      }
      goldCount = this.player.gold[0];
      //console.info("goldCount="+goldCount);
      //console.info("itemCount="+itemCount);

      if (goldCount < price) {
        this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
        return;
      }

      var consume = ItemTypes.isConsumableItem(itemKind);
      if (consume || (!consume && this.player.inventory.hasRoom())) {
        var item = new ItemRoom([itemKind, itemCount, 0, 0, 0]);
        var res = this.player.inventory.putItem(item);
        if (res == -1)
          return;
        this.player.modifyGold(-price);
        this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_BUY", [itemName]));
        /*if (!this.player.tut.equip) {
          this.player.tutChat("TUTORIAL_EQUIP", 10, "equip");
        }*/
      } else {
        this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOSPACE"));
      }
    }

  },

  handleCraft: function(message) {
    var craftId = parseInt(message[0]),
      itemCount = parseInt(message[1]),
      itemName = null,
      price = 0,
      goldCount = 0,
      buyCount = 0;

    if (itemCount <= 0) {
      return;
    }

    if (craftId < 0 || craftId >= ItemData.CraftData.length)
      return;

    var craftData = ItemData.CraftData[craftId];

    var itemKind = craftData.o;

    //console.info("itemKind="+itemKind);
    //console.info(JSON.stringify(ItemTypes));
    if (!ItemTypes.KindData.hasOwnProperty(itemKind))
    {
      console.error("handleCraft - itemData not found for kind: "+itemKind);
      return;
    }

    var itemData = ItemTypes.KindData[itemKind];

    var itemName = itemData.name;
    price = ItemTypes.getCraftPrice(itemKind);
    if (price < 0)
      return;

    if (ItemTypes.Store.isBuyMultiple(itemKind)) {
      itemCount = (itemCount < itemData.buycount) ? itemCount : itemData.buycount;
    } else {
      itemCount = 1;
    }

    price = price * itemCount;

    goldCount = this.player.gold[0];
    //console.info("goldCount="+goldCount);
    //console.info("itemCount="+itemCount);

    if (goldCount < price) {
      this.ph.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
      return;
    }

    if (itemData.craft.length == 0)
      return;

    for (var it of craftData.i)
    {
        if (!this.player.inventory.hasItems(it[0],it[1]*itemCount)) {
          this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOCRAFTITEMS"));
          return;
        }
    }

    if (!this.player.inventory.hasRoom())
    {
      this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOSPACE"));
      return;
    }

    this.player.modifyGold(-price);
    for (var it of craftData.i)
    {
        this.player.inventory.removeItemKind(it[0],it[1]*itemCount);
    }

    var durability = 0;
    if (ItemTypes.isWeapon() || ItemTypes.isArmor())
      durability = 900;

    var item = new ItemRoom([itemKind, itemCount, durability, durability]);
    if (this.player.inventory.putItem(item) == -1)
      return;

    this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_BUY", [itemName]));
  },

});
