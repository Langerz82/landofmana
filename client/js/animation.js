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
export default class Animation {
    constructor(name, length, col, row, width, height) {
        this.name = name;
        this.length = length;
        this.col = col;
        this.row = row;
        this.width = width;
        this.height = height;

        this.reset();
    }

    tick() {
        let i = this.currentFrame.index;

        i = (i + 1) % this.length;

        if (this.count > 0) {
            if (i === 0) {
                this.count -= 1;
                if (this.count === 0) {
                    this.currentFrame.index = 0;
                    this.endcount_callback();
                    return;
                }
            }
        }

        const cf = this.currentFrame;
        cf.x = this.width * (i + this.col);
        cf.y = this.height * this.row;
        cf.i = i + this.col;
        cf.j = this.row;

        cf.index = i;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    // Animation templates live on a shared Sprite (sprite.animations) and are reused by
    // every entity with that appearance. Playback state (count/currentFrame/endcount_callback)
    // must NOT be mutated on that shared object, or two entities attacking around the same
    // time will stomp on each other's completion callback. clone() gives each entity its own
    // independent playback instance derived from the shared template.
    clone() {
        return new Animation(
            this.name,
            this.length,
            this.col,
            this.row,
            this.width,
            this.height
        );
    }

    setCount(count, onEndCount) {
        this.count = count;
        this.endcount_callback = onEndCount;
    }

    isTimeToAnimate(time) {
        return time - this.lastTime > this.speed;
    }

    update(time) {
        if (this.lastTime === 0 && this.name.substr(0, 3) === 'atk') {
            this.lastTime = time;
        }

        if (this.isTimeToAnimate(time)) {
            this.lastTime = time;
            this.tick();
            return true;
        } else {
            return false;
        }
    }

    reset() {
        this.lastTime = 0;
        this.currentFrame = {
            index: 0,
            x: this.col * this.width,
            y: this.row * this.height,
            i: this.col,
            j: this.row
        };
    }
}
