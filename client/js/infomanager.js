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
import HoveringInfo from './hoveringinfo.js';

export default class InfoManager {
    constructor(game) {
        this.game = game;
        this.infos = {};
        this.destroyQueue = [];
        this.infoQueue = [];
        this.index = 1;
        const self = this;

        setInterval(function () {
            if (self.infoQueue.length > 0) {
                const time = self.game.currentTime;
                const info = self.infoQueue[0];
                if (!info.showTime) info.showTime = time;
                self.infos[info.id] = info;
                if (info.isTimeToShow(time)) {
                    self.infoQueue.shift();
                }
            }
        }, 50);
    }

    addDamageInfo(value, x, y, type, duration) {
        this.index = this.index >= Number.MAX_SAFE_INTEGER ? 1 : this.index + 1;
        // FIX (var cleanup): `duration` here was redeclaring the `duration` parameter via
        // var (legal, a no-op reassignment) inside the same multi-declaration statement as
        // genuinely new variables - let/const can't redeclare a parameter, so it's split out
        // into a plain reassignment below and the rest converted to const.
        duration = duration || 1000;
        const time = this.game.currentTime,
            id = this.index,
            self = this,
            info = new HoveringInfo(id, value, x, y, duration, type);

        info.onDestroy(function (id) {
            if (!id || !self.destroyQueue) return;
            self.destroyQueue.push(id);
        });

        if (info.interval > 0) {
            self.infoQueue.push(info);
        } else {
            info.showTime = time;
            self.infos[id] = info;
        }
    }

    addInfo(info) {
        const time = this.game.currentTime,
            self = this;

        info.onDestroy(function (id) {
            id = id || this.id;
            if (!id || !self.destroyQueue) return;
            self.destroyQueue.push(id);
        });

        if (info.interval > 0) {
            self.infoQueue.push(info);
        } else {
            info.showTime = time;
            self.infos[info.id] = info;
        }
    }

    forEachInfo(callback) {
        Object.values(this.infos).forEach(callback);
    }

    update(time) {
        this.forEachInfo(function (info) {
            info.update(time);
        });

        this.destroyQueue.forEach((id) => {
            game.renderer.removeSprite(Container.HUD, 'ci_' + id);
            delete this.infos[id];
        });
        this.destroyQueue = [];
    }
}
