// Extracted from auctiondialog.js: StoreFrame (the tab-book holding the three auction category
// pages plus their shared page navigator). Same split pattern used for
// dialog/appearancedialog.js.
import TabBook from '../../tabbook.js';
import PageNavigator from '../../pageNavigator.js';
import { MyAuctionPage, AuctionArmorPage, AuctionWeaponPage } from './auctionpage.js';
/* global game */

export default class StoreFrame extends TabBook {
        constructor(parent) {
            super('#storeDialogStore'); // FIX (conversion): this._super('#storeDialogStore') -> super('#storeDialogStore')

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new MyAuctionPage(parent, this.scale));
            this.add(new AuctionArmorPage(parent, this.scale));
            this.add(new AuctionWeaponPage(parent, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale);

            const self = this;

            this.pageNavigator.onChange(function(sender) {
                const activePage = self.getActivePage();
                if(activePage && game.auctionDialog.visible) {
                    log.info("activePage.setPageIndex("+(sender.getIndex()-1)+");");
                    activePage.setPageIndex(sender.getIndex()-1);
                }
            });
        }

        rescale() {
        	this.scale = this.parent.scale;

          for (let page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        }

        reload() {
          for (let page of this.pages)
            page.reload();
        }

        setPageIndex(page) {
            page = page || 0;

            if (!game.auctionDialog.visible)
            	    return;

            this.pages[page].sendOpen();

            super.setPageIndex(page); // FIX (conversion): this._super(page) -> super.setPageIndex(page)
        }

        updatePageNav(len) {
          const activePage = this.getActivePage();
          if(activePage) {
            if(activePage.getPageCount() > 1) {
                this.pageNavigator.setCount(activePage.getPageCount());
                this.pageNavigator.setIndex(activePage.getPageIndex()+1);
                this.pageNavigator.setVisible(true);
            } else {
                this.pageNavigator.setVisible(false);
            }
          }
        }

        open(val) {
          this.setPageIndex(val);
          this.pageNavigator.setVisible(false);
        }
}
