define(['./dialog', '../tabbook', '../tabpage', '../entity/item', '../inventorystore', '../pageNavigator', 'data/items'],
  function(Dialog, TabBook, TabPage, Item, InventoryStore, PageNavigator, Items) {

    var SCALE = 3;
    function setScale(scale) {
    	    SCALE = scale;
    }

    var StoreRack = Class.extend({
        init: function(parent, id, index) {
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

            var self = this;
        },

        rescale: function() {
            var scale = this.parent.scale;
            var id = this.id;
            this.body = $(id);
          	if (scale == 1)
          	{
              this.body.css({
      	        'position': 'absolute',
      	        'left': '0px',
      	        'top': '' + (this.index * 20) + 'px'
      		    });
            }
            else if (scale == 2) {
              this.body.css({
                'position': 'absolute',
                'left': '0px',
                'top': '' + (this.index * 40) + 'px'
              });
            }
            else if (scale == 3) {
              this.body.css({
                'position': 'absolute',
                'left': '0px',
                'top': '' + (this.index * 60) + 'px'
              });
            }
            if (this.item) {
            	     this.assign(this.item);
            }
        },

        getVisible: function() {
            return this.body.css('display') === 'block';
        },
        setVisible: function(value) {
            var self = this;

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
        },

        assign: function(item) {
            this.item = item;
            Items.jqShowItem(this.basket, this.item, this.basket);

            var itemRoom = new ItemRoom(0, item.kind, 1, 900,900, 0);
            var itemDesc = Item.getInfoMsgEx(itemRoom);
            var itemName = ItemTypes.getName(item.kind);
            this.basket.attr('title', itemDesc);
            if (ItemTypes.isConsumableItem(item.kind)) {
              this.basket.text('');
              this.extra.text((item.buyCount > 0 ? 'x' + item.buyCount : '')+" "+itemDesc);
            } else {
              //this.basket.text(ItemTypes.getLevelByKind(item.kind) +"+1");
              this.extra.text(itemName);
            }

            this.price.text(getGoldShortHand(item.buyPrice));
        }
    });

    var StorePage = TabPage.extend({
        init: function(parent, id, itemType, items, scale, buttonIndex) {
            this._super(parent, id + 'Page', id + buttonIndex + 'Button');
            this.itemType = itemType;
            this.racks = [];
            this.items = items;
            this.scale = scale;
            this.pageIndex = 0;

            this.parent = parent;
            this.rackRows = 5;

            for(var index = 0; index < this.rackRows; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        },

        rescale: function (scale) {
            this.scale = scale;
            for(var index = 0; index < this.rackRows; index++) {
                this.racks[index].rescale();
            }
        },

        getPageCount: function() {
            if (!this.items) return 0;
            log.info("this.items.length="+this.items.length);
            return Math.ceil(this.items.length / this.rackRows);
        },

        getPageIndex: function() {
            return this.pageIndex;
        },

        setPageIndex: function(value) {
            this.pageIndex = value;
            this.open(this.parent.minLevel,this.parent.maxLevel);
            this.reload();
        },

        open: function(min,max) {
            this.items = ItemTypes.Store.getItems(this.itemType, min, max);
            log.info(JSON.stringify(this.items));

            var cond = function (item) { return ItemTypes.isConsumableItem(item.kind); };
        		if (this.itemType==2)
                cond = function (item) { return ItemTypes.isArmor(item.kind); }
        		if (this.itemType==3)
                cond = function (item) { return ItemTypes.isWeapon(item.kind); }

            var i=this.items.length;
            while (--i >= 0)
            {
          	    var item = this.items[i];
          	    if (!cond(item))
          	    	this.items.splice(this.items.indexOf(item),1);
            }
            //this.setPageIndex(0);
        },

        reload: function() {
            this.clear();

            for(var index = this.pageIndex * this.rackRows; index < Math.min((this.pageIndex + 1) * this.rackRows, this.items.length); index++) {
                var rack = this.racks[index - (this.pageIndex * this.rackRows)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
        },

        clear: function () {
          for(var index = 0; index < this.rackRows; index++) {
              var rack = this.racks[index];
              rack.setVisible(false);
          }
        },

        close: function () {
          this.clear();
          this.setVisible(false);
        }

    });

    var StorePotionPage = StorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 1,
            	    null, scale, 0);
        }
    });

    var StoreArmorPage = StorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 2,
            	    null, scale, 1);
        }
    });

    var StoreWeaponPage = StorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 3,
            	    null, scale, 2);
        }
    });

    var StoreFrame = TabBook.extend({
        init: function(parent) {
            this._super('#storeDialogStore');

            this.parent = parent;
            this.scale = this.parent.scale;
            this.pagePotion = new StorePotionPage(this, this.scale);
            this.pageArmor = new StoreArmorPage(this, this.scale);
            this.pageWeapon = new StoreWeaponPage(this, this.scale);

            this.add(this.pagePotion);
            this.add(this.pageArmor);
            this.add(this.pageWeapon);

            this.pageNavigator = new PageNavigator(parent, parent.scale);
            this.pageNavigator.onChange(function(sender) {
                var activePage = self.getActivePage();
                if(activePage && game.storeDialog.visible) {
                    log.info("self.parent.game.storeDialog.visible");
                    activePage.setPageIndex(sender.getIndex() - 1);
                    //activePage.reload();
                }

            });

            var self = this;

            this.minLevel = 1;
            this.maxLevel = 100;
        },

        rescale: function() {
        	this.scale = this.parent.scale;
        	this.pagePotion.rescale(this.scale);
        	this.pageArmor.rescale(this.scale);
        	this.pageWeapon.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        },

        setPageIndex: function(value) {
            if (!game.storeDialog.visible)
            {
            	    return;
            }
            this.pages[value].open(this.minLevel, this.maxLevel);

            this._super(value);

            var activePage = this.getActivePage();

            if(activePage) {
                if(activePage.getPageCount() > 1) {
                    //log.info("activePage.getPageCount()="+activePage.getPageCount());
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
        },

        open: function(min,max) {
            var self = this;

            this.minLevel = min;
            this.maxLevel = max;

            //for(var index = 0; index < this.pages.length; index++) {
            //    this.pages[index].open(min,max);
            //}

            this.setPageIndex(0);
            this.pagePotion.setPageIndex(0);
            //this.pagePotion.open(min,max);


            //this.pageNavigator.open();
        }
    });

    var StoreDialog = Dialog.extend({
        init: function(game) {
            this._super(game, '#storeDialog');
            this.setScale();

            this.storeFrame = new StoreFrame(this);

            this.sellButton = $('#storeDialogStore3Button');
            this.sellButton.show();

            //this.modal = $('#dialogModal');

            this.scale=this.setScale();

            var self = this;

            //$('#storeDialogStorePage').css('display','none');
        },

        setScale: function() {
          this.scale = game.renderer.getUiScaleFactor();
        },

        rescale: function() {
        	this.setScale();
		      this.storeFrame.rescale();
        },

        show: function(min, max) {
            var self = this;

            $('#storeDialog .frameheading div').text('SHOPS');

            $("#storeDialogStore0Button").text('CONSUME');
            //$("#storeDialogStore0Button").removeClass('active');
            $("#storeDialogStore0Button").show();
            $("#storeDialogStore2Button").show();

            this.sellButton.text('SELL');
            this.sellButton.show();

            this.sellButton.off().on('click', function (event) {
              game.inventoryMode = InventoryMode.MODE_SELL;
              game.inventoryHandler.showInventory(true);
            });

            this.rescale();
            this.storeFrame.open(min, max);

            this.addClose();

            this._super();
            $("#storeDialogStore0Button").trigger('click');
        },

        hide: function() {
            var activePage = this.storeFrame.getActivePage();
            if (activePage)
            {
                activePage.close();
            }
            this._super();
        },
    });

    return StoreDialog;
});
