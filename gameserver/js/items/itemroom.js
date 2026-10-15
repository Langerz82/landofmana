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

import BaseItem from './baseitem.js';

class ItemRoom extends BaseItem {
    // NOTE: the original set `this.slot = -1` BEFORE calling `_super(arr)`, which
    // was legal under the old prototype-based Class.extend pattern (the instance
    // already existed at that point). Native ES6 classes forbid touching `this`
    // before `super()` runs, so the super call is made first and `this.slot` is
    // set right after — BaseItem's constructor never reads `this.slot`, so this
    // reordering has no observable effect on behavior.
    constructor(arr) {
        super(arr);
        this.slot = -1;
    }

    toRedis() {
        return this.toArray().join(',');
    }

    toArray() {
        const cols = [parseInt(this.slot)].concat(super.toArray());
        return cols;
    }

    toArrayNoSlot() {
        const arr = this.toArray();
        arr.shift();
        return arr;
    }
}

export default ItemRoom;
