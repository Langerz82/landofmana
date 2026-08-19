/* global databaseHandler, log */
import Messages from '../message.js';
import { ItemTypes } from '../common.js';
import Utils from '../utils.js';
import { G_DEBUG } from '../constants.js';

// BaseItemRoomStore holds everything about a fixed-slot item store that is
// independent of who owns it: slot bookkeeping (`rooms`/`_occupiedCount`),
// lookups, and the raw slot mutator (`setItem`). It has no `this.owner` and
// implements no stack-combining (`combineItem`) -- both of those are
// "who does this store belong to" concerns, not "how are slots stored"
// ones, and live on whichever subclass actually has an owner. See
// itemroomstore.js's ItemRoomStore (Inventory/Bank) and equipment.js's
// Equipment for the two owner-aware subclasses, each of which extends the
// owner-agnostic pieces here with its own owner-notification code.
class BaseItemRoomStore {
    constructor(number, items) {
        this.number = number;

        this.typeIndex = 0;
        // FIX: this used to be hardcoded to 50 here regardless of the
        // `number` constructor parameter, relying on subclasses (Bank)
        // to overwrite `this.maxNumber` right after calling super(). That
        // was harmless while `rooms` was a Map/plain object (nothing sized
        // off maxNumber until later reads), but rooms below is now a
        // fixed-length array allocated in THIS constructor, before any
        // subclass override runs -- so it has to be sized off the real
        // capacity from the start. `number` is exactly that value (every
        // caller already passes the correct capacity: 50 for Inventory, 96
        // for Bank, 5 for Equipment -- see user/userhandler.js), so use it
        // directly; `|| 50` only covers a caller omitting it entirely.
        this.maxNumber = number || 50;
        this.maxStack = 100;
        this.fullMessage = new Messages.Notify('ITEMSTORE', 'ITEMSTORE_FULL');

        // PERF: was a plain object (`{}`), then a Map, keyed by slot index.
        // The object version's `for...in` iteration yielded string keys,
        // causing real string-vs-number `===` bugs (already fixed
        // individually in playercombat.js/player.js for the sibling
        // Equipment.rooms object before that was fixed at the source too).
        // The Map version fixed that, but slot indices here are a small,
        // fixed, dense range (0..maxNumber-1, maxNumber <= 96) known
        // up front -- exactly the case a plain array is faster at: no
        // hashing/bucket lookup per get/set, and V8 keeps a fully-populated
        // numeric array in its fast "packed elements" representation, which
        // is a plain contiguous-memory scan on iteration (hasItems(),
        // toString(), etc. all walk every slot). Pre-filling every slot
        // with `null` up front (rather than leaving indices unset) is what
        // keeps it in that packed mode instead of degrading to a sparse/
        // "holey" array. Real `for`/`for...of` loops over an array (used
        // throughout this file) yield real numeric indices, same as the Map
        // did -- the original bug class doesn't come back.
        this.rooms = new Array(this.maxNumber).fill(null);
        // PERF: fires on every Inventory/Bank/Equipment load (every
        // login/reconnect) -- gated behind G_DEBUG like equivalent
        // load-time logging elsewhere.
        if (G_DEBUG) console.info('number=' + number);
        //console.info("itemSlots="+JSON.stringify(itemSlots));

        if (items) {
            for (let i = 0; i < items.length; i++) {
                const slot = items[i].slot;
                // FIX: a Map/plain object accepted any key with no bounds
                // implications; a fixed-length array does not -- writing
                // past the end via bracket assignment would silently grow
                // the array and (worse) leave it in "holey" mode for every
                // index in between, undoing the whole point of this being a
                // fixed array. Guard against a corrupted/out-of-range slot
                // in saved data instead of letting it quietly widen the
                // array. `this.constructor.name` reports the real subclass
                // (Inventory/Bank/Equipment) rather than a generic label.
                if (slot < 0 || slot >= this.maxNumber) {
                    console.warn(
                        this.constructor.name +
                            ': dropping saved item with out-of-range slot ' +
                            slot +
                            ' (maxNumber=' +
                            this.maxNumber +
                            ')'
                    );
                    continue;
                }
                this.rooms[slot] = items[i];
            }
        }

        // PERF/FIX: hasRoom()/hasRoomCount() used to compute
        // Object.keys(this.rooms).length on every call -- besides the
        // allocation, this actually counts every slot INDEX ever touched,
        // not the number currently holding an item: makeEmptyItem() sets an
        // emptied slot to `null` rather than truly removing it (see
        // setItem() below), so once a store had ever been filled to
        // maxNumber, Object.keys().length stayed at maxNumber forever after
        // -- hasRoom() would report "full" permanently even after most
        // items were sold/used, silently blocking store purchases/crafting
        // (see shophandler.js/playerharvest.js callers). `_occupiedCount`
        // tracks the real number of non-null rooms incrementally (see
        // setItem()); seeded here with one one-time scan of the initial
        // `items` rather than trusting a running count of `items.length`,
        // in case of null/duplicate-slot entries in saved data.
        this._occupiedCount = this.rooms.filter(Boolean).length;
    }

