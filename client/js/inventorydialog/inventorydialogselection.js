// Mixin extracted from inventorydialog.js: item/equipment selection and activation:
// selectInventory, activateItem, selectEquipment, deselectItem, selectItem.
// Applied onto InventoryDialog.prototype via install*(...) call in inventorydialog.js; not a standalone class.
/* global Types, ItemTypes */
const InventoryMode = Types.InventoryMode;

export function installInventoryDialogSelection(proto) {
        proto.selectInventory = function(jq) {
          if (!game || !game.ready)
            return;

          const type = $(jq).data("itemType");
          const slot = $(jq).data("itemSlot");

          const item = this.getItem(type, slot);

          $('.inventorySellGold').html("0");
          if (item) {
            const kind = item.itemKind;
            if (game.inventoryMode === InventoryMode.MODE_ENCHANT ||
                game.inventoryMode === InventoryMode.MODE_REPAIR)
            {
              if (!ItemTypes.isEquipment(kind))
                return;
            }
            if (game.inventoryMode === InventoryMode.MODE_SELL ||
                game.inventoryMode === InventoryMode.MODE_AUCTION)
            {
              if (ItemTypes.isLootItem(kind))
                return;
            }
          }
          if (item && this.selectedItem !== slot) {
              $('.inventorySellGoldFrame').show();
              this.selectItem(type, this.selectedItem, false);
              this.selectItem(type, slot, true);
              this.jqActionButton.data('itemType', type);
              this.jqActionButton.data('itemSlot', slot);
              this.jqActionButton.show();

              const kind = item.itemKind;
              if (game.inventoryMode === InventoryMode.MODE_AUCTION) {
                const value = ~~(ItemTypes.getEnchantSellPrice(item)/2);
                $('.inventorySellGold').html(parseInt(value));
              }
              else if (game.inventoryMode === InventoryMode.MODE_SELL) {
                $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantSellPrice(item)));
              }
              else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
                $('.inventorySellGold').html(parseInt(ItemTypes.getRepairPrice(item)));
              }
              else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
                $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantPrice(item)));
              }
              else if (game.inventoryMode === InventoryMode.MODE_BANK) {
                $('.inventorySellGoldFrame').hide();
              }
              else if (game.inventoryMode === InventoryMode.MODE_NORMAL) {
                $('.inventorySellGoldFrame').hide();
              }
              return;
          }

          if (item && this.selectedItem === slot) {
            let triggerClick = false;
            if (game.inventoryMode === InventoryMode.MODE_AUCTION ||
                game.inventoryMode === InventoryMode.MODE_SELL ||
                game.inventoryMode === InventoryMode.MODE_REPAIR ||
                game.inventoryMode === InventoryMode.MODE_ENCHANT ||
                game.inventoryMode === InventoryMode.MODE_BANK)
            {
              triggerClick = true;
            }
            if (triggerClick) {
              this.jqActionButton.data('itemType', type);
              this.jqActionButton.data('itemSlot', slot);
              this.jqActionButton.trigger("click");
            }
            this.deselectItem();
          }
        };

        proto.activateItem = function(type, slot, item, btnPressed) {
          if (item) {
            const kind = item.itemKind;
            if (game.inventoryMode === InventoryMode.MODE_AUCTION) {
              if (ItemTypes.isLootItem(kind) || ItemTypes.isConsumableItem(kind))
                return;

              const value = ~~(ItemTypes.getEnchantSellPrice(item)/2);
              $('#auctionSellCount').val(value);
              game.app.showAuctionSellDialog(slot);
            }
            else if (game.inventoryMode === InventoryMode.MODE_SELL) {
              if (ItemTypes.isLootItem(kind))
                return;

              game.client.sendStoreSell(type, slot);
            }
            else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
              if (!ItemTypes.isEquipment(kind))
                return;

              game.equipment.repairItem(type, slot, item);
            }
            else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
              if (!ItemTypes.isEquipment(kind))
                return;

              game.equipment.enchantItem(type, slot, item);
            }
            else if (game.inventoryMode === InventoryMode.MODE_BANK) {
              if (!game.bankHandler.isBankFull()) {
                this.handler.moveItem(1, -1);
              }
            }
            else if (game.inventoryMode === InventoryMode.MODE_NORMAL) {
              if (this.selectedItem >= 0 && btnPressed)
                this.handler.dropItem(slot);
              else {
                if (DragItem)
                  this.handler.useItem(DragItem.type, item);
              }
            }
            else {
              if (DragItem)
                this.handler.useItem(DragItem.type, item);
            }
          } else {
            this.handler.splitItem(1, slot);
          }
        };

        proto.selectEquipment = function(event, type, slot) {
          const item = this.getItem(type, slot);
          if (item !== null && DragItem && DragItem.item !== item)
            this.deselectItem();

          if (this.selectedItem < 0)
          {
            this.selectInventory(event.target);
            this.handler.moveItem(2, slot, true);
            event.stopPropagation();
          }
        };

        proto.deselectItem = function() {
          DragItem = null;
          this.selectItem(this.selectedType, this.selectedItem, false);
          this.jqActionButton.hide();
        };

        proto.selectItem = function(type, slot, select) {
          let htmlItem = $('#inventoryitembackground' + slot); // FIX: missing var, was leaking an implicit global
          if (type === 2) {
            htmlItem = $('#equipBackground'+slot);
          }
          this.selectedType = type;
          if (select) {
            this.selectedItem = slot;
            htmlItem.css({
              'border': this.scale + 'px solid white'
            });
          }
          else {
            this.selectedItem = -1;
            htmlItem.css({
              'border': 'none'
            });
          }
        };

}
