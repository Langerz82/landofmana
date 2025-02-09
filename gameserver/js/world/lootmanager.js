
module.exports = LootManager = Class.extend({
  init: function (world) {
    this.world = world;
  },

  handleDropItem: function (entity, attacker)
  {
    var itemLoot = this.getLootItem(attacker, entity, 0);
    if (itemLoot && itemLoot instanceof Item)
    {
        console.info("LOOT ITEM SENT!")
        itemLoot.x = entity.x;
        itemLoot.y = entity.y;
        this.handleItemDespawn(itemLoot);
        return;
    }

    var item = this.getDroppedOrStolenItem(attacker, entity, 0);
    if (item && item instanceof Item)
    {
        item.x = entity.x;
        item.y = entity.y;
        this.handleItemDespawn(item);
        return;
    }
  },

  handleItemDespawn: function(item)
  {
      if (item)
      {
          item.handleDespawn(
          {
              beforeBlinkDelay: 20000,
              blinkCallback: function()
              {
                  //item.map.entities.pushToAdjacentGroups(item.group, new Messages.Blink(item));
              },
              blinkingDuration: 10000,
              despawnCallback: function()
              {
                  item.map.entities.itemDespawn(item);
              }
          });
      }
  },

  getLootItem: function(source, target, stolen)
  {
    var self = this;
    var itemId2 = null;

    if ( !target instanceof Mob)
      return;

    var v = Utils.randomRangeInt(0,1000);
    var itemId2;
    var drops = target.questDrops;

    for (var d in drops) {
      var count = drops[d];
      if (v >= 0 && v < count) {
        itemId2 = d;
        break;
      }
      v -= count;
    }

    if (itemId2) {
      //console.info("itemName: "+itemName);
      //var kind = ItemTypes.getKindFromString(itemName);
      var itemRoom = new ItemRoom([parseInt(itemId2), 1, 0, 0, 0]);
      var lootItem = target.map.entities.createItem(itemRoom, target.x, target.y, 1);
      lootItem.count = 1;
      lootItem.experience = 0;

      target.map.entities.sendNeighbours(target, lootItem.spawn());
      return target.map.entities.addItem(lootItem);
    }
    return null;
  },

  getPlayerDrop: function(source, target, stolen) {
    var itemIndex = target.inventory.getRandomItemNumber();
    if (itemIndex == -1)
      return;
    item = target.inventory.rooms[itemIndex];
    var count = 1;
    if (ItemTypes.isConsumableItem(item.itemKind)) {
      count = Math.floor((Math.random() * target.level + 2) / 2);
      if (count > item.itemNumber)
        count = item.itemNumber;
    }
    var item2;
    if (stolen) {
      item2 = Object.assign(new ItemRoom(), item);
      item2.itemNumber = count;
      source.map.entities.sendToPlayer(source, new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name]));
    }
    else {
      item2 = target.map.entities.addItem(target.map.entities.createItem(type, item, target.x, target.y, count));
    }
    target.inventory.takeOutItems(itemIndex, count);
    return item2;
  },

  getDrop: function(source, target, stolen) {
    //console.info("getDroppedItem");
    if (target.droppedItem == true)
      return;

    target.droppedItem = true;

    var drops = target.drops;
    var v = Utils.random(1000);
    var itemId2;

    for (var itemId in drops) {
      var count = drops[itemId];
      if (v >= 0 && v < count) {
        itemId2 = itemId;
        break;
      }
      v -= count;
    }

// TODO CHECK CODE AS ITEM IS NOT PROVIDING ITEM KIND.
    if (!itemId2)
      return null;

    //console.info("itemName: "+itemName);
    //var kind = ItemTypes.getKindFromString(itemName);
    var itemRoom;
    if (ItemTypes.isEquippable(itemId2))
    {
      var count = Utils.setEquipmentBonus(itemId2)
      itemRoom = new ItemRoom([itemId2, count, 0, 0, 900, 900]);
      itemRoom.itemExperience = ItemTypes.itemExpForLevel[count - 1];
    }
    else {
      itemRoom = new ItemRoom([itemId2, 1, 0, 0, 0, 0]);
    }
    var item = target.map.entities.createItem(itemRoom, target.x, target.y, 1);

    if (stolen)
    {
      if (source instanceof Player)
        source.map.entities.sendToPlayer(source, new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name]));
      return itemRoom;
    }
    else
    {
      if (target.data && target.data.dropBonus)
        item.count += target.data.dropBonus;

      target.map.entities.sendNeighbours(target, item.spawn());
      item.enemyDrop = true;
      return target.map.entities.addItem(item);
    }
  },

  getGoldDrop: function(source, target, stolen) {
    // No item drop gold.
    var count = target.dropGold();

    if (source instanceof Player) {
      source.modifyGold(count);
    }
  },

  getDroppedOrStolenItem: function(source, target, stolen) {
    var self = this;
    var item = null;
    if (source instanceof Player && target instanceof Player) {
      this.getGoldDrop(source, target, stolen);
      return this.getPlayerDrop(source, target, stolen);
    } else if (target instanceof Mob) {
      this.getGoldDrop(source, target, stolen);
      return this.getDrop(source, target, stolen);
    }
    /*else if (target instanceof Gather) {
      return this.getDrop(source, target, stolen);
    }*/
    return null;
  },

});
