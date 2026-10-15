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
import Mob from './entity/mob.js';
import SkillData from './data/skilldata.js';
import Character from './entity/character/character.js';

/* global Types */

class Skill {
    constructor(skillId) {
        this.level = 0;
        this.slots = [];
        this.skillId = skillId;
        this.data = SkillData.Data[skillId];
    }

    getName() {
        return this.data.name; // FIX: constructor sets this.data, not this.skillData; was always undefined
    }
    getLevel() {
        return this.level;
    }
    setLevel(value) {
        this.level = value;
    }

    clear() {}
    add(slot) {
        this.slots.push(slot);
    }
    remove(slot) {
        const index = this.slots.indexOf(slot);
        if (index >= 0) {
            this.slots.splice(index, 1);
        }
    }
}

class SkillActive extends Skill {
    constructor(skillId) {
        super(skillId); // FIX (conversion): this._super(skillId) -> super(skillId)

        // FIX: was `this.cooltime` (lowercase t) divided by 1000, but execute() reads `this.coolTime` (capital T),
        // which was always undefined, so the cooldown gate never blocked repeated skill use. data.recharge is
        // already stored in ms (see data/skilldata.js), matching how skilldialog.js's Skill class uses it directly
        // against Date.now() diffs, so the /1000 conversion was also wrong for this ms-based comparison.
        this.coolTime = this.data.recharge;
    }

    execute() {
        const self = this;
        const player = game.player;

        if (Date.now() - this.cooldownTime < this.coolTime) {
            return false;
        }

        if (this.data.skillType === 'attack') {
            player.attackSkill = this;
            if (!player.attackInterval) game.makePlayerInteractNextTo();
            if (this.execute_callback) this.execute_callback(self);
        } else if (this.data.skillType === 'target') {
            if (player.hasTarget() && player.target instanceof Character) {
                if (this.execute_callback) this.execute_callback(self);
                game.client.sendSkill(this.skillId, player.target.id);
            } else {
                game.makePlayerInteractNextTo();
                return false;
            }
        } else if (this.data.skillType === 'self') {
            if (this.execute_callback) this.execute_callback(self);
            game.client.sendSkill(this.skillId, 0);
        }

        this.cooldownTime = Date.now();
        player.skillHandler.pushActiveSkill(this);
        return true;
    }
}

const SkillFactory = {
    make: function (index) {
        if (index in SkillFactory.Skills) {
            return new SkillFactory.Skills[index](index);
        } else {
            return null;
        }
    }
};

SkillFactory.Skills = {};
for (let i = 0; i < SkillData.Data.length; ++i) {
    SkillFactory.Skills[i] = SkillActive;
}

export default class SkillHandler {
    constructor(game) {
        this.game = game;
        this.skills = [];
        this.jqContainer = $('#skillcontainer');
        this.activeSkills = [];

        const jqSkillsCloseButton = $('#skillsCloseButton');
        jqSkillsCloseButton.click(function () {
            ShortcutData = null;
        });
    }

    getSkill(skillId) {
        return this.skills.In(skillId) ? this.skills[skillId] : null;
    }

    clear() {}

    addAll(skillExps) {
        const sl = skillExps.length; // FIX: missing var, was leaking an implicit global
        for (let i = 0; i < sl; ++i) {
            this.add(i, skillExps[i]);
        }
    }

    execute(skillId) {
        return this.skills[skillId].execute();
    }

    add(skillId, exp) {
        let skill = null;
        if (skillId in this.skills) {
            skill = this.skills[skillId];
        } else {
            skill = SkillFactory.make(skillId);
            if (skill) {
                this.skills[skillId] = skill;
            }
        }
        if (skill) {
            skill.setLevel(Types.getSkillLevel(exp));
        }
    }

    pushActiveSkill(activeSkill) {
        this.activeSkills.push(activeSkill);
    }
}
