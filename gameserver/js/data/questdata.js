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

//import Utils from "../utils.js";
import Quest, { getQuestObject } from '../quest.js';
import QuestsJson from '../../shared/data/quests.json' with { type: 'json' };
import { G_DEBUG } from '../constants.js';

const QuestData = {};
const QuestNpcData = {};

for (const id in QuestsJson) {
    const data = QuestsJson[id];
    // PERF: module-load-time only (once per quest) -- gated behind G_DEBUG
    // for consistency with the same fix applied elsewhere.
    if (G_DEBUG) console.info('data:' + JSON.stringify(data));
    const quest = {};
    quest.id = id;
    quest.npcQuestId = data.npcKind;
    quest.raw = data;
    quest.npcKind = data.npcKind;
    quest.type = data.type;
    quest.level = data.level;
    quest.data1 = data.data1 || 0;
    quest.data2 = data.data2 || 0;
    quest.count = 0;
    quest.status = 0;
    quest.gold = data.gold || 0;
    quest.reward = data.reward || [];
    quest.expMultiplier = data.expMultiplier || 1;

    // FIX: was passing `data.object.level` (a 2-element [low, high] array,
    // e.g. [3,5] -- see shared/data/quests.json) as a single element of the
    // outer array, producing a 5-element array. getQuestObject() (quest.js)
    // branches on `arr.length === 5` for that shape and does
    // `self.level = [parseInt(arr[4], 10), 99]` -- parseInt() on an array
    // argument coerces it via .toString() first (`[3,5]` -> "3,5" ->
    // parseInt -> 3), so the authored upper bound was silently discarded
    // and every quest's level ceiling became 99 instead of its real value.
    // Spreading the level array into the outer array instead produces a
    // proper 6-element array, which hits getQuestObject()'s 6-arg branch
    // and reads both bounds correctly.
    if (data.object) {
        quest.object = getQuestObject([
            data.object.type,
            data.object.kind,
            data.object.count || 0,
            data.object.chance || 0,
            ...(data.object.level || [0, 99])
        ]);
    }
    if (data.object2) {
        quest.object2 = getQuestObject([
            data.object2.type,
            data.object2.kind,
            data.object2.count || 0,
            data.object2.chance || 0,
            ...(data.object2.level || [0, 99])
        ]);
    }

    const questObject = Object.assign(new Quest(), quest);
    questObject.data = quest;

    QuestData[quest.id] = questObject;
}

//console.info(QuestData);
export const Data = QuestData;

export default { Data };
