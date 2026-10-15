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

// Mixin extracted from clientcallbacks.js: Skill load/XP/effects callbacks.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
/* global game */

export function installClientCallbacksSkills(proto) {
    proto.onSkillLoad = function (datas) {
        const skillIndex = Number(datas[0]);
        const skillExp = Number(datas[1]);

        // FIX: missing var - was an implicit global
        const skillLevel = Types.getSkillLevel(skillExp);
        game.player.skillHandler.setSkill(skillIndex, skillExp);
        // FIX: `game.skillsDialog` does not exist (game.js only sets up `game.skillDialog`,
        // see clientcallbacksplayerstate.js's onPlayer using `game.skillDialog.page.setSkills`)
        // -- this threw "Cannot read properties of undefined" on every WC_SKILLLOAD packet.
        game.skillDialog.page.setSkill(skillIndex, skillLevel);
    };

    proto.onSkillXP = function (data) {
        const skillCount = Number(data.shift());

        if (skillCount === 0) return;

        for (let i = 0; i < skillCount; ++i) {
            game.player.skillHandler.setSkill(
                Number(data[i * 2]),
                Number(data[i * 2 + 1])
            );
        }
    };

    proto.onSkillEffects = function (data) {
        // stub for now.
    };
}
