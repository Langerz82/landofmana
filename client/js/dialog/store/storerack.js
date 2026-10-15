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

// Extracted from storedialog.js: StoreRack (a single purchasable-item slot). Same split pattern
// used for dialog/appearancedialog.js (StoreRack/AppearancePage/StoreFrame/AppearanceDialog).
import Item, { ItemRoom } from '../../entity/item.js';
import Items from '../../data/items.js';
/* global ItemTypes, Utils */

export default class StoreRack {
    constructor(parent, id, index) {
        this.parent = parent;
        this.id = id;
        this.index = index;
        this.jqBody = $(id);
        this.jqBasketBackground = $(id + 'BasketBackground');
        this.jqBasket = $(id + 'Basket');
        this.jqExtra = $(id + 'Extra');
        this.jqPrice = $(id + 'Price');
        this.jqBuyButton = $(id + 'BuyButton');
        this.item = null;

        this.rescale();

        this.jqBuyButton.text('Buy');

        const self = this;
    }

    rescale() {
        const scale = this.parent.scale;
        const id = this.id;
        // FIX: rescale() used to re-run `$(id)` on every call, re-querying a DOM node
        // already cached in the constructor (id never changes for a rack instance).
        // Reuse the cached this.jqBody instead.
        this.jqBody.css({
            position: 'absolute',
            left: '0px',
            top: '' + this.index * (20 * scale) + 'px' // FIX: was `this.scale`, which is never set on StoreRack (only StorePage sets it), so this evaluated to NaN and broke row spacing; use the local `scale` const instead
        });

        if (this.item) {
            this.assign(this.item);
        }
    }

    getVisible() {
        return this.jqBody.css('display') === 'block';
    }
    setVisible(value) {
        const self = this;

        this.jqBody.css('display', value ? 'block' : 'none');
        this.jqBuyButton.text('Buy');
        if (value) {
            this.jqBuyButton.off().on('click', function (event) {
                if (self.item.buyPrice > game.player.gold[0]) {
                    game.showNotification(['SHOP', 'SHOP_NOGOLD']);
                    return;
                }
                if (game && game.ready) {
                    game.client.sendStoreBuy(
                        self.parent.itemType,
                        parseInt(self.item.kind),
                        1
                    );
                }
                event.stopPropagation();
            });
        }
    }

    assign(item) {
        this.item = item;
        Items.jqShowItem(this.jqBasket, this.item, this.jqBasket);

        const itemRoom = new ItemRoom(0, item.kind, 1, 900, 900, 0);
        const itemDesc = Item.getInfoMsgEx(itemRoom);
        const itemName = ItemTypes.getName(item.kind);
        this.jqBasket.attr('title', itemDesc);
        if (ItemTypes.isConsumableItem(item.kind)) {
            this.jqBasket.text('');
            this.jqExtra.text(
                (item.buyCount > 0 ? 'x' + item.buyCount : '') + ' ' + itemDesc
            );
        } else {
            this.jqExtra.text(itemName);
        }

        const price = ItemTypes.getBuyPrice(item.kind);
        this.jqPrice.text(Utils.getNumShortHand(price));
    }
}
