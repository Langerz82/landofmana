/* global databaseHandler, log */
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

    // SIMPLIFY: getItemCount()/getItemIndex() were identical "scan rooms for
    // the first matching itemKind" loops, only differing in what they
    // returned once found. Shared here; behavior (first match wins) is
    // unchanged.
    _findFirstByKind(itemKind) {
        for(const i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                return { index: i, item: this.rooms[i] };
            }
        }
        return null;
    }

    getItemIndex(itemKind) {
        const found = this._findFirstByKind(itemKind);
        return found ? found.index : -1;
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

    // FIX: `item` (the source, being merged away) and `item2` (the
    // destination, already living in `this` store) used to both get
    // written back via `this.setItem(...)` -- fine for putItem()'s own
    // call below, where both items already belong to the same store, but
    // NOT for playeritems.js's swapItem(), which calls this cross-store as
    // `store2.combineItem(rs1, rs2)` to merge a stack being dragged from
    // one item store (e.g. inventory) into another (e.g. bank). In that
    // case `item` (rs1) belongs to store1, not `this` (store2) -- but its
    // own leftover/cleared value was still written via `this.setItem(slot,
    // item)`, i.e. into store2's room at store1's slot INDEX. Depending on
    // what happened to occupy that same index number in store2, this
    // either silently destroyed an unrelated item there, or (in the
    // "fully merged" case, item=null) left the source item never actually
    // removed from store1 at all -- functionally duplicating it (it stays
    // in store1 while an equal-or-larger stack now also exists in store2).
    // `sourceStore` (new, optional, defaults to `this` so the existing
    // single-store putItem() call site is unaffected) lets the caller
    // specify where `item` actually lives so it gets written back there
    // instead.
    combineItem(item, item2, sourceStore) {
        sourceStore = sourceStore || this;

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
                if (item.slot === -1) {
                    slot = this.getEmptyIndex();
                    // FIX: getEmptyIndex() returning -1 (no free room) used
                    // to fall straight through to `this.setItem(slot,
                    // item)` below with slot still -1, storing the overflow
                    // remainder under room key "-1" -- outside the normal
                    // 0..maxNumber-1 range that toString()/toStringJSON()
                    // (and the client's fixed-size inventory grid) assume.
                    // Mirror _putItem()'s own "no room" handling instead:
                    // notify the player and drop the overflow reference
                    // rather than corrupt the room map.
                    if (slot < 0) {
                        if (this.owner instanceof Player)
                            this.owner.sendPlayer(this.fullMessage);
                        item = null;
                    }
                }
            } else {
                item = null;
            }
            res = true;
        }

        if(item2.itemNumber <= 0) {
            item2 = null;
        }

        // `item` belongs to sourceStore (may differ from `this` -- see the
        // FIX comment above), `item2` always belongs to `this` (the store
        // this method was called on).
        sourceStore.setItem(slot, item);
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

    // FIX: this used to walk `this.rooms` and destroy every matching stack
    // it found -- even when the total available was less than `number` --
    // before falling through to `return false`. A caller checking the
    // return value for "did this actually succeed" got a false negative
    // AFTER the items were already gone, with no rollback (e.g.
    // playerquests.js's questAboutItemComplete used to gate on a cheaper
    // "has at least 1" check instead of "has enough", so it could reach
    // here with too few items and still lose them all for nothing).
    // Checking sufficiency via hasItems() up front, before mutating
    // anything, makes an insufficient-quantity call a true no-op.
    removeItemKind(kind, number)
    {
        if (!this.hasItems(kind, number))
            return false;

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
                // FIX: also fixes a separate pre-existing bug -- without
                // this early return, fully consuming the *exact* remaining
                // amount across one or more whole stacks (no leftover
                // remainder to hit the `r.itemNumber > j` branch above)
                // fell through to the loop's own `return false` at the
                // bottom, misreporting a fully-successful removal as a
                // failure.
                if (j <= 0)
                    return true;
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

    // NOTE: a stale comment here used to claim `item.toArray()` returns only
    // [kind,count,durability,durabilityMax,experience] (BaseItem.toArray(),
    // 5 fields, no slot) and needed the room index `i` prepended to match
    // userhandler.js's handleLoadPlayerItems (which reads itemData[0] as the
    // slot). That's wrong: every item actually held in `rooms` is an
    // ItemRoom (items/itemroom.js), whose own toArray() override already
    // does `[this.slot].concat(super.toArray())` -- 6 fields, slot first --
    // and setItem() below always keeps item.slot in sync with the room index
    // it's stored under. Prepending `i` on top of that (as a since-reverted
    // change here briefly did) double-counted the slot, corrupting the save
    // format instead of fixing it. `item.toArray()` alone is correct as-is.
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
