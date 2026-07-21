// Extracted from craftdialog.js: StorePage (a book page of craftable-item racks) and its three
// concrete per-category subclasses (StoreMiscPage/StoreArmorPage/StoreWeaponPage). Same split
// pattern used for dialog/appearancedialog.js.
import TabPage from '../../tabpage.js';
import StoreRack from './craftrack.js';
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

        for (let index = 0; index < this.rackRows; index++) {
            this.racks.push(new StoreRack(this, id + index, index));
        }
    }

    rescale(scale) {
        this.scale = scale;
        for (let index = 0; index < this.rackRows; index++) {
            this.racks[index].rescale();
        }
    }

    getPageCount() {
        if (!this.items) return 0;
        log.info('this.items.length=' + this.items.length);
        return Math.ceil(this.items.length / this.rackRows);
    }

    getPageIndex() {
        return this.pageIndex;
    }

    setPageIndex(value) {
        this.pageIndex = value;
        this.open(this.parent.minLevel, this.parent.maxLevel);
        this.reload();
    }

    open(min, max) {
        this.items = ItemTypes.Store.getItems(this.itemType, min, max);
        log.info(JSON.stringify(this.items));

        let cond = function (item) {
            return true;
        };
        if (this.itemType === 2)
            cond = function (item) {
                return ItemTypes.isArmor(item.kind);
            };
        if (this.itemType === 3)
            cond = function (item) {
                return ItemTypes.isWeapon(item.kind);
            };

        let i = this.items.length;
        while (--i >= 0) {
            const item = this.items[i];
            // FIX: the `item.craft.length === 0` check below was not an `else if`, so it
            // still ran even after the item was already spliced out by the `!cond(item)`
            // branch above. With `item` no longer in the array, `indexOf(item)` returned
            // -1 and `splice(-1, 1)` deleted the *last* element instead - an unrelated
            // craft item could silently vanish from the list. Made the checks mutually
            // exclusive so a filtered-out item is only spliced once.
            if (!cond(item)) {
                this.items.splice(this.items.indexOf(item), 1);
            } else if (item.craft.length === 0) {
                this.items.splice(this.items.indexOf(item), 1);
            } else if (item.craft.length === 1) {
                item.craft = item.craft[0];
            } else {
                for (let j = 0; j < item.craft.length; j++) {
                    // FIX: was Object.assign({}, item) immediately discarded by the next line
                    // reassigning newItem to item.craft[j] - the copy had zero effect
                    const newItem = item.craft[j];
                    this.items.push(newItem);
                }
            }
        }
        log.info('this.items=' + JSON.stringify(this.items));
        this.reload();
    }

    reload() {
        this.clear();

        const len = Math.min(
            (this.pageIndex + 1) * this.rackRows,
            this.items.length
        );
        for (let index = this.pageIndex * this.rackRows; index < len; index++) {
            const rack = this.racks[index - this.pageIndex * this.rackRows];

            rack.assign(this.items[index]);
            rack.setVisible(true);
        }
    }

    clear() {
        for (let index = 0; index < this.rackRows; index++) {
            const rack = this.racks[index];
            rack.setVisible(false);
        }
    }

    close() {
        this.clear();
        this.setVisible(false);
    }
}

export class StoreMiscPage extends StorePage {
    constructor(parent, scale) {
        super(parent, '#craftDialogStore', 4, null, scale, 0); // FIX (conversion): this._super(...) -> super(...)
    }
}

export class StoreArmorPage extends StorePage {
    constructor(parent, scale) {
        super(parent, '#craftDialogStore', 2, null, scale, 1); // FIX (conversion): this._super(...) -> super(...)
    }
}

export class StoreWeaponPage extends StorePage {
    constructor(parent, scale) {
        super(parent, '#craftDialogStore', 3, null, scale, 2); // FIX (conversion): this._super(...) -> super(...)
    }
}
