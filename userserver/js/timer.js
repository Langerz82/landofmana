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

class Timer {
    constructor(duration, startTime) {
        this.lastTime = startTime;

        if (isNaN(startTime) || startTime === null || startTime === 0) {
            this.lastTime = Date.now();
        }

        this.duration = duration;
    }

    isOver(time) {
        let over = false;

        if (isNaN(time) || time === null || time === 0) {
            time = Date.now();
        }

        if (time - this.lastTime > this.duration) {
            over = true;
            this.lastTime = time;
        }

        return over;
    }

    // isOverLatency method (uncomment if needed)
    /*
    isOverLatency(time, latency) {
        let over = false;

        if ((time - this.lastTime) > (this.duration - latency)) {
            over = true;
            this.lastTime = time;
        }

        return over;
    }
    */
}

// Rest of the codebase uses ES module import/export; `module.exports` doesn't
// exist in that context and would throw if this were ever imported normally.
export default Timer;
