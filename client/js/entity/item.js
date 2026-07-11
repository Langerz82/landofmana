// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global ItemTypes */
import Entity from './entity.js';

// This helper was a bare top-level global before (not part of the AMD define() below),
// referenced elsewhere in the codebase (clientcallbacks.js, dialog/storedialog.js,
// dialog/craftdialog.js) as `ItemRoom`. ES module top-level declarations are module-scoped,
// not global, so it's exported here too and those call sites need to import it once converted.
export function ItemRoom(slot, itemKind, itemNumber, itemDurability, itemDurabilityMax, itemExperience) {
    this.slot = slot;
    this.itemKind = itemKind;
    this.itemNumber = itemNumber;
    this.itemDurability = itemDurability;
    this.itemDurabilityMax = itemDurabilityMax;
    this.itemExperience = itemExperience;
}
// FIX: these were assigned onto the constructor function itself
// (ItemRoom.toArray = ...) instead of ItemRoom.prototype, so
// `new ItemRoom(...).toArray()` threw "not a function" and `.toString()`
// silently fell back to Object.prototype.toString ("[object Object]")
// instead of the intended CSV. Compare user.js's PlayerSummary, which
// assigns the analogous methods onto .prototype correctly.
ItemRoom.prototype.toArray = function() {
    const cols = [parseInt(this.slot),
        this.itemKind,
        this.itemNumber,
        this.itemDurability,
        this.itemDurabilityMax,
        this.itemExperience];
    return cols;
}
ItemRoom.prototype.toString = function() {
    return this.toArray().join(",");
}

export default class Item extends Entity {
    constructor(id, type, map, kind /*, type , durability, durabilityMax, experience*/) {
        super(id, type, map, kind);

        this.kind = kind;
        this.type = type;
        this.wasDropped = false;
        //this.itemDurability = durability;
        //this.itemDurabilityMax = durabilityMax;
        //this.itemExperience = experience;
        this.count = 1;
    }

    getItemSpriteName() {
        if (ItemTypes.KindData[this.kind].sprite !== "") {
            log.info("item-" + ItemTypes.KindData[this.kind].sprite);
            return "item-" + ItemTypes.KindData[this.kind].sprite;
        }
        return null;
    }

    getInfoMsg() {
        return this.getInfoMsgEx(this);
    }

    getInfoMsgEx(item) {
        let msg = '';
        if (ItemTypes.isEquipment(item.itemKind)) {
            msg = ItemTypes.getName(item.itemKind) + ": Lv " + ItemTypes.getLevelByKind(item.itemKind) + (item.itemNumber ? "+" + item.itemNumber + " " : " ") + (item.itemDurability / 10) + "/" + (item.itemDurabilityMax / 10);
            return msg;
        }
        const name = ItemTypes.getName(item.itemKind);
        return (name) ? name : '';
    }
}
// Preserved from the original: the instance method is also copied onto the class itself so it
// can be called as Item.getInfoMsgEx(item) as well as instance.getInfoMsgEx(item).
Item.getInfoMsgEx = Item.prototype.getInfoMsgEx;
