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
//
// The gameserver decides which quest/dialogue text applies (gameserver/js/
// questtext.js) and sends its lang *index* -- a path into lang data such as
// ['QUESTS', '200100', 1] -- plus the display delay. The client retrieves the
// lang value for that path and generates the quest fill-in variables
// (%name%, %count%, %name2%, %count2%) itself from the quest's mob/item/npc
// kinds (getQuestVars() below).
/* global lang, Types */
import NpcData from './data/npcdata.js';
import MobData from './data/mobdata.js';
import ItemLoot from './data/itemlootdata.js';

const QuestType = Types.QuestType;



const getQuestObject = function (arr) {
    return {
        type: arr[0],
        kind: arr[1] || 0,
        count: arr[2] || 0
    };
};

const capitalize = (t) => {
    t = String(t || '');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

// The quest fill-in variables, generated client-side from the quest's
// objects (port of the old Quest.setTextTemplate()):
//   KILLMOBKIND: %name% mob, %count% kill count
//   GETITEMKIND: %name% item, %count% item count, %name2% mob dropping it
//   HIDEANDSEEK: %name% npc
//   USENODE:     %count% node count
//   all:         %count2% current progress
function getQuestVars(type, object, object2, count) {
    const vars = { count2: Number(count) || 0 };
    switch (Number(type)) {
        case QuestType.GETITEMKIND:
            if (object2) {
                const loot = ItemLoot[object2.kind];
                if (loot) vars.name = capitalize(loot.name);
                vars.count = object2.count;
            }
            if (object) {
                const mob = MobData.Kinds[object.kind];
                if (mob) vars.name2 = capitalize(mob.key);
            }
            break;
        case QuestType.KILLMOBKIND:
        case QuestType.KILLMOBS:
            if (object) {
                const mob = MobData.Kinds[object.kind];
                if (mob) vars.name = capitalize(mob.key);
                vars.count = object.count;
            }
            break;
        case QuestType.HIDEANDSEEK:
            if (object) {
                const npc = NpcData.Kinds[object.kind];
                if (npc) vars.name = npc.name || npc.uid || '';
            }
            break;
        case QuestType.USENODE:
            if (object) vars.count = object.count;
            break;
    }
    return vars;
}

// Replaces `%key%` and `{key}` for every key in `vars` (an array gives
// {0}, {1}, ... / %0%, %1%, ...; an object gives its own key names).
function fillText(text, vars) {
    let txt = String(text === undefined || text === null ? '' : text);
    if (!vars) return txt;
    for (const key of Object.keys(vars)) {
        const val = String(vars[key]);
        txt = txt.split('%' + key + '%').join(val);
        txt = txt.split('{' + key + '}').join(val);
    }
    return txt;
}

// Lang value at `path` (array of keys/indices into lang.data), or undefined.
function getLangPath(path) {
    if (!Array.isArray(path) || path.length === 0) return undefined;
    let value = lang.data;
    for (const key of path) {
        if (value === undefined || value === null || typeof value !== 'object')
            return undefined;
        value = value[key];
    }
    return value;
}

// Any lang dialogue shape -> [[speaker, text], ...] (same rules as the
// server's questtext.js normalizeLines): "text", [0, "text"], ["a", "b"],
// [[0, "a"], [1, "b"]].
function normalizeLines(raw) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) return [[0, String(raw)]];
    if (raw.length >= 2 && typeof raw[0] === 'number' && !Array.isArray(raw[1]))
        return [[raw[0] ? 1 : 0, String(raw[1])]];
    const lines = [];
    for (const entry of raw) {
        if (Array.isArray(entry)) {
            if (entry.length < 2) continue;
            lines.push([Number(entry[0]) ? 1 : 0, String(entry[1])]);
        } else if (entry !== undefined && entry !== null) {
            lines.push([0, String(entry)]);
        }
    }
    return lines;
}

// Dialogue lines for a server-sent lang path, with the vars filled in.
export function langLines(path, vars) {
    return normalizeLines(getLangPath(path)).map((l) => [
        l[0],
        fillText(l[1], vars)
    ]);
}

// Single lang string for a server-sent lang path, with the vars filled in.
function langText(path, vars) {
    const value = getLangPath(path);
    return value === undefined || value === null || typeof value === 'object'
        ? ''
        : fillText(value, vars);
}

export default class Quest {
    constructor(arr) {
        this.desc = [];
        this.summary = '';
        this.delay = Types.DIALOGUE_DELAY_DEFAULT;
        this.update(arr);
    }

    // arr: the 13 quest fields, optionally followed by the server's text
    // object {desc[, summary][, delay]} (lang paths, looked up here;
    // their variables come from this quest's own fields). The summary is
    // only sent when the quest starts / at login -- later updates keep it.
    update(arr) {
        const text = arr.length > 13 ? arr[13] : null;
        // FIX: parseInt() was an Array.prototype monkey-patch that has
        // been removed from utils.js; migrated to Utils.ArrayParseInt().
        arr = Utils.ArrayParseInt(arr.slice(0, 13));

        this.id = arr[0];
        this.type = arr[1];
        this.npcQuestId = arr[2];
        this.count = arr[3];
        this.status = arr[4];
        this.data1 = arr[5];
        this.data2 = arr[6];
        if (!isNaN(arr[7]))
            this.object = getQuestObject([arr[7], arr[8], arr[9]]);
        this.object2 = null;
        if (arr.length === 13 && !isNaN(arr[10]))
            this.object2 = getQuestObject([arr[10], arr[11], arr[12]]);
        if (text) this.setText(text);
    }

    setText(text) {
        if (typeof text === 'string') {
            try {
                text = JSON.parse(decodeURIComponent(text));
            } catch (e) {
                return;
            }
        }
        if (!text || typeof text !== 'object') return;

        const vars = getQuestVars(
            this.type,
            this.object,
            this.object2,
            this.count
        );
        this.desc = langLines(text.desc, vars);
        if ('summary' in text) this.summaryPath = text.summary;
        // Re-filled on every update since %count2% (progress) can change.
        this.summary = langText(this.summaryPath, vars);
        // Only sent when it differs from the default.
        this.delay = Number(text.delay) || Types.DIALOGUE_DELAY_DEFAULT;
    }
}
