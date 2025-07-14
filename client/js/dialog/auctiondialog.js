define(['./dialog', '../tabbook', '../tabpage', '../entity/item', 'data/items', '../inventorystore', '../pageNavigator'], function(Dialog, TabBook, TabPage, Item, Items, InventoryStore, PageNavigator) {
    function fixed(value, length) {
        var buffer = '00000000' + value;
        return buffer.substring(buffer.length - length);
    }

    var SCALE = 2;
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

            this.buyButton.text('BUY');
        },

        rescale: function() {
            var scale = this.parent.scale;
            var id = this.id;
            this.body = $(id);
            this.basketBackground = $(id + 'BasketBackground');
            this.basket = $(id + 'Basket');
            this.extra = $(id + 'Extra');
            this.price = $(id + 'Price');
            this.buyButton = $(id + 'BuyButton');
        	if (scale == 1)
        	{
            this.body.css({
        			'position': 'absolute',
        			'left': '0px',
        			'top': '' + (this.index * 18) + 'px',
    		    });
  	     }
  	     else if (scale == 2) {
           this.body.css({
       			'position': 'absolute',
       			'left': '0px',
       			'top': '' + (this.index * 40) + 'px',
   		    });
  	     }
  	     else if (scale == 3) {
  		    this.body.css({
      			'position': 'absolute',
      			'left': '0px',
      			'top': '' + (this.index * 60) + 'px',
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
            this.body.css('display', value===true ? 'block' : 'none');
            if (this.parent.parent.pageIndex == 0)
            	this.buyButton.text('DELETE');
            else
            	this.buyButton.text('BUY');
            this.buyButton.off().on('click', function(event) {
                if (self.item)
                {
            			if(game && game.ready && game.auctionDialog.visible) {
            			    //alert("auction buy");
            			    if (self.parent.parent.pageIndex == 0) {
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
        },

        assign: function(item) {
            this.item = item;
            log.info(JSON.stringify(item));

            Items.jqShowItem(this.basket, item.item, this.basket);
            var itemData = ItemTypes.KindData[item.kind];
            var itemDesc = Item.getInfoMsgEx(item.item);
            this.extra.text(itemDesc);
            this.price.text(item.buyPrice + 'g');
        },

        clear: function() {
            this.basket.css('background-image', 'none')
            this.basket.attr('title', '');
            this.extra.text('');
            this.price.text('');

        }
    });

    var AuctionStorePage = TabPage.extend({
      init: function(parent, id, itemType, items, scale, buttonIndex) {
          this._super(parent, id + 'Page', id + buttonIndex + 'Button');
            this.itemType = itemType;
            this.racks = [];
            this.items = items;
            this.scale = scale;
            this.rackSize = 5;

            for(var index = 0; index < this.rackSize; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        },

        rescale: function (scale) {
            this.scale = scale;
            for(var index = 0; index < this.rackSize; index++) {
                this.racks[index].rescale();
            }
        },

        getPageCount: function() {
            if (this.items)
            	    return Math.ceil(this.items.length / this.rackSize);
            return 0;
        },

        getPageIndex: function() {
            return this.pageIndex;
        },

        setPageIndex: function(value) {
            log.info("setPageIndex: "+ value);
            this.pageIndex = value;
            this.reload();
        },

        sendOpen: function() {
             game.client.sendAuctionOpen(this.itemType);
        },

        reload: function() {
            for (var rack of this.racks)
              rack.clear();

            this.close();

            if (!this.items || this.items.length == 0)
        	     return;

            log.info("reload - this.pageIndex: "+ this.pageIndex);
            for(var index = this.pageIndex * this.rackSize; index < Math.min((this.pageIndex + 1) * this.rackSize, this.items.length); index++) {
                var rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
            this.parent.updatePageNav();
        },

        close: function() {
            for(var index = 0; index < this.rackSize; index++) {
            	this.racks[index].setVisible(false);
            }
        },

        setItems: function(itemData) {
          this.items = [];
          if (!itemData)
            this.close();

  		    for(var k in itemData) {
  			    var item = itemData[k];
            var kind = item.item.itemKind;
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
      		    for (var i = this.items.length - 1; i > 0; --i)
      		    {
          			var item = this.items[i];
          			var prevItem = this.items[i-1];

          			if (item.kind == prevItem.kind &&
          			    item.itemCount == prevItem.itemCount &&
          			    item.itemSkillKind == prevItem.itemSkillKind &&
          			    item.itemSkillLevel == prevItem.itemSkillLevel)
          			{
          				this.items.splice(i,1);
          			}
      		   }
      		 }
    	   }
       }
    });

    var MyAuctionPage = AuctionStorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 0, [], scale, 0);
        },
    });
    var AuctionArmorPage = AuctionStorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 1, [], scale, 1);
        },
    });

    var AuctionWeaponPage = AuctionStorePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 2, [], scale, 2);
        },
    });

    var StoreFrame = TabBook.extend({
        init: function(parent) {
            this._super('#storeDialogStore');

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new MyAuctionPage(parent, this.scale));
            this.add(new AuctionArmorPage(parent, this.scale));
            this.add(new AuctionWeaponPage(parent, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale);

            var self = this;

            this.pageNavigator.onChange(function(sender) {
                var activePage = self.getActivePage();
                if(activePage && game.auctionDialog.visible) {
                    log.info("activePage.setPageIndex("+(sender.getIndex()-1)+");");
                    activePage.setPageIndex(sender.getIndex()-1);
                }
            });
        },

        rescale: function() {
        	this.scale = this.parent.scale;

          for (var page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        },

        reload: function () {
          for (var page of this.pages)
            page.reload();
        },

        setPageIndex: function(page) {
            page = page || 0;

            if (!game.auctionDialog.visible)
            	    return;

            this.pages[page].sendOpen();

            this._super(page);
        },

        updatePageNav: function(len) {
          var activePage = this.getActivePage();
          if(activePage) {
            if(activePage.getPageCount() > 1) {
                this.pageNavigator.setCount(activePage.getPageCount());
                this.pageNavigator.setIndex(activePage.getPageIndex()+1);
                this.pageNavigator.setVisible(true);
            } else {
                this.pageNavigator.setVisible(false);
            }
          }
        },

        open: function(val) {
          this.setPageIndex(val);
          this.pageNavigator.setVisible(false);
        }
    });

    var AuctionDialog = Dialog.extend({
        init: function(game) {
            this._super(game, '#storeDialog');
            this.setScale();

            this.storeFrame = new StoreFrame(this);

            this.modal = $('#storeDialogModal');
            this.scale=this.setScale();

            this.addClose();
        },

        setScale: function() {
		      this.scale = game.renderer.getUiScaleFactor();
	      },

        rescale: function() {
        	this.setScale();
		      this.storeFrame.rescale();
        },

        show: function() {
            var self = this;

            this.rescale();

            $('#storeDialog .frameheading div').text('AUCTION');

            $("#storeDialogStore0Button").text('LIST');
            $("#storeDialogStore0Button").show();
            $("#storeDialogStore2Button").show();

            var store3btn = $("#storeDialogStore3Button");
            store3btn.text('SELL');
            store3btn.show();
            store3btn.off().on('click', function (event) {
              game.inventoryMode = InventoryMode.MODE_AUCTION;
              game.inventoryHandler.toggleInventory();
              //self.storeFrame.setPageIndex(0);
            });

            this.storeFrame.open(0);

            this._super();
            $("#storeDialogStore0Button").trigger('click');
        },

        hide: function() {
            var activePage = this.storeFrame.getActivePage();
            if (activePage)
            {
                activePage.close();
                activePage.setVisible(false);
            }
            this._super();
        },
    });

    return AuctionDialog;
});
