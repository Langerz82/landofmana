/* global databaseHandler, log */
import Messages from '../message.js';
import ItemData from '../data/itemdata.js';
import { ItemTypes } from '../common.js';

class Equipment {
    constructor(owner, number, items) {
        this.owner = owner;
        this.number = number;
        this.maxNumber = 5;
        this.weaponSlot = 4;
        this.rooms = {};
        console.info("number="+number);
        console.info("itemSlots="+JSON.stringify(items));

        if (items) {
            for(let i=0; i<items.length; i++){
                const index = items[i].slot;
                this.rooms[index] = items[i];
                /*if (items[i] && index === this.weaponSlot) {
                  this.owner.setRange();
                }*/
            }
        }
    }

    /*hasItem: function(itemKind){
        return this.hasItems(itemKind, 1);
    },

    hasItems: function(itemKind, itemCount){
        var a = 0;
        for(var i in this.rooms){
            //console.info("hasItems - compare: " + this.rooms[i].itemKind + "=" + itemKind);
            if(this.rooms[i].itemKind === itemKind){
            	 a += this.rooms[i].itemNumber;
            	 if (a >= itemCount)
                	return true;
            }
        }
        return false;
    },*/

    makeEmptyItem(index) {
        this.rooms[index] = null;
        delete this.rooms[index];
        this.setItem(index, null);
    }

    /*getItemCount: function(itemKind){
    	for(var i in this.rooms){
            if(this.rooms[i].itemKind === itemKind){
                return this.rooms[i].itemNumber;
            }
        }
        return 0;
    },*/

