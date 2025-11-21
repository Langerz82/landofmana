define(['./dialog', '../tabbook', '../tabpage', '../entity/item', 'data/items', 'data/itemlootdata', '../inventorystore'],
  function(Dialog, TabBook, TabPage, Item, Items, ItemLoot, InventoryStore) {
    var BankSlot = Class.extend({
        init: function(parent, index) {
            this.parent = parent;
            this.index = index;
            this.item = null;

            var jqParent = $("#bankDialogBank");
            data = "<div id=\"bankDialogBank{0}Background\" class=\"bankItemBackground\"><div id=\"bankDialogBank{0}Body\" class=\"bankItem\"></div></div>".format(index);

            jqParent.append(data);

            var name = '#bankDialogBank' + this.index;
            this.background = $(name + 'Background');
            this.body = $(name + 'Body');

            var top = (60 * ~~(index/parent.itemsPerRow));
            var left = (60*(index % parent.itemsPerRow));

            this.background.css({
              "top": top+"px",
              "left": left+"px"
            });

            this.rescale();
            var self = this;

            this.background.data('itemSlot',this.index);

            this.body.data('itemSlot',this.index);

            this.body.attr('draggable', true);
            this.body.draggable = true;

            var getRealSlot = function (slot) {
              return slot + (self.parent.page * self.parent.pageItems);
            }
            var moveItem = function (type, slot, start) {
              start = start || false;
              if (start && DragBank === null) {
                DragBank = {};
                DragBank.type = type;
                DragBank.slot = slot;
                DragBank.item = self.item;
                return;
              }
              if (!start && DragBank !== null) {
                var slot2 = slot >= 0 ? getRealSlot(slot) : slot;
                var count = (DragBank.item) ? DragBank.item.itemNumber : 1;
                game.client.sendItemSlot([1, DragBank.type, getRealSlot(DragBank.slot), count, type, slot2]);
                DragBank = null;
                self.parent.deselectItem();
              }
            };

            this.body.off().on('click', function(event) {
            });

            this.background.off().on('click', function(event) {
                var slot = $(this).data("itemSlot");
                if (DragBank === null) {
                  if (self.item === null)
                    return;
                  self.parent.selectBankItem(this);
                  moveItem(1, slot, true);
  								event.stopPropagation();
                }
                else {
                  if (DragBank.slot === slot)
                    moveItem(0, -1);
                  else
                    moveItem(1, slot);
                }
								event.stopPropagation();
            });

            this.body.on('dragstart', function(event) {
              var slot = $(this).data("itemSlot");
              if (DragBank === null) {
                if (self.item === null)
                  return;                
                self.parent.selectBankItem(this);
                moveItem(1, slot, true);
                event.stopPropagation();
              }
            });

            this.body.on('dragover', function(event) {
              event.preventDefault();
            });
						this.background.on('dragover', function(event) {
              event.preventDefault();
            });

            this.background.on('drop', function(event) {
              if (DragBank) {
                if ($(this).data("itemSlot") === DragBank.slot)
                  return;

                moveItem(1, $(this).data("itemSlot"));
              }
            });
        },

        rescale: function() {
            this.scale = game.renderer.guiScale;
            if (this.scale === 1)
            {
              this.background.css({
          			'position': 'absolute',
          			'left': '' + (0 + Math.floor(this.index % 6) * 18) + 'px',
          			'top': '' + (0 + Math.floor(this.index / 6) * 18) + 'px'
      		    });
            }
            else if (this.scale === 2)
            {
              this.background.css({
          			'position': 'absolute',
          			'left': '' + (0 + Math.floor(this.index % 6) * 50) + 'px',
          			'top': '' + (0 + Math.floor(this.index / 6) * 50) + 'px'
      		    });
            }
            else if (this.scale === 3)
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
						this.body.css('display', 'none');
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
            this.pageItems = 96;
            this.itemsPerRow = 6;

            var self = this;
            this.selectBankItem = function(jq) {
              if (!(game && game.ready))
                return;

              var slot = $(jq).data("itemSlot");
              var itemNumber = $(jq).data("itemNumber");
              log.info("selectInventory - click, slot:"+slot);

              //var realslot = slot + (self.page * self.pageItems);
              var item = game.bankHandler.banks[slot];
              //var item = this.getItem(slot);

              //log.info("slot=" + slot);
              //log.info("inventories " + JSON.stringify(self.inventory));
              if (item) {
                if (self.selectedItem !== slot) {
                  if (self.selectedItem != null)
                    self.deselectItem();
                  self.selectItem(slot, true);
                  return;
                }
                else {
                  self.select(slot, itemNumber);
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
      	    	game.app.showDropDialog("inventorygold");
      	    });
        },

        rescale: function(scale) {
            for(var index = 0; index < this.bankslots.length; index++) {
                this.bankslots[index].rescale();
            }
        },

        getItem: function (slot) {
            return game.bankHandler.banks[slot];
        },

        getInventory: function(index) {
            return this.bankslots[index];
        },

        open: function(page) {
            this.page = page;
            game.bankHandler.pageIndex = page;

            for(var index = 0; index < this.pageItems; index++) {
                this.bankslots[index].release();
            }

            if(game && game.ready) {
                for(var bankNumber = 0; bankNumber < this.pageItems; bankNumber++) {
                    var item = game.bankHandler.banks[bankNumber];
                    if(item) {
                        this.bankslots[bankNumber].assign(item);
                    }
                }
            }
        },

        select: function(slot, itemCount = 1) {
            if (!game.inventory.isInventoryFull())
            {
                game.client.sendItemSlot([1, 1, slot, itemCount, 0, -1]);
                this.bankslots[slot].release();
            }
        },

        deselectItem: function() {
          if (this.selectedItem === null || this.selectedItem === -1)
            return;
          this.selectItem(this.selectedItem, false);
        },

        selectItem: function(slot, select) {
          //pageslot = realslot % this.pageItems;
          //var str = '#bankDialogBank'+pageslot+'Background';
          if (slot < 0)
            return;

          var background = this.bankslots[slot].background;

          if (select) {
            var s = game.renderer.getUiScaleFactor();
            this.selectedItem = slot;
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
              game.inventoryDialog.showInventory();
              game.inventoryDialog.backPage = self;
              self.hide();
            });

            $('#bankGoldFrame').click(function(event) {
      	    	game.app.showDropDialog("inventorygold");
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
