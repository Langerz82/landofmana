// Mixin extracted from inventorydialog.js: rendering/refreshing inventory slots:
// refreshInventory, refreshInventoryAll, makeEmptyInventory, makeEmptyInventoryAll, showItems.
// Applied onto InventoryDialog.prototype via install*(...) call in inventorydialog.js; not a standalone class.
/* global Types, ItemTypes */
import Items from '../data/items.js';
const InventoryMode = Types.InventoryMode;

export function installInventoryDialogDisplay(proto) {
    proto.refreshInventory = function (index) {
        index = index || -1;
        if (index > -1) {
            const item = this.getItem(0, index); // FIX: missing var, was leaking an implicit global
            if (item) this.showItems(index);
            else {
                this.makeEmptyInventory(index);
            }
            return;
        }
        this.refreshInventoryAll();
    };

    proto.refreshInventoryAll = function () {
        this.makeEmptyInventoryAll();
        this.showItems(0, this.maxInventoryNumber);
        this.funcCooldown();
    };

    proto.makeEmptyInventory = function (i) {
        const cooltime = this.jqInventoryHighlights[i];
        cooltime.css({
            'background-color': 'transparent'
        });

        const jqItem = this.jqInventoryItems[i];
        jqItem.css({
            display: 'none',
            'background-image': 'none'
        });
        jqItem.attr('title', '');
        jqItem.html('');
        this.jqSlots[i].html('');
    };

    proto.makeEmptyInventoryAll = function () {
        for (let i = 0; i < this.maxInventoryNumber; i++) {
            this.makeEmptyInventory(i);
        }
    };

    proto.showItems = function (slotStart, slotEnd) {
        slotStart = slotStart || 0;
        slotEnd = slotEnd || slotStart + 1;

        // TODO - Work out why not emptying item shortcuts.
        for (let slot = slotStart; slot < slotEnd; ++slot) {
            const item = this.getItem(0, slot);
            if (!item) {
                this.makeEmptyInventory(slot);
                continue;
            }

            const itemKind = item.itemKind;

            if (itemKind > 0) {
                const jq = this.jqInventoryItems[slot];
                Items.jqShowItem(jq, item, jq);
            }

            const highlight = this.jqInventoryHighlights[slot];

            if (
                game.inventoryMode === InventoryMode.MODE_SELL ||
                game.inventoryMode === InventoryMode.MODE_AUCTION
            ) {
                if (ItemTypes.isEquippable(itemKind)) {
                    highlight.css({
                        'background-color': 'transparent'
                    });
                } else {
                    highlight.css({
                        'background-color': '#00000077'
                    });
                }
            } else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
                if (
                    ItemTypes.isEquippable(itemKind) &&
                    item.itemDurability !== item.itemDurabilityMax
                ) {
                    highlight.css({
                        'background-color': 'transparent'
                    });
                } else {
                    highlight.css({
                        'background-color': '#00000077'
                    });
                }
            } else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
                if (ItemTypes.isEquippable(itemKind)) {
                    highlight.css({
                        'background-color': 'transparent'
                    });
                } else {
                    highlight.css({
                        'background-color': '#00000077'
                    });
                }
            } else {
                if (!highlight.data('cooltime')) {
                    highlight.css({
                        'background-color': 'transparent'
                    });
                }
            }
        }
    };
}
