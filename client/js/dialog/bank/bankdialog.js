// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// FIX (maintainability): this file used to declare three classes (BankSlot/BankFrame/
// BankDialog) together; split into sibling files (bankslot.js/bankframe.js), same pattern
// used for dialog/appearancedialog.js. This file now keeps only the BankDialog class itself.
import Dialog from '../dialog.js';
import TabBook from '../../tabbook.js';
import TabPage from '../../tabpage.js';
/* global Types, ItemTypes */
import InventoryStore from '../../inventorystore.js';
import BankFrame from './bankframe.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

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
