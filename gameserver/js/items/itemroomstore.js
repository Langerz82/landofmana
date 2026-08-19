/* global databaseHandler, log */
import BaseItemRoomStore from './baseitemroomstore.js';
import Messages from '../message.js';
import { ItemTypes } from '../common.js';
import Player from '../entity/player/player.js';
import { G_DEBUG } from '../constants.js';

// ItemRoomStore is BaseItemRoomStore plus everything that depends on who
// owns the store: `this.owner` itself, notifying that owner when a slot
// changes or the store is full, and stack-combining (`combineItem`), whose
// overflow path also has to notify an owner. Inventory (inventory.js) and
// Bank (bank.js) extend this. Equipment (equipment.js) does NOT -- it has
// its own owner-notification wiring built directly on top of
// BaseItemRoomStore instead, since its slot semantics (fixed equipment
// slots, no stacking/combining) diverge too much from putItem()/
// combineItem() below to share them.
class ItemRoomStore extends BaseItemRoomStore {
    constructor(owner, number, items) {
        super(number, items);
        this.owner = owner;
    }

    // Extends BaseItemRoomStore.setItem(): reuses its slot mutation/
    // bookkeeping, then notifies the owner with whatever it actually wrote
    // (the item, or the `{slot, itemKind: -1}` placeholder for a clear).
    setItem(index, item) {
        const result = super.setItem(index, item);
        if (result === false) return false;

        this.owner.sendPlayer(new Messages.ItemSlot(this.typeIndex, [result]));
        return true;
    }

    // Extends BaseItemRoomStore._putItem(): adds the "store full" owner
    // notification base has no concept of.
    _putItem(item) {
        const i = super._putItem(item);
        if (i < 0) {
            if (this.owner instanceof Player)
                this.owner.sendPlayer(this.fullMessage);
        }
        return i;
    }

    putItem(item) {
        const kind = item.itemKind;
        const consume = ItemTypes.isConsumableItem(kind);
        const loot = ItemTypes.isLootItem(kind);
        const craft = ItemTypes.isCraftItem(kind);

        if (consume || loot || craft) {
            for (let i = 0; i < this.rooms.length; i++) {
                if (this.combineItem(item, this.rooms[i])) return i;
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
    // what happened to occupy that same index in store2, this either
    // silently destroyed an unrelated item there, or (in the "fully merged"
    // case, item=null) left the source item never actually removed from
    // store1 at all -- functionally duplicating it (it stays in store1
    // while an equal-or-larger stack now also exists in store2).
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

        if (!item || !item2) return false;

        if (item.itemKind !== item2.itemKind) return false;

        if (
            ItemTypes.isEquippable(item.itemKind) ||
            ItemTypes.isEquippable(item2.itemKind)
        ) {
            return false;
        }

        if (item.itemNumber === this.maxStack) return false;
        if (item2.itemNumber === this.maxStack) return false;

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
                    // FIX: was `this.getEmptyIndex()` -- picks a free slot
                    // number out of `this` (the destination store's
                    // layout), but `item`/`slot` here belong to
                    // `sourceStore` (which can differ from `this` -- see
                    // the FIX comment above this method), and the result is
                    // used a few lines down as `sourceStore.setItem(slot,
                    // item)`. A free index in `this`'s layout isn't
                    // necessarily free (or even in bounds) in
                    // `sourceStore`'s layout -- could silently overwrite
                    // whatever occupies that index in sourceStore. Confirmed
                    // this specific branch is unreachable via the current
                    // cross-store call site (playeritems.js's swapItem()
                    // always passes an `item` that already has a real slot
                    // -- setItem() keeps item.slot in sync with its actual
                    // room index, per this file's own invariant), but fixed
                    // as a latent footgun rather than left relying on that
                    // invariant never changing.
                    slot = sourceStore.getEmptyIndex();
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
                        // FIX: was `this.owner`/`this.fullMessage` -- same
                        // "which store does this belong to" mistake as the
                        // getEmptyIndex() call above. The overflow item that
                        // couldn't be placed belongs to sourceStore, so the
                        // "store full" notification should go to
                        // sourceStore's owner, not this store's.
                        if (sourceStore.owner instanceof Player)
                            sourceStore.owner.sendPlayer(
                                sourceStore.fullMessage
                            );
                        item = null;
                    }
                }
            } else {
                item = null;
            }
            res = true;
        }

        if (item2.itemNumber <= 0) {
            item2 = null;
        }

        // `item` belongs to sourceStore (may differ from `this` -- see the
        // FIX comment above), `item2` always belongs to `this` (the store
        // this method was called on).
        sourceStore.setItem(slot, item);
        this.setItem(slot2, item2);
        return res;
    }
}

export default ItemRoomStore;
