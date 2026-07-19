// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';
import TabBook from '../tabbook.js';
import TabPage from '../tabpage.js';
/* global ItemTypes, Utils */
import Item, { ItemRoom } from '../entity/item.js';
import InventoryStore from '../inventorystore.js';
import PageNavigator from '../pageNavigator.js';
import Items from '../data/items.js';

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

            let cond = function (item) { return true; };
        		if (this.itemType===2)
                cond = function (item) { return ItemTypes.isArmor(item.kind); }
        		if (this.itemType===3)
                cond = function (item) { return ItemTypes.isWeapon(item.kind); }

            let i=this.items.length;
            while (--i >= 0)
            {
          	    const item = this.items[i];
                // FIX: the `item.craft.length === 0` check below was not an `else if`, so it
                // still ran even after the item was already spliced out by the `!cond(item)`
                // branch above. With `item` no longer in the array, `indexOf(item)` returned
                // -1 and `splice(-1, 1)` deleted the *last* element instead - an unrelated
                // craft item could silently vanish from the list. Made the checks mutually
                // exclusive so a filtered-out item is only spliced once.
                if (!cond(item)) {
          	    	this.items.splice(this.items.indexOf(item),1);
                }
                else if (item.craft.length === 0) {
          	    	this.items.splice(this.items.indexOf(item),1);
                }
                else if (item.craft.length === 1) {
                  item.craft = item.craft[0];
                }
                else {
                  for (let j=0; j < item.craft.length; j++) {
                    // FIX: was Object.assign({}, item) immediately discarded by the next line
                    // reassigning newItem to item.craft[j] - the copy had zero effect
                    const newItem = item.craft[j];
                    this.items.push(newItem);
                  }
                }
            }
            log.info("this.items="+JSON.stringify(this.items));
            this.reload();
        }

        reload() {
            this.clear();

            const len = Math.min((this.pageIndex + 1) * this.rackRows, this.items.length);
            for(let index = this.pageIndex * this.rackRows; index < len; index++) {
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

class StoreMiscPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#craftDialogStore', 4,
            	    null, scale, 0); // FIX (conversion): this._super(...) -> super(...)
        }
}

class StoreArmorPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#craftDialogStore', 2,
            	    null, scale, 1); // FIX (conversion): this._super(...) -> super(...)
        }
}

class StoreWeaponPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#craftDialogStore', 3,
            	    null, scale, 2); // FIX (conversion): this._super(...) -> super(...)
        }
}

class StoreFrame extends TabBook {
        constructor(parent) {
            super('#craftDialogStore'); // FIX (conversion): this._super('#craftDialogStore') -> super('#craftDialogStore')

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new StoreMiscPage(this, this.scale));
            this.add(new StoreArmorPage(this, this.scale));
            this.add(new StoreWeaponPage(this, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale, "craft");
            this.pageNavigator.onChange(function(sender) {
                const activePage = self.getActivePage();
                if(activePage && game.craftDialog.visible) {
                    log.info("self.parent.game.craftDialog.visible");
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
            if (!game.craftDialog.visible)
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

            this.minLevel = min;
            this.maxLevel = max;

            //for(var index = 0; index < this.pages.length; index++) {
            //}

            this.setPageIndex(0);
            this.pages[0].setPageIndex(0);


        }
}

export default class CraftDialog extends Dialog {
        constructor(game) {
            super(game, '#craftDialog'); // FIX (conversion): this._super(game, '#craftDialog') -> super(game, '#craftDialog')
            this.setScale();

            this.craftFrame = new StoreFrame(this);

            this.sellButton = $('#craftDialogStore3Button');
            this.sellButton.hide();

            const self = this;

            $('#craftDialogStorePage').css('display','none');
        }

        setScale() {
          this.scale = game.renderer.getUiScaleFactor();
        }

        rescale() {
        	this.setScale();
		      this.craftFrame.rescale();
        }

        show(min, max) {
            const self = this;

            $('#craftDialog .frameheadingtext').text('CRAFT');

            $("#craftDialogStore0Button").text('MISC');
            $("#craftDialogStore0Button").show();

            this.rescale();
            this.craftFrame.open(min, max);

            this.addClose();

            super.show(); // FIX (conversion): this._super() -> super.show()
            $("#craftDialogStore0Button").trigger('click');

            $('#storeDialogStore div.inventoryGoldFrame').show();
            $('#storeDialogStore div.inventoryGemsFrame').hide();
        }

        hide() {
          const activePage = this.craftFrame.getActivePage();
          if (activePage)
          {
              activePage.setVisible(false);
              activePage.close();
          }
            super.hide(); // FIX (conversion): this._super() -> super.hide()
        }
}
