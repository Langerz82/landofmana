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
import Dialog from './dialog.js';

export default class ConfirmDialog extends Dialog {
    constructor() {
        super(game, '#dialogModalConfirm'); // FIX (conversion): this._super(game, '#dialogModalConfirm') -> super(game, '#dialogModalConfirm')
        this.setScale();

        this.jqModalParent = $('#dialogModal');
        this.jqModal = $('#dialogModalConfirm');

        this.jqModalConfirmMessage = $('#dialogModalConfirmMessage');
        this.jqModalConfirmButton1 = $('#dialogModalConfirmButton1');
        this.jqModalConfirmButton2 = $('#dialogModalConfirmButton2');

        this.confirmCallback = null;

        const self = this;

        this.jqModalConfirmButton1.click(function (event) {
            self.hide();

            if (self.confirmCallback) {
                self.confirmCallback(true);
            }
        });
        this.jqModalConfirmButton2.click(function (event) {
            self.hide();

            if (self.confirmCallback) {
                self.confirmCallback(false);
            }
        });
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
    }

    show() {
        this.rescale();
        this.jqModalParent.css('display', 'block');
        this.jqModal.css('display', 'block');
        super.show(); // FIX (conversion): this._super() -> super.show()
    }

    hide() {
        this.jqModalParent.css('display', 'none');
        this.jqModal.css('display', 'none');
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }

    confirm(message, callback) {
        this.confirmCallback = callback;

        this.jqModalConfirmMessage.text(message);
        this.show();
    }
}
