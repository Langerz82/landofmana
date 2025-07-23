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

            this.buyButton.text('Craft');

            var self = this;
        },

        rescale: function() {
            var scale = this.parent.scale;
            var id = this.id;
            this.body = $(id);
            this.body.css({
    	        'position': 'absolute',
    	        'left': '0px',
    	        'top': '' + (this.index * (20*scale)) + 'px'
    		    });

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
            this.buyButton.text('Craft');
            if (value)
            {
              this.buyButton.off().on('click', function(event) {
                  var noItems = false;
                  for (var it of self.item.craft.i) {
                    if (!game.inventoryHandler.hasItems(it[0],it[1])) {
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
            } else {
              //this.basket.text(ItemTypes.getLevelByKind(item.kind) +"+1");
              this.extra.text(itemName);
            }

            var i=0;
            var html="<span class='craftBecomes'>&lt;&lt;&nbsp;</span><div class='craftReqs'>";
            for (var it of item.craft.i) {
              it.name = "craft_"+item.kind+"_"+i;
              html += "<div class='craftitem'><div id='"+it.name+"'></div></div>";
              i++;
            }
            this.extra.html(html+"</div>");

            for (var it of item.craft.i) {
              var itemData = {itemKind: it[0], itemNumber: it[1]};
              Items.jqShowItem($('#'+it.name), itemData, $('#'+it.name));
            }

            this.price.text(Utils.getNumShortHand(item.craftPrice));
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

            var cond = function (item) { return true; };
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
          	    if (item.craft.length == 0)
          	    	this.items.splice(this.items.indexOf(item),1);
                else if (item.craft.length == 1) {
                  item.craft = item.craft[0];
                }
                else {
                  for (var j=0; j < item.craft.length; j++) {
                    var newItem = Object.assign({}, item);
                    newItem = item.craft[j];
                    this.items.push(newItem);
                  }
                }
            }
            log.info("this.items="+JSON.stringify(this.items));
            //this.setPageIndex(0);
            this.reload();
        },

        reload: function() {
            this.clear();

            var len = Math.min((this.pageIndex + 1) * this.rackRows, this.items.length);
            for(var index = this.pageIndex * this.rackRows; index < len; index++) {
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

    var StoreMiscPage = StorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#craftDialogStore', 4,
            	    null, scale, 0);
        }
    });

    var StoreArmorPage = StorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#craftDialogStore', 2,
            	    null, scale, 1);
        }
    });

    var StoreWeaponPage = StorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#craftDialogStore', 3,
            	    null, scale, 2);
        }
    });

    var StoreFrame = TabBook.extend({
        init: function(parent) {
            this._super('#craftDialogStore');

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new StoreMiscPage(this, this.scale));
            this.add(new StoreArmorPage(this, this.scale));
            this.add(new StoreWeaponPage(this, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale, "craft");
            this.pageNavigator.onChange(function(sender) {
                var activePage = self.getActivePage();
                if(activePage && game.craftDialog.visible) {
                    log.info("self.parent.game.craftDialog.visible");
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

          for (var page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        },

        setPageIndex: function(value) {
            if (!game.craftDialog.visible)
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
            this.pages[0].setPageIndex(0);
            //this.pagePotion.open(min,max);


            //this.pageNavigator.open();
        }
    });

    var CraftDialog = Dialog.extend({
        init: function(game) {
            this._super(game, '#craftDialog');
            this.setScale();

            this.craftFrame = new StoreFrame(this);

            this.sellButton = $('#craftDialogStore3Button');
            this.sellButton.hide();

            //this.modal = $('#dialogModal');

            this.scale=this.setScale();

            var self = this;

            $('#craftDialogStorePage').css('display','none');
        },

        setScale: function() {
          this.scale = game.renderer.getUiScaleFactor();
        },

        rescale: function() {
        	this.setScale();
		      this.craftFrame.rescale();
        },

        show: function(min, max) {
            var self = this;

            $('#craftDialog .frameheadingtext').text('CRAFT');

            $("#craftDialogStore0Button").text('MISC');
            //$("#craftDialogStore0Button").removeClass('active');
            $("#craftDialogStore0Button").show();

            this.rescale();
            this.craftFrame.open(min, max);

            this.addClose();

            this._super();
            $("#craftDialogStore0Button").trigger('click');

            $('#storeDialogStore div.inventoryGoldFrame').show();
            $('#storeDialogStore div.inventoryGemsFrame').hide();            
        },

        hide: function() {
          var activePage = this.craftFrame.getActivePage();
          if (activePage)
          {
              activePage.setVisible(false);
              activePage.close();
          }
            this._super();
        },
    });

    return CraftDialog;
});
