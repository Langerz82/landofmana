// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// FIX (maintainability): CraftDialog's supporting classes (StoreRack, StorePage/
// StoreMiscPage/StoreArmorPage/StoreWeaponPage, StoreFrame) are split across
// craftrack.js/craftpage.js/craftframe.js for readability - same pattern used for
// dialog/appearancedialog.js.
import Dialog from '../dialog.js';
import InventoryStore from '../../inventorystore.js';
import StoreFrame from './craftframe.js';

export default class CraftDialog extends Dialog {
    constructor(game) {
        super(game, '#craftDialog'); // FIX (conversion): this._super(game, '#craftDialog') -> super(game, '#craftDialog')
        this.setScale();

        this.craftFrame = new StoreFrame(this);

        this.sellButton = $('#craftDialogStore3Button');
        this.sellButton.hide();

        const self = this;

        $('#craftDialogStorePage').css('display', 'none');
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
        this.craftFrame.rescale();
    }

    show(min, max) {
        const self = this;

        $('#craftDialog .frameheadingtext').text('CRAFT');

        $('#craftDialogStore0Button').text('MISC');
        $('#craftDialogStore0Button').show();

        this.rescale();
        this.craftFrame.open(min, max);

        this.addClose();

        super.show(); // FIX (conversion): this._super() -> super.show()
        $('#craftDialogStore0Button').trigger('click');

        $('#storeDialogStore div.inventoryGoldFrame').show();
        $('#storeDialogStore div.inventoryGemsFrame').hide();
    }

    hide() {
        const activePage = this.craftFrame.getActivePage();
        if (activePage) {
            activePage.setVisible(false);
            activePage.close();
        }
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }
}
