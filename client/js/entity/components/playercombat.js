// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, ItemTypes, Utils */
// FIX: `defender instanceof Mob` below referenced a global `Mob` that was never imported here,
// which would throw ReferenceError the first time baseDamage() is called with a defender arg
// (currently masked because its only caller passes no defender). Import it properly.
import Mob from '../mob.js';

export default class PlayerCombat {
    constructor(entity) {
        this.entity = entity;
    }

    baseHit() {
        return 0;
    }

    baseHitDef() {
        return 0;
    }

    baseCrit() {
        const entity = this.entity;

        let itemDiff = entity.level * 2;
        const item = entity.items.getWeapon();
        if (item) {
            itemDiff = (3 * ItemTypes.getData(item.itemKind).modifier) + (item.itemNumber * 2);
        }
        const statDiff = entity.stats.attack + (entity.stats.luck * 2);
        const chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
        return (chance / 5).toFixed(0) + "%";
    }

    baseCritDef() {
        const entity = this.entity;

        let itemDiff = entity.level * 2;
        for (let id in entity.items.equipment.rooms) {
            if (Number(id) === 4) continue; // FIX: for-in keys are strings, so `id === 4` never matched and the weapon slot was never skipped; coerce to number
            const item = entity.items.equipment.rooms[id];
            if (item) {
                itemDiff += (3 * ItemTypes.getData(item.itemKind).modifier) + (item.itemNumber * 2);
            }
        }
        const statDiff = entity.stats.defense + (entity.stats.luck * 2);
        const chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
        return (chance / 5).toFixed(0) + "%";
    }

    baseDamage(defender) {
        const entity = this.entity;

        let dealt, dmg;
        const weapon = entity.items.getWeapon();
        const level = entity.level;

        dealt = ~~(weapon ? (ItemTypes.getData(weapon.itemKind).modifier * 3 + weapon.itemNumber * 2) : level);

        const lvl = Types.getAttackLevel(entity.stats.exp.attack);
        let power = ((lvl / 50) + 1);

        power *= ((entity.items.getWeaponLevel() / 50) + 1);

        // Weapon Durability affects Damage.
        if (weapon) {
            dealt = ~~(dealt * ((weapon.itemDurability / weapon.itemDurabilityMax * 0.5) + 0.5));
        }

        // Players Stat affects Damage.
        const mods = (entity.stats.mod && entity.stats.mod.attack ?
            entity.stats.mod.attack : 0);
        dealt += ~~((entity.stats.attack * 3) + mods) + entity.stats.luck;

        const noobLvl = 12;
        const noobMulti = 1 + Math.max(0, (noobLvl - entity.level) * (1 / entity.level));

        let min = ~~(level * power * noobMulti * 4);
        let max = ~~(min * 1.15);

        dmg = Utils.randomRangeInt(min, max) + dealt;

        if (entity.stats.mod && entity.stats.mod.damage)
            dmg += entity.stats.mod.damage;

        if (defender && defender instanceof Mob) {
            const type = entity.items.getWeaponType();
            if (type) {
                const mod = defender.data.modDamage[type];
                dmg = ~~(dmg * mod);
            }
        }

        min = ~~(min + dealt);
        max = ~~((max + dealt) * 3);

        return [min, max];
    }

    baseDamageDef(defender) {
        const entity = this.entity;

        const level = entity.level + 3;

        let dealt = level;
        for (let id in entity.items.equipment.rooms) {
            const item = entity.items.equipment.rooms[id];
            if (item) {
                const eq_multi = (Number(id) === 1) ? 4 : 2; // FIX: for-in keys are strings, so `id === 1` never matched and slot 1's 4x armor multiplier was never applied; coerce to number
                const def = (ItemTypes.getData(item.itemKind).modifier * eq_multi + item.itemNumber * eq_multi);
                dealt += ~~(def * ((item.itemDurability / item.itemDurabilityMax * 0.5) + 0.5));
            }
        }

        const lvl = Types.getDefenseLevel(entity.stats.exp.defense);
        const power = ((lvl / 50) + 1);
        let min = ~~(level * power);
        let max = ~~(min * 2);

        // Players Stat affects Damage.
        const mods = (entity.stats.mod ? entity.stats.mod.defense : 0);
        dealt += ~~((entity.stats.defense * 4) + mods) + entity.stats.luck;

        Utils.randomRangeInt(min, max); // NOTE: result unused, but kept to preserve prior RNG draw sequence

        min = ~~(min + dealt);
        max = ~~((max + dealt) * 1.75);

        return [min, max];
    }
}
