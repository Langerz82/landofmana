// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
//
// EXPLOIT FIX: both clients only open the shop / bank / craft / enchant /
// repair / auction / looks windows when the player clicks the matching NPC
// (client gameinteractiontarget.js, godot world.gd), but the server never
// checked that -- a modified client could buy, sell, bank, craft, enchant,
// repair, use the auction house and buy looks from anywhere on the map.
// Server-side, a service packet is now only honoured if the player is standing
// next to an NPC with that title (npcs.json "name") on their map -- the same
// Entity.isNextTooEntity() test (within one tile) the clients use before they
// open these windows.

import NpcData from '../data/npcdata.js';
function npcTitle(npc) {
    const data = NpcData.Kinds[npc.kind];
    return data ? data.name || data.uid : null;
}

export function isNearServiceNpc(player, ...titles) {
    const entities = player && player.map && player.map.entities;
    if (!entities) return false;
    for (const group of [entities.npcs, entities.npcplayers]) {
        if (!group) continue;
        for (const npc of group.values()) {
            if (!titles.includes(npcTitle(npc))) continue;
            if (player.isNextTooEntity(npc)) return true;
        }
    }
    return false;
}

export default isNearServiceNpc;
