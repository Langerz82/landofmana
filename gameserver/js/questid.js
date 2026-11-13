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

// Quest ids: a fixed-width 13-digit number, built from
//   1 digit  - 1 = static (authored, shared/data/quests.json),
//              2 = dynamic (made up by an NPC on the fly, entityquests.js)
//   4 digits - the NPC's map's base index: the map's number x 100 (100 for
//              every part of map1), not the index of the part it stands in,
//              so quest ids don't change when a map is split differently
//              (map/mapgroup.js)
//   6 digits - the NPC's entity id (its fixed id in
//              data/maps/<map>/entity.json, unique in that file; MAX_FIXED_ID wide)
//   2 digits - the quest's number at that NPC, 01-99 (01 = its first quest)
// e.g. 1 0300 000001 01 = 1030000000101, the Old Man's (map3, map index 300, entity 1)
// first quest. Still a plain integer (well below 2^53), so every place that
// already parses quest ids as numbers -- the network packets, both clients,
// saved player data -- keeps working.
import { MAX_FIXED_ID } from './constants.js';

export const QUEST_STATIC = 1;
export const QUEST_DYNAMIC = 2;
// Most quests one NPC can give a player (the 2-digit quest number).
export const MAX_QUESTS_PER_NPC = 99;
// Most dynamic quests one NPC gives a player before it says NO_MORE_QUESTS.
export const MAX_DYNAMIC_QUESTS_PER_NPC = 10;

const ENTITY_DIGITS = String(MAX_FIXED_ID).length;

// "<1|2><map index><entity id>" -- every quest id of that kind from that NPC
// starts with this.
export function questIdPrefix(kind, mapIndex, entityId) {
    return (
        String(kind) +
        String(mapIndex).padStart(4, '0') +
        String(entityId).padStart(ENTITY_DIGITS, '0')
    );
}

export function makeQuestId(kind, mapIndex, entityId, number) {
    return Number(
        questIdPrefix(kind, mapIndex, entityId) +
            String(number).padStart(2, '0')
    );
}

// A static quest id -> { mapIndex, entityId, number }, or null if it isn't
// one (wrong length, or not starting with QUEST_STATIC).
export function parseQuestId(id) {
    const s = String(id);
    if (s.length !== 1 + 4 + ENTITY_DIGITS + 2 || !/^\d+$/.test(s)) return null;
    if (Number(s[0]) !== QUEST_STATIC) return null;
    return {
        mapIndex: Number(s.slice(1, 5)),
        entityId: Number(s.slice(5, 5 + ENTITY_DIGITS)),
        number: Number(s.slice(5 + ENTITY_DIGITS))
    };
}

export default {
    QUEST_STATIC,
    QUEST_DYNAMIC,
    MAX_QUESTS_PER_NPC,
    MAX_DYNAMIC_QUESTS_PER_NPC,
    questIdPrefix,
    makeQuestId,
    parseQuestId
};
