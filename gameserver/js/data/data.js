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

import MobData from './mobdata.js';
//setTimeout(function () {
import SkillData from './skilldata.js';
//}, 10000);
import ItemData from './itemdata.js';
import AppearanceData from './appearancedata.js';
import ItemLootData from './itemlootdata.js';
import NpcData from './npcdata.js';
import LangData from './langdata.js';
import QuestData from './questdata.js';
import NotifyData from './notificationdata.js';
import EntitySpawnData from './entityspawndata.js';

// NOTE: the original file just `require()`d each data module for its
// side effects and relied on every one of these (MobData, SkillData,
// ItemData, ...) leaking into the shared global scope so other files could
// reference them bare. ES modules don't leak globals, so this file now
// re-exports each of them by name -- anything that used to reach them as a
// bare global should `import` them from here (or directly from their own
// module) instead.
export {
    MobData,
    SkillData,
    ItemData,
    AppearanceData,
    ItemLootData,
    NpcData,
    LangData,
    QuestData,
    NotifyData,
    EntitySpawnData
};
