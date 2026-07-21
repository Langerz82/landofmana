// Split out of dialog/bankdialog.js: the bank grid/page container (holds all BankSlot cells for
// the currently-open bank page), previously one of three classes (BankSlot/BankFrame/
// BankDialog) declared in that one file. Same split pattern used for dialog/appearancedialog.js
// (StoreRack/AppearancePage/StoreFrame/AppearanceDialog).
import BankSlot from './bankslot.js';

export default class BankFrame {
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
