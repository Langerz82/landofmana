// Extracted from auctiondialog.js: AuctionStorePage (a book page of auction listing racks) and
// its three concrete per-category subclasses (MyAuctionPage/AuctionArmorPage/
// AuctionWeaponPage). Same split pattern used for dialog/appearancedialog.js.
import TabPage from '../../tabpage.js';
import StoreRack from './auctionrack.js';
/* global ItemTypes, game */

export class AuctionStorePage extends TabPage {
    constructor(parent, id, itemType, items, scale, buttonIndex) {
        super(parent, id + 'Page', id + buttonIndex + 'Button'); // FIX (conversion): this._super(...) -> super(...)
        this.itemType = itemType;
        this.racks = [];
        this.items = items;
        this.scale = scale;
        this.rackSize = 5;

        for (let index = 0; index < this.rackSize; index++) {
            this.racks.push(new StoreRack(this, id + index, index));
        }
    }

    rescale(scale) {
        this.scale = scale;
        for (let index = 0; index < this.rackSize; index++) {
            this.racks[index].rescale();
        }
    }

    getPageCount() {
        if (this.items) return Math.ceil(this.items.length / this.rackSize);
        return 0;
    }

    getPageIndex() {
        return this.pageIndex;
    }

    setPageIndex(value) {
        log.info('setPageIndex: ' + value);
        this.pageIndex = value;
        this.reload();
    }

    sendOpen() {
        game.client.sendAuctionOpen(this.itemType);
    }

    reload() {
        for (let rack of this.racks) rack.clear();

        this.close();

        if (!this.items || this.items.length === 0) return;

        log.info('reload - this.pageIndex: ' + this.pageIndex);
        for (
            let index = this.pageIndex * this.rackSize;
            index <
            Math.min((this.pageIndex + 1) * this.rackSize, this.items.length);
            index++
        ) {
            const rack = this.racks[index - this.pageIndex * this.rackSize];

            rack.assign(this.items[index]);
            rack.setVisible(true);
        }
        this.parent.updatePageNav();
    }

    close() {
        for (let index = 0; index < this.rackSize; index++) {
            this.racks[index].setVisible(false);
        }
    }

    setItems(itemData) {
        this.items = [];
        if (!itemData) this.close();

        for (let k in itemData) {
            const item = itemData[k];
            const kind = item.item.itemKind;
            this.items.push({
                index: item.index,
                name: ItemTypes.KindData[kind].name,
                kind: kind,
                itemKind: kind,
                player: item.player,
                buyPrice: item.buy,
                item: item.item,
                rank: ItemTypes.KindData[kind].modifier
            });
        }

        if (this.items.length > 0) {
            this.items.sort(function (a, b) {
                return (
                    a.rank - b.rank ||
                    a.kind - b.kind ||
                    a.itemCount - b.itemCount ||
                    a.buyPrice - b.buyPrice
                );
            });

            if (this.itemType > 0) {
                // Find the Cheapest Item for that kind only.
                for (let i = this.items.length - 1; i > 0; --i) {
                    const item = this.items[i];
                    const prevItem = this.items[i - 1];

                    if (
                        item.kind === prevItem.kind &&
                        item.itemCount === prevItem.itemCount &&
                        item.itemSkillKind === prevItem.itemSkillKind &&
                        item.itemSkillLevel === prevItem.itemSkillLevel
                    ) {
                        this.items.splice(i, 1);
                    }
                }
            }
        }
    }
}

export class MyAuctionPage extends AuctionStorePage {
    constructor(parent, scale) {
        super(parent, '#storeDialogStore', 0, [], scale, 0); // FIX (conversion): this._super(...) -> super(...)
    }
}
export class AuctionArmorPage extends AuctionStorePage {
    constructor(parent, scale) {
        super(parent, '#storeDialogStore', 1, [], scale, 1); // FIX (conversion): this._super(...) -> super(...)
    }
}
export class AuctionWeaponPage extends AuctionStorePage {
    constructor(parent, scale) {
        super(parent, '#storeDialogStore', 2, [], scale, 2); // FIX (conversion): this._super(...) -> super(...)
    }
}
