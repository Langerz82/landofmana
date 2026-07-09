import { ItemTypes } from '../common.js';

class BaseItem {
    constructor(arr) {
        if (Array.isArray(arr))
            this.set(arr);
    }

    assign(item) {
        this.set([Number(item.itemKind),
            Number(item.itemNumber),
            Number(item.itemDurability),
            Number(item.itemDurabilityMax),
            Number(item.itemExperience)]);
    }

    set(arr) {
        const itemKind = Number(arr[0]);
        this.itemKind = itemKind;
        this.itemNumber = Number(arr[1]);
        this.itemDurability = arr[2] ? Number(arr[2]) : ((ItemTypes.isConsumableItem(itemKind) || ItemTypes.isCraftItem(itemKind)) ? 0 : 900);
        this.itemDurabilityMax = arr[3] ? Number(arr[3]) : ((ItemTypes.isConsumableItem(itemKind) || ItemTypes.isCraftItem(itemKind)) ? 0 : 900);
        this.itemExperience = Number(arr[4]) || 0;
    }

    addNumber(number) {
        this.itemNumber += Number(number);
    }

    save() {
        return this.toArray().join(",");
    }

    toArray() {
        const cols = [
            this.itemKind,
            this.itemNumber,
            this.itemDurability,
            this.itemDurabilityMax,
            this.itemExperience];
        return cols;
    }
}

export default BaseItem;
