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

// Server-side quest/dialogue text selection.
//
// The gameserver decides WHICH lang entry an NPC says / a quest shows (by
// quest id and status) and the display delay, and pushes those to the
// client. It sends the lang *index* (a path into shared/data/lang.json's
// language table), not the text itself. The client retrieves the lang value
// for that path and generates the quest fill-in variables (%name%, %count%,
// %name2%, %count2%) itself from the quest's mob/item/npc kinds. The server
// only reads the text to count lines (to time quest activation at the end of
// an offer dialogue).
//
// Wire shapes produced here:
//   lang path: ['QUESTS', '200100', 0] / ['QUESTS_MOB', 0, 1] /
//              ['QUEST_SUMMARY', 'KILLMOBKIND'] / ['QUESTS_REWARD']
//              -- each element indexes one level deeper into lang data.
//   delay: ms each line stays on screen before the next one -- only sent
//          when it differs from Types.DIALOGUE_DELAY_DEFAULT (5000).
// Non-quest dialogue (QUESTS_NONE, QUESTS_REWARD) still carries positional
// vars ({0}, {1}, ...) from the server -- those are NPC names/directions the
// client can't know, not quest variables.

import { Types } from './common.js';
import { Data as LangJson } from './data/langdata.js';
import { G_DIALOGUE_DELAY } from './constants.js';

const LANG = 'EN';
const QuestType = Types.QuestType;

function getLang(key) {
    const table = LangJson[LANG] || {};
    return table[key];
}

// Normalizes any lang dialogue shape into [[speaker, text], ...] (used here
// only to count lines; both clients have the same normalization):
//   "text"               -> [[0, "text"]]
//   [0, "text"]          -> [[0, "text"]]
//   ["a", "b"]           -> [[0, "a"], [0, "b"]]
//   [[0, "a"], [1, "b"]] -> [[0, "a"], [1, "b"]]
function normalizeLines(raw) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) return [[0, String(raw)]];
    if (raw.length >= 2 && typeof raw[0] === 'number' && !Array.isArray(raw[1]))
        return [[raw[0] ? 1 : 0, String(raw[1])]];

    const lines = [];
    for (const entry of raw) {
        if (Array.isArray(entry)) {
            if (entry.length < 2) continue;
            lines.push([parseInt(entry[0], 10) ? 1 : 0, String(entry[1])]);
        } else if (entry !== undefined && entry !== null) {
            lines.push([0, String(entry)]);
        }
    }
    return lines;
}

// Lang value at `path` (array of keys/indices), or undefined.
function getLangPath(path) {
    if (!Array.isArray(path) || path.length === 0) return undefined;
    let value = LangJson[LANG] || {};
    for (const key of path) {
        if (value === undefined || value === null || typeof value !== 'object')
            return undefined;
        value = value[key];
    }
    return value;
}

// Number of dialogue lines the lang entry at `path` has.
export function getLineCount(path) {
    return normalizeLines(getLangPath(path)).length;
}

const genericKeys = function (type) {
    switch (parseInt(type, 10)) {
        case QuestType.HIDEANDSEEK:
            return ['QUESTS_FIND', 'HIDEANDSEEK'];
        case QuestType.KILLMOBKIND:
        case QuestType.KILLMOBS:
            return ['QUESTS_MOB', 'KILLMOBKIND'];
        case QuestType.GETITEMKIND:
            return ['QUESTS_ITEM', 'GETITEMKIND'];
        case QuestType.USENODE:
            return ['QUESTS_NODE', 'USENODE'];
    }
    return [null, null];
};

// Lang path of the lines an NPC says when offering an authored quest
// (QUESTS[id][0]), or null if there are none.
export function getQuestOfferPath(questId) {
    const path = ['QUESTS', String(questId), 0];
    return getLineCount(path) > 0 ? path : null;
}

// Lang path of a quest's status-dependent description: QUESTS[id][status+1]
// for authored quests, or the generic per-type text (e.g. QUESTS_MOB[0][status])
// for procedurally generated ones. null if there is no such entry.
export function getQuestDescPath(quest) {
    const status = parseInt(quest.status, 10) || 0;
    const id = String(quest.id);
    const quests = getLang('QUESTS') || {};
    let path = null;
    if (Array.isArray(quests[id])) {
        path = ['QUESTS', id, status + 1];
    } else {
        const langKey = genericKeys(quest.type)[0];
        if (langKey) path = [langKey, 0, status];
    }
    return path && getLineCount(path) > 0 ? path : null;
}

// Lang path of a quest's one-line summary (QUEST_SUMMARY[id], falling back
// to QUEST_SUMMARY[<type>]), or null.
function getQuestSummaryPath(quest) {
    const sums = getLang('QUEST_SUMMARY') || {};
    const id = String(quest.id);
    if (Object.prototype.hasOwnProperty.call(sums, id))
        return ['QUEST_SUMMARY', id];
    const key = genericKeys(quest.type)[1];
    return key && sums[key] ? ['QUEST_SUMMARY', key] : null;
}

// Everything the client needs to display a quest besides the quest fields
// themselves: lang paths for the description (status-dependent, so sent on
// every update) and, when `withSummary`, the summary -- which never changes
// for a quest, so it is only sent when the quest starts and in the login
// quest list; the client keeps it from then on. Plus the per-line delay, only
// when it differs from Types.DIALOGUE_DELAY_DEFAULT. The client looks the
// text up and fills in the variables from the quest's fields.
export function getQuestText(quest, withSummary) {
    const text = { desc: getQuestDescPath(quest) };
    if (withSummary) text.summary = getQuestSummaryPath(quest);
    if (G_DIALOGUE_DELAY !== Types.DIALOGUE_DELAY_DEFAULT)
        text.delay = G_DIALOGUE_DELAY;
    return text;
}

export default {
    getLineCount,
    getQuestOfferPath,
    getQuestDescPath,
    getQuestText
};
