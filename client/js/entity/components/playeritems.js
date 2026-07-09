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
        var entity = this.entity;

        type = type || "any";
        if (type === "any")
            return true;

        var weapon = this.equipment.getWeapon();
        if (!weapon)
            return false;

        if (type) {
            return this.getWeaponType() === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }

    getWeapon() {
        return this.equipment.getWeapon();
    }

    hasWeapon() {
        return this.getWeapon() !== null;
    }

    getWeaponLevel() {
        var entity = this.entity;

        var weapon = this.getWeapon();
        if (!weapon)
            return 0;
        var weaponData = ItemTypes.KindData[weapon.itemKind];
        return Types.getWeaponLevel(entity.stats.exp[weaponData.type]);
    }

    getWeaponType() {
        var weapon = this.getWeapon();
        if (!weapon)
            return null;
        return ItemTypes.getType(weapon.itemKind);
    }

    hasHarvestWeapon(type) {
        if (type && type === "any")
            return true;

        var weapon = this.getWeapon();
        if (!weapon)
            return false;

        var weaponData = ItemTypes.KindData[weapon.itemKind];
        if (type) {
            return weaponData.type === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }
}
