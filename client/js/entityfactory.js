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

// Converted from AMD (define) to a native ES6 module.
/* global Types, log, _ */
import Entity from './entity/entity.js';
import Item from './entity/item.js';
import Mob from './entity/mob.js';
import NpcStatic from './entity/npcstatic.js';
import NpcMove from './entity/npcmove.js';
import Player from './entity/player/player.js';
import Block from './entity/block.js';
import Node from './entity/node.js';

const EntityFactory = {};

EntityFactory.createEntity = function (
    type,
    kind,
    id,
    mapIndex,
    name,
    level = 0
) {
    if (!id) {
        log.info(
            'ERROR - kind is undefined: ' + kind + ' ' + id + ' ' + name,
            true
        );
        return null;
    }

    switch (type) {
        case Types.EntityTypes.PLAYER:
            return new Player(id, type, mapIndex, kind, name);
        case Types.EntityTypes.MOB:
            return new Mob(id, type, mapIndex, kind, name, level);
        case Types.EntityTypes.NPCSTATIC:
            return new NpcStatic(id, type, mapIndex, kind, name);
        case Types.EntityTypes.ITEM:
        case Types.EntityTypes.ITEMLOOT:
            return new Item(id, type, mapIndex, kind, 'item');
        case Types.EntityTypes.BLOCK:
            return new Block(id, type, mapIndex, kind, name);
        case Types.EntityTypes.TRAP:
            return new Entity(id, type, mapIndex, kind, name);
        case Types.EntityTypes.NPCMOVE:
            return new NpcMove(id, type, mapIndex, kind, name);
        case Types.EntityTypes.NODE:
            // Chests are spawned server-side as Node.CHEST_KIND nodes (see
            // gameserver/js/entity/node.js) rather than a separate entity type,
            // so this one branch already covers ore/tree nodes and chests alike.
            return new Node(id, mapIndex, kind);
        default:
            return null;
    }
};

export default EntityFactory;
