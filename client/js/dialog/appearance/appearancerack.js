// Extracted from appearancedialog.js: StoreRack (a single unlockable-appearance slot).
import AppearanceData from '../../data/appearancedata.js';
import Items from '../../data/items.js';
/* global game */

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

        this.buyButton.text('Unlock');
    }

    rescale() {
        const scale = this.parent.scale;
        const id = this.id;
        this.body.css({
            position: 'absolute',
            left: '0px',
            top: '' + this.index * (18 * scale) + 'px'
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

        this.body.css('display', value === true ? 'block' : 'none');
        this.buyButton.text('UNLOCK');

        const fnPreviewItem = function () {
            const dialog = game.appearanceDialog;
            if (game && game.ready && dialog.visible) {
                const item = self.item;
                dialog.update(
                    self.parent.itemType,
                    game.sprites[AppearanceData[item.index].sprite]
                );
                $('#changeLookUnlock').data('item', item);
                dialog.unlockMode(true);
            }
        };
        this.basketBackground.off().on('click', function (event) {
            fnPreviewItem();
        });

        this.buyButton.off().on('click', function (event) {
            fnPreviewItem();
        });
    }

    assign(item) {
        this.item = item;
        item.itemKind = item.index;

        this.scale = this.parent.scale;
        Items.jqShowItem(this.basket, this.item, this.basket);
        this.basket.text('');
        this.extra.text(item.name);
        this.price.text(item.buyPrice);

        const self = this;
    }

    clear() {
        this.basket.css('background-image', 'none');
        this.basket.attr('title', '');
        this.extra.text('');
        this.price.text('');
        this.basket.text('');
    }
}
