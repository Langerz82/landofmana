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

        this.sellButton = $('#storeDialogStore3Button');
        this.sellButton.show();

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

        $('#storeDialog .frameheading div').text('SHOPS');

        $('#storeDialogStore0Button').text('CONSUME');
        $('#storeDialog .storebuttons').show();

        this.sellButton.text('SELL');
        this.sellButton.show();

        this.sellButton.off().on('click', function (event) {
            game.inventoryMode = InventoryMode.MODE_SELL;
            game.inventoryDialog.showInventory(true);
            game.inventoryDialog.backPage = self;
            self.hide();
        });

        this.rescale();
        this.storeFrame.open(min, max);

        this.addClose();

        super.show(); // FIX (conversion): this._super() -> super.show()
        $('#storeDialogStore0Button').trigger('click');

        $('#storeDialogStore div.inventoryGoldFrame').show();
        $('#storeDialogStore div.inventoryGemsFrame').hide();
    }

    hide() {
        const activePage = this.storeFrame.getActivePage();
        if (activePage) {
            activePage.close();
        }
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }
}
