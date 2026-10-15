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

// Split (see effecthandler/ folder): this file used to define EffectType,
// SkillEffect, and SkillEffectHandler all in one ~500-line file. Each class
// now lives in its own file under effecthandler/; this file just re-exports
// them under the same names/shape every external caller already expects.
//
// NOTE: the original CommonJS file did `module.exports = EffectType;` then
// `module.exports = SkillEffect;` then `module.exports = SkillEffectHandler;`
// in sequence -- each overwrote the previous, so only SkillEffectHandler was
// ever actually importable (`require('./effecthandler')` === SkillEffectHandler).
// That default-export behavior is preserved below; EffectType/SkillEffect are
// additionally exposed as named exports since they're genuinely useful and
// were previously just unreachable dead exports due to the overwrite bug.
export { EffectType } from './effecttype.js';
export { SkillEffect } from './skilleffect.js';
export { SkillEffectHandler } from './skilleffecthandler.js';
export { SkillEffectHandler as default } from './skilleffecthandler.js';
