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

class MobCombat {
    constructor(entity) {
        this.entity = entity;
    }

    // BALANCE: all four combat ratings below are on the same scale as
    // PlayerCombat's (entity/player/playercombat.js) so a same-level fight
    // stays even at every level. Mob stats.attack/defense are
    // 3 * attackMod/defenseMod * level (entity/mob/mob.js).
    //
    // Crit ratings feed Formulas.crit(): chance = (25 + crit - critDef)/200,
    // so each point is 0.5%. A standard mob vs a same-level player lands
    // around 12-18%; high-attackMod mobs (e.g. DeathKnight) reach ~25%.
    // The old version used raw attack/defense (up to ~225 at lv50), which
    // left players either un-crittable (~2%) or always critting (~75-98%).
    baseCrit() {
        const entity = this.entity;
        const attack = entity.stats.attack + entity.stats.mod.attack;
        return ~~Utils.clamp(0, 500, entity.level * 0.75 + attack / 3);
    }

    baseCritDef() {
        const entity = this.entity;
        const defense = entity.stats.defense + entity.stats.mod.defense;
        return ~~Utils.clamp(0, 500, entity.level + defense / 6);
    }

    // Linear in level (old: level*12 + attack*(6 - min(3, level/10)),
    // which spiked early then flattened). +/-10% spread like the player.
    // Tuned for mobs attacking every 1000ms x attackRateMod (data/mobdata.js;
    // was 1500ms): with an even stat spread and level-appropriate gear a
    // same-level mob needs about 13-20 hits to kill a player at every level
    // (~1.5x the old 8-17, so roughly the same seconds as before), and high
    // levels are no longer the most punishing. Was 10 + level*8 + attack*3.5.
    baseDamage() {
        const entity = this.entity;
        const attack = entity.stats.attack + entity.stats.mod.attack;
        const base = 10 + entity.level * 6.5 + attack * 2.75;
        return Utils.randomRangeInt(~~(base * 0.9), ~~(base * 1.1));
    }

    // Absorbs roughly 35-45% of a same-level player's hit.
    baseDamageDef() {
        const entity = this.entity;
        const defense = entity.stats.defense + entity.stats.mod.defense;
        return ~~(entity.level + (defense * 5) / 3);
    }

    // Split out of entity/mob.js -- dropGold/getXP are combat-outcome
    // values (how much gold/xp killing this mob awards), the same domain
    // as the damage-calc methods above, and follow the same
    // constructor(entity) delegation as playercombat.js's dropGold.
    dropGold() {
        const entity = this.entity;
        return (
            Utils.randomRangeInt(entity.level * 2, entity.level * 3) *
            entity.creatureMulti
        );
    }

    getXP() {
        const entity = this.entity;
        return (
            entity.data.xp *
            entity.data.attackMod *
            entity.data.defenseMod *
            entity.data.attackRateMod *
            entity.data.hpMod *
            entity.level *
            entity.creatureMulti
        );
    }
}

export default MobCombat;
