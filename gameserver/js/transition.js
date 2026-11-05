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

import {
    MOVE_FRAME_MS,
    MAX_CATCHUP_MS,
    EPSILON
} from './constants.js';

// Fixed-timestep movement transition.
//
// Movement is simulated on a fixed MOVE_FPS (constants.js) timeline that is
// independent of how often the screen/server loop actually runs. Every fixed
// frame that has elapsed adds MOVE_FRAME_MS / delay pixels of progress
// (delay = ms per pixel, the entity's moveDelay), and updateFunction(object,
// dir) is called once for every whole pixel of progress. If the real loop
// runs slower than 60 fps, drops frames, or stalls, the next step() simulates
// every missed fixed frame, so an entity always covers exactly the same
// number of pixels for the same elapsed time on every client and the server.
// If the loop runs faster than 60 fps, step() simply does nothing until the
// next fixed frame is due.
//
// updateFunction returns true to end the transition (path node reached, path
// finished, blocked, ...). When it ends that way *without* anyone calling
// stop() from outside (the entity is just turning at a path node and the
// updater immediately start()s the next leg), the fixed-frame clock and any
// fractional pixel progress carry into the next start(), so no time or
// distance is lost at corners. Any external stop() discards the carry.


const now =
    typeof performance !== 'undefined' && performance.now
        ? () => performance.now()
        : () => Date.now();

class Transition {
    constructor(object) {
        this.inProgress = false;
        this.object = object;

        this.dir = 0; // -1 or 1
        this.delay = 0; // ms per pixel
        this.frameTime = 0; // time of the last simulated fixed frame
        this.progress = 0; // fractional pixels accumulated, not yet moved

        this.updateFunction = null;
        this.stopFunction = null;

        this._stepping = false;
        this._externalStop = false;
        this._carry = null; // { frameTime, progress } for the next start()
    }

    static now() {
        return now();
    }

    // dir: sign gives direction (-1/1; any negative/positive number accepted).
    // delay: ms per pixel. <= 0 means "don't move".
    start(updateFunction, stopFunction, dir, delay) {
        const t = now();
        this.updateFunction = updateFunction;
        this.stopFunction = stopFunction;
        this.dir = dir < 0 ? -1 : dir > 0 ? 1 : 0;
        this.delay = delay > 0 ? delay : 0;

        const carry = this._carry;
        this._carry = null;
        if (
            carry !== null &&
            t - carry.frameTime >= 0 &&
            t - carry.frameTime <= MAX_CATCHUP_MS
        ) {
            this.frameTime = carry.frameTime;
            this.progress = carry.progress;
        } else {
            this.frameTime = t;
            this.progress = 0;
        }

        this.inProgress = true;
    }

    // Change speed mid-transition; takes effect from the next fixed frame.
    setDelay(delay) {
        this.delay = delay > 0 ? delay : 0;
    }

    step() {
        if (!this.inProgress || !this.updateFunction) return;
        if (this.dir === 0 || this.delay <= 0) return;

        const t = now();

        // Clamp very long gaps so we don't burst hundreds of pixels at once.
        if (t - this.frameTime > MAX_CATCHUP_MS) {
            this.frameTime = t - MAX_CATCHUP_MS;
        }

        const pxPerFrame = MOVE_FRAME_MS / this.delay;

        this._stepping = true;
        this._externalStop = false;
        try {
            // Simulate every fixed frame that has come due since the last one.
            while (t - this.frameTime >= MOVE_FRAME_MS - EPSILON) {
                this.frameTime += MOVE_FRAME_MS;
                this.progress += pxPerFrame;

                while (this.progress >= 1 - EPSILON) {
                    if (!this.inProgress) return;

                    this.progress -= 1;
                    if (this.updateFunction(this.object, this.dir)) {
                        const external =
                            this._externalStop || !this.inProgress;
                        const carry = {
                            frameTime: this.frameTime,
                            progress: Math.max(this.progress, 0)
                        };
                        this.stop();
                        if (!external) this._carry = carry;
                        return;
                    }
                }
            }
        } finally {
            this._stepping = false;
        }
    }

    stop() {
        if (this._stepping) this._externalStop = true;
        this._carry = null;

        if (this.stopFunction) this.stopFunction(this.object);

        this.inProgress = false;
    }
}

export default Transition;