    hasItem(itemKind) {
        return this.hasItems(itemKind, 1);
    }

    hasItems(itemKind, itemCount) {
        let a = 0;
        for (const item of this.rooms) {
            if (item && item.itemKind === itemKind) {
                a += item.itemNumber;
                if (a >= itemCount) return true;
            }
        }
        return false;
    }

    hasItemCount(itemKind) {
        let a = 0;
        for (const item of this.rooms) {
            if (item && item.itemKind === itemKind) {
                a += item.itemNumber;
            }
        }
        return a;
    }

    // FIX: dropped the `start`/`end` parameters -- confirmed via search that
    // no caller anywhere in the codebase passes them (every call site uses
    // hasRoom()/hasRoomCount() with no args), and they were never actually
    // used by either method despite being accepted and normalized -- the
    // signature promised ranged behavior (unlike getEmptyIndex() below,
    // which does honor the same params correctly) it never delivered.
    hasRoomCount() {
        return this.maxNumber - this._occupiedCount;
    }

    hasRoom() {
        return this._occupiedCount < this.maxNumber;
    }

    makeEmptyItem(index) {
        // SIMPLIFY: the direct `this.rooms[index] = null; delete
        // this.rooms[index];` that used to be here was a no-op in practice
        // -- the setItem(index, null) call right after it unconditionally
        // rewrites this.rooms[index] to null anyway, so nothing downstream
        // ever observed the brief deleted state. setItem() is also now
        // where _occupiedCount is maintained (see constructor/setItem), so
        // routing through it here (instead of mutating rooms directly) keeps
        // that count correct.
        this.setItem(index, null);
    }

    // SIMPLIFY: backs getItemIndex() below -- scans for the first room
    // holding a matching itemKind and returns both its index and the item.
    // (getItemCount() below now delegates to hasItemCount() instead of this,
    // since "first match" was the wrong semantics for a count -- see its
    // own comment.)
    _findFirstByKind(itemKind) {
        for (let index = 0; index < this.rooms.length; index++) {
            const item = this.rooms[index];
            if (item && item.itemKind === itemKind) {
                return { index, item };
            }
        }
        return null;
    }

    getItemIndex(itemKind) {
        const found = this._findFirstByKind(itemKind);
        return found ? found.index : -1;
    }

    // FIX: this used to return just the first matching room's itemNumber
    // (via the same "first match wins" scan getItemIndex() above uses)
    // instead of the total held across every room slot with this itemKind
    // -- a single itemKind can be split across multiple stacks/slots (see
    // ItemRoomStore.combineItem()'s maxStack-overflow handling), so this
    // undercounted whenever that happened. Iterates every room and sums
    // from 0 instead, same as hasItemCount() (now identical to it).
    getItemCount(itemKind) {
        return this.hasItemCount(itemKind);
    }

    getEmptyIndex(start, end) {
        start = start || 0;
        end = end || this.maxNumber;
        for (let index = start; index < end; index++) {
            if (!this.rooms[index]) {
                return index;
            }
        }
        return -1;
    }

    // Only knows how to place an item into a free slot -- does not notify
    // anyone when the store is full, since "who gets notified" is an owner
    // concern. ItemRoomStore/Equipment's owner-aware variants (setItem/
    // _setItem/_putItem overrides) add that on top of this.
    _putItem(item) {
        const i = this.getEmptyIndex();
        if (i < 0) {
            return -1;
        }
        this.setItem(i, item);
        return i;
    }

