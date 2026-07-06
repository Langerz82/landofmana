var Bank = require("../../items/bank"),
    Equipment = require("../../items/equipment"),
    Inventory = require("../../items/inventory"),
    Timer = require("../../timer"),
    Messages = require("../../message");

module.exports = PlayerItems = cls.Class.extend({
  init: function(entity) {
    this.entity = entity;

    this.inventory = null;
    this.bank = null;
    this.equipment = null;
    this.itemStore = new Array(3);

    this.gold = new Array(2);

    this.consumeTimeout = null;
    this.consumeTime = new Timer(10000);
  },

  hasWeaponType: function (type) {
    var entity = this.entity;

    type = type || "any";
    if (type === "any")
        return true;

    var weapon = this.equipment.getWeapon();
    if (!weapon)
      return false;

    if (type) {
      return this.getWeaponType() === type;
    }
    return ItemTypes.isHarvestWeapon(weapon.itemKind);
  },

  getWeapon: function () {
    return this.equipment.getWeapon();
  },

  hasWeapon: function() {
    return this.getWeapon() !== null;
  },

  getWeaponLevel: function () {
    var entity = this.entity;

    var weapon = this.getWeapon();
    if (!weapon)
      return 0;
    var weaponData = ItemTypes.KindData[weapon.itemKind];
    return Types.getWeaponLevel(entity.stats.exp[weaponData.type]);
  },

  getWeaponType : function () {
    var weapon = this.getWeapon();
    if (!weapon)
      return null;
    return ItemTypes.getType(weapon.itemKind);
  },

  hasHarvestWeapon: function (type) {
    if (type && type === "any")
        return true;

    var weapon = this.getWeapon();
    if (!weapon)
      return false;

    var weaponData = ItemTypes.KindData[weapon.itemKind];
    if (type) {
      return weaponData.type === type;
    }
    return ItemTypes.isHarvestWeapon(weapon.itemKind);
  },

  handleStoreEmpty: function (slot, item) {
    var entity = this.entity;

    var kind = item.itemKind;
    var store = this.itemStore[slot[0]];
    var index = slot[1];
    var count = slot[2];

    if (slot[0] === 2) {
      console.error("handleStoreEmpty - Cannot empty equipment store.");
      return;
    }

    var itemRoom = store.rooms[slot[1]];
    var newItemRoom = Object.assign(new ItemRoom(), itemRoom);
    var item = entity.map.entities.createItem(newItemRoom, entity.x, entity.y);
    count = Utils.clamp(1, itemRoom.itemNumber, count);

    if(!ItemTypes.isEquippable(kind)) {
      item.room.itemNumber = count;
      store.takeOutItems(index, count);
    } else {
      store.makeEmptyItem(index);
    }

    entity.map.entities.sendNeighbours(entity, item.spawn());
    entity.knownIds.push(item.id);
    entity.world.loot.handleItemDespawn(item);
  },

  swapItem: function (slot, slot2) {
    var entity = this.entity;

    //console.info(JSON.stringify(slot));
    //console.info(JSON.stringify(slot2));
    var store1 = this.itemStore[slot[0]];
    var store2 = this.itemStore[slot2[0]];
    var room1 = store1.rooms;
    var rs1 = room1[slot[1]];
    if (!rs1)
      return;

    // if equipment and item is equipment set the correct index.
    if (slot2[0] === 2 && rs1) {
      slot2[1] = store2.getItemTypeIndex(rs1);
    }

    var room2 = store2.rooms;
    var rs2 = null;
    if (slot2[1] >= 0)
      rs2 = room2[slot2[1]];

    if (rs1 === rs2)
      return;

    var splitItem = function (slot, slot2, rs1)
    {
      if (slot[2] > 0 && slot[2] < rs1.itemNumber && ItemTypes.isStackedItem(rs1.itemKind))
      {
        rs1.itemNumber -= slot[2];
        store1.setItem(slot[1], rs1);
        var rs2 = Object.assign(new ItemRoom(), rs1);
        rs2.itemNumber = slot[2];
        store2.setItem(slot2[1], rs2);
        return true;
      }
      return false;
    };

    if (rs2)
    {
      if (!store2.combineItem(rs1, rs2)) {
        var tmp = rs2;
        if (store2.checkItem(slot2[1], rs1) && store1.checkItem(slot[1], rs2))
        {
          store2.setItem(slot2[1], rs1);
          store1.setItem(slot[1], rs2);
        }
      }
    }
    else if (slot2[1] >= 0) {

      if (!splitItem(slot, slot2, rs1)) {
        if (store2.setItem(slot2[1], rs1))
          store1.setItem(slot[1], null);
      }
    }
    else {
      if (store2.putItem(rs1) !== -1)
        store1.setItem(slot[1], null);
    }

    if((slot && slot[0] === 2 && slot[1] === 4) ||
       (slot2 && slot2[0] === 2 && slot2[1] === 4))
    {
      entity.broadcastSprites();
    }
  },

  /* ITEM STORE FUNCTIONS */
  getStoredItem: function (type, slot, count) {
    var entity = this.entity;

    var store = this.itemStore[type];

    var rooms = store.rooms;

    //console.info("inventory: "+JSON.stringify(this.player.inventory.rooms[index]));
    if (slot < 0 || slot >= rooms.length)
      return null;

    var item = rooms[slot];
    if (!item)
      return;

    var count2 = rooms[slot].itemNumber;
    if(ItemTypes.isLootItem(item.itemKind) || ItemTypes.isConsumableItem(item.itemKind)) {
      if (count > 0 && count2 > 0 && count2 < count)
          item = store.takeOutItems(slot, count2);
    }
    return item;
  },

  modifyGold: function(gold, type) {
    var entity = this.entity;

    type = type || 0;
    if (this.gold[type]+gold < 0)
      return false;

    this.gold[type] += parseInt(gold);

    entity.sendPlayer(new Messages.Gold(entity));
    if (gold === 0) {
      //this.sendPlayer(new Messages.Notify("CHAT", "GOLD_ZERO"));
    } else if (gold > 0)
      entity.sendPlayer(new Messages.Notify("CHAT", "GOLD_ADDED", [gold]));
    else {
      gold *= -1;
      entity.sendPlayer(new Messages.Notify("CHAT", "GOLD_REMOVED", [gold]));
    }
    return true;
  },

  modifyGems: function(diff) {
    var entity = this.entity;

    diff = parseInt(diff);
    if ((entity.user.gems - diff) < 0)
    {
      entity.connection.send((new Messages.Notify("SHOP", "SHOP_NOGEMS")).serialize());
      return false;
    }
    entity.user.gems += diff;
    entity.connection.send((new Messages.Gold(p)).serialize());
    return true;
  },

  handleInventoryEat: function(item, slot){
    var entity = this.entity;

    var kind = item.itemKind;

    if(!this.consumeTime.isOver())
        return;

    var amount;

    var itemData = ItemTypes.KindData[kind];
    this.consumeTime.duration = itemData.cooldown * 1000;

    if (itemData.typemod === "health")
    {
      amount = itemData.modifier;
      if(!entity.hasFullHealth()) {
        entity.modHp(amount);
      }
    }
    else if (itemData.typemod === "healthpercent")
    {
      amount = ~~(entity.stats.hpMax * itemData.modifier/100);
      if(!entity.hasFullHealth()) {
        entity.modHp(amount);
      }
    }
    if (itemData.typemod === "energy")
    {
      amount = itemData.modifier;
      if(!entity.hasFullEnergy()) {
        entity.modEp(amount);
      }
    }
    this.items.inventory.takeOutItems(slot, 1);
  },

});
