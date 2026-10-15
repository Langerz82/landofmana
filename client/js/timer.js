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
// Was: define(function() { var Timer = Class.extend({ init: ..., ... }); return Timer; });
export default class Timer {
    constructor(duration, startTime) {
        this.restart(startTime);

        this.duration = duration;
    }

    restart(startTime) {
        this.lastTime = startTime;
        if (isNaN(startTime) || startTime === null || startTime === 0) {
            this.lastTime = Date.now();
        }
    }

    isOver(time) {
        let over = false;

        if (isNaN(time) || time === null || time === 0) {
            time = Date.now();
        }

        if (this.lastTime === 0 || time - this.lastTime > this.duration) {
            over = true;
            this.lastTime = time;
        }
        return over;
    }

    getRatio(time) {
        return Math.min((time - this.lastTime) / this.duration, 1.0);
    }
}
