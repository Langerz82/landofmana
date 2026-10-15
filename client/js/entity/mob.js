// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
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
/* global Utils */
import Character from './character/character.js';
import MobData from '../data/mobdata.js';

export default class Mob extends Character {
    constructor(id, type, map, kind, name, level) {
        super(id, type, map, kind);

        this.data = MobData.Kinds[this.kind];

        this.idleSpeed = Utils.randomRangeInt(
            ~~((this.data.idleSpeed * 2) / 3),
            ~~((this.data.idleSpeed * 4) / 3)
        );

        this.level = level || this.data.level;

        this.title = this.data.name;

        this.stats.attack = this.data.attack * this.level;
        this.stats.defense = this.data.defense * this.level;
        this.stats.hp = this.data.hp * this.level;
        this.stats.hpMax = this.data.hp * this.level;
        this.stats.xp = this.data.xp * this.level;

        this.hatelist = [];
        this.hateCount = 0;
        this.tankerlist = [];

        this.respawnTimeout = null;
        this.returnTimeout = null;
        this.isDead = false;

        this.aggroRange = this.data.aggroRange;
        this.attackRange = this.data.attackRange;
        this.isAggressive = this.data.isAggressive;

        this.moveSpeed = this.data.moveSpeed;
        this.setMoveRate(this.moveSpeed);

        this.setAttackRate(this.data.attackRate);
    }

    getSpriteName() {
        return MobData.Kinds[this.kind].spriteName;
    }
}
