define(['./dialog', '../tabbook', '../tabpage', '../entity/item', 'data/items', 'data/itemlootdata', '../inventorystore'], function(Dialog, TabBook, TabPage, Item, Items, ItemLoot, InventoryStore) {
    function fixed(value, length) {
        var buffer = '00000000' + value;
        return buffer.substring(buffer.length - length);
    }

    var BankSlot = Class.extend({
        init: function(parent, index) {
            this.parent = parent;
            this.index = index;
            this.item = null;
            var name = '#bankDialogBank' + fixed(this.index, 2);
            this.background = $(name + 'Background');
            this.body = $(name + 'Body');

            this.rescale();
            var self = this;

            this.background.data('itemSlot',this.index);


            this.body.data('itemSlot',this.index);

            this.body.attr('draggable', true);
            this.body.draggable = true;

            var moveItem = function (slot) {
              var realslot = slot + (self.parent.page * self.parent.pageItems);

              if (DragBank === null) {
                DragBank = {};
                DragBank.type = 0;
                DragBank.slot = realslot;
                //self.parent.selectBankItem(self.background);
              } else {
                game.client.sendItemSlot([1, 1, DragBank.slot, 1, 1, realslot]);
                DragBank = null;
                self.parent.deselectItem();
              }
            };

            this.background.off().on('click tap', function(event) {
                var slot = $(this).data("itemSlot");

                if (self.parent.getItem(slot) == null) {
                  if (game.gamepad.isActive())
                      moveItem(slot);
                  self.parent.deselectItem();
                  return;
                }

                var isSame = (self.parent.selectedItem % 24) == slot;
                self.parent.selectBankItem(this);
                if (!game.renderer.isDesktop || isSame || game.gamepad.isActive()) {
                  moveItem(slot);
                  return;
                }

            });

            this.body.on('dragstart touchstart', function(event) {
              if (self.parent.selectedItem == -1)
                self.parent.selectBankItem(this);
              if (!DragBank)
                moveItem($(this).data("itemSlot"));
            });

            this.body.on('dragover touchover', function(event) {
              event.preventDefault();
            });

            this.background.on('drop touchend', function(event) {
              moveItem($(this).data("itemSlot"));
            });
        },

        rescale: function() {
            this.scale = game.renderer.guiScale;
            if (this.scale == 1)
            {
              this.background.css({
      			'position': 'absolute',
      			'left': '' + (0 + Math.floor(this.index % 6) * 18) + 'px',
      			'top': '' + (0 + Math.floor(this.index / 6) * 18) + 'px'
      		    });
            }
            else if (this.scale == 2)
            {
              this.background.css({
      			'position': 'absolute',
      			'left': '' + (0 + Math.floor(this.index % 6) * 50) + 'px',
      			'top': '' + (0 + Math.floor(this.index / 6) * 50) + 'px'
      		    });
            }
            else if (this.scale == 3)
            {
      		    this.background.css({
      			'position': 'absolute',
      			'left': '' + (0 + Math.floor(this.index % 6) * 60) + 'px',
      			'top': '' + (0 + Math.floor(this.index / 6) * 60) + 'px'
      		    });
            }
            if (this.item) {
                this.restore();
            }
        },

        getIndex: function() {
            return this.index;
        },
        getItemKind: function() {
            return this.item.itemKind;
        },
        setItemName: function() {
            var kind = this.item.itemKind;
            if ( ItemTypes.isLootItem(kind))
              this.itemName = ItemLoot[kind-1000].name;
            else
      	      this.itemName = ItemTypes.KindData[kind].name;
        },
        getItemName: function() {
            return this.itemName;
        },
        getComment: function() {
            return Item.getInfoMsgEx(this.item);
        },

        assign: function(item) {
            this.item = item;
            var kind = item.itemKind;
            this.setItemName(kind);
            this.itemDurabilityPercent = item.itemDurability/item.itemDurabilityMax*100;
            this.body.data('itemNumber',this.item.itemNumber);
            this.background.data('itemNumber',this.item.itemNumber);

            this.restore();
        },
        clear: function() {
            this.item = null;
            this.release();
        },
        release: function() {
            this.body.css('background-image', '');
            this.body.html("");
            this.body.attr('title', '');
        },
        restore: function() {
            var kind = itemKind = this.item.itemKind;
            var scale = game.renderer.getIconScaleFactor();

            Items.jqShowItem(this.body, this.item, this.body);
        }
    });

    var BankFrame = Class.extend({
        init: function(parent) {
            this.parent = parent;
            this.bankslots = [];
            this.page = 0;

            //this.pageIndex = 0;
            this.pageItems = 24;

            var self = this;
            this.selectBankItem = function(jq) {
              if (!(game && game.ready))
                return;

              var slot = $(jq).data("itemSlot");
              var itemNumber = $(jq).data("itemNumber");
              log.info("selectInventory - click, slot:"+slot);

              var realslot = slot + (self.page * self.pageItems);
              var item = game.bankHandler.banks[realslot];
              //var item = this.getItem(slot);

              //log.info("slot=" + slot);
              //log.info("inventories " + JSON.stringify(self.inventory));
              if (item) {
                if (self.selectedItem != realslot) {
                  self.deselectItem();
                  self.selectItem(realslot, true);
                  return;
                }
                else {
                  self.select(realslot, itemNumber);
                  self.deselectItem();
                }
              }
            };

            for(var index = 0; index < this.pageItems; index++) {
                this.bankslots.push(new BankSlot(this, index));
            }

            this.goldNumber = $('.bankGold');

            this.selectedBank = null;
            this.selectedItem = null;

      	    $('#bankDialogBankGoldBody').click(function(event) {
      	    	game.app.showDropDialog(-2);
      	    });



        },

        rescale: function(scale) {
            for(var index = 0; index < this.bankslots.length; index++) {
                this.bankslots[index].rescale();
            }
        },

        getItem: function (slot) {
            var realslot = slot + (this.page * this.pageItems);
            return game.bankHandler.banks[realslot];
        },

        getInventory: function(index) {
            return this.bankslots[index];
        },

        open: function(page) {
            this.page = page;
            game.bankHandler.pageIndex = page;

            for(var index = 0; index < 24; index++) {
                this.bankslots[index].release();
            }

            if(game && game.ready) {
                for(var bankNumber = 0; bankNumber < this.pageItems; bankNumber++) {
                    var item = game.bankHandler.banks[this.pageItems*page+bankNumber];
                    if(item) {
                        this.bankslots[bankNumber].assign(item);
                    }
                }
            }
        },

        select: function(realslot, itemCount = 1) {
            if (!game.inventoryHandler.isInventoryFull())
            {
                game.client.sendItemSlot([1, 1, realslot, itemCount, 0, -1]);
                this.bankslots[realslot % 24].release();
            }
        },

        deselectItem: function() {
          this.selectItem(this.selectedItem, false);
        },

        selectItem: function(realslot, select) {
          pageslot = realslot % this.pageItems;
          //var str = '#bankDialogBank'+fixed(pageslot,2)+'Background';
          if (pageslot < 0)
            return;

          var background = this.bankslots[pageslot].background;

          if (select) {
            var s = game.renderer.getUiScaleFactor();
            this.selectedItem = realslot;
            background.css({
              'border': s + 'px solid white'
            });
          }
          else {
            this.selectedItem = -1;
            background.css({
              'border': 'none'
            });
          }
        },
    });


    var BankDialog = Dialog.extend({
        init: function(game) {
            this._super(game, '#bankDialog');
            this.scale=0;
            this.setScale();

            var self = this;

            this.bankFrame = new BankFrame(this);

            this.storeButton = $('#bankDialogStoreButton');
            this.storeButton.off().on('click', function (event) {
              game.inventoryMode = InventoryMode.MODE_BANK;
              game.inventoryHandler.showInventory();
            });

            $('#bankGoldFrame').click(function(event) {
      	    	game.app.showDropDialog(-2);
      	    });

            $('#bankDialog0Button').click(function(event) {
      	    	  self.bankFrame.open(0);
      	    });
            $('#bankDialog1Button').click(function(event) {
      	    	  self.bankFrame.open(1);
      	    });
            $('#bankDialog2Button').click(function(event) {
      	    	  self.bankFrame.open(2);
      	    });
            $('#bankDialog3Button').click(function(event) {
      	    	  self.bankFrame.open(3);
      	    });


            this.closeButton = $('#bankDialogCloseButton');



            this.closeButton.click(function(event) {
                self.hide();
            });
        },

        setScale: function() {
          game.renderer.getUiScaleFactor();
        },

        rescale: function() {
        	this.setScale();
		      this.bankFrame.rescale(this.scale);
        },

        show: function() {
            this.rescale();
            this.bankFrame.open(this.bankFrame.page);
            this._super();
        },

        hide: function() {
            this._super();
        },

    });

    return BankDialog;
});
