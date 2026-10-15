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
// FIX (maintainability): AuctionDialog's supporting classes (StoreRack, AuctionStorePage/
// MyAuctionPage/AuctionArmorPage/AuctionWeaponPage, StoreFrame) are split across
// auctionrack.js/auctionpage.js/auctionframe.js for readability - same pattern used for
// dialog/appearancedialog.js.
import Dialog from '../dialog.js';
/* global Types */
import InventoryStore from '../../inventorystore.js';
import StoreFrame from './auctionframe.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

export default class AuctionDialog extends Dialog {
    constructor(game) {
        super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')
        this.setScale();

        this.storeFrame = new StoreFrame(this);

        this.jqModal = $('#storeDialogModal');

        // Cached once here and reused by show() below instead of re-querying the DOM
        // every time the dialog is shown.
        this.jqFrameHeadingDiv = $('#storeDialog .frameheading div');
        this.jqStore0Button = $('#storeDialogStore0Button');
        this.jqStoreButtons = $('#storeDialog .storebuttons');
        this.jqStore3Button = $('#storeDialogStore3Button');
        this.jqGoldFrame = $('#storeDialogStore div.inventoryGoldFrame');
        this.jqGemsFrame = $('#storeDialogStore div.inventoryGemsFrame');

        this.addClose();
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
        this.storeFrame.rescale();
    }

    show() {
        const self = this;

        this.rescale();

        this.jqFrameHeadingDiv.text('AUCTION');

        this.jqStore0Button.text('LIST');
        this.jqStoreButtons.show();

        this.jqStore3Button.text('SELL');
        this.jqStore3Button.show();
        this.jqStore3Button.off().on('click', function (event) {
            game.inventoryMode = InventoryMode.MODE_AUCTION;
            game.inventoryDialog.backPage = self;
            self.hide();
            game.inventoryDialog.toggleInventory();
        });

        this.storeFrame.open(0);

        super.show(); // FIX (conversion): this._super() -> super.show()
        this.jqStore0Button.trigger('click');

        this.jqGoldFrame.show();
        this.jqGemsFrame.hide();
    }

    hide() {
        const activePage = this.storeFrame.getActivePage();
        if (activePage) {
            activePage.close();
            activePage.setVisible(false);
        }
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }
}
