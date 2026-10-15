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

// Extracted from shortcuthandler.js: Cooldown (tracks/ticks down a shared cooldown timer across
// every shortcut slot bound to the same item/skill). Previously one of three classes
// (Shortcut/Cooldown/ShortcutHandler) declared in that one file. Same split pattern used for
// dialog/appearancedialog.js.

export default class Cooldown {
    constructor(shortcut) {
        this.shortcut = shortcut;
        this.children = shortcut.parent.getSameShortcuts(shortcut);
    }

    start(time) {
        const self = this;

        this.cooltimeCounter = time;

        const funcCooldown = function () {
            if (self.cooltimeCounter >= 0) {
                self.tick();
                self.cooltimeCounter -= 1;
            } else {
                self.done();
            }
        };

        clearInterval(this.cooltimeTickHandle);
        this.cooltimeTickHandle = setInterval(funcCooldown, 1000);

        funcCooldown();

        for (let sc of this.children) {
            sc.isCoolingDown = true;
            sc.jqCooldown.show();
        }
    }

    tick() {
        this.children = this.shortcut.parent.getSameShortcuts(this.shortcut);

        if (this.cooltimeCounter === 0) {
            this.done();
            return;
        }

        this.show();
    }

    show() {
        for (let sc of this.children) {
            sc.jqCooldown.show();
            sc.jqCooldown.html(this.cooltimeCounter);
        }
    }

    done() {
        clearInterval(this.cooltimeTickHandle);
        this.cooltimeTickHandle = null;
        this.cooltimeCounter = 0;

        for (let sc of this.children) {
            sc.isCoolingDown = false;
            sc.jqCooldown.hide();
            sc.cooldown = null;
        }
        this.cooldown = null;
        this.shortcut.cooldown = null;
        // FIX: `delete this;` is a no-op (delete cannot remove a local/this binding); removed dead code, cleanup is already handled above
    }
}
