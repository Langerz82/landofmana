// Extracted from appearancedialog.js: StoreRack (a single unlockable-appearance slot).
import AppearanceData from '../../data/appearancedata.js';
import Items from '../../data/items.js';
/* global game */

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

        this.jqBuyButton.text('Unlock');
    }

    rescale() {
        const scale = this.parent.scale;
        const id = this.id;
        this.jqBody.css({
            position: 'absolute',
            left: '0px',
            top: '' + this.index * (18 * scale) + 'px'
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

        this.jqBody.css('display', value === true ? 'block' : 'none');
        this.jqBuyButton.text('UNLOCK');

        const fnPreviewItem = function () {
            const dialog = game.appearanceDialog;
            if (game && game.ready && dialog.visible) {
                const item = self.item;
                dialog.update(
                    self.parent.itemType,
                    game.sprites[AppearanceData[item.index].sprite]
                );
                // NOTE: reuses AppearanceDialog's cached jqChangeLookUnlock (same
                // '#changeLookUnlock' selector) instead of re-querying the DOM here.
                dialog.jqChangeLookUnlock.data('item', item);
                dialog.unlockMode(true);
            }
        };
        this.jqBasketBackground.off().on('click', function (event) {
            fnPreviewItem();
        });

        this.jqBuyButton.off().on('click', function (event) {
            fnPreviewItem();
        });
    }

    assign(item) {
        this.item = item;
        item.itemKind = item.index;

        this.scale = this.parent.scale;
        Items.jqShowItem(this.jqBasket, this.item, this.jqBasket);
        this.jqBasket.text('');
        this.jqExtra.text(item.name);
        this.jqPrice.text(item.buyPrice);

        const self = this;
    }

    clear() {
        this.jqBasket.css('background-image', 'none');
        this.jqBasket.attr('title', '');
        this.jqExtra.text('');
        this.jqPrice.text('');
        this.jqBasket.text('');
    }
}
