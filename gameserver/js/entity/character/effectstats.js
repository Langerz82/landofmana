// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
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

// Skill-effect modifiers: entity.stats.mod.attack / defense / damage are what
// the skill effects currently active on the entity add (Berserker's attack,
// Shield's defense, Explosive / Deadly Attack's bonus damage). stats.attack
// etc. stay the entity's own values; the effective stat is
// stats.attack + stats.mod.attack.
//
// stats.mod isn't a running total that each cast adds to and subtracts from
// (that drifted with several skills active): each value is summed on read
// from what every active cast applied to this entity (SkillEffect.applied,
// effecthandler/skilleffect.js), so ending, refreshing or losing an effect
// just stops it counting. The values are read-only.
export const EFFECT_STATS = ['attack', 'defense', 'damage'];

// What the skill effects active on `entity` add to `stat` (also used for
// the non-stat totals 'slow' and 'freeze', see effecttype.js).
export function effectTotal(entity, stat) {
    const effects = entity.activeEffects;
    if (!effects) return 0;
    let total = 0;
    for (const se of effects) total += se.appliedValue(entity, stat);
    return total;
}

// Give entity.stats its computed `mod` object. Run again whenever
// entity.stats is replaced with a new object.
export function installEffectMods(entity) {
    const mod = {};
    for (const stat of EFFECT_STATS) {
        Object.defineProperty(mod, stat, {
            enumerable: true,
            get: () => effectTotal(entity, stat)
        });
    }
    Object.defineProperty(entity.stats, 'mod', {
        value: mod,
        enumerable: true,
        configurable: true,
        writable: false
    });
}
