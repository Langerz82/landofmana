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

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types */
import Character from './character/character.js';
import AppearanceData from '../data/appearancedata.js';
import Sprites from '../sprites.js';

export default class NpcMove extends Character {
    constructor(id, type, map, kind, name) {
        super(id, type, map, kind);
        this.mapIndex = map;
        this.talkIndex = 0;
        this.name = name;
        this.orientation = 2;
    }

    getSpriteName() {
        // FIX: was `game.spriteNames[this.sprites[0]]` - `game.spriteNames` is never assigned
        // anywhere (only a commented-out line in game.js), so this always threw, and
        // `this.sprites[0]` holds a Sprite object/null rather than a lookup key anyway.
        // Use the same uid formula clientcallbacks.js uses when spawning an NpcMove.
        return (
            'npc' + (1 + (~~(this.kind / 8) % 4)) + '_' + (1 + (this.kind % 8))
        );
    }
}
