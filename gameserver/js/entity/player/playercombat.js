// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import Utils from '../../utils.js';
import { Types, ItemTypes } from '../../common.js';
import Mob from '../mob/mob.js';

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

    // BALANCE: these four are tuned against MobCombat's
    // (entity/mob/mobcombat.js) so that, with level-appropriate gear and
    // an even stat spread, a same-level mob dies in ~4-8 hits and takes
    // ~9-12 hits to kill the player, at every level 1-50. Attack-heavy
    // builds kill faster but die faster; defense/health builds the reverse.
    //
    // Crit: Formulas.crit() uses (25 + crit - critDef)/200, so ratings are
    // kept close to level and stats/gear only nudge them (~11-20% normal,
    // ~30% for an all-luck build) instead of the old ~75-98%.
    baseCrit() {
        const entity = this.entity;

        let chance =
            entity.level + entity.stats.luck / 4 + entity.stats.attack / 6;
        const item = entity.items.getWeapon();
        if (item) {
            chance +=
                ItemTypes.getData(item.itemKind).modifier / 10 +
                item.itemNumber / 2;
        }
        return ~~Utils.clamp(0, 500, chance);
    }

    baseCritDef() {
        const entity = this.entity;

        let gear = 0;
        // forEachArmor() supplies real numeric slot ids and skips the
        // weapon slot (items/equipment.js).
        entity.items.equipment.forEachArmor((id, item) => {
            if (item) {
                gear +=
                    ItemTypes.getData(item.itemKind).modifier / 10 +
                    item.itemNumber / 2;
            }
        });
        const chance =
            entity.level +
            entity.stats.luck / 4 +
            entity.stats.defense / 6 +
            gear / 2;
        return ~~Utils.clamp(0, 500, chance);
    }

    baseDamage(defender) {
        const entity = this.entity;
        const level = entity.level;

        // Weapon: modifier + upgrades, scaled by durability (50%-100%).
        let weaponDmg = 0;
        const weapon = entity.items.getWeapon();
        if (weapon) {
            weaponDmg =
                ItemTypes.getData(weapon.itemKind).modifier * 2 +
                weapon.itemNumber * 3;
            weaponDmg *=
                (weapon.itemDurability / weapon.itemDurabilityMax) * 0.5 + 0.5;
        }

        // Player stats.
        const mods =
            entity.stats.mod && entity.stats.mod.attack
                ? entity.stats.mod.attack
                : 0;
        const statDmg = entity.stats.attack * 3 + mods + entity.stats.luck;

        // Attack + weapon skill levels (1-50 each) add up to +50%. Was a
        // multiplicative (1+lvl/50)^2 (up to 4x) on top of a newbie
        // multiplier of up to 12x at level 1, which one-shot early mobs.
        const attackLvl = Types.getAttackLevel(entity.stats.exp.attack);
        const weaponLvl = entity.items.getWeaponLevel();
        const power = 1 + (attackLvl + weaponLvl) / 200;

        const base = (10 + level * 6 + weaponDmg + statDmg) * power;
        let dmg = Utils.randomRangeInt(~~(base * 0.9), ~~(base * 1.1));

        if (entity.stats.mod && entity.stats.mod.damage)
            dmg += entity.stats.mod.damage;

        if (defender && defender instanceof Mob) {
            const type = entity.items.getWeaponType();
            if (type) {
                const mod = defender.data.modDamage[type];
                dmg = ~~(dmg * mod);
            }
        }

        return ~~dmg;
    }

    baseDamageDef(defender) {
        const entity = this.entity;

        // Armor: chest counts double. Scaled by durability (50%-100%).
        let armorDef = 0;
        entity.items.equipment.forEachArmor((id, item) => {
            if (item) {
                const multi = id === 1 ? 2 : 1;
                const def =
                    (ItemTypes.getData(item.itemKind).modifier +
                        item.itemNumber) *
                    multi;
                armorDef +=
                    def *
                    ((item.itemDurability / item.itemDurabilityMax) * 0.5 +
                        0.5);
            }
        });

        const mods =
            entity.stats.mod && entity.stats.mod.defense
                ? entity.stats.mod.defense
                : 0;
        const statDef =
            entity.stats.defense * 2 + mods + entity.stats.luck / 2;

        // Defense skill level (1-50) adds up to +25%.
        const defLvl = Types.getDefenseLevel(entity.stats.exp.defense);
        const power = 1 + defLvl / 200;

        const base = (entity.level * 2 + armorDef + statDef) * power;
        return Utils.randomRangeInt(~~(base * 0.9), ~~(base * 1.1));
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

        const ratio = damage / entity2.stats.hpMax;

        let xp = ~~(entity2.getXP() * ratio);

        const diff = 10;
        const div = 1 / diff;
        const mod =
            1 +
            div +
            Utils.clamp(-diff, diff, entity2.level - entity.level) * div;
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
        log.info('player - armorDamage:' + armorDamage);
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
            if (!equippedItem) return;
            if (armorDamage > 0) {
                if (entity.items.equipment.degradeItem(it, 1))
                    entity.items.equipment.addExperience(it, armorDamage);
            }
        });
        entity.armorDamage = 0;

        // Degrade weapon if over threshold.
        const weaponDamage = Math.min(5, Math.ceil(damage / 2000));
        if (weaponDamage > 0) {
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
