// Extracted from craftdialog.js: StoreRack (a single craftable-item slot). Same split pattern
// used for dialog/appearancedialog.js (StoreRack/AppearancePage/StoreFrame/AppearanceDialog).
/* global ItemTypes, Utils */
import Item, { ItemRoom } from '../../entity/item.js';
import Items from '../../data/items.js';

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

        this.jqBuyButton.text('Craft');

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
            top: '' + this.index * (20 * scale) + 'px'
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
        this.jqBuyButton.text('Craft');
        if (value) {
            this.jqBuyButton.off().on('click', function (event) {
                let noItems = false;
                for (let it of self.item.craft.i) {
                    if (!game.inventory.hasItems(it[0], it[1])) {
                        game.showNotification([
                            'CHAT',
                            'SHOP_MISSINGITEMS',
                            it[1],
                            ItemTypes.getData(it[0]).name
                        ]);
                        noItems = true;
                    }
                }
                if (noItems) {
                    game.showNotification(['SHOP', 'SHOP_NOCRAFTITEMS']);
                    return;
                }
                if (self.item.craftPrice > game.player.gold[0]) {
                    game.showNotification(['SHOP', 'SHOP_NOGOLD']);
                    return;
                }
                if (game && game.ready) {
                    game.client.sendStoreCraft(parseInt(self.item.craft.id), 1);
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
        } else {
            this.jqExtra.text(itemName);
        }

        let i = 0;
        let html =
            "<span class='craftBecomes'>&lt;&lt;&nbsp;</span><div class='craftReqs'>";
        for (let it of item.craft.i) {
            it.name = 'craft_' + item.kind + '_' + i;
            html +=
                "<div class='craftitem'><div id='" + it.name + "'></div></div>";
            i++;
        }
        this.jqExtra.html(html + '</div>');

        // NOTE: `$('#' + it.name)` here is intentionally not cached in the constructor -
        // these per-craft-ingredient elements don't exist until the this.jqExtra.html(...)
        // call immediately above creates them, and they're recreated fresh (new DOM nodes)
        // every time assign() runs with a different item, so the old cache would be stale.
        for (let it of item.craft.i) {
            const itemData = { itemKind: it[0], itemNumber: it[1] };
            Items.jqShowItem($('#' + it.name), itemData, $('#' + it.name));
        }

        this.jqPrice.text(Utils.getNumShortHand(item.craftPrice));
    }
}
