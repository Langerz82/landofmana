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
            this.body = $(id);
            this.basketBackground = $(id + 'BasketBackground');
            this.basket = $(id + 'Basket');
            this.extra = $(id + 'Extra');
            this.price = $(id + 'Price');
            this.buyButton = $(id + 'BuyButton');
            this.item = null;

            this.rescale();

            this.buyButton.text('BUY');
        }

        rescale() {
            const scale = this.parent.scale;
            const id = this.id;
            this.body = $(id);
            this.basketBackground = $(id + 'BasketBackground');
            this.basket = $(id + 'Basket');
            this.extra = $(id + 'Extra');
            this.price = $(id + 'Price');
            this.buyButton = $(id + 'BuyButton');
        	if (scale === 1)
        	{
            this.body.css({
        			'position': 'absolute',
        			'left': '0px',
        			'top': '' + (this.index * 18) + 'px',
    		    });
  	     }
  	     else if (scale === 2) {
           this.body.css({
       			'position': 'absolute',
       			'left': '0px',
       			'top': '' + (this.index * 40) + 'px',
   		    });
  	     }
  	     else if (scale === 3) {
  		    this.body.css({
      			'position': 'absolute',
      			'left': '0px',
      			'top': '' + (this.index * 60) + 'px',
  		    });
  	     }
  	     if (this.item) {
           this.assign(this.item);
  	     }
        }

        getVisible() {
            return this.body.css('display') === 'block';
        }
        setVisible(value) {
            const self = this;
            this.body.css('display', value===true ? 'block' : 'none');
            if (this.parent.parent.pageIndex === 0)
            	this.buyButton.text('DELETE');
            else
            	this.buyButton.text('BUY');
            this.buyButton.off().on('click', function(event) {
                if (self.item)
                {
            			if(game && game.ready && game.auctionDialog.visible) {
            			    if (self.parent.parent.pageIndex === 0) {
            				      game.client.sendAuctionDelete(self.item.index, self.parent.itemType);
                      }
            			    else {
                          if (self.item.buyPrice > game.player.gold[0]) {
                              game.showNotification(["SHOP", "SHOP_NOGOLD"]);
                              return;
                          }
            				      game.client.sendAuctionBuy(self.item.index, self.parent.itemType);
                      }
            			}
            		}
            });
        }

        assign(item) {
            this.item = item;
            log.info(JSON.stringify(item));

            Items.jqShowItem(this.basket, item.item, this.basket);
            const itemData = ItemTypes.KindData[item.kind];
            const itemDesc = Item.getInfoMsgEx(item.item);
            this.extra.text(itemDesc);
            this.price.text(item.buyPrice + 'g');
        }

        clear() {
            this.basket.css('background-image', 'none')
            this.basket.attr('title', '');
            this.extra.text('');
            this.price.text('');

        }
}
