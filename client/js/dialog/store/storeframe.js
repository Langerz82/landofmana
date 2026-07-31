// Extracted from storedialog.js: StoreFrame (the tab-book holding the three store category
// pages plus their shared page navigator). Same split pattern used for
// dialog/appearancedialog.js.
import TabBook from '../../tabbook.js';
import PageNavigator from '../../pageNavigator.js';
import {
    StorePotionPage,
    StoreArmorPage,
    StoreWeaponPage
} from './storepage.js';

export default class StoreFrame extends TabBook {
    constructor(parent) {
        super('#storeDialogStore'); // FIX (conversion): this._super('#storeDialogStore') -> super('#storeDialogStore')

        this.parent = parent;
        this.scale = this.parent.scale;

        this.add(new StorePotionPage(this, this.scale));
        this.add(new StoreArmorPage(this, this.scale));
        this.add(new StoreWeaponPage(this, this.scale));

        this.pageNavigator = new PageNavigator(parent, parent.scale);
        this.pageNavigator.onChange(function (sender) {
            const activePage = self.getActivePage();
            if (activePage && game.storeDialog.visible) {
                log.info('self.parent.game.storeDialog.visible');
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
        if (!game.storeDialog.visible) {
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

        // FIX: unlike the near-identical craftframe.js's open(min, max), this never applied
        // the passed-in min/max to this.minLevel/this.maxLevel - setPageIndex() below (via
        // this.pages[value].open(this.minLevel, this.maxLevel)) always used whatever the
        // constructor set them to (1, 100), silently ignoring any different range a caller
        // asked for. Currently every real caller happens to pass (1, 100) too, so this had no
        // visible effect yet, but it's a live trap for a level-gated store.
        this.minLevel = min;
        this.maxLevel = max;

        this.setPageIndex(0);
        this.pages[0].setPageIndex(0);
    }
}
