/* global databaseHandler, log */
import BaseItemRoomStore from './baseitemroomstore.js';
import Messages from '../message.js';
import ItemData from '../data/itemdata.js';
import { ItemTypes } from '../common.js';

// Equipment extends BaseItemRoomStore for the owner-agnostic slot
// bookkeeping (rooms/_occupiedCount, hasItem*/hasRoom*, getEmptyIndex,
// takeOutItems, removeItemKind, toString/toStringJSON, ...), and layers its
// own owner-aware code on top in its own extended functions (_setItem
// below) rather than going through ItemRoomStore's owner+combineItem
// wiring (itemroomstore.js) -- equipment's fixed 5-slot layout doesn't
// stack/combine, and has its own equip-validation and notification needs.
class Equipment extends BaseItemRoomStore {
    constructor(owner, number, items) {
        // Equipment always has exactly 5 slots regardless of what's passed
        // in -- matches the pre-refactor behavior, which hardcoded
        // `this.maxNumber = 5` here and ignored `number` entirely.
        super(5, items);
        this.owner = owner;
        this.weaponSlot = 4;
    }

    putItem(item) {
        return -1;
    }

    combineItem(item, item2) {
        return false;
    }

    checkItem(index, item) {
        if (!item) return true;

        const kind = item.itemKind;
        const data = ItemData.Kinds[kind];
        //var equip = this.rooms;
        //var isArmor = ItemTypes.isArmor(kind);

        if (!ItemTypes.isEquipment(kind)) return false;

        if (
            index === 0 &&
            !(data.type === 'helm' && this.canEquip(item, data.level))
        )
            return false;
        //if (slot==1 && (!isArmor || !this.canEquip(item, ItemTypes.getArmorLevel(kind))))
        if (
            index === 1 &&
            !(data.type === 'chest' && this.canEquip(item, data.level))
        )
            return false;
        if (
            index === 2 &&
            !(data.type === 'gloves' && this.canEquip(item, data.level))
        )
            return false;
        if (
            index === 3 &&
            !(data.type === 'boots' && this.canEquip(item, data.level))
        )
            return false;
        //var isWeapon = ItemTypes.isWeapon(kind);
        if (
            index === this.weaponSlot &&
            !(
                ItemTypes.isWeapon(kind) &&
                this.canEquip(item, ItemTypes.getWeaponLevel(kind))
            )
        )
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
            if (data.type === 'helm') return 0;
            else if (data.type === 'chest') return 1;
            else if (data.type === 'gloves') return 2;
            else if (data.type === 'boots') return 3;
            else if (ItemTypes.isWeapon(kind)) return this.weaponSlot;
        }
        return -1;
    }

    // NOTE: was flagged "swapping equipment items to different boxes deletes
    // item" -- see the FIX comment on setItem() above, which was the actual
    // cause (a missing `return` there made every caller-side success check
    // on this method's result always false).
    //
    // Extends BaseItemRoomStore.setItem(): reuses its bounds-check/
    // checkItem()-gate/rooms-mutation/_occupiedCount bookkeeping via
    // `super.setItem(...)`, then layers on the equipment-specific "don't
    // re-set the same item that's already there" guard and the owner
    // notification (typeIndex hardcoded to 2, matching every other
    // equipment notification in this file) that BaseItemRoomStore itself
    // knows nothing about.
    _setItem(index, item) {
        if (item && this.rooms[index] === item) return false;

        const result = super.setItem(index, item);
        if (result === false) return false;

        this.owner.sendPlayer(new Messages.ItemSlot(2, [result]));
        return true;
    }

    canEquip(item, level) {
        const player = this.owner;
        const kind = item.itemKind;
        //var level = ItemTypes.getArmorLevel(kind);

        if (level > player.level) {
            player.sendPlayer(
                new Messages.Notify('EQUIP', 'EQUIPMENT_LEVEL', [level])
            );
            return false;
        }

        return true;
    }

    // NOTE: save() (originally `//databaseHandler.saveItems(this.owner, 2,
    // this.rooms);`, already dead) is inherited from BaseItemRoomStore's
    // no-op version instead of being redefined here.

    /*takeOutItems: function(index, number){
        var item = this.rooms[index];
        if((ItemTypes.isLootItem(item.itemKind) || ItemTypes.isConsumableItem(item.itemKind)) && item.itemNumber > number)
        {
            item.itemNumber -= number;
        }
        this.setItem(index, item);
    },*/

    // FIX: was calling the nonexistent this.makeEmptyEquipment(slot); the only
    // defined method on this class is makeEmptyItem(index) (inherited from
    // BaseItemRoomStore). This threw whenever equipped-item durability hit 0,
    // breaking equipment degradation.
    degradeItem(slot, adjustment) {
        const item = this.rooms[slot];
        if (!item) return;
        item.itemDurability -= adjustment;
        item.itemDurability = Math.max(0, item.itemDurability);
        if (item.itemDurability === 0 && item.itemDurabilityMax <= 30) {
            this.makeEmptyItem(slot);
            return false;
        }
        this.owner.sendPlayer(new Messages.ItemSlot(2, [item]));
        return true;
    }

    addExperience(slot, adjustment) {
        const item = this.rooms[slot];
        if (!item) return;

        item.itemExperience += adjustment;
        const oldItemNumber = item.itemNumber;
        const newItemNumber = ItemTypes.getItemLevel(item.itemExperience);

        if (oldItemNumber < newItemNumber) {
            item.itemNumber++;
            this.owner.sendPlayer(new Messages.ItemLevelUp(slot, item));
        }

        //log.warn("addExperience - item:"+JSON.stringify(item));
        item.slot = slot;
        this.owner.sendPlayer(new Messages.ItemSlot(2, [item]));
    }

    // NOTE: toString()/toStringJSON() used to be redefined here, but were
    // byte-for-byte the same walk-`rooms`-and-serialize logic as
    // BaseItemRoomStore's versions (every item held in `rooms` is an
    // ItemRoom -- items/itemroom.js -- whose own toArray() already includes
    // its slot, and _setItem() above always keeps item.slot in sync with
    // the room index it's stored under, same invariant the base class
    // relies on), so they're inherited from there instead of duplicated.

    getWeapon() {
        return this.rooms[this.weaponSlot];
    }

    getArmor() {
        return this.rooms[1];
    }

    // Iterates every equipped armor slot (everything except weaponSlot),
    // skipping empty slots before invoking the callback -- every current
    // caller (playercombat.js's baseCritDef/baseDamageDef, player.js's
    // armor-degrade loop) starts with an `if (item)`/`if (!item) return`
    // guard anyway, so filtering here just avoids a wasted callback call
    // per empty slot instead of changing what runs. `id` is the real array
    // index (rooms is a fixed-length array -- see BaseItemRoomStore's
    // constructor comment), not a lookup, so it's always correct even when
    // multiple slots are empty.
    forEachArmor(callback) {
        for (let id = 0; id < this.rooms.length; ++id) {
            const item = this.rooms[id];
            if (!item) continue;
            if (id === this.weaponSlot) continue;
            callback(id, this.rooms[id]);
        }
    }

    // NOTE: a death penalty should hit the whole loadout (unlike
    // forEachArmor() above, which deliberately excludes the weapon slot for
    // the defense/armor-degrade paths it backs). BaseItemRoomStore already
    // provides exactly that as forEachItem() (same iteration, no
    // weaponSlot exclusion), so it's inherited rather than redefined here.
}

export default Equipment;
