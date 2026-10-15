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

// Extracted from auctiondialog.js: StoreFrame (the tab-book holding the three auction category
// pages plus their shared page navigator). Same split pattern used for
// dialog/appearancedialog.js.
import TabBook from '../../tabbook.js';
import PageNavigator from '../../pageNavigator.js';
import {
    MyAuctionPage,
    AuctionArmorPage,
    AuctionWeaponPage
} from './auctionpage.js';
/* global game */

export default class StoreFrame extends TabBook {
    constructor(parent) {
        super('#storeDialogStore'); // FIX (conversion): this._super('#storeDialogStore') -> super('#storeDialogStore')

        this.parent = parent;
        this.scale = this.parent.scale;

        this.add(new MyAuctionPage(parent, this.scale));
        this.add(new AuctionArmorPage(parent, this.scale));
        this.add(new AuctionWeaponPage(parent, this.scale));

        this.pageNavigator = new PageNavigator(parent, parent.scale);

        const self = this;

        this.pageNavigator.onChange(function (sender) {
            const activePage = self.getActivePage();
            if (activePage && game.auctionDialog.visible) {
                log.info(
                    'activePage.setPageIndex(' + (sender.getIndex() - 1) + ');'
                );
                activePage.setPageIndex(sender.getIndex() - 1);
            }
        });
    }

    rescale() {
        this.scale = this.parent.scale;

        for (let page of this.pages) page.rescale(this.scale);

        this.pageNavigator.rescale(this.scale);
    }

    reload() {
        for (let page of this.pages) page.reload();
    }

    setPageIndex(page) {
        page = page || 0;

        if (!game.auctionDialog.visible) return;

        this.pages[page].sendOpen();

        super.setPageIndex(page); // FIX (conversion): this._super(page) -> super.setPageIndex(page)
    }

    updatePageNav(len) {
        const activePage = this.getActivePage();
        if (activePage) {
            if (activePage.getPageCount() > 1) {
                this.pageNavigator.setCount(activePage.getPageCount());
                this.pageNavigator.setIndex(activePage.getPageIndex() + 1);
                this.pageNavigator.setVisible(true);
            } else {
                this.pageNavigator.setVisible(false);
            }
        }
    }

    open(val) {
        this.setPageIndex(val);
        this.pageNavigator.setVisible(false);
    }
}
