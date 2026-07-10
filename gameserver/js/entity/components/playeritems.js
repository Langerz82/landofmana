import Bank from '../../items/bank.js';
import Equipment from '../../items/equipment.js';
import Inventory from '../../items/inventory.js';
import Timer from '../../timer.js';
import Messages from '../../message.js';
import { Types, ItemTypes } from '../../common.js';
import ItemRoom from '../../items/itemroom.js';
import Utils from '../../utils.js';

class PlayerItems {
    constructor(entity) {
        this.entity = entity;

        this.inventory = null;
        this.bank = null;
        this.equipment = null;
        this.itemStore = new Array(3);

        this.gold = new Array(2);

        this.consumeTimeout = null;
        this.consumeTime = new Timer(10000);
    }

    hasWeaponType(type) {
        const entity = this.entity;

        type = type || "any";
        if (type === "any")
            return true;

        const weapon = this.equipment.getWeapon();
        if (!weapon)
            return false;

        if (type) {
            return this.getWeaponType() === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }

    getWeapon() {
        return this.equipment.getWeapon();
    }

    hasWeapon() {
        return this.getWeapon() !== null;
    }

    getWeaponLevel() {
        const entity = this.entity;

        const weapon = this.getWeapon();
        if (!weapon)
            return 0;
        const weaponData = ItemTypes.KindData[weapon.itemKind];
        return Types.getWeaponLevel(entity.stats.exp[weaponData.type]);
    }

    getWeaponType() {
        const weapon = this.getWeapon();
        if (!weapon)
            return null;
        return ItemTypes.getType(weapon.itemKind);
    }

    hasHarvestWeapon(type) {
        if (type && type === "any")
            return true;

        const weapon = this.getWeapon();
        if (!weapon)
            return false;

        const weaponData = ItemTypes.KindData[weapon.itemKind];
        if (type) {
            return weaponData.type === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }

    handleStoreEmpty(slot, item) {
        const entity = this.entity;

        const kind = item.itemKind;
        const store = this.itemStore[slot[0]];
        const index = slot[1];
        let count = slot[2];

        if (slot[0] === 2) {
            console.error("handleStoreEmpty - Cannot empty equipment store.");
            return;
        }

        const itemRoom = store.rooms[slot[1]];
        const newItemRoom = Object.assign(new ItemRoom(), itemRoom);
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
    }

    swapItem(slot, slot2) {
        const entity = this.entity;

        //console.info(JSON.stringify(slot));
        //console.info(JSON.stringify(slot2));
        const store1 = this.itemStore[slot[0]];
        const store2 = this.itemStore[slot2[0]];
        const room1 = store1.rooms;
        const rs1 = room1[slot[1]];
        if (!rs1)
            return;

        // if equipment and item is equipment set the correct index.
        if (slot2[0] === 2 && rs1) {
            slot2[1] = store2.getItemTypeIndex(rs1);
        }

        const room2 = store2.rooms;
        let rs2 = null;
        if (slot2[1] >= 0)
            rs2 = room2[slot2[1]];

        if (rs1 === rs2)
            return;

        const splitItem = function (slot, slot2, rs1)
        {
            if (slot[2] > 0 && slot[2] < rs1.itemNumber && ItemTypes.isStackedItem(rs1.itemKind))
            {
                rs1.itemNumber -= slot[2];
                store1.setItem(slot[1], rs1);
                const rs2 = Object.assign(new ItemRoom(), rs1);
                rs2.itemNumber = slot[2];
                store2.setItem(slot2[1], rs2);
                return true;
            }
            return false;
        };

        if (rs2)
        {
            if (!store2.combineItem(rs1, rs2)) {
                const tmp = rs2;
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
    }

    /* ITEM STORE FUNCTIONS */
    getStoredItem(type, slot, count) {
        const entity = this.entity;

        const store = this.itemStore[type];

        const rooms = store.rooms;

        //console.info("inventory: "+JSON.stringify(this.player.inventory.rooms[index]));
        if (slot < 0 || slot >= rooms.length)
            return null;

        let item = rooms[slot];
        if (!item)
            return;

        const count2 = rooms[slot].itemNumber;
        if(ItemTypes.isLootItem(item.itemKind) || ItemTypes.isConsumableItem(item.itemKind)) {
            if (count > 0 && count2 > 0 && count2 < count)
                item = store.takeOutItems(slot, count2);
        }
        return item;
    }

    modifyGold(gold, type) {
        const entity = this.entity;

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
    }

    // FIX: `p` was never defined anywhere in this file (the constructor
    // parameter/property is named `entity` everywhere else in this class, and
    // Messages.Gold expects a player-shaped object with .items.gold/.user.gems
    // -- see message.js). This threw a ReferenceError on every successful gem
    // spend, right after the gems had already been deducted, so the client
    // never got its updated gold/gems packet.
    modifyGems(diff) {
        const entity = this.entity;

        diff = parseInt(diff);
        if ((entity.user.gems - diff) < 0)
        {
            entity.connection.send((new Messages.Notify("SHOP", "SHOP_NOGEMS")).serialize());
            return false;
        }
        entity.user.gems += diff;
        entity.connection.send((new Messages.Gold(entity)).serialize());
        return true;
    }

    handleInventoryEat(item, slot){
        const entity = this.entity;

        // FIX: getStoredItem() (above) returns null/undefined for an empty
        // slot, and packethandler.js's CW_ITEMSLOT "eat" action passes
        // whatever getStoredItem() returns straight through without checking
        // it first. A client could point an eat packet at an empty inventory
        // slot and throw a TypeError here on every such packet (previously
        // silently swallowed by the global uncaughtException handler instead
        // of being rejected cleanly).
        if (!item)
            return;

        const kind = item.itemKind;

        if(!this.consumeTime.isOver())
            return;

        let amount;

        const itemData = ItemTypes.KindData[kind];
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
        // FIX: `this` here is the PlayerItems instance itself (this method is
        // defined on PlayerItems), and PlayerItems has no `this.items`
        // property -- only `this.inventory` directly (PlayerItems *is*
        // player.items). `this.items.inventory` threw "Cannot read
        // properties of undefined" every time a player ate/consumed an
        // inventory item.
        this.inventory.takeOutItems(slot, 1);
    }
}

export default PlayerItems;
