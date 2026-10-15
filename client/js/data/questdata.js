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

// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types */
import fetchJsonSync from '../lib/fetchjsonsync.js';

const padding = (val, size) => String(val).padStart(size, '0');

const QuestData = {};
const data = fetchJsonSync('shared/data/quests.json');

let i = 0;
Object.values(data).forEach((quest) => {
    const id = padding(quest.type, 2) + padding(quest.npcId, 4) + padding(i, 3);
    QuestData[id] = quest;
    QuestData[id].id = id;
    QuestData[id].objectId = quest.objectId || 0;
    QuestData[id].objectCount = quest.objectCount || 0;
    i++;
});

export default QuestData;
