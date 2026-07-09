/* global databaseHandler, log */
import ItemRoom from './itemroom.js';
import Messages from '../message.js';
import { ItemTypes } from '../common.js';
import Player from '../entity/player.js';

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
        console.info(JSON.stringify(item));
        console.info(JSON.stringify(item2));

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

    // NOTE: pre-existing bug preserved from the original — pushes a bare `id`
    // identifier below instead of the loop variable `i` (or `item.slot`). This
    // would throw a ReferenceError at runtime in the original CommonJS version
    // too, since sloppy mode only creates implicit globals on bare *assignment*,
    // not on read of an undeclared name.
    getRandomItemNumber() {
        let item = null;
        const itemNums = [];
        for (const i in this.rooms)
        {
            item = this.rooms[i];
            if (item && item.itemKind > 0) itemNums.push(id);
        }
        const rand = Utils.randomRange(0,itemNums.length-1);
        return (itemNums.length > 0) ?
            itemNums[rand] : -1;
    }

    toString() {
        var i=0;
        let itemString = "" + this.maxNumber + ",";

        for(var i in this.rooms){
            const item = this.rooms[i];
            if (!item) continue;
            itemString += item.toArray().join(',');
        }
        return itemString;
    }

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
