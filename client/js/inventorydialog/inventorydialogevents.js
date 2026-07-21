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
        for (let i = 0; i < max; i++) {
            $('#equipment' + i).attr('draggable', true);
            $('#equipment' + i).draggable = true;

            $('#equipment' + i).data('itemType', 2);
            $('#equipment' + i).data('itemSlot', i);

            $('#equipBackground' + i).data('itemType', 2);
            $('#equipBackground' + i).data('itemSlot', i);

            $('#equipment' + i).on('click', function (event) {});

            $('#equipBackground' + i).on('click', function (event) {
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

            $('#equipment' + i).on('dragstart', function (event) {
                const slot = $(this).data('itemSlot');
                self.selectEquipment(event, 2, slot);
            });

            $('#equipment' + i).on('dragover', function (event) {
                event.preventDefault();
            });
            $('#equipBackground' + i).on('dragover', function (event) {
                event.preventDefault();
            });

            $('#equipBackground' + i).on('drop', function (event) {
                if (DragItem) {
                    if ($(this).data('itemSlot') === DragItem.slot) return;

                    self.handler.moveItem(2, $(this).data('itemSlot'));
                    self.deselectItem();
                }
            });
        }

        for (let i = 0; i < this.maxInventoryNumber; i++) {
            $('#inventoryitem' + i).attr('draggable', true);
            $('#inventoryitem' + i).draggable = true;

            $('#inventoryitem' + i).data('itemType', 0);
            $('#inventoryitem' + i).data('itemSlot', i);
            $('#inventoryitembackground' + i).data('itemType', 0);
            $('#inventoryitembackground' + i).data('itemSlot', i);

            $('#inventoryitembackground' + i).on('click', function (event) {
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

            $('#inventoryitem' + i).on('dragstart', function (event) {
                if (self.selectedItem < 0) {
                    self.selectInventory(this);
                    self.handler.moveItem(0, $(this).data('itemSlot'), true);
                    event.stopPropagation();
                }
            });

            $('#inventoryitembackground' + i).on('dragover', function (event) {
                event.preventDefault();
            });

            $('#inventoryitem' + i).on('dragover', function (event) {
                event.preventDefault();
            });

            $('#inventoryitembackground' + i).on('drop', function (event) {
                if (DragItem) {
                    if ($(this).data('itemSlot') === DragItem.slot) return;

                    self.handler.splitItem(0, $(this).data('itemSlot'));
                    self.deselectItem();
                }
            });
        }

        $('#game').on('dragover', function (event) {
            event.preventDefault();
        });

        $('#game').on('drop', function (event) {
            game.app.setMouseCoordinates(event);

            const invCheck = DragItem && DragItem.slot >= 0;

            if (invCheck) {
                self.handler.dropItem(DragItem.slot);
                DragItem = null;
                self.deselectItem();
            }
        });

        this.sellButton = $('#invActionButton');
        this.sellButton.off().on('click', function (event) {
            const type = parseInt($(this).data('itemType'));
            const slot = parseInt($(this).data('itemSlot'));

            const item = self.getItem(type, slot);

            self.activateItem(type, slot, item, true);
            self.deselectItem();
        });

        $('.inventoryGoldFrame')
            .off()
            .on('click', function (event) {
                if (game.inventoryMode === InventoryMode.MODE_BANK) {
                    game.app.showDropDialog('bankgold');
                }
            });
    };
}