    getItemIndex(itemKind) {
        for(const i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                return i;
            }
        }
        return -1;
    }

    /*getEmptyIndex: function() {
        for(var index = 0; index < this.maxNumber; index++) {
            if(!this.rooms[index]) {

                return index;
            }
        }
        return -1;
    },*/

    putItem(item) {
        return -1;
    }

    combineItem(item, item2) {
        return false;
    }

    checkItem(index, item) {
        if (!item)
            return true;

        const kind = item.itemKind;
        const data = ItemData.Kinds[kind];
        //var equip = this.rooms;
        //var isArmor = ItemTypes.isArmor(kind);

        if (!ItemTypes.isEquipment(kind))
            return false;

        if (index==0 && !(data.type === "helm" && this.canEquip(item, data.level)))
            return false;
        //if (slot==1 && (!isArmor || !this.canEquip(item, ItemTypes.getArmorLevel(kind))))
        if (index==1 && !(data.type === "chest" && this.canEquip(item, data.level)))
            return false;
        if (index==2 && !(data.type === "gloves" && this.canEquip(item, data.level)))
            return false;
        if (index==3 && !(data.type === "boots" && this.canEquip(item, data.level)))
            return false;
        //var isWeapon = ItemTypes.isWeapon(kind);
        if (index==4 && !(ItemTypes.isWeapon(kind) && this.canEquip(item, ItemTypes.getWeaponLevel(kind))))
            return false;

        return true;
    }

    // FIX: this was missing `return`, so setItem() always returned `undefined`
    // (falsy) regardless of whether _setItem() actually succeeded. playeritems.js's
    // swapItem() relies on that return value as its "did the item actually get
    // placed" gate before clearing the source slot:
    //   if (store2.setItem(slot2[1], rs1))
    //       store1.setItem(slot[1], null);
    // Every time an item was equipped into a previously-EMPTY equipment slot (the
    // ordinary "equip from inventory/bank" action), that `if` was always false --
    // _setItem() had already written the item into this.rooms[index] and stamped
    // item.slot to the new equipment index, but the source store's slot was never
    // cleared. The same item object ended up referenced from two slots at once
    // (one stale dictionary key still pointing at an object whose .slot now says
    // otherwise), which is exactly what could make an item look equipped in the
    // current session but come back wrong -- or vanish -- on the next
    // save/load (toStringJSON()/userhandler.js serialize by walking `rooms`,
    // using each item's own .slot). This is the root cause of the
    // "swapping equipment items to different boxes deletes item" bug.
    setItem(index, item) {
        return this._setItem(index, item);
    }

    getItemTypeIndex(item) {
        if (item) {
            const kind = item.itemKind;
            const data = ItemData.Kinds[kind];
            if (data.type === "helm")
                return 0;
            else if (data.type === "chest")
                return 1;
            else if (data.type === "gloves")
                return 2;
            else if (data.type === "boots")
                return 3;
            else if (ItemTypes.isWeapon(kind))
                return 4;
        }
        return -1;
    }

    // NOTE: was flagged "swapping equipment items to different boxes deletes
    // item" -- see the FIX comment on setItem() above, which was the actual
    // cause (a missing `return` there made every caller-side success check
    // on this method's result always false).
    _setItem(index, item)
    {

        if (item && this.rooms[index] === item)
            return false;

        const player = this.owner;

        if (!item) {
            this.rooms[index] = null;
            item = {slot: index, itemKind: -1};
        }
        else {
            if (!this.checkItem(index, item))
                return false;

            this.rooms[index] = item;
            item.slot = index;
        }
        player.sendPlayer(new Messages.ItemSlot(2, [item]));
        return true;
    }

    canEquip(item, level) {
        const player = this.owner;
        const kind = item.itemKind;
        //var level = ItemTypes.getArmorLevel(kind);

        if(level > player.level){
            player.sendPlayer(new Messages.Notify("EQUIP", "EQUIPMENT_LEVEL", [level]));
            return false;
        }

        return true;
    }

    save()
    {
        //databaseHandler.saveItems(this.owner, 2, this.rooms);
    }

    /*takeOutItems: function(index, number){
        var item = this.rooms[index];
        if((ItemTypes.isLootItem(item.itemKind) || ItemTypes.isConsumableItem(item.itemKind)) && item.itemNumber > number)
        {
            item.itemNumber -= number;
        }
        this.setItem(index, item);
    },*/

    // FIX: was calling the nonexistent this.makeEmptyEquipment(slot); the only
    // defined method on this class is makeEmptyItem(index). This threw
    // whenever equipped-item durability hit 0, breaking equipment degradation.
    degradeItem(slot, adjustment) {
        const item = this.rooms[slot];
        if (!item)
            return;
        item.itemDurability -= adjustment;
        item.itemDurability = Math.max(0,item.itemDurability);
        if (item.itemDurability === 0 && item.itemDurabilityMax <= 30)
        {
            this.makeEmptyItem(slot);
            return false;
        }
        this.owner.sendPlayer(new Messages.ItemSlot(2, [item]));
        return true;
    }

    addExperience(slot, adjustment) {
        const item = this.rooms[slot];
        if (!item)
            return;

        item.itemExperience += adjustment;
        const oldItemNumber = item.itemNumber;
        const newItemNumber = ItemTypes.getItemLevel(item.itemExperience);

        if (oldItemNumber < newItemNumber)
        {
            item.itemNumber++;
            this.owner.sendPlayer(new Messages.ItemLevelUp(slot, item));
        }

        //log.warn("addExperience - item:"+JSON.stringify(item));
        item.slot = slot;
        this.owner.sendPlayer(new Messages.ItemSlot(2, [item]));
    }

    toString() {
        // NOTE: there used to be a `var i=0;` here too -- dead (nothing
        // read it before the `for...in` loop below rebound `i` to each
        // room key anyway). Removed; the loop variable is now `const`,
        // scoped to the loop.
        let itemString = "" + this.maxNumber + ",";

        for(const i in this.rooms){
            const item = this.rooms[i];
            if (!item) continue;
            itemString += item.toArray().join(',');
        }
        return itemString;
    }

    // NOTE: a stale comment here used to claim `item.toArray()` returns only
    // [kind,count,durability,durabilityMax,experience] (BaseItem.toArray(),
    // 5 fields, no slot) and needed the room index `i` prepended to match
    // userhandler.js's handleLoadPlayerItems (which reads itemData[0] as the
    // slot). That's wrong: every item actually held in `rooms` is an
    // ItemRoom (items/itemroom.js), whose own toArray() override already
    // does `[this.slot].concat(super.toArray())` -- 6 fields, slot first --
    // and _setItem() above always keeps item.slot in sync with the room
    // index it's stored under (see the FIX comment on setItem() above this
    // for why that matters). Prepending `i` on top of that (as a
    // since-reverted change here briefly did) double-counted the slot,
    // corrupting the save format instead of fixing it. `item.toArray()`
    // alone is correct as-is.
    toStringJSON() {
        let item = null;
        const items = [];
        for(const i in this.rooms){
            item = this.rooms[i];
            if (!item) continue;
            items.push(item.toArray());
        }
        return JSON.stringify(items);
    }

    getWeapon() {
        return this.rooms[4];
    }

    getArmor() {
        return this.rooms[1];
    }
}

export default Equipment;
