// Split out of dialog/bankdialog.js: a single bank-grid slot (one item cell), previously one of
// three classes (BankSlot/BankFrame/BankDialog) declared in that one file. Same split pattern
// used for dialog/appearancedialog.js (StoreRack/AppearancePage/StoreFrame/AppearanceDialog).
// NOTE: `DragBank` is a cross-file shared "global" (also read/written by main.js). It relies
// on js/globalstate.js having already run to seed `window.DragBank` under strict-mode ES
// modules - see the comment in globalstate.js for the full explanation.
/* global Types, ItemTypes */
import Item from '../../entity/item.js';
import Items from '../../data/items.js';
import ItemLoot from '../../data/itemlootdata.js';

export default class BankSlot {
    constructor(parent, index) {
        this.parent = parent;
        this.index = index;
        this.item = null;

        const jqParent = $('#bankDialogBank');
        const data =
            '<div id="bankDialogBank{0}Background" class="bankItemBackground"><div id="bankDialogBank{0}Body" class="bankItem"></div></div>'.format(
                index
            ); // FIX: missing var, was leaking an implicit global

        jqParent.append(data);

        const name = '#bankDialogBank' + this.index;
        this.jqBackground = $(name + 'Background');
        this.jqBody = $(name + 'Body');

        const top = 60 * ~~(index / parent.itemsPerRow);
        const left = 60 * (index % parent.itemsPerRow);

        this.jqBackground.css({
            top: top + 'px',
            left: left + 'px'
        });

        this.rescale();
        const self = this;

        this.jqBackground.data('itemSlot', this.index);

        this.jqBody.data('itemSlot', this.index);

        this.jqBody.attr('draggable', true);
        this.jqBody.draggable = true;

        const getRealSlot = function (slot) {
            return slot + self.parent.page * self.parent.pageItems;
        };
        const moveItem = function (type, slot, start) {
            start = start || false;
            if (start && DragBank === null) {
                DragBank = {};
                DragBank.type = type;
                DragBank.slot = slot;
                DragBank.item = self.item;
                return;
            }
            if (!start && DragBank !== null) {
                const slot2 = slot >= 0 ? getRealSlot(slot) : slot;
                const count = DragBank.item ? DragBank.item.itemNumber : 1;
                game.client.sendItemSlot([
                    1,
                    DragBank.type,
                    getRealSlot(DragBank.slot),
                    count,
                    type,
                    slot2
                ]);
                DragBank = null;
                self.parent.deselectItem();
            }
        };

        this.jqBody.off().on('click', function (event) {});

        this.jqBackground.off().on('click', function (event) {
            const slot = $(this).data('itemSlot');
            if (DragBank === null) {
                if (self.item === null) return;
                self.parent.selectBankItem(this);
                moveItem(1, slot, true);
                event.stopPropagation();
            } else {
                if (DragBank.slot === slot) moveItem(0, -1);
                else moveItem(1, slot);
            }
            event.stopPropagation();
        });

        this.jqBody.on('dragstart', function (event) {
            const slot = $(this).data('itemSlot');
            if (DragBank === null) {
                if (self.item === null) return;
                self.parent.selectBankItem(this);
                moveItem(1, slot, true);
                event.stopPropagation();
            }
        });

        this.jqBody.on('dragover', function (event) {
            event.preventDefault();
        });
        this.jqBackground.on('dragover', function (event) {
            event.preventDefault();
        });

        this.jqBackground.on('drop', function (event) {
            if (DragBank) {
                if ($(this).data('itemSlot') === DragBank.slot) return;

                moveItem(1, $(this).data('itemSlot'));
            }
        });
    }

    rescale() {
        this.scale = game.renderer.guiScale;
        if (this.scale === 1) {
            this.jqBackground.css({
                position: 'absolute',
                left: '' + (0 + Math.floor(this.index % 6) * 18) + 'px',
                top: '' + (0 + Math.floor(this.index / 6) * 18) + 'px'
            });
        } else if (this.scale === 2) {
            this.jqBackground.css({
                position: 'absolute',
                left: '' + (0 + Math.floor(this.index % 6) * 50) + 'px',
                top: '' + (0 + Math.floor(this.index / 6) * 50) + 'px'
            });
        } else if (this.scale === 3) {
            this.jqBackground.css({
                position: 'absolute',
                left: '' + (0 + Math.floor(this.index % 6) * 60) + 'px',
                top: '' + (0 + Math.floor(this.index / 6) * 60) + 'px'
            });
        }
        if (this.item) {
            this.restore();
        }
    }

    getIndex() {
        return this.index;
    }
    getItemKind() {
        return this.item.itemKind;
    }
    setItemName() {
        const kind = this.item.itemKind;
        if (ItemTypes.isLootItem(kind))
            this.itemName = ItemLoot[kind - 1000].name;
        else this.itemName = ItemTypes.KindData[kind].name;
    }
    getItemName() {
        return this.itemName;
    }
    getComment() {
        return Item.getInfoMsgEx(this.item);
    }

    assign(item) {
        this.item = item;
        const kind = item.itemKind;
        this.setItemName(kind);
        this.itemDurabilityPercent =
            (item.itemDurability / item.itemDurabilityMax) * 100;
        this.jqBody.data('itemNumber', this.item.itemNumber);
        this.jqBackground.data('itemNumber', this.item.itemNumber);

        this.restore();
    }
    clear() {
        this.item = null;
        this.release();
    }
    release() {
        this.jqBody.css('display', 'none');
        this.jqBody.css('background-image', '');
        this.jqBody.html('');
        this.jqBody.attr('title', '');
    }
    restore() {
        const kind = this.item.itemKind,
            itemKind = kind; // FIX: itemKind was an implicit global; declare it properly
        const scale = game.renderer.getIconScaleFactor();

        Items.jqShowItem(this.jqBody, this.item, this.jqBody);
    }
}
