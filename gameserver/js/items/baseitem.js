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
    // repair flow in packets/shophandler.js.
    //
    // FIX (round 2): the code was then changed to `arr[2] === 0 ? default :
    // Number(arr[2])` -- which reproduces the exact same bug via a
    // different route, since every caller creating a *fresh* item (shop
    // purchase, quest reward, quest/mob loot drop, harvest) passes a
    // literal `0` for "give this item its default durability", the same
    // value a genuinely-broken *reloaded* item's real saved durability
    // would carry. `arr[2] === 0` can't tell those two apart. The comment
    // above already named the real fix -- check for null/undefined instead
    // of a specific numeric value -- but the code never actually did that.
    // Every "fresh item, use default" call site (packets/shophandler.js,
    // world/lootmanager.js, entity/player/playerharvest.js) now passes
    // `null` instead of `0` for durability/durabilityMax (see their own FIX
    // comments), so this can finally use a real null/undefined check: sites
    // loading genuinely-saved data (auction.js, userhandler.js) always pass
    // a real parsed number -- including a real 0 for a broken item -- and
    // are unaffected.
    set(arr) {
        const itemKind = Number(arr[0]);
        this.itemKind = itemKind;
        this.itemNumber = Number(arr[1]);
        const itemDurability = ItemTypes.isEquipment(itemKind) ? 900 : 0;
        this.itemDurability =
            arr[2] === null || arr[2] === undefined
                ? itemDurability
                : Number(arr[2]);
        this.itemDurabilityMax =
            arr[3] === null || arr[3] === undefined
                ? itemDurability
                : Number(arr[3]);
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
