// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';
import TabBook from '../tabbook.js';
import TabPage from '../tabpage.js';
/* global Types, ItemTypes, Utils */
import Item, { ItemRoom } from '../entity/item.js';
import InventoryStore from '../inventorystore.js';
import PageNavigator from '../pageNavigator.js';
import Items from '../data/items.js';

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

            this.buyButton.text('Buy');

            const self = this;
        }

        rescale() {
            const scale = this.parent.scale;
            const id = this.id;
            this.body = $(id);
            this.body.css({
    	        'position': 'absolute',
    	        'left': '0px',
    	        'top': '' + (this.index * (20*scale)) + 'px' // FIX: was `this.scale`, which is never set on StoreRack (only StorePage sets it), so this evaluated to NaN and broke row spacing; use the local `scale` const instead
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
            if (value)
            {
              this.buyButton.off().on('click', function(event) {
                  if (self.item.buyPrice > game.player.gold[0]) {
                      game.showNotification(["SHOP", "SHOP_NOGOLD"]);
                      return;
                  }
                  if(game && game.ready) {
                      game.client.sendStoreBuy(self.parent.itemType, parseInt(self.item.kind), 1);
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
              this.extra.text((item.buyCount > 0 ? 'x' + item.buyCount : '')+" "+itemDesc);
            } else {
              this.extra.text(itemName);
            }

            const price = ItemTypes.getBuyPrice(item.kind);
            this.price.text(Utils.getNumShortHand(price));
        }
}

class StorePage extends TabPage {
        constructor(parent, id, itemType, items, scale, buttonIndex) {
            super(parent, id + 'Page', id + buttonIndex + 'Button'); // FIX (conversion): this._super(...) -> super(...)
            this.itemType = itemType;
            this.racks = [];
            this.items = items;
            this.scale = scale;
            this.pageIndex = 0;

            this.parent = parent;
            this.rackRows = 5;

            for(let index = 0; index < this.rackRows; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        }

        rescale(scale) {
            this.scale = scale;
            for(let index = 0; index < this.rackRows; index++) {
                this.racks[index].rescale();
            }
        }

        getPageCount() {
            if (!this.items) return 0;
            log.info("this.items.length="+this.items.length);
            return Math.ceil(this.items.length / this.rackRows);
        }

        getPageIndex() {
            return this.pageIndex;
        }

        setPageIndex(value) {
            this.pageIndex = value;
            this.open(this.parent.minLevel,this.parent.maxLevel);
            this.reload();
        }

        open(min,max) {
            this.items = ItemTypes.Store.getItems(this.itemType, min, max);
            log.info(JSON.stringify(this.items));

            let cond = function (item) { return ItemTypes.isConsumableItem(item.kind); };
        		if (this.itemType===2)
                cond = function (item) { return ItemTypes.isArmor(item.kind); }
        		if (this.itemType===3)
                cond = function (item) { return ItemTypes.isWeapon(item.kind); }

            let i=this.items.length;
            while (--i >= 0)
            {
          	    const item = this.items[i];
          	    if (!cond(item))
          	    	this.items.splice(this.items.indexOf(item),1);
            }
        }

        reload() {
            this.clear();

            for(let index = this.pageIndex * this.rackRows; index < Math.min((this.pageIndex + 1) * this.rackRows, this.items.length); index++) {
                const rack = this.racks[index - (this.pageIndex * this.rackRows)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
        }

        clear() {
          for(let index = 0; index < this.rackRows; index++) {
              const rack = this.racks[index];
              rack.setVisible(false);
          }
        }

        close() {
          this.clear();
          this.setVisible(false);
        }
}

class StorePotionPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 1,
            	    null, scale, 0); // FIX (conversion): this._super(...) -> super(...)
        }
}

class StoreArmorPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 2,
            	    null, scale, 1); // FIX (conversion): this._super(...) -> super(...)
        }
}

class StoreWeaponPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 3,
            	    null, scale, 2); // FIX (conversion): this._super(...) -> super(...)
        }
}

class StoreFrame extends TabBook {
        constructor(parent) {
            super('#storeDialogStore'); // FIX (conversion): this._super('#storeDialogStore') -> super('#storeDialogStore')

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new StorePotionPage(this, this.scale));
            this.add(new StoreArmorPage(this, this.scale));
            this.add(new StoreWeaponPage(this, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale);
            this.pageNavigator.onChange(function(sender) {
                const activePage = self.getActivePage();
                if(activePage && game.storeDialog.visible) {
                    log.info("self.parent.game.storeDialog.visible");
                    activePage.setPageIndex(sender.getIndex() - 1);
                }

            });

            // FIX (var cleanup): was `var self = this;` declared after the onChange callback
            // above that reads `self` - safe as const because the callback only actually runs
            // later (on a page-navigator change event), by which time this line has executed.
            const self = this;

            this.minLevel = 1;
            this.maxLevel = 100;
        }

        rescale() {
        	this.scale = this.parent.scale;

          for (let page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        }

        setPageIndex(value) {
            if (!game.storeDialog.visible)
            {
            	    return;
            }
            this.pages[value].open(this.minLevel, this.maxLevel);

            super.setPageIndex(value); // FIX (conversion): this._super(value) -> super.setPageIndex(value)

            const activePage = this.getActivePage();

            if(activePage) {
                if(activePage.getPageCount() > 1) {
                    this.pageNavigator.setCount(activePage.getPageCount());
                    this.pageNavigator.setIndex(activePage.getPageIndex() + 1);
                    this.pageNavigator.open();
                    this.pageNavigator.setVisible(true);
                }
                else {
                  this.pageNavigator.setVisible(false);
                }
                activePage.reload();
            }
        }

        open(min,max) {
            const self = this;


            this.setPageIndex(0);
            this.pages[0].setPageIndex(0);
        }
}

export default class StoreDialog extends Dialog {
        constructor(game) {
            super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')
            this.setScale();

            this.storeFrame = new StoreFrame(this);

            this.sellButton = $('#storeDialogStore3Button');
            this.sellButton.show();

            const self = this;
        }

        setScale() {
          this.scale = game.renderer.getUiScaleFactor();
        }

        rescale() {
        	this.setScale();
		      this.storeFrame.rescale();
        }

        show(min, max) {
            const self = this;

            $('#storeDialog .frameheading div').text('SHOPS');

            $("#storeDialogStore0Button").text('CONSUME');
            $("#storeDialog .storebuttons").show();

            this.sellButton.text('SELL');
            this.sellButton.show();

            this.sellButton.off().on('click', function (event) {
              game.inventoryMode = InventoryMode.MODE_SELL;
              game.inventoryDialog.showInventory(true);
              game.inventoryDialog.backPage = self;
              self.hide();
            });

            this.rescale();
            this.storeFrame.open(min, max);

            this.addClose();

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
            }
            super.hide(); // FIX (conversion): this._super() -> super.hide()
        }
}
