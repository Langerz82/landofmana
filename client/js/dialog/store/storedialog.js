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
// FIX (maintainability): StoreDialog's supporting classes (StoreRack, StorePage/
// StorePotionPage/StoreArmorPage/StoreWeaponPage, StoreFrame) are split across
// storerack.js/storepage.js/storeframe.js for readability - same pattern used for
// dialog/appearancedialog.js.
import Dialog from '../dialog.js';
/* global Types */
import InventoryStore from '../../inventorystore.js';
import StoreFrame from './storeframe.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

export default class StoreDialog extends Dialog {
    constructor(game) {
        super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')
        this.setScale();

        this.storeFrame = new StoreFrame(this);

        this.jqSellButton = $('#storeDialogStore3Button');
        this.jqSellButton.show();

        // Cached once here and reused by show() below instead of re-querying the DOM
        // every time the dialog is shown.
        this.jqFrameHeadingDiv = $('#storeDialog .frameheading div');
        this.jqStore0Button = $('#storeDialogStore0Button');
        this.jqStoreButtons = $('#storeDialog .storebuttons');
        this.jqGoldFrame = $('#storeDialogStore div.inventoryGoldFrame');
        this.jqGemsFrame = $('#storeDialogStore div.inventoryGemsFrame');

        const self = this;
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
        this.storeFrame.rescale();
    }

    show(min, max) {
        const self = this;

        this.jqFrameHeadingDiv.text('SHOPS');

        this.jqStore0Button.text('CONSUME');
        this.jqStoreButtons.show();

        this.jqSellButton.text('SELL');
        this.jqSellButton.show();

        this.jqSellButton.off().on('click', function (event) {
            game.inventoryMode = InventoryMode.MODE_SELL;
            game.inventoryDialog.showInventory(true);
            game.inventoryDialog.backPage = self;
            self.hide();
        });

        this.rescale();
        this.storeFrame.open(min, max);

        this.addClose();

        super.show(); // FIX (conversion): this._super() -> super.show()
        this.jqStore0Button.trigger('click');

        this.jqGoldFrame.show();
        this.jqGemsFrame.hide();
    }

    hide() {
        const activePage = this.storeFrame.getActivePage();
        if (activePage) {
            activePage.close();
        }
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }
}
