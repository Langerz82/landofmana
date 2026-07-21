// Extracted from craftdialog.js: StoreFrame (the tab-book holding the three craft category
// pages plus their shared page navigator). Same split pattern used for
// dialog/appearancedialog.js.
import TabBook from '../../tabbook.js';
import PageNavigator from '../../pageNavigator.js';
import { StoreMiscPage, StoreArmorPage, StoreWeaponPage } from './craftpage.js';

export default class StoreFrame extends TabBook {
    constructor(parent) {
        super('#craftDialogStore'); // FIX (conversion): this._super('#craftDialogStore') -> super('#craftDialogStore')

        this.parent = parent;
        this.scale = this.parent.scale;

        this.add(new StoreMiscPage(this, this.scale));
        this.add(new StoreArmorPage(this, this.scale));
        this.add(new StoreWeaponPage(this, this.scale));

        this.pageNavigator = new PageNavigator(parent, parent.scale, 'craft');
        this.pageNavigator.onChange(function (sender) {
            const activePage = self.getActivePage();
            if (activePage && game.craftDialog.visible) {
                log.info('self.parent.game.craftDialog.visible');
                activePage.setPageIndex(sender.getIndex() - 1);
            }
        });

        // FIX (var cleanup): was `var self = this;` declared after the onChange callback
        // above that reads `self` - safe as const because the callback only actually runs
        // later (on a page-navigator change event), by which time this line has executed.
        const self = this;

        this.minLevel = 1;
        this.maxLevel = 100;
    }

    rescale() {
        this.scale = this.parent.scale;

        for (let page of this.pages) page.rescale(this.scale);

        this.pageNavigator.rescale(this.scale);
    }

    setPageIndex(value) {
        if (!game.craftDialog.visible) {
            return;
        }
        this.pages[value].open(this.minLevel, this.maxLevel);

        super.setPageIndex(value); // FIX (conversion): this._super(value) -> super.setPageIndex(value)

        const activePage = this.getActivePage();

        if (activePage) {
            if (activePage.getPageCount() > 1) {
                this.pageNavigator.setCount(activePage.getPageCount());
                this.pageNavigator.setIndex(activePage.getPageIndex() + 1);
                this.pageNavigator.open();
                this.pageNavigator.setVisible(true);
            } else {
                this.pageNavigator.setVisible(false);
            }
            activePage.reload();
        }
    }

    open(min, max) {
        const self = this;

        this.minLevel = min;
        this.maxLevel = max;

        //for(var index = 0; index < this.pages.length; index++) {
        //}

        this.setPageIndex(0);
        this.pages[0].setPageIndex(0);
    }
}
