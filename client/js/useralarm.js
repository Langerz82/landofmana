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
/* global Types, Class, _, questSerial */

export default class UserAlarm {
    constructor() {
        this.hideDelay = 5000; //How long the notification shows for.

        this.queue = [];
        this.jqAlarm = $('#useralarm');
        this.showing = false;
        this.disabled = false;
    }

    alarmQueue(str, delay) {
        delay = delay || this.hideDelay;

        this.queue.push([str, delay]);

        if (!this.showing) this.showQueue();
    }

    hide() {
        this.jqAlarm.hide();
        this.disabled = true;
    }

    show() {
        this.disabled = false;

        if (!this.showing) this.showQueue();
    }

    showQueue() {
        const self = this;

        if (this.disabled) {
            setTimeout(function () {
                self.showQueue();
            }, 1000);
            return;
        }

        if (this.queue.length > 0) {
            this.showing = true;
            // FIX: was `.pop()` (LIFO/stack order) on a queue that's pushed to with alarmQueue()/push(); notifications
            // showed most-recent-first instead of in arrival order. Use `.shift()` for correct FIFO queue behavior.
            const msg = this.queue.shift();
            this.jqAlarm.html(msg[0]);
            this.jqAlarm.fadeIn();
            setTimeout(function () {
                self.jqAlarm.fadeOut(1500, function () {
                    self.showQueue();
                });
            }, msg[1]);
        } else {
            this.showing = false;
        }
    }

    alarm(str, delay) {
        this.alarmQueue(str, delay);
    }
}
