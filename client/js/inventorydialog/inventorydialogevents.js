// Mixin extracted from inventorydialog.js: wiring up jQuery click/dragstart/dragover/drop
// handlers for equipment and inventory slots: loadInventoryEvents.
// Applied onto InventoryDialog.prototype via install*(...) call in inventorydialog.js; not a standalone class.
// NOTE: `DragItem` is a cross-file shared "global"; see inventorydialog.js header comment.
/* global Types */
const InventoryMode = Types.InventoryMode;

export function installInventoryDialogEvents(proto) {
    proto.loadInventoryEvents = function () {
        const self = this;

        const max = game.equipment.maxNumber;
        // Cache-on-first-use: these can't be cached in InventoryDialog's constructor
        // because `game.equipment` doesn't exist yet at that point (see the
        // jqEquipmentSlots/jqEquipmentBackgrounds comment in inventorydialog.js).
        // loadInventoryEvents() only runs once ($(document).ready, from main.js), so
        // populating the arrays here is equivalent to constructor-time caching.
        self.jqEquipmentSlots = [];
        self.jqEquipmentBackgrounds = [];
        for (let i = 0; i < max; i++) {
            const jqEquipment = $('#equipment' + i);
            const jqEquipBackground = $('#equipBackground' + i);
            self.jqEquipmentSlots[i] = jqEquipment;
            self.jqEquipmentBackgrounds[i] = jqEquipBackground;

            jqEquipment.attr('draggable', true);
            jqEquipment.draggable = true;

            jqEquipment.data('itemType', 2);
            jqEquipment.data('itemSlot', i);

            jqEquipBackground.data('itemType', 2);
            jqEquipBackground.data('itemSlot', i);

            jqEquipment.on('click', function (event) {});

            jqEquipBackground.on('click', function (event) {
                const type = $(this).data('itemType');
                const slot = $(this).data('itemSlot');

                if (self.selectedItem < 0) {
                    self.selectEquipment(event, type, slot);
                } else {
                    const dragItem = DragItem
                        ? self.getItem(DragItem.type, DragItem.slot)
                        : null;
                    const item = self.getItem(type, slot);

                    if (dragItem && item) {
                        if (dragItem === item) {
                            self.activateItem(type, slot, item);
                        } else self.handler.moveItem(type, slot);
                    } else if (dragItem) {
                        self.handler.useItem(DragItem.type, dragItem);
                    } else if (item) {
                        self.handler.useItem(type, item);
                    }
                    self.deselectItem();
                }
                event.stopPropagation();
            });

            jqEquipment.on('dragstart', function (event) {
                const slot = $(this).data('itemSlot');
                self.selectEquipment(event, 2, slot);
            });

            jqEquipment.on('dragover', function (event) {
                event.preventDefault();
            });
            jqEquipBackground.on('dragover', function (event) {
                event.preventDefault();
            });

            jqEquipBackground.on('drop', function (event) {
                if (DragItem) {
                    if ($(this).data('itemSlot') === DragItem.slot) return;

                    self.handler.moveItem(2, $(this).data('itemSlot'));
                    self.deselectItem();
                }
            });
        }

        for (let i = 0; i < this.maxInventoryNumber; i++) {
            const jqInventoryItem = self.jqInventoryItems[i];
            const jqInventoryItemBackground = self.jqInventoryItemBackgrounds[i];

            jqInventoryItem.attr('draggable', true);
            jqInventoryItem.draggable = true;

            jqInventoryItem.data('itemType', 0);
            jqInventoryItem.data('itemSlot', i);
            jqInventoryItemBackground.data('itemType', 0);
            jqInventoryItemBackground.data('itemSlot', i);

            jqInventoryItemBackground.on('click', function (event) {
                const type = $(this).data('itemType');
                const slot = $(this).data('itemSlot');

                if (self.selectedItem >= 0) {
                    const dragItem = DragItem
                        ? self.getItem(DragItem.type, DragItem.slot)
                        : null;
                    const item = self.getItem(type, slot);
                    if (dragItem && item) {
                        if (dragItem === item) {
                            self.activateItem(type, slot, item);
                        } else {
                            self.handler.moveItem(type, slot);
                        }
                    } else if (dragItem || item) {
                        self.handler.splitItem(type, slot);
                    }
                    self.deselectItem();
                } else {
                    self.selectInventory(this);
                    self.handler.moveItem(0, slot, true);
                }
                event.stopPropagation();
            });

            jqInventoryItem.on('dragstart', function (event) {
                if (self.selectedItem < 0) {
                    self.selectInventory(this);
                    self.handler.moveItem(0, $(this).data('itemSlot'), true);
                    event.stopPropagation();
                }
            });

            jqInventoryItemBackground.on('dragover', function (event) {
                event.preventDefault();
            });

            jqInventoryItem.on('dragover', function (event) {
                event.preventDefault();
            });

            jqInventoryItemBackground.on('drop', function (event) {
                if (DragItem) {
                    if ($(this).data('itemSlot') === DragItem.slot) return;

                    self.handler.splitItem(0, $(this).data('itemSlot'));
                    self.deselectItem();
                }
            });
        }

        const jqGame = $('#game');
        jqGame.on('dragover', function (event) {
            event.preventDefault();
        });

        jqGame.on('drop', function (event) {
            game.app.setMouseCoordinates(event);

            const invCheck = DragItem && DragItem.slot >= 0;

            if (invCheck) {
                self.handler.dropItem(DragItem.slot);
                DragItem = null;
                self.deselectItem();
            }
        });

        // NOTE: was previously re-fetched into this.sellButton, duplicating the
        // already-cached this.jqActionButton ($('#invActionButton')) from the
        // InventoryDialog constructor; reuse the cached reference instead.
        this.jqActionButton.off().on('click', function (event) {
            const type = parseInt($(this).data('itemType'));
            const slot = parseInt($(this).data('itemSlot'));

            const item = self.getItem(type, slot);

            self.activateItem(type, slot, item, true);
            self.deselectItem();
        });

        const jqInventoryGoldFrame = $('.inventoryGoldFrame');
        jqInventoryGoldFrame.off().on('click', function (event) {
            if (game.inventoryMode === InventoryMode.MODE_BANK) {
                game.app.showDropDialog('bankgold');
            }
        });
    };
}
