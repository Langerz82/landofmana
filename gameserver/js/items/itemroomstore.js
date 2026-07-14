/* global databaseHandler, log */
import ItemRoom from './itemroom.js';
import Messages from '../message.js';
import { ItemTypes } from '../common.js';
import Player from '../entity/player.js';
// FIX: getRandomItemNumber() below calls Utils.randomRange() but Utils was
// never imported -- threw ReferenceError every time it ran, which
// world/lootmanager.js's PvP drop logic (getPlayerDrop) relies on.
import Utils from '../utils.js';
import { G_DEBUG } from '../main.js';

class ItemStore {
    constructor(owner, number, items) {
        this.owner = owner;
        this.number = number;

        this.typeIndex = 0;
        this.maxNumber = 50;
        this.maxStack = 100;
        this.fullMessage = new Messages.Notify("ITEMSTORE", "ITEMSTORE_FULL");

        this.rooms = {};
        console.info("number="+number);
        //console.info("itemSlots="+JSON.stringify(itemSlots));

        if (items) {
            for(let i=0; i<items.length; i++){
                this.rooms[ items[i].slot] = items[i];
            }
        }
    }

    hasItem(itemKind) {
        return this.hasItems(itemKind, 1);
    }

    hasItems(itemKind, itemCount) {
        let a = 0;
        for(const i in this.rooms){
            //console.info("hasItems - compare: " + this.rooms[i].itemKind + "=" + itemKind);
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                a += this.rooms[i].itemNumber;
                if (a >= itemCount)
                    return true;
            }
        }
        return false;
    }

    hasItemCount(itemKind) {
        let a = 0;
        for(const i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                a += this.rooms[i].itemNumber;
            }
        }
        return a;
    }

    hasRoomCount(start, end) {
        start = start || 0;
        end = end || this.maxNumber;
        return this.maxNumber - Object.keys(this.rooms).length;
    }

    hasRoom(start, end) {
        start = start || 0;
        end = end || this.maxNumber;
        return Object.keys(this.rooms).length < this.maxNumber;
    }

    makeEmptyItem(index) {
        this.rooms[index] = null;
        delete this.rooms[index];
        this.setItem(index, null);
    }

    getItemCount(itemKind) {
        for(const i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                return this.rooms[i].itemNumber;
            }
        }
        return 0;
    }

    getItemIndex(itemKind) {
        for(const i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                return i;
            }
        }
        return -1;
    }

    getEmptyIndex(start, end) {
        start = start || 0;
        end = end || this.maxNumber;
        for(let index = start; index < end; index++) {
            if(!this.rooms[index]) {
                return index;
            }
        }
        return -1;
    }

    putItem(item) {
        const kind = item.itemKind;
        const consume = ItemTypes.isConsumableItem(kind);
        const loot = ItemTypes.isLootItem(kind);
        const craft = ItemTypes.isCraftItem(kind);

        if (consume || loot || craft)
        {
            for(const i in this.rooms){
                if (this.combineItem(item, this.rooms[i]))
                    return i;
            }
        }
        return this._putItem(item);
    }

    combineItem(item, item2) {
        // PERF: putItem() (above) calls combineItem() once per occupied
        // room slot (up to maxNumber, 50) on every single item pickup/stack
        // attempt -- these two JSON.stringify calls ran unconditionally on
        // every one of those checks, so a single item pickup could pay up to
        // ~100 stringify calls of full item objects whose result was never
        // used for anything. Gated behind G_DEBUG like the equivalent
        // per-pickup/per-attempt logging elsewhere in the codebase.
        if (G_DEBUG) {
            console.info(JSON.stringify(item));
            console.info(JSON.stringify(item2));
        }

        if(!item || !item2)
            return false;

        if(item.itemKind !== item2.itemKind)
            return false;

        if (ItemTypes.isEquippable(item.itemKind) ||
            ItemTypes.isEquippable(item2.itemKind)) {
            return false;
        }

        if (item.itemNumber === this.maxStack)
            return false;
        if (item2.itemNumber === this.maxStack)
            return false;

        let res = false;
        let slot = item.slot;
        const slot2 = item2.slot;

        const maxStack = this.maxStack;
        if (item2.itemNumber < maxStack) {
            item2.itemNumber += item.itemNumber;
            if (item2.itemNumber > maxStack) {
                item.itemNumber = item2.itemNumber - maxStack;
                item2.itemNumber = Math.min(item2.itemNumber, maxStack);
                //this.setItem(slot, null); //  NOT NEEDED.
                if (item.slot === -1)
                    slot = this.getEmptyIndex();
            } else {
                item = null;
            }
            res = true;
        }

        if(item2.itemNumber <= 0) {
            item2 = null;
        }

        this.setItem(slot, item);
        this.setItem(slot2, item2);
        return res;
    }

    // NOTE: `i` was a bare (undeclared) assignment in the original CommonJS
    // source, which created an implicit global there; declared with `var` here
    // since ES modules are always strict mode and forbid implicit globals.
    _putItem(item) {
        const i = this.getEmptyIndex();
        if (i < 0)
        {
            if (this.owner instanceof Player)
                this.owner.sendPlayer(this.fullMessage);
            return -1;
        }
        else {
            this.setItem(i, item);
            return i;
        }
    }

    checkItem(index, item) {
        return (item);
    }

    setItem(index, item)
    {
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
        this.owner.sendPlayer(new Messages.ItemSlot(this.typeIndex, [item]));
        return true;
    }

    save()
    {
    }

    removeItemKind(kind, number)
    {
        let j=number;
        for(const i in this.rooms){
            let r = this.rooms[i];
            if (!r)
                continue;
            if(r.itemKind === kind) {
                if (r.itemNumber > j) {
                    r.itemNumber -= j;
                    this.setItem(i, r);
                    return true;
                } else {
                    j -= r.itemNumber;
                    r = null;
                }
                this.setItem(i, r);
            }
        }
        return false;
    }

    takeOutItems(index, number) {
        let item = this.rooms[index];
        if (!item)
            return null;

        if (number > item.itemNumber)
            return null;

        if (ItemTypes.isEquippable(item.itemKind)) {
            this.setItem(index, null);
            return item;
        }

        item.itemNumber -= number;

        if (item.itemNumber === 0)
            item = null;

        this.setItem(index, item);
        return item;
    }

    // FIX: pushed a bare `id` identifier instead of the loop variable `i`,
    // throwing a ReferenceError on every call (e.g. lootmanager.js's
    // getPlayerDrop, which indexes back into `rooms` with the returned value
    // -- `i` is exactly the right key to push for that).
    getRandomItemNumber() {
        let item = null;
        const itemNums = [];
        for (const i in this.rooms)
        {
            item = this.rooms[i];
            if (item && item.itemKind > 0) itemNums.push(i);
        }
        const rand = Utils.randomRange(0,itemNums.length-1);
        return (itemNums.length > 0) ?
            itemNums[rand] : -1;
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

    // FIX: this pushed `item.toArray()` alone, which is only
    // [kind,count,durability,durabilityMax,experience] (see
    // BaseItem.toArray()) -- 5 fields, no slot index. But the load side
    // (userhandler.js's handleLoadPlayerItems) reads itemData[0] as the slot
    // and itemData[1..5] as kind/count/durability/durabilityMax/experience,
    // i.e. it expects 6 fields with the slot first. Without the slot
    // prepended here, every saved item's fields silently shifted down one
    // position on load (durability read as count, experience read as
    // durabilityMax, etc.) and the item's actual slot was lost entirely.
    // `i` (the room index this item came from) is exactly the slot to
    // prepend.
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
}

export default ItemStore;
