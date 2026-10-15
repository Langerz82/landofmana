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
import EntityMoving from './entitymoving/entitymoving.js';
import Timer from '../timer.js';

export default class Block extends EntityMoving {
    // FIX: param order didn't match the call site in entityfactory.js
    // (`new Block(id, type, mapIndex, kind, name)`), so `mapIndex` was landing in this
    // constructor's `kind` slot and vice versa, and that swapped pair was then forwarded
    // to Entity via super(). Camera.isVisible() gates rendering on entity.mapIndex, so
    // blocks effectively never rendered/became interactive. Reordered to match the caller.
    constructor(id, type, mapIndex, kind, name, x, y) {
        super(id, type, mapIndex, kind, x, y);

        this.name = name;
    }

    pickup(entity) {
        entity.holdingBlock = this;
        game.client.sendBlock(0, this.id, this.x, this.y);
    }

    place(entity) {
        const ts = G_TILESIZE;
        const pos = entity.nextTile();
        pos[0] = pos[0].roundTo(ts);
        pos[1] = pos[1].roundTo(ts);
        if (game.currentMap.isColliding(pos[0], pos[1])) return;

        this.setPosition(pos[0], pos[1]);
        entity.holdingBlock = null;
        game.client.sendBlock(1, this.id, this.x, this.y);
    }

    // FIX (carried over from earlier bug-fix pass): removed dead commented-out block (isColliding/isActivated/onActivated/move) referencing undefined vars (bss, i); would error if re-enabled
}
