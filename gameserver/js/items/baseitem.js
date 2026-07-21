import { ItemTypes } from '../common.js';

class BaseItem {
    constructor(arr) {
        if (Array.isArray(arr)) this.set(arr);
    }

    assign(item) {
        this.set([
            Number(item.itemKind),
            Number(item.itemNumber),
            Number(item.itemDurability),
            Number(item.itemDurabilityMax),
            Number(item.itemExperience)
        ]);
    }

    // FIX: `arr[2] ? ... : default` / `arr[3] ? ... : default` used truthy
    // checks, but 0 is a legitimate, reachable durability value (a fully
    // broken item -- see items/equipment.js's degradeItem(), which clamps
    // durability down to 0). Every time a broken item was reloaded (login,
    // reconnect, server restart -- see user/userhandler.js's
    // handleLoadPlayerItems, which builds a BaseItem/ItemRoom from saved
    // CSV fields for every inventory/bank/equipment slot), `Number(arr[2])
    // === 0` was falsy and silently replaced with the full-durability
    // default, fully repairing the item for free and bypassing the paid
    // repair flow in packets/shophandler.js. Checking for null/undefined
    // instead of falsiness treats an explicit 0 as the real value it is.
    set(arr) {
        const itemKind = Number(arr[0]);
        this.itemKind = itemKind;
        this.itemNumber = Number(arr[1]);
        const itemDurability = ItemTypes.isEquipment(itemKind) ? 900 : 0;
        this.itemDurability = arr[2] === 0 ? itemDurability : Number(arr[2]);
        this.itemDurabilityMax = arr[3] === 0 ? itemDurability : Number(arr[3]);
        this.itemExperience = Number(arr[4]) || 0;
    }

    addNumber(number) {
        this.itemNumber += Number(number);
    }

    save() {
        return this.toArray().join(',');
    }

    toArray() {
        const cols = [
            this.itemKind,
            this.itemNumber,
            this.itemDurability,
            this.itemDurabilityMax,
            this.itemExperience
        ];
        return cols;
    }
}

export default BaseItem;