    checkItem(index, item) {
        return item;
    }

    // The single place `this.rooms` is ever actually mutated (see
    // makeEmptyItem() and the constructor). Mutates `rooms`/
    // `_occupiedCount` and returns the item that ended up in the slot (the
    // `{slot, itemKind: -1}` placeholder when clearing it), or `false` if
    // the write was rejected (out of bounds, or checkItem() rejected it).
    // Deliberately does NOT notify an owner -- that's added on top by the
    // owner-aware subclasses (ItemRoomStore.setItem / Equipment._setItem),
    // which both call this via `super.setItem(...)` and use the returned
    // item to build their notification.
    setItem(index, item) {
        // FIX: rooms is now a fixed-length array (see the constructor
        // comment above), and writing past its bounds via bracket
        // assignment would silently grow it and leave it "holey", undoing
        // the point of it being a fixed array. Every current caller already
        // keeps `index` in range (getEmptyIndex()/_putItem() only ever hand
        // back 0..maxNumber-1 or -1, and callers elsewhere bounds-check
        // against maxNumber before calling in -- see shophandler.js), but
        // this method should enforce its own contract rather than rely on
        // every future caller remembering to.
        if (index < 0 || index >= this.maxNumber) return false;

        // PERF/FIX: this is also where _occupiedCount is kept in sync --
        // see the constructor comment above for why this replaced
        // Object.keys(this.rooms).length.
        const wasOccupied = !!this.rooms[index];

        if (!item) {
            this.rooms[index] = null;
            item = { slot: index, itemKind: -1 };
        } else {
            if (!this.checkItem(index, item)) return false;

            this.rooms[index] = item;
            item.slot = index;
        }

        const isOccupied = !!this.rooms[index];
        if (isOccupied !== wasOccupied)
            this._occupiedCount += isOccupied ? 1 : -1;

        return item;
    }

    save() {}

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
    removeItemKind(kind, number) {
        if (!this.hasItems(kind, number)) return false;

        let j = number;
        for (let i = 0; i < this.rooms.length; i++) {
            let r = this.rooms[i];
            if (!r) continue;
            if (r.itemKind === kind) {
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
                if (j <= 0) return true;
            }
        }
        return false;
    }

    takeOutItems(index, number) {
        let item = this.rooms[index];
        if (!item) return null;

        if (number > item.itemNumber) return null;

        if (ItemTypes.isEquippable(item.itemKind)) {
            this.setItem(index, null);
            return item;
        }

        item.itemNumber -= number;

        if (item.itemNumber === 0) item = null;

        this.setItem(index, item);
        return item;
    }

    // FIX: pushed a bare `id` identifier instead of the loop variable `i`,
    // throwing a ReferenceError on every call (e.g. lootmanager.js's
    // getPlayerDrop, which indexes back into `rooms` with the returned value
    // -- `i` is exactly the right key to push for that).
    getRandomItemNumber() {
        const itemNums = [];
        for (let i = 0; i < this.rooms.length; i++) {
            const item = this.rooms[i];
            if (item && item.itemKind > 0) itemNums.push(i);
        }
        const rand = Utils.randomRange(0, itemNums.length - 1);
        return itemNums.length > 0 ? itemNums[rand] : -1;
    }

    forEachItem(callback) {
        for (let id = 0; id < this.rooms.length; ++id) {
            const item = this.rooms[id];
            if (!item) continue;
            callback(id, item);
        }
    }

    toString() {
        let itemString = '' + this.maxNumber + ',';

        for (const item of this.rooms) {
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
    // and setItem() above always keeps item.slot in sync with the room index
    // it's stored under. Prepending `i` on top of that (as a since-reverted
    // change here briefly did) double-counted the slot, corrupting the save
    // format instead of fixing it. `item.toArray()` alone is correct as-is.
    toStringJSON() {
        const items = [];
        for (const item of this.rooms) {
            if (!item) continue;
            items.push(item.toArray());
        }
        return JSON.stringify(items);
    }
}

export default BaseItemRoomStore;
