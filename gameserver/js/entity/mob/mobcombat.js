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

    baseCrit() {
        const entity = this.entity;

        const modDiff = 0;
        const statDiff = entity.stats.attack + entity.stats.mod.attack;
        const chance = ~~Utils.clamp(5, 500, ~~(statDiff + modDiff));
        //console.info("player - baseCrit: "+chance);
        return chance;
    }

    baseCritDef() {
        const entity = this.entity;

        const modDiff = 0;
        const statDiff = entity.stats.defense + entity.stats.mod.defense;
        const chance = ~~Utils.clamp(5, 500, ~~(statDiff + modDiff));
        //console.info("player - baseCritDef: "+chance);
        return chance;
    }

    baseDamage() {
        const entity = this.entity;

        // NOTE: was `let dealt, absorbed, dmg;` -- `absorbed` unused, dead
        // (same pattern already cleaned up elsewhere in this codebase, e.g.
        // area/mobarea.js, world/taskhandler.js, transition.js).
        let dealt, dmg;

        dealt = ~~(entity.level * 12);
        dealt +=
            (entity.stats.attack + entity.stats.mod.attack) *
            (6 - Math.min(3, entity.level * 0.1));

        dmg = ~~dealt;

        //console.info("player - baseDamage: "+dmg);
        return dmg;
    }

    baseDamageDef() {
        const entity = this.entity;

        // NOTE: same unused `absorbed` removed here as in baseDamage() above.
        let dealt, dmg;

        dealt = ~~(entity.level * 2);
        dealt += (entity.stats.defense + entity.stats.mod.defense) * 2;

        dmg = ~~dealt;
        //console.info("player - baseDamageDef: "+dmg);
        return dmg;
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
