// Extracted from storedialog.js: StorePage (a book page of purchasable-item racks) and its
// three concrete per-category subclasses (StorePotionPage/StoreArmorPage/StoreWeaponPage).
// Same split pattern used for dialog/appearancedialog.js.
import TabPage from '../../tabpage.js';
import StoreRack from './storerack.js';
/* global ItemTypes */

export class StorePage extends TabPage {
        constructor(parent, id, itemType, items, scale, buttonIndex) {
            super(parent, id + 'Page', id + buttonIndex + 'Button'); // FIX (conversion): this._super(...) -> super(...)
            this.itemType = itemType;
            this.racks = [];
            this.items = items;
            this.scale = scale;
            this.pageIndex = 0;

            this.parent = parent;
            this.rackRows = 5;

            for(let index = 0; index < this.rackRows; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        }

        rescale(scale) {
            this.scale = scale;
            for(let index = 0; index < this.rackRows; index++) {
                this.racks[index].rescale();
            }
        }

        getPageCount() {
            if (!this.items) return 0;
            log.info("this.items.length="+this.items.length);
            return Math.ceil(this.items.length / this.rackRows);
        }

        getPageIndex() {
            return this.pageIndex;
        }

        setPageIndex(value) {
            this.pageIndex = value;
            this.open(this.parent.minLevel,this.parent.maxLevel);
            this.reload();
        }

        open(min,max) {
            this.items = ItemTypes.Store.getItems(this.itemType, min, max);
            log.info(JSON.stringify(this.items));

            let cond = function (item) { return ItemTypes.isConsumableItem(item.kind); };
        		if (this.itemType===2)
                cond = function (item) { return ItemTypes.isArmor(item.kind); }
        		if (this.itemType===3)
                cond = function (item) { return ItemTypes.isWeapon(item.kind); }

            let i=this.items.length;
            while (--i >= 0)
            {
          	    const item = this.items[i];
          	    if (!cond(item))
          	    	this.items.splice(this.items.indexOf(item),1);
            }
        }

        reload() {
            this.clear();

            for(let index = this.pageIndex * this.rackRows; index < Math.min((this.pageIndex + 1) * this.rackRows, this.items.length); index++) {
                const rack = this.racks[index - (this.pageIndex * this.rackRows)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
        }

        clear() {
          for(let index = 0; index < this.rackRows; index++) {
              const rack = this.racks[index];
              rack.setVisible(false);
          }
        }

        close() {
          this.clear();
          this.setVisible(false);
        }
}

export class StorePotionPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 1,
            	    null, scale, 0); // FIX (conversion): this._super(...) -> super(...)
        }
}

export class StoreArmorPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 2,
            	    null, scale, 1); // FIX (conversion): this._super(...) -> super(...)
        }
}

export class StoreWeaponPage extends StorePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 3,
            	    null, scale, 2); // FIX (conversion): this._super(...) -> super(...)
        }
}
