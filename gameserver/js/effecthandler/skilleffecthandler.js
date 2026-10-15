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

// Extracted from effecthandler.js: SkillEffectHandler, one instance per
// entity (see entity/player.js's `this.skills` wiring), tracking that
// entity's active SkillEffect casts. Behavior unchanged.
import { SkillEffect } from './skilleffect.js';

export class SkillEffectHandler {
    constructor(entity) {
        this.entity = entity;
        this.skills = entity.skills;
        this.skillEffects = [];

        /*for (var skill of this.skills) {
        this.skillEffects.push( new SkillEffect(this, skill.skillIndex, skill.skillLevel));
      }*/
    }

    interval(phase, damage) {
        damage = damage || 0;
        for (const skillEffect of this.entity.activeEffects)
            skillEffect.onInterval(phase, damage);
    }

    cast(skillId, target, x, y) {
        //var skillEffect = this.skillEffects[skillId];
        const skill = this.skills[skillId];
        const skillLevel = skill.skillLevel;
        const skillEffect = new SkillEffect(this, skillId, skillLevel);
        this.skillEffects.push(skillEffect);
        //var skill = this.skills[skillId];
        skill.xp(1);
        skillEffect.level = skill.skillLevel;
        skillEffect.apply(target, x, y);
    }

    removeSkillEffect(skillEffect) {
        const index = this.skillEffects.indexOf(skillEffect);
        if (index >= 0) this.skillEffects.splice(index, 1);
    }
}
