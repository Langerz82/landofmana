// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: `DragBank` is a cross-file shared "global" (also read/written by main.js). It relies
// on js/globalstate.js having already run to seed `window.DragBank` under strict-mode ES
// modules - see the comment in globalstate.js for the full explanation.
import Dialog from './dialog.js';
import TabBook from '../tabbook.js';
import TabPage from '../tabpage.js';
/* global Types, ItemTypes */
import Item from '../entity/item.js';
import Items from '../data/items.js';
import ItemLoot from '../data/itemlootdata.js';
import InventoryStore from '../inventorystore.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

class BankSlot {
        constructor(parent, index) {
            this.parent = parent;
            this.index = index;
            this.item = null;

            const jqParent = $("#bankDialogBank");
            const data = "<div id=\"bankDialogBank{0}Background\" class=\"bankItemBackground\"><div id=\"bankDialogBank{0}Body\" class=\"bankItem\"></div></div>".format(index); // FIX: missing var, was leaking an implicit global

            jqParent.append(data);

            const name = '#bankDialogBank' + this.index;
            this.background = $(name + 'Background');
            this.body = $(name + 'Body');

            const top = (60 * ~~(index/parent.itemsPerRow));
            const left = (60*(index % parent.itemsPerRow));

            this.background.css({
              "top": top+"px",
              "left": left+"px"
            });

            this.rescale();
            const self = this;

            this.background.data('itemSlot',this.index);

            this.body.data('itemSlot',this.index);

            this.body.attr('draggable', true);
            this.body.draggable = true;

            const getRealSlot = function (slot) {
              return slot + (self.parent.page * self.parent.pageItems);
            }
            const moveItem = function (type, slot, start) {
              start = start || false;
              if (start && DragBank === null) {
                DragBank = {};
                DragBank.type = type;
                DragBank.slot = slot;
                DragBank.item = self.item;
                return;
              }
              if (!start && DragBank !== null) {
                const slot2 = slot >= 0 ? getRealSlot(slot) : slot;
                const count = (DragBank.item) ? DragBank.item.itemNumber : 1;
                game.client.sendItemSlot([1, DragBank.type, getRealSlot(DragBank.slot), count, type, slot2]);
                DragBank = null;
                self.parent.deselectItem();
              }
            };

            this.body.off().on('click', function(event) {
            });

            this.background.off().on('click', function(event) {
                const slot = $(this).data("itemSlot");
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
              const slot = $(this).data("itemSlot");
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
        }

        rescale() {
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
        }

        getIndex() {
            return this.index;
        }
        getItemKind() {
            return this.item.itemKind;
        }
        setItemName() {
            const kind = this.item.itemKind;
            if ( ItemTypes.isLootItem(kind))
              this.itemName = ItemLoot[kind-1000].name;
            else
      	      this.itemName = ItemTypes.KindData[kind].name;
        }
        getItemName() {
            return this.itemName;
        }
        getComment() {
            return Item.getInfoMsgEx(this.item);
        }

        assign(item) {
            this.item = item;
            const kind = item.itemKind;
            this.setItemName(kind);
            this.itemDurabilityPercent = item.itemDurability/item.itemDurabilityMax*100;
            this.body.data('itemNumber',this.item.itemNumber);
            this.background.data('itemNumber',this.item.itemNumber);

            this.restore();
        }
        clear() {
            this.item = null;
            this.release();
        }
        release() {
						this.body.css('display', 'none');
            this.body.css('background-image', '');
            this.body.html("");
            this.body.attr('title', '');
        }
        restore() {
            const kind = this.item.itemKind, itemKind = kind; // FIX: itemKind was an implicit global; declare it properly
            const scale = game.renderer.getIconScaleFactor();

            Items.jqShowItem(this.body, this.item, this.body);
        }
}

class BankFrame {
        constructor(parent) {
            this.parent = parent;
            this.bankslots = [];
            this.page = 0;

            this.pageItems = 96;
            this.itemsPerRow = 6;

            const self = this;
            this.selectBankItem = function(jq) {
              if (!(game && game.ready))
                return;

              const slot = $(jq).data("itemSlot");
              const itemNumber = $(jq).data("itemNumber");
              log.info("selectInventory - click, slot:"+slot);

              const item = game.bankHandler.banks[slot];

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

            for(let index = 0; index < this.pageItems; index++) {
                this.bankslots.push(new BankSlot(this, index));
            }

            this.goldNumber = $('.bankGold');

            this.selectedBank = null;
            this.selectedItem = null;

      	    $('#bankDialogBankGoldBody').click(function(event) {
      	    	game.app.showDropDialog("inventorygold");
      	    });
        }

        rescale(scale) {
            for(let index = 0; index < this.bankslots.length; index++) {
                this.bankslots[index].rescale();
            }
        }

        getItem(slot) {
            return game.bankHandler.banks[slot];
        }

        getInventory(index) {
            return this.bankslots[index];
        }

        open(page) {
            this.page = page;
            game.bankHandler.pageIndex = page;

            for(let index = 0; index < this.pageItems; index++) {
                this.bankslots[index].release();
            }

            if(game && game.ready) {
                for(let bankNumber = 0; bankNumber < this.pageItems; bankNumber++) {
                    const item = game.bankHandler.banks[bankNumber];
                    if(item) {
                        this.bankslots[bankNumber].assign(item);
                    }
                }
            }
        }

        select(slot, itemCount = 1) {
            if (!game.inventory.isInventoryFull())
            {
                game.client.sendItemSlot([1, 1, slot, itemCount, 0, -1]);
                this.bankslots[slot].release();
            }
        }

        deselectItem() {
          if (this.selectedItem === null || this.selectedItem === -1)
            return;
          this.selectItem(this.selectedItem, false);
        }

        selectItem(slot, select) {
          if (slot < 0)
            return;

          const background = this.bankslots[slot].background;

          if (select) {
            const s = game.renderer.getUiScaleFactor();
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
        }
}

export default class BankDialog extends Dialog {
        constructor(game) {
            super(game, '#bankDialog'); // FIX (conversion): this._super(game, '#bankDialog') -> super(game, '#bankDialog')
            this.scale=0;
            this.setScale();

            const self = this;

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
        }

        setScale() {
          this.scale = game.renderer.getUiScaleFactor(); // FIX: return value was never assigned to this.scale, unlike other dialogs
        }

        rescale() {
        	this.setScale();
		      this.bankFrame.rescale(this.scale);
        }

        show() {
            this.rescale();
            this.bankFrame.open(this.bankFrame.page);
            super.show(); // FIX (conversion): this._super() -> super.show()
        }

        hide() {
            super.hide(); // FIX (conversion): this._super() -> super.hide()
        }
}
