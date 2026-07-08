import Utils from '../../utils.js';
import { Types, ItemTypes } from '../../common.js';
import Mob from '../mob.js';

class PlayerCombat {
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
        var entity = this.entity;

        var itemDiff = entity.level*2;
        var item = entity.items.getWeapon();
        if (item) {
            itemDiff = (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
        }
        var statDiff = entity.stats.attack + (entity.stats.luck*2);
        var chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
        //console.info("player - baseCrit: "+chance);
        //var chance_out = (chance / 5).toFixed(0)+"%";
        //return chance_out;
        return chance;
    }

    baseCritDef() {
        var entity = this.entity;

        var itemDiff = entity.level*2;
        for (var id in entity.items.equipment.rooms) {
            if (id === 4) continue;
            var item = entity.items.equipment.rooms[id];
            if (item) {
                itemDiff += (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
            }
        }
        var statDiff = entity.stats.defense + (entity.stats.luck*2);
        var chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
        //console.info("player - baseCritDef: "+chance);
        //var chance_out = (chance / 5).toFixed(0)+"%";
        //return chance_out;
        return chance;
    }

    baseDamage(defender) {
        var entity = this.entity;

        var dealt, dmg;
        var weapon = entity.items.getWeapon();
        var level = entity.level;

        dealt = ~~(weapon ? (ItemTypes.getData(weapon.itemKind).modifier * 3 + weapon.itemNumber * 2) : level);

        var lvl = Types.getAttackLevel(entity.stats.exp.attack);
        var power = ((lvl / 50) + 1);

        power *= ((entity.items.getWeaponLevel() / 50) + 1);

        // Weapon Durability affects Damage.
        if (weapon) {
            dealt = ~~(dealt * ((weapon.itemDurability / weapon.itemDurabilityMax * 0.5) + 0.5));
        }

        // Players Stat affects Damage.
        var mods = (entity.stats.mod && entity.stats.mod.attack ?
            entity.stats.mod.attack : 0);
        dealt += ~~((entity.stats.attack*3)+mods) + entity.stats.luck;

        var noobLvl = 12;
        var noobMulti = 1 + Math.max(0,(noobLvl-entity.level) * (1/entity.level));

        var min = ~~(level*power*noobMulti*4);
        var max = ~~(min*1.15);

        dmg = Utils.randomRangeInt(min, max) + dealt;

        if (entity.stats.mod && entity.stats.mod.damage)
            dmg += entity.stats.mod.damage;

        if (defender && defender instanceof Mob)
        {
            var type = entity.items.getWeaponType();
            if (type) {
                var mod = defender.data.modDamage[type];
                dmg = ~~(dmg * mod);
            }
        }

        min = ~~(min + dealt);
        max = ~~((max + dealt) * 3);

        //return [min,max];
        return dmg;
    }

    baseDamageDef(defender) {
        var entity = this.entity;

        var dealt = 0, dmg = 0;

        var level = entity.level+3;
        //console.info("baseDamageDef:");

        dealt = level;
        for (var id in entity.items.equipment.rooms)
        {
            var item = entity.items.equipment.rooms[id];
            if (item) {
                var eq_multi = (id === 1) ? 4 : 2;
                var def = (ItemTypes.getData(item.itemKind).modifier * eq_multi + item.itemNumber * eq_multi);
                dealt += ~~(def * ((item.itemDurability / item.itemDurabilityMax * 0.5) + 0.5));
            }
        }

        //console.info("dealt="+dealt);
        var lvl = Types.getDefenseLevel(entity.stats.exp.defense);
        var power = ((lvl / 50) + 1);
        //console.info("power="+power);
        var min = ~~(level*power);
        var max = ~~(min*2);

        //console.info("dealtrange="+dealt);
        // Players Stat affects Damage.
        var mods = (entity.stats.mod ? entity.stats.mod.defense : 0);
        dealt += ~~((entity.stats.defense*4)+mods) + entity.stats.luck;

        //console.info("dealtstats="+dealt);

        dmg = Utils.randomRangeInt(min, max) + dealt;

        min = ~~(min + dealt);
        max = ~~((max+dealt) * 1.75);

        //return [min,max];
        return dmg;
    }
}

export default PlayerCombat;
