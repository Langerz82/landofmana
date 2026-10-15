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
// `Tile` was a local-only base class (never returned/exported by the original module, only used
// as AnimatedTile's parent) - preserved as module-local, not exported, for fidelity.
class Tile {}

export default class AnimatedTile extends Tile {
    constructor(id, length, speed, index) {
        super();
        this.startId = id;
        this.id = id;
        this.length = length;
        this.speed = speed;
        this.index = index;
        this.lastTime = 0;
    }

    tick() {
        if (this.id - this.startId < this.length - 1) {
            this.id += 1;
        } else {
            this.id = this.startId;
        }
    }

    animate(time) {
        if (time - this.lastTime > this.speed) {
            this.tick();
            this.lastTime = time;
            return true;
        } else {
            return false;
        }
    }
}
