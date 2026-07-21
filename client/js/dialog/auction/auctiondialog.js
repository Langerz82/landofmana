// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// FIX (maintainability): AuctionDialog's supporting classes (StoreRack, AuctionStorePage/
// MyAuctionPage/AuctionArmorPage/AuctionWeaponPage, StoreFrame) are split across
// auctionrack.js/auctionpage.js/auctionframe.js for readability - same pattern used for
// dialog/appearancedialog.js.
import Dialog from '../dialog.js';
/* global Types */
import InventoryStore from '../../inventorystore.js';
import StoreFrame from './auctionframe.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

export default class AuctionDialog extends Dialog {
    constructor(game) {
        super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')
        this.setScale();

        this.storeFrame = new StoreFrame(this);

        this.modal = $('#storeDialogModal');

        this.addClose();
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
        this.storeFrame.rescale();
    }

    show() {
        const self = this;

        this.rescale();

        $('#storeDialog .frameheading div').text('AUCTION');

        $('#storeDialogStore0Button').text('LIST');
        $('#storeDialog .storebuttons').show();

        const store3btn = $('#storeDialogStore3Button');
        store3btn.text('SELL');
        store3btn.show();
        store3btn.off().on('click', function (event) {
            game.inventoryMode = InventoryMode.MODE_AUCTION;
            game.inventoryDialog.backPage = self;
            self.hide();
            game.inventoryDialog.toggleInventory();
        });

        this.storeFrame.open(0);

        super.show(); // FIX (conversion): this._super() -> super.show()
        $('#storeDialogStore0Button').trigger('click');

        $('#storeDialogStore div.inventoryGoldFrame').show();
        $('#storeDialogStore div.inventoryGemsFrame').hide();
    }

    hide() {
        const activePage = this.storeFrame.getActivePage();
        if (activePage) {
            activePage.close();
            activePage.setVisible(false);
        }
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }
}
