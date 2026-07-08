import Item from '../entity/item.js';
import Mob from '../entity/mob.js';
import Player from '../entity/player.js';
//import Utils from '../utils.js';
import ItemRoom from '../items/itemroom.js';
import Messages from '../message.js';
import ItemData from '../data/itemdata.js';

class LootManager {
    constructor(world) {
        this.world = world;
    }

    handleDropItem(entity, attacker)
    {
        var itemLoot = this.getLootItem(attacker, entity, 0);
        if (itemLoot && itemLoot instanceof Item)
        {
            console.info("LOOT ITEM SENT!")
            var pos = Utils.fixGridPosition(entity.x,entity.y);
            itemLoot.x = pos.x;
            itemLoot.y = pos.y;
            this.handleItemDespawn(itemLoot);
            return;
        }

        var item = this.getDroppedOrStolenItem(attacker, entity, 0);
        if (item && item instanceof Item)
        {
            var pos = Utils.fixGridPosition(entity.x,entity.y);
            item.x = pos.x;
            item.y = pos.y;
            this.handleItemDespawn(item);
            return;
        }
    }

    handleItemDespawn(item)
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
    }

    // NOTE: pre-existing bug preserved from the original — operator precedence
    // means `!target instanceof Mob` evaluates as `(!target) instanceof Mob`
    // (always false, since `!target` is a boolean), not `!(target instanceof
    // Mob)` as presumably intended.
    getLootItem(source, target, stolen)
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
    }

    // NOTE: `item` was a bare (undeclared) assignment in the original CommonJS
    // source, which created an implicit global there; declared with `var` here
    // since ES modules are always strict mode and forbid implicit globals.
    // Also NOTE: the else-branch below references a bare `type` identifier that
    // is never defined anywhere in this function, and calls
    // target.map.entities.createItem(...) with 5 arguments even though that
    // method's signature is (itemRoom, x, y) — both pre-existing bugs, left
    // unchanged since this code path would already have thrown/misbehaved in the
    // original CommonJS version too.
    getPlayerDrop(source, target, stolen) {
        var itemIndex = target.inventory.getRandomItemNumber();
        if (itemIndex === -1)
            return;
        var item = target.inventory.rooms[itemIndex];
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
            source.sendPlayer(new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name]));
        }
        else {
            item2 = target.map.entities.addItem(target.map.entities.createItem(type, item, target.x, target.y, count));
        }
        target.inventory.takeOutItems(itemIndex, count);
        return item2;
    }

    getDrop(source, target, stolen) {
        //console.info("getDroppedItem");
        if (target.droppedItem === true)
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
                source.sendPlayer(new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name]));
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
    }

    getGoldDrop(source, target, stolen) {
        // No item drop gold.
        var count = target.dropGold();
        if (source instanceof Player) {
            var targetLevel = 0;
            targetLevel = target.level;
            var diff = targetLevel - source.level;
            var bonusLevel = Utils.clamp(0.1, 1.9, 1 + (diff * 0.05));
            count *= bonusLevel;
            count = ~~count;
        }

        if (source instanceof Player) {
            source.items.modifyGold(count);
        }
    }

    getDroppedOrStolenItem(source, target, stolen) {
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
    }
}

export default LootManager;
