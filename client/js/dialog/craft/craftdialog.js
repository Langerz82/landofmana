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
// FIX (maintainability): CraftDialog's supporting classes (StoreRack, StorePage/
// StoreMiscPage/StoreArmorPage/StoreWeaponPage, StoreFrame) are split across
// craftrack.js/craftpage.js/craftframe.js for readability - same pattern used for
// dialog/appearancedialog.js.
import Dialog from '../dialog.js';
import InventoryStore from '../../inventorystore.js';
import StoreFrame from './craftframe.js';

export default class CraftDialog extends Dialog {
    constructor(game) {
        super(game, '#craftDialog'); // FIX (conversion): this._super(game, '#craftDialog') -> super(game, '#craftDialog')
        this.setScale();

        this.craftFrame = new StoreFrame(this);

        this.jqSellButton = $('#craftDialogStore3Button');
        this.jqSellButton.hide();

        // Cached once here and reused by show() below instead of re-querying the DOM
        // every time the dialog is shown.
        this.jqFrameHeadingText = $('#craftDialog .frameheadingtext');
        this.jqStore0Button = $('#craftDialogStore0Button');
        this.jqGoldFrame = $('#storeDialogStore div.inventoryGoldFrame');
        this.jqGemsFrame = $('#storeDialogStore div.inventoryGemsFrame');

        const self = this;

        const jqCraftDialogStorePage = $('#craftDialogStorePage');
        jqCraftDialogStorePage.css('display', 'none');
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
        this.craftFrame.rescale();
    }

    show(min, max) {
        const self = this;

        this.jqFrameHeadingText.text('CRAFT');

        this.jqStore0Button.text('MISC');
        this.jqStore0Button.show();

        this.rescale();
        this.craftFrame.open(min, max);

        this.addClose();

        super.show(); // FIX (conversion): this._super() -> super.show()
        this.jqStore0Button.trigger('click');

        this.jqGoldFrame.show();
        this.jqGemsFrame.hide();
    }

    hide() {
        const activePage = this.craftFrame.getActivePage();
        if (activePage) {
            activePage.setVisible(false);
            activePage.close();
        }
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }
}
