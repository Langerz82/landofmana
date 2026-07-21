// Extracted from appearancedialog.js: AppearancePage (the per-category-type store page)
// and AppearanceArmorPage (the one concrete page currently wired up; a commented-out
// AppearanceWeaponPage sibling is preserved below as dead code, unchanged from before).
import TabPage from '../../tabpage.js';
import AppearanceData from '../../data/appearancedata.js';
import StoreRack from './appearancerack.js';
/* global game */

export class AppearancePage extends TabPage {
        constructor(parent, id, itemType, scale, buttonIndex) {
            super(parent, id + 'Page', id + buttonIndex + 'Button'); // FIX (conversion): this._super(...) -> super(...)
            this.itemType = itemType;
            this.racks = [];
            this.items = [];
            this.scale = scale;
            this.rackSize = 5;
            this.pageIndex = 0;

            for(let index = 0; index < this.rackSize; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        }

        rescale(scale) {
            this.scale = scale;
            for(let index = 0; index < this.rackSize; index++) {
                this.racks[index].rescale();
            }
        }

        getPageCount() {
            if (this.items)
            	    return Math.ceil(this.items.length / this.rackSize);
            return 0;
        }
        getPageIndex() {
            return this.pageIndex;
        }

        setPageIndex(value) {
            this.pageIndex = value;
            this.onData();
        }

        open() {
            this.setPageIndex(0);
        }

        onData() {
            this.items = [];
            let categoryType;
            if (!game || !game.player || !game.player.appearances)
              return;

            if (this.itemType===0)
                categoryType="armor";
            if (this.itemType===1)
                categoryType="weapon";

    		    if (game.player.isArcher())
    		    {
              if (this.itemType===0)
        			    categoryType="armorarcher";
        			if (this.itemType===1)
        			    categoryType="weaponarcher";
        		}

    		    for(let k=0; k < AppearanceData.length; ++k) {
        			const item = AppearanceData[k];
        			if (!item)
        			    continue;

        			if (item.type === categoryType && game.player.appearances[k] === 0 && item.buy > 0)
        			{
      				    this.items.push({
          					index: k,
          					name: item.name,
          					sprite: item.sprite,
          					buyPrice: item.buy});
        			}
    		    }

      	    this.reload();
      	    this.parent.updateNavigator();
            this.parent.parent.showStore(true);
            if (this.parent.getPageIndex() !== 0)
              this.parent.setPageIndex(0);
        }

        reload()
        {
            for(let index = this.pageIndex * this.rackSize; index < Math.min((this.pageIndex + 1) * this.rackSize, this.items.length); index++) {
                const rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
            for(let index = this.items.length; index < (this.pageIndex + 1) * this.rackSize; index++) {
                const rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.setVisible(false);
            }
        }
}

export class AppearanceArmorPage extends AppearancePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 0, scale, 0); // FIX (conversion): this._super(...) -> super(...)
        }
}

/*var AppearanceWeaponPage = AppearancePage.extend({
    init: function(parent, scale) {
        this._super(parent, '#storeDialogStore', 1, scale, 1);
    }
});*/
