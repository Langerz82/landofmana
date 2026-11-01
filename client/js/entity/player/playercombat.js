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

    // BALANCE: mirrors gameserver/js/entity/player/playercombat.js. These
    // are only used for the stat dialog (dialog/statdialog.js); the server
    // is authoritative. Crit values are ratings, not percentages -- the
    // real chance is (25 + yourCrit - theirCritDef) / 200 per hit.
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

    // Returns [min, max] for display.
    baseDamage(defender) {
        const entity = this.entity;
        const level = entity.level;

        let weaponDmg = 0;
        const weapon = entity.items.getWeapon();
        if (weapon) {
            weaponDmg =
                ItemTypes.getData(weapon.itemKind).modifier * 2 +
                weapon.itemNumber * 3;
            weaponDmg *=
                (weapon.itemDurability / weapon.itemDurabilityMax) * 0.5 + 0.5;
        }

        const mods =
            entity.stats.mod && entity.stats.mod.attack
                ? entity.stats.mod.attack
                : 0;
        const statDmg = entity.stats.attack * 3 + mods + entity.stats.luck;

        const attackLvl = Types.getAttackLevel(entity.stats.exp.attack);
        const weaponLvl = entity.items.getWeaponLevel();
        const power = 1 + (attackLvl + weaponLvl) / 200;

        const base = (10 + level * 6 + weaponDmg + statDmg) * power;
        // Same order as the server: +/-10% spread, then flat damage bonus,
        // then the mob's weapon-type multiplier.
        const bonus =
            entity.stats.mod && entity.stats.mod.damage
                ? entity.stats.mod.damage
                : 0;

        let mult = 1;
        if (defender && defender instanceof Mob) {
            const type = entity.items.getWeaponType();
            if (type) mult = defender.data.modDamage[type];
        }

        return [
            ~~((~~(base * 0.9) + bonus) * mult),
            ~~((~~(base * 1.1) + bonus) * mult)
        ];
    }

    // Returns [min, max] for display.
    baseDamageDef(defender) {
        const entity = this.entity;

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

        const defLvl = Types.getDefenseLevel(entity.stats.exp.defense);
        const power = 1 + defLvl / 200;

        const base = (entity.level * 2 + armorDef + statDef) * power;
        return [~~(base * 0.9), ~~(base * 1.1)];
    }
}
