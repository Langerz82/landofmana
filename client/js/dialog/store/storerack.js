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
        this.body = $(id);
        this.basketBackground = $(id + 'BasketBackground');
        this.basket = $(id + 'Basket');
        this.extra = $(id + 'Extra');
        this.price = $(id + 'Price');
        this.buyButton = $(id + 'BuyButton');
        this.item = null;

        this.rescale();

        this.buyButton.text('Buy');

        const self = this;
    }

    rescale() {
        const scale = this.parent.scale;
        const id = this.id;
        this.body = $(id);
        this.body.css({
            position: 'absolute',
            left: '0px',
            top: '' + this.index * (20 * scale) + 'px' // FIX: was `this.scale`, which is never set on StoreRack (only StorePage sets it), so this evaluated to NaN and broke row spacing; use the local `scale` const instead
        });

        if (this.item) {
            this.assign(this.item);
        }
    }

    getVisible() {
        return this.body.css('display') === 'block';
    }
    setVisible(value) {
        const self = this;

        this.body.css('display', value ? 'block' : 'none');
        this.buyButton.text('Buy');
        if (value) {
            this.buyButton.off().on('click', function (event) {
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
        Items.jqShowItem(this.basket, this.item, this.basket);

        const itemRoom = new ItemRoom(0, item.kind, 1, 900, 900, 0);
        const itemDesc = Item.getInfoMsgEx(itemRoom);
        const itemName = ItemTypes.getName(item.kind);
        this.basket.attr('title', itemDesc);
        if (ItemTypes.isConsumableItem(item.kind)) {
            this.basket.text('');
            this.extra.text(
                (item.buyCount > 0 ? 'x' + item.buyCount : '') + ' ' + itemDesc
            );
        } else {
            this.extra.text(itemName);
        }

        const price = ItemTypes.getBuyPrice(item.kind);
        this.price.text(Utils.getNumShortHand(price));
    }
}
