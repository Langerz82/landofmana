import Item from '../entity/item.js';
import Mob from '../entity/mob.js';
import Player from '../entity/player.js';
import Utils from '../utils.js';
import ItemRoom from '../items/itemroom.js';
import Messages from '../message.js';
import ItemData from '../data/itemdata.js';
import { ItemTypes } from '../common.js';
import { G_TILESIZE } from '../constants.js';

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
            const pos = Utils.fixGridPosition(G_TILESIZE, entity.x, entity.y);
            itemLoot.x = pos.x;
            itemLoot.y = pos.y;
            this.handleItemDespawn(itemLoot);
            return;
        }

        const item = this.getDroppedOrStolenItem(attacker, entity, 0);
        if (item && item instanceof Item)
        {
            const pos = Utils.fixGridPosition(G_TILESIZE, entity.x, entity.y);
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

    // SIMPLIFY: getLootItem() and getDrop() below both pick a weighted
    // random entry from a `{id: chance}`-style drops object via the same
    // "roll a number, walk entries subtracting each chance until the roll
    // lands inside one" scan. Shared here; returns the matching id (a
    // string, since these are for...in keys) or null if the roll doesn't
    // land in any entry (e.g. drops don't sum to the full roll range).
    _pickWeighted(drops, roll) {
        let v = roll;
        for (const id in drops) {
            const count = drops[id];
            if (v >= 0 && v < count) {
                return id;
            }
            v -= count;
        }
        return null;
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

        // NOTE: `itemId2` used to be declared twice with `var` -- once here
        // (`= null`) and once more, bare, right after the `if` above.
        // Redeclaring without an initializer is a no-op under `var` (the
        // `null` from the first declaration survived); a SyntaxError under
        // `let`. Consolidated to the one declaration -- now just the return
        // value of the shared _pickWeighted() scan above.
        const drops = target.questDrops;
        const itemId2 = this._pickWeighted(drops, Utils.randomRangeInt(0,1000));

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
        let itemId2 = this._pickWeighted(drops, Utils.random(1000));

        // FIX: `itemId` from a `for...in` loop is always a string (object
        // keys are strings even when numeric-looking, the same class of
        // bug already fixed elsewhere in this codebase -- see
        // entity/components/playercombat.js's baseCritDef/baseDamageDef).
        // `itemId2` was left as that string and used directly below in
        // `ItemTypes.isEquippable(itemId2)` -- this is exactly what the
        // "ITEM IS NOT PROVIDING ITEM KIND" TODO was flagging: an
        // equippable drop's kind wouldn't compare/lookup correctly as a
        // string, misclassifying it as non-equippable and building the
        // dropped ItemRoom with the wrong durability/experience defaults
        // for its actual kind. `new ItemRoom(...)` further down happens to
        // self-heal via its own `Number(arr[0])` coercion, but that's after
        // the isEquippable check already ran on the raw string. Coercing
        // once here fixes it at the source.
        if (!itemId2)
            return null;
        itemId2 = Number(itemId2);

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
