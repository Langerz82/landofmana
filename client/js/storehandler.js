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
import config from './config.js';

export default class StoreHandler {
    constructor(game, app) {
        this.game = game;
        this.app = app;
        this.toggle = false;
        const self = this;

        this.jqShopDialog = $('#shopDialog');
        this.jqShopUsername = $('#shopUsername');

        const jqShopCloseButton = $('#shopCloseButton');
        jqShopCloseButton.click(function (e) {
            self.jqShopDialog.hide();
            self.toggle = false; // FIX: `this` inside the click handler is the DOM element, not the StoreHandler; use captured `self` instead
        });
        this.jqShopDialog.hide();
    }

    show() {
        this.jqShopDialog.show();
        this.jqShopUsername.val(game.player.user.username);
    }
}
