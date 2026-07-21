// Extracted from appearancedialog.js: StoreFrame (the TabBook wrapping AppearanceArmorPage
// plus the shared PageNavigator).
import TabBook from '../../tabbook.js';
import PageNavigator from '../../pageNavigator.js';
import { AppearanceArmorPage } from './appearancepage.js';
/* global game */

export default class StoreFrame extends TabBook {
        constructor(parent) {
            super('#storeDialogStore'); // FIX (conversion): this._super('#storeDialogStore') -> super('#storeDialogStore')

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new AppearanceArmorPage(parent, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale);

            const self = this;

            this.pageNavigator.onChange(function(sender) {
                const activePage = self.getActivePage();
                if(activePage && game.appearanceDialog.visible) {
                     activePage.setPageIndex(sender.getIndex() - 1);
                }
            });
        }

        rescale() {
        	this.scale = this.parent.scale;
          for (let page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        }

        setPageIndex(value) {
            if (!this.parent.visible)
            	    return;

            super.setPageIndex(value); // FIX (conversion): this._super(value) -> super.setPageIndex(value)
            this.updateNavigator();
            const activePage = this.getActivePage();
            activePage.open();
        }

        updateNavigator() {
            const activePage = this.getActivePage();
            const pageNav = this.pageNavigator;
            if(activePage) {
                if(activePage.getPageCount() > 0) {
                    pageNav.setCount(activePage.getPageCount());
                    pageNav.setIndex(activePage.getPageIndex() + 1);
                    pageNav.setVisible(true);
                } else {
                    pageNav.setVisible(false);
                }
                activePage.reload();
            }
        }

        open() {
            game.client.sendAppearanceList();
            this.setPageIndex(0);
            this.getActivePage().active();
        }
}
