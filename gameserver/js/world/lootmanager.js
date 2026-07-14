import Item from '../entity/item.js';
import Mob from '../entity/mob.js';
import Player from '../entity/player.js';
import Utils from '../utils.js';
import ItemRoom from '../items/itemroom.js';
import Messages from '../message.js';
import ItemData from '../data/itemdata.js';
import { ItemTypes } from '../common.js';

class LootManager {
    constructor(world) {
        this.world = world;
    }

    handleDropItem(entity, attacker)
    {
        const itemLoot = this.getLootItem(attacker, entity, 0);
        if (itemLoot && itemLoot instanceof Item)
        {
            console.info("LOOT ITEM SENT!")
            const pos = Utils.fixGridPosition(entity.x,entity.y);
            itemLoot.x = pos.x;
            itemLoot.y = pos.y;
            this.handleItemDespawn(itemLoot);
            return;
        }

        const item = this.getDroppedOrStolenItem(attacker, entity, 0);
        if (item && item instanceof Item)
        {
            const pos = Utils.fixGridPosition(entity.x,entity.y);
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

    // FIX: operator precedence meant `!target instanceof Mob` evaluated as
    // `(!target) instanceof Mob` (always false, since `!target` is a
    // boolean, and booleans are never instances of Mob) instead of the
    // intended `!(target instanceof Mob)`. This guard clause never actually
    // fired, so non-Mob targets (e.g. players) fell through into mob-only
    // quest-drop logic.
    getLootItem(source, target, stolen)
    {
        const self = this;

        if (!(target instanceof Mob))
            return;

        let v = Utils.randomRangeInt(0,1000);
        // NOTE: `itemId2` used to be declared twice with `var` -- once here
        // (`= null`) and once more, bare, right after the `if` above.
        // Redeclaring without an initializer is a no-op under `var` (the
        // `null` from the first declaration survived); a SyntaxError under
        // `let`. Consolidated to the one declaration, moved to just above
        // where it's actually used (reassigned in the loop below, read at
        // the `if (itemId2)` check further down).
        let itemId2 = null;
        const drops = target.questDrops;

        for (const d in drops) {
            const count = drops[d];
            if (v >= 0 && v < count) {
                itemId2 = d;
                break;
            }
            v -= count;
        }

        if (itemId2) {
            //console.info("itemName: "+itemName);
            //var kind = ItemTypes.getKindFromString(itemName);
            const itemRoom = new ItemRoom([parseInt(itemId2), 1, 0, 0, 0]);
            const lootItem = target.map.entities.createItem(itemRoom, target.x, target.y, 1);
            lootItem.count = 1;
            lootItem.experience = 0;

            target.map.entities.sendNeighbours(target, lootItem.spawn());
            return target.map.entities.addItem(lootItem);
        }
        return null;
    }

    // FIX: three bugs here. (1) `target.inventory` doesn't exist -- inventory
    // lives on `target.items.inventory` everywhere else in this codebase
    // (including two lines below, and takeOutItems() at the bottom), so this
    // threw immediately on every call. (2) the else-branch referenced a bare
    // `type` identifier that was never defined anywhere in this function.
    // (3) it called target.map.entities.createItem(...) with 5 arguments even
    // though that method's signature is (itemRoom, x, y) -- and createItem()
    // already adds the item internally, so the extra wrapping addItem() call
    // below would have double-added the entity even if the arguments were
    // right. Building a proper ItemRoom clone (same pattern as the `stolen`
    // branch just above) and calling createItem() directly fixes all three.
    getPlayerDrop(source, target, stolen) {
        const itemIndex = target.items.inventory.getRandomItemNumber();
        if (itemIndex === -1)
            return;
        const item = target.items.inventory.rooms[itemIndex];
        let count = 1;
        if (ItemTypes.isConsumableItem(item.itemKind)) {
            count = Math.floor((Math.random() * target.level + 2) / 2);
            if (count > item.itemNumber)
                count = item.itemNumber;
        }
        let item2;
        if (stolen) {
            item2 = Object.assign(new ItemRoom(), item);
            item2.itemNumber = count;
            source.sendPlayer(new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name]));
        }
        else {
            const droppedRoom = Object.assign(new ItemRoom(), item);
            droppedRoom.itemNumber = count;
            item2 = target.map.entities.createItem(droppedRoom, target.x, target.y);
        }
        target.items.inventory.takeOutItems(itemIndex, count);
        return item2;
    }

    getDrop(source, target, stolen) {
        //console.info("getDroppedItem");
        if (target.droppedItem === true)
            return;

        target.droppedItem = true;

        const drops = target.drops;
        let v = Utils.random(1000);
        let itemId2;

        for (const itemId in drops) {
            const count = drops[itemId];
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
        let itemRoom;
        if (ItemTypes.isEquippable(itemId2))
        {
            const count = Utils.setEquipmentBonus(itemId2)
            itemRoom = new ItemRoom([itemId2, count, 0, 0, 900, 900]);
            itemRoom.itemExperience = ItemTypes.itemExpForLevel[count - 1];
        }
        else {
            itemRoom = new ItemRoom([itemId2, 1, 0, 0, 0, 0]);
        }
        const item = target.map.entities.createItem(itemRoom, target.x, target.y, 1);

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
        let count = target.dropGold();
        if (source instanceof Player) {
            let targetLevel = 0;
            targetLevel = target.level;
            const diff = targetLevel - source.level;
            const bonusLevel = Utils.clamp(0.1, 1.9, 1 + (diff * 0.05));
            count *= bonusLevel;
            count = ~~count;
        }

        if (source instanceof Player) {
            source.items.modifyGold(count);
        }
    }

    getDroppedOrStolenItem(source, target, stolen) {
        const self = this;
        const item = null;
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
