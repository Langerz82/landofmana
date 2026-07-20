import Utils from '../../utils.js';
import { Types, ItemTypes } from '../../common.js';
import Mob from '../mob.js';

/* global log */

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
        const entity = this.entity;

        let itemDiff = entity.level*2;
        const item = entity.items.getWeapon();
        if (item) {
            itemDiff = (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
        }
        const statDiff = entity.stats.attack + (entity.stats.luck*2);
        const chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
        //console.info("player - baseCrit: "+chance);
        //var chance_out = (chance / 5).toFixed(0)+"%";
        //return chance_out;
        return chance;
    }

    baseCritDef() {
        const entity = this.entity;

        let itemDiff = entity.level*2;
        // FIX: `id` used to come from a for...in loop, always a string
        // ("4"), so `id === 4` never matched and the weapon slot was never
        // excluded from this crit-defense calculation (it should be, since
        // a weapon isn't armor). equipment.rooms is now a fixed-length
        // array (items/equipment.js) rather than an object/Map, so this uses
        // the same forEachArmor() helper baseDamageDef() below already uses
        // -- it iterates real numeric slot indices and already excludes the
        // weapon slot, instead of hand-rolling the same loop/exclusion here
        // too.
        entity.items.equipment.forEachArmor((id, item) => {
            if (item) {
                itemDiff += (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
            }
        });
        const statDiff = entity.stats.defense + (entity.stats.luck*2);
        const chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
        //console.info("player - baseCritDef: "+chance);
        //var chance_out = (chance / 5).toFixed(0)+"%";
        //return chance_out;
        return chance;
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
        dealt += ~~((entity.stats.attack*3)+mods) + entity.stats.luck;

        const noobLvl = 12;
        const noobMulti = 1 + Math.max(0,(noobLvl-entity.level) * (1/entity.level));

        let min = ~~(level*power*noobMulti*4);
        let max = ~~(min*1.15);

        dmg = Utils.randomRangeInt(min, max) + dealt;

        if (entity.stats.mod && entity.stats.mod.damage)
            dmg += entity.stats.mod.damage;

        if (defender && defender instanceof Mob)
        {
            const type = entity.items.getWeaponType();
            if (type) {
                const mod = defender.data.modDamage[type];
                dmg = ~~(dmg * mod);
            }
        }

        min = ~~(min + dealt);
        max = ~~((max + dealt) * 3);

        //return [min,max];
        return dmg;
    }

    baseDamageDef(defender) {
        const entity = this.entity;

        let dealt = 0, dmg = 0;

        const level = entity.level+3;
        //console.info("baseDamageDef:");

        dealt = level;
        // FIX: same string/number mismatch as baseCritDef above -- `id` used
        // to come from a for...in loop, always a string, so `id === 1` never
        // matched and the chest slot never got its intended 4x defense
        // multiplier (every equipped item was treated as the 2x case
        // instead). Fixed the same way: equipment.rooms is now a fixed-
        // length array (items/equipment.js) indexed by the real numeric
        // slot. This callback references `id`, which forEachArmor()
        // supplies as the first callback argument -- `callback(id, item)`
        // -- so the parameter order here has to match that.
        entity.items.equipment.forEachArmor((id, item) => {
          if (item) {
              const eq_multi = (id === 1) ? 4 : 2;
              const def = (ItemTypes.getData(item.itemKind).modifier * eq_multi + item.itemNumber * eq_multi);
              dealt += ~~(def * ((item.itemDurability / item.itemDurabilityMax * 0.5) + 0.5));
          }
        });

        //console.info("dealt="+dealt);
        const lvl = Types.getDefenseLevel(entity.stats.exp.defense);
        const power = ((lvl / 50) + 1);
        //console.info("power="+power);
        let min = ~~(level*power);
        let max = ~~(min*2);

        //console.info("dealtrange="+dealt);
        // Players Stat affects Damage.
        const mods = (entity.stats.mod ? entity.stats.mod.defense : 0);
        dealt += ~~((entity.stats.defense*4)+mods) + entity.stats.luck;

        //console.info("dealtstats="+dealt);

        dmg = Utils.randomRangeInt(min, max) + dealt;

        min = ~~(min + dealt);
        max = ~~((max+dealt) * 1.75);

        //return [min,max];
        return dmg;
    }

    // Split out of entity/player.js -- onKillEntity/dropGold are
    // combat-outcome bookkeeping (post-kill XP/gear-degrade, death gold
    // drop -- the only external caller of dropGold is
    // world/lootmanager.js's getGoldDrop(), computing loot during combat
    // resolution), the same domain as the damage-calc methods above.
    // resetBars() was moved here too at first, but it isn't actually a
    // combat concept -- its callers are respawn()/levelUp()/
    // playerpersistence.js's _initDerivedStats(), never anything
    // combat-related, and Mob has its own separate resetBars() (mob.js), so
    // it isn't even shared Character behavior. It moved back to Player
    // itself, next to modHp/modEp (which it's built directly from, and
    // which stayed on Player for the same "not really combat-specific"
    // reason -- see the NOTE there). onKillEntity/dropGold don't call
    // super, so they still move here cleanly.
    onKillEntity(entity2, damage, dealt) {
      const entity = this.entity;
      damage = damage || 0;
      dealt = dealt || 0;

      const ratio = (damage / entity2.stats.hpMax);

      let xp = ~~(entity2.getXP() * ratio);

      const diff = 10;
      const div = 1/diff;
      const mod = 1 + div + Utils.clamp(-diff,diff,(entity2.level - entity.level)) * div;
      // NOTE: was a second `var xp = ...` -- redeclaring is a no-op under
      // `var` (same binding), but `let` forbids redeclaring in the same
      // scope. This is a genuine reassignment (xp built from its own prior
      // value), so it's just `xp =` here, not a second `let`.
      xp = ~~(xp * mod);

      entity.incExp(xp);
      entity.incWeaponExp(xp);

      // NOTE: still needed below for the explicit weapon-degrade call
      // (degradeItem(weaponSlot, ...)) after the armor loop -- only the
      // armor-degrade loop's own hand-rolled weapon-slot exclusion was
      // removed in favor of forEachArmor() (see the FIX comment below).
      const weaponSlot = entity.items.equipment.weaponSlot;
      const armorDamage = Math.min(5, Math.ceil(dealt / 300));
      log.info("player - armorDamage:" + armorDamage);
      // FIX: `it` used to come from a for...in loop over equipment.rooms
      // (originally a plain object, then briefly a Map), which yields
      // string keys, so `it === weaponSlot` (a number) never matched --
      // the weapon slot was never excluded from this armor-degrade loop,
      // so the weapon got degraded and given "armor" XP here in addition
      // to the explicit weapon-degrade code a few lines below. equipment.js
      // already has forEachArmor() (added for playercombat.js's defense
      // calc) which both excludes the weapon slot and hands back real
      // numeric ids -- reusing it here instead of hand-rolling the same
      // loop/exclusion a second time.
      entity.items.equipment.forEachArmor((it, equippedItem) => {
        if (!equippedItem)
          return;
        if (armorDamage > 0)
        {
            if (entity.items.equipment.degradeItem(it, 1))
              entity.items.equipment.addExperience(it, armorDamage);
        }
      });
      entity.armorDamage = 0;

      // Degrade weapon if over threshold.
      const weaponDamage = Math.min(5, Math.ceil(damage / 2000));
      if (weaponDamage > 0)
      {
          if (entity.items.equipment.degradeItem(weaponSlot, 1))
            entity.items.equipment.addExperience(weaponSlot, weaponDamage);
      }
      entity.weaponDamage = 0;

    }

    dropGold() {
      const entity = this.entity;
      const level = entity.level;
      let count = Math.ceil(Math.random() * level * 5 + level);
      count = Math.min(count, entity.items.gold[0]);
      entity.items.modifyGold(-count);
      return count;
    }
}

export default PlayerCombat;
