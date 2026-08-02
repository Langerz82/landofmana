// Extracted from auctiondialog.js: StoreRack (a single auction-listing slot). Same split
// pattern used for dialog/appearancedialog.js (StoreRack/AppearancePage/StoreFrame/
// AppearanceDialog -> appearancerack.js/appearancepage.js/appearanceframe.js).
import Item from '../../entity/item.js';
import Items from '../../data/items.js';
/* global ItemTypes, game */

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

        this.jqBuyButton.text('BUY');
    }

    rescale() {
        const scale = this.parent.scale;
        const id = this.id;
        // FIX: rescale() used to re-run `$(id)`/`$(id + 'Xxx')` for every field on every
        // call, re-querying DOM nodes already cached in the constructor (and never
        // invalidated - `id` never changes for a rack instance). Reuse the cached
        // this.jqXxx properties instead.
        if (scale === 1) {
            this.jqBody.css({
                position: 'absolute',
                left: '0px',
                top: '' + this.index * 18 + 'px'
            });
        } else if (scale === 2) {
            this.jqBody.css({
                position: 'absolute',
                left: '0px',
                top: '' + this.index * 40 + 'px'
            });
        } else if (scale === 3) {
            this.jqBody.css({
                position: 'absolute',
                left: '0px',
                top: '' + this.index * 60 + 'px'
            });
        }
        if (this.item) {
            this.assign(this.item);
        }
    }

    getVisible() {
        return this.jqBody.css('display') === 'block';
    }
    setVisible(value) {
        const self = this;
        this.jqBody.css('display', value === true ? 'block' : 'none');
        if (this.parent.parent.pageIndex === 0) this.jqBuyButton.text('DELETE');
        else this.jqBuyButton.text('BUY');
        this.jqBuyButton.off().on('click', function (event) {
            if (self.item) {
                if (game && game.ready && game.auctionDialog.visible) {
                    if (self.parent.parent.pageIndex === 0) {
                        game.client.sendAuctionDelete(
                            self.item.index,
                            self.parent.itemType
                        );
                    } else {
                        if (self.item.buyPrice > game.player.gold[0]) {
                            game.showNotification(['SHOP', 'SHOP_NOGOLD']);
                            return;
                        }
                        game.client.sendAuctionBuy(
                            self.item.index,
                            self.parent.itemType
                        );
                    }
                }
            }
        });
    }

    assign(item) {
        this.item = item;
        log.info(JSON.stringify(item));

        Items.jqShowItem(this.jqBasket, item.item, this.jqBasket);
        const itemData = ItemTypes.KindData[item.kind];
        const itemDesc = Item.getInfoMsgEx(item.item);
        this.jqExtra.text(itemDesc);
        this.jqPrice.text(item.buyPrice + 'g');
    }

    clear() {
        this.jqBasket.css('background-image', 'none');
        this.jqBasket.attr('title', '');
        this.jqExtra.text('');
        this.jqPrice.text('');
    }
}
