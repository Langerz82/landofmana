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
export default class Dialog {
    constructor(game, id) {
        this.id = id;
        this.jqBody = $(id);
        this.visible = false;
    }

    addClose(closeEvent) {
        this.jqCloseButton = $(this.id + ' .frame-close-button');
        this.closeEvent = closeEvent;
    }

    show() {
        const self = this;

        if (this.showHandler) {
            this.showHandler(this);
        }

        this.jqBody.show();
        this.visible = true;
        this.showing = true;

        if (game.gamepad) game.gamepad.dialogOpen(this.jqBody);

        if (this.jqCloseButton) {
            // FIX: unbind previous handler before rebinding, otherwise repeated show() calls stack duplicate click handlers
            this.jqCloseButton.off('click').click(function (e) {
                if (game.gamepad) game.gamepad.dialogClose();
                if (self.closeEvent) self.closeEvent(e);
                self.hide();
            });
        }
    }

    hide() {
        this.visible = false;
        this.showing = false;
        this.jqBody.hide();

        if (this.hideHandler) {
            this.hideHandler(this);
        }
    }

    onShow(handler) {
        this.showHandler = handler;
    }

    onHide(handler) {
        this.hideHandler = handler;
    }
}
