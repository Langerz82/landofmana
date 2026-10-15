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

import SkillsJSON from '../../shared/data/skills2.json' with { type: 'json' };
import { EffectType } from '../effecthandler/effecthandler.js';
import { G_DEBUG } from '../constants.js';

const Skills = [];
//var SkillNames = {};

const getSkillEffects = function (data) {
    const effects = [];
    for (const rec of data) {
        effects.push(
            new EffectType(rec[0] === 'target', rec[1], rec[2], rec[3])
        );
    }
    return effects;
};

// NOTE: was `const i = 0;` here, unused -- dead even under the old `var i=0;`
// this was ported from (nothing in the loop below ever read it; same pattern
// already cleaned up in a couple of other files in this codebase).
//console.info(JSON.stringify(SkillsJSON));
for (const index in SkillsJSON) {
    const value = SkillsJSON[index];
    // PERF: module-load-time only (once per skill, once for the table
    // below) so low runtime cost, but same unaddressed anti-pattern as the
    // per-request logging fixed elsewhere -- gated behind G_DEBUG.
    if (G_DEBUG) console.info(index + '=' + JSON.stringify(value));

    //if (!value.skillType)
    //continue;

    Skills.push({
        // Client-side only.
        //name:value.name,
        //iconOffset: value.iconOffset,
        //detail: value.detail,

        skillType: value.skillType,
        targetType: value.targetType ? value.targetType : 0,
        duration: value.duration ? value.duration : 0,
        durationPL: value.durationPL ? value.durationPL : 0,
        recharge: value.recharge ? value.recharge * 1000 : 0,
        aoe: value.aoe ? value.aoe : 0,
        countTotal: value.countTotal ? value.countTotal : 0,
        effectTypes: getSkillEffects(value.effects)
    });
}

if (G_DEBUG) console.info('skills: ' + JSON.stringify(Skills));

export { Skills };
export default { Skills };
