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

        this.jqSellButton = $('#craftDialogStore3Button');
        this.jqSellButton.hide();

        // Cached once here and reused by show() below instead of re-querying the DOM
        // every time the dialog is shown.
        this.jqFrameHeadingText = $('#craftDialog .frameheadingtext');
        this.jqStore0Button = $('#craftDialogStore0Button');
        this.jqGoldFrame = $('#storeDialogStore div.inventoryGoldFrame');
        this.jqGemsFrame = $('#storeDialogStore div.inventoryGemsFrame');

        const self = this;

        const jqCraftDialogStorePage = $('#craftDialogStorePage');
        jqCraftDialogStorePage.css('display', 'none');
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

        this.jqFrameHeadingText.text('CRAFT');

        this.jqStore0Button.text('MISC');
        this.jqStore0Button.show();

        this.rescale();
        this.craftFrame.open(min, max);

        this.addClose();

        super.show(); // FIX (conversion): this._super() -> super.show()
        this.jqStore0Button.trigger('click');

        this.jqGoldFrame.show();
        this.jqGemsFrame.hide();
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
