// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';
import TabBook from '../tabbook.js';
import TabPage from '../tabpage.js';
/* global Types, ItemTypes */
import Item from '../entity/item.js';
import Items from '../data/items.js';
import InventoryStore from '../inventorystore.js';
import PageNavigator from '../pageNavigator.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

class StoreRack {
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
            			    //alert("auction buy");
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

class AuctionStorePage extends TabPage {
      constructor(parent, id, itemType, items, scale, buttonIndex) {
          super(parent, id + 'Page', id + buttonIndex + 'Button'); // FIX (conversion): this._super(...) -> super(...)
            this.itemType = itemType;
            this.racks = [];
            this.items = items;
            this.scale = scale;
            this.rackSize = 5;

            for(let index = 0; index < this.rackSize; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        }

        rescale(scale) {
            this.scale = scale;
            for(let index = 0; index < this.rackSize; index++) {
                this.racks[index].rescale();
            }
        }

        getPageCount() {
            if (this.items)
            	    return Math.ceil(this.items.length / this.rackSize);
            return 0;
        }

        getPageIndex() {
            return this.pageIndex;
        }

        setPageIndex(value) {
            log.info("setPageIndex: "+ value);
            this.pageIndex = value;
            this.reload();
        }

        sendOpen() {
             game.client.sendAuctionOpen(this.itemType);
        }

        reload() {
            for (let rack of this.racks)
              rack.clear();

            this.close();

            if (!this.items || this.items.length === 0)
        	     return;

            log.info("reload - this.pageIndex: "+ this.pageIndex);
            for(let index = this.pageIndex * this.rackSize; index < Math.min((this.pageIndex + 1) * this.rackSize, this.items.length); index++) {
                const rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
            this.parent.updatePageNav();
        }

        close() {
            for(let index = 0; index < this.rackSize; index++) {
            	this.racks[index].setVisible(false);
            }
        }

        setItems(itemData) {
          this.items = [];
          if (!itemData)
            this.close();

  		    for(let k in itemData) {
  			    const item = itemData[k];
            const kind = item.item.itemKind;
  			    this.items.push({
      				index: item.index,
      				name: ItemTypes.KindData[kind].name,
      				kind: kind,
              itemKind: kind,
      				player: item.player,
      				buyPrice: item.buy,
      				item: item.item,
      				rank: ItemTypes.KindData[kind].modifier
  			    });
  		    }

    	    if (this.items.length > 0)
    	    {
	          this.items.sort(function(a, b) {
               return a.rank - b.rank || a.kind - b.kind || a.itemCount - b.itemCount || a.buyPrice - b.buyPrice;
	          });

        		if (this.itemType > 0)
        		{
        		// Find the Cheapest Item for that kind only.
      		    for (let i = this.items.length - 1; i > 0; --i)
      		    {
          			const item = this.items[i];
          			const prevItem = this.items[i-1];

          			if (item.kind === prevItem.kind &&
          			    item.itemCount === prevItem.itemCount &&
          			    item.itemSkillKind === prevItem.itemSkillKind &&
          			    item.itemSkillLevel === prevItem.itemSkillLevel)
          			{
          				this.items.splice(i,1);
          			}
      		   }
      		 }
    	   }
       }
}

class MyAuctionPage extends AuctionStorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 0, [], scale, 0); // FIX (conversion): this._super(...) -> super(...)
        }
}
class AuctionArmorPage extends AuctionStorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 1, [], scale, 1); // FIX (conversion): this._super(...) -> super(...)
        }
}

class AuctionWeaponPage extends AuctionStorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 2, [], scale, 2); // FIX (conversion): this._super(...) -> super(...)
        }
}

class StoreFrame extends TabBook {
        constructor(parent) {
            super('#storeDialogStore'); // FIX (conversion): this._super('#storeDialogStore') -> super('#storeDialogStore')

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new MyAuctionPage(parent, this.scale));
            this.add(new AuctionArmorPage(parent, this.scale));
            this.add(new AuctionWeaponPage(parent, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale);

            const self = this;

            this.pageNavigator.onChange(function(sender) {
                const activePage = self.getActivePage();
                if(activePage && game.auctionDialog.visible) {
                    log.info("activePage.setPageIndex("+(sender.getIndex()-1)+");");
                    activePage.setPageIndex(sender.getIndex()-1);
                }
            });
        }

        rescale() {
        	this.scale = this.parent.scale;

          for (let page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        }

        reload() {
          for (let page of this.pages)
            page.reload();
        }

        setPageIndex(page) {
            page = page || 0;

            if (!game.auctionDialog.visible)
            	    return;

            this.pages[page].sendOpen();

            super.setPageIndex(page); // FIX (conversion): this._super(page) -> super.setPageIndex(page)
        }

        updatePageNav(len) {
          const activePage = this.getActivePage();
          if(activePage) {
            if(activePage.getPageCount() > 1) {
                this.pageNavigator.setCount(activePage.getPageCount());
                this.pageNavigator.setIndex(activePage.getPageIndex()+1);
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

export default class AuctionDialog extends Dialog {
        constructor(game) {
            super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')
            this.setScale();

            this.storeFrame = new StoreFrame(this);

            this.modal = $('#storeDialogModal');
            this.scale=this.setScale();

            this.addClose();
        }

        setScale() {
		      this.scale = game.renderer.getUiScaleFactor();
	      }

        rescale() {
        	this.setScale();
		      this.storeFrame.rescale();
        }

        show() {
            const self = this;

            this.rescale();

            $('#storeDialog .frameheading div').text('AUCTION');

            $("#storeDialogStore0Button").text('LIST');
            $("#storeDialog .storebuttons").show();
            //$("#storeDialogStore0Button").show();
            //$("#storeDialogStore2Button").show();

            const store3btn = $("#storeDialogStore3Button");
            store3btn.text('SELL');
            store3btn.show();
            store3btn.off().on('click', function (event) {
              game.inventoryMode = InventoryMode.MODE_AUCTION;
              game.inventoryDialog.backPage = self;
              self.hide();
              game.inventoryDialog.toggleInventory();
            });

            this.storeFrame.open(0);

            super.show(); // FIX (conversion): this._super() -> super.show()
            $("#storeDialogStore0Button").trigger('click');

            $('#storeDialogStore div.inventoryGoldFrame').show();
            $('#storeDialogStore div.inventoryGemsFrame').hide();
        }

        hide() {
            const activePage = this.storeFrame.getActivePage();
            if (activePage)
            {
                activePage.close();
                activePage.setVisible(false);
            }
            super.hide(); // FIX (conversion): this._super() -> super.hide()
        }
}
