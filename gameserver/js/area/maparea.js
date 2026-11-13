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
import { insideEllipse } from './area.js';

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
                // a true ellipse (area/area.js insideEllipse(): it used to be
                // a circle of half the smaller diameter)
                const inElipse = insideEllipse(
                    entity.x,
                    entity.y,
                    this.x,
                    this.y,
                    this.width,
                    this.height
                );

                return inElipse;
            } else {
                return false;
            }
        }
    }
}

export default MapArea;
