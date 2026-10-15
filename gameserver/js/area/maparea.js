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

class MapArea {
    constructor(map, elipse, x, y, width, height) {
        this.map = map;
        this.elipse = elipse;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // FIX: `contains` was reading the bare `elipse` identifier instead of the
    // constructor parameter captured on `this.elipse`. That threw a
    // ReferenceError on every call, breaking door/portal detection entirely
    // (map.js's isDoor/getDoor call into this). Using `this.elipse` below.
    contains(entity) {
        if (!this.elipse) {
            if (entity) {
                return (
                    entity.x >= this.x &&
                    entity.y >= this.y &&
                    entity.x < this.x + this.width &&
                    entity.y < this.y + this.height
                );
            } else {
                return false;
            }
        }
        if (this.elipse) {
            if (entity) {
                const cx = this.x;
                const cy = this.y;
                const d = Math.sqrt(
                    Math.pow(entity.x - cx, 2) + Math.pow(entity.y - cy, 2)
                );
                const inElipse = d < this.width / 2 && d < this.height / 2;

                // FIX/PERF: was `console.log("this.elipseId="+this.elipseId);`
                // here, unconditionally, on every call -- this.elipseId is never
                // assigned anywhere on MapArea (same dead-property issue already
                // fixed in area.js's own elipseId reference), so this always
                // logged "undefined" and did nothing useful. contains() is the
                // hot path map.js's isDoor()/getDoor() call on every relevant
                // player move, so this was unconditional log spam on a per-move
                // check. Removed rather than gated behind G_DEBUG, since there's
                // no real elipseId value here to ever report.
                return inElipse;
            } else {
                return false;
            }
        }
    }
}

export default MapArea;
