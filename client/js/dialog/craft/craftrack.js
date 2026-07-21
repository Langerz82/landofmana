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
            this.body = $(id);
            this.basketBackground = $(id + 'BasketBackground');
            this.basket = $(id + 'Basket');
            this.extra = $(id + 'Extra');
            this.price = $(id + 'Price');
            this.buyButton = $(id + 'BuyButton');
            this.item = null;

            this.rescale();

            this.buyButton.text('Craft');

            const self = this;
        }

        rescale() {
            const scale = this.parent.scale;
            const id = this.id;
            this.body = $(id);
            this.body.css({
    	        'position': 'absolute',
    	        'left': '0px',
    	        'top': '' + (this.index * (20*scale)) + 'px'
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
            this.buyButton.text('Craft');
            if (value)
            {
              this.buyButton.off().on('click', function(event) {
                  let noItems = false;
                  for (let it of self.item.craft.i) {
                    if (!game.inventory.hasItems(it[0],it[1])) {
                      game.showNotification(["CHAT", "SHOP_MISSINGITEMS", it[1], ItemTypes.getData(it[0]).name]);
                      noItems = true;
                    }
                  }
                  if (noItems) {
                    game.showNotification(["SHOP", "SHOP_NOCRAFTITEMS"]);
                    return;
                  }
                  if (self.item.craftPrice > game.player.gold[0]) {
                      game.showNotification(["SHOP", "SHOP_NOGOLD"]);
                      return;
                  }
                  if(game && game.ready) {
                      game.client.sendStoreCraft(parseInt(self.item.craft.id), 1);
                  }
                  event.stopPropagation();
              });
            }
        }

        assign(item) {
            this.item = item;
            Items.jqShowItem(this.basket, this.item, this.basket);

            const itemRoom = new ItemRoom(0, item.kind, 1, 900,900, 0);
            const itemDesc = Item.getInfoMsgEx(itemRoom);
            const itemName = ItemTypes.getName(item.kind);
            this.basket.attr('title', itemDesc);
            if (ItemTypes.isConsumableItem(item.kind)) {
              this.basket.text('');
            } else {
              this.extra.text(itemName);
            }

            let i=0;
            let html="<span class='craftBecomes'>&lt;&lt;&nbsp;</span><div class='craftReqs'>";
            for (let it of item.craft.i) {
              it.name = "craft_"+item.kind+"_"+i;
              html += "<div class='craftitem'><div id='"+it.name+"'></div></div>";
              i++;
            }
            this.extra.html(html+"</div>");

            for (let it of item.craft.i) {
              const itemData = {itemKind: it[0], itemNumber: it[1]};
              Items.jqShowItem($('#'+it.name), itemData, $('#'+it.name));
            }

            this.price.text(Utils.getNumShortHand(item.craftPrice));
        }
}
