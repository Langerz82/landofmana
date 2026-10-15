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

import EntityMoving from './entitymoving/entitymoving.js';
import { Types } from '../common.js';

class Block extends EntityMoving {
    // NOTE: the original set `this.type`/`this.parent`/`this.ix`/`this.iy` on `this`
    // BEFORE calling `_super()`, which was legal under the old prototype-based
    // Class.extend pattern (the instance already existed). Native ES6 classes
    // forbid touching `this` before `super()` runs, so `type` is computed into a
    // local first, passed to `super()`, and the rest are assigned right after —
    // none of these fields are read inside the parent constructor chain, so this
    // reordering has no observable effect on behavior.
    constructor(id, kind, x, y, map, area, name) {
        const type = Types.EntityTypes.BLOCK;
        super(id, type, kind, x, y, map);
        this.type = type;
        this.area = area;
        this.name = name;
        this.playerName = null;
    }

    isCompleted(player) {
        if (this.parent.isCompleted()) this.parent.onComplete();
    }

    getState() {
        return this._getBaseState();
    }

    update(player) {
        this.playerName = player.name;
        this.parent.update();
    }
}

export default Block;
