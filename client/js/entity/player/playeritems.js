// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, ItemTypes */

export default class PlayerItems {
    constructor(entity) {
        this.entity = entity;

        this.equipment = {};
        this.inventory = {};
    }

    setItems(equipment, inventory) {
        this.equipment = equipment;
        this.inventory = inventory;
    }

    hasWeaponType(type) {
        // FIX: was defaulting `type` to "any" and returning true immediately, before even
        // checking whether the entity has a weapon equipped, and *before* the `type` param
        // could ever be falsy again - which made the final `isHarvestWeapon` fallback below
        // permanently unreachable dead code. Mirrors the (correct) pattern used by the sibling
        // hasHarvestWeapon() just below in this file: only short-circuit on an explicit "any".
        if (type === 'any') return true;

        const weapon = this.equipment.getWeapon();
        if (!weapon) return false;

        if (type) {
            return this.getWeaponType() === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }

    getWeapon() {
        return this.equipment.getWeapon();
    }

    hasWeapon() {
        // FIX: equipment.getWeapon() returns this.rooms[4], which is
        // `undefined` (not `null`) until that slot is explicitly set -- same
        // undefined-vs-null gap as inventoryhandler.js's isInventoryFull().
        // `!== null` would report true for an unset weapon slot.
        return !!this.getWeapon();
    }

    getWeaponLevel() {
        const entity = this.entity;

        const weapon = this.getWeapon();
        if (!weapon) return 0;
        const weaponData = ItemTypes.KindData[weapon.itemKind];
        return Types.getWeaponLevel(entity.stats.exp[weaponData.type]);
    }

    getWeaponType() {
        const weapon = this.getWeapon();
        if (!weapon) return null;
        return ItemTypes.getType(weapon.itemKind);
    }

    hasHarvestWeapon(type) {
        if (type === 'any') return true;

        const weapon = this.getWeapon();
        if (!weapon) return false;

        const weaponData = ItemTypes.KindData[weapon.itemKind];
        if (type) {
            return weaponData.type === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }
}
