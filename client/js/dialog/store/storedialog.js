// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// FIX (maintainability): StoreDialog's supporting classes (StoreRack, StorePage/
// StorePotionPage/StoreArmorPage/StoreWeaponPage, StoreFrame) are split across
// storerack.js/storepage.js/storeframe.js for readability - same pattern used for
// dialog/appearancedialog.js.
import Dialog from '../dialog.js';
/* global Types */
import InventoryStore from '../../inventorystore.js';
import StoreFrame from './storeframe.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

export default class StoreDialog extends Dialog {
    constructor(game) {
        super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')
        this.setScale();

        this.storeFrame = new StoreFrame(this);

        this.jqSellButton = $('#storeDialogStore3Button');
        this.jqSellButton.show();

        // Cached once here and reused by show() below instead of re-querying the DOM
        // every time the dialog is shown.
        this.jqFrameHeadingDiv = $('#storeDialog .frameheading div');
        this.jqStore0Button = $('#storeDialogStore0Button');
        this.jqStoreButtons = $('#storeDialog .storebuttons');
        this.jqGoldFrame = $('#storeDialogStore div.inventoryGoldFrame');
        this.jqGemsFrame = $('#storeDialogStore div.inventoryGemsFrame');

        const self = this;
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
        this.storeFrame.rescale();
    }

    show(min, max) {
        const self = this;

        this.jqFrameHeadingDiv.text('SHOPS');

        this.jqStore0Button.text('CONSUME');
        this.jqStoreButtons.show();

        this.jqSellButton.text('SELL');
        this.jqSellButton.show();

        this.jqSellButton.off().on('click', function (event) {
            game.inventoryMode = InventoryMode.MODE_SELL;
            game.inventoryDialog.showInventory(true);
            game.inventoryDialog.backPage = self;
            self.hide();
        });

        this.rescale();
        this.storeFrame.open(min, max);

        this.addClose();

        super.show(); // FIX (conversion): this._super() -> super.show()
        this.jqStore0Button.trigger('click');

        this.jqGoldFrame.show();
        this.jqGemsFrame.hide();
    }

    hide() {
        const activePage = this.storeFrame.getActivePage();
        if (activePage) {
            activePage.close();
        }
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }
}
