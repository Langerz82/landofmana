/* global Types, Class */

define(['entity/item', 'data/items'], function(Item, Items) {
    var EquipmentHandler = Class.extend({
        init: function(game) {
            var self = this;
            this.game = game;
            this.equipment = [];
            this.maxNumber = 5;
            this.scale = 3;

            /*var selectEquipment = function(event) {
              if (self.game.ready) {
                var slot = $(this).data("itemSlot");

                log.info("slot=" + slot);
                //log.info("inventories " + JSON.stringify(self.inventory));
                var item = self.equipment[slot];

                if (item && self.selectedItem != realslot) {
                    self.selectItem(self.selectedItem, false);
                    self.selectItem(realslot, true);
                    $('#invActionButton').data('itemType', 2);
                    $('#invActionButton').data('itemSlot', slot);

                    if (game.inventoryMode == InventoryMode.MODE_SELL) {
                      $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantSellPrice(item)));
                    }
                    else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
                      $('.inventorySellGold').html(parseInt(ItemTypes.getRepairPrice(item)));
                    }
                    else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
                      $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantPrice(item)));
                    }
                    else if (game.inventoryMode == InventoryMode.MODE_BANK) {
                    }
                    return;
                  }
                }

                if (item && self.selectedItem == realslot) {
                  var triggerClick = false;
                  if (game.inventoryMode == InventoryMode.MODE_SELL) {
                    triggerClick = true;
                  }
                  else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
                    triggerClick = true;
                  }
                  else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
                    triggerClick = true;
                  }
                  else if (game.inventoryMode == InventoryMode.MODE_BANK) {
                    triggerClick = true;
                  }
                  else {
                    self.game.unequip(slot);
                  }
                  if (triggerClick) {
                    $('#invActionButton').data('itemType', 2);
                    $('#invActionButton').data('itemSlot', slot);
                    $('#invActionButton').trigger("click");
                  }
                  self.selectItem(realslot, false);
                }
              };*/


            for (var i=0; i < 5; ++i)
            {
              $('#equipment'+i).attr('draggable', true);
              $('#equipment'+i).draggable = true;
              $('#equipment'+i).data("slot", i);
              $('#equipBackground'+i).data("slot", i);

              /*$('#equipment'+i).on('click', function (event) {
                self.selectItem($(this).data("slot"), true);
              });*/

              /*$('#equipment'+i).on('click', function (event) {
                if (DragItem) {
                  var slot = $(this).data("slot");
                  game.client.sendItemSlot([1, DragItem.type, DragItem.slot, 1, 2, slot]);
                  DragItem = null;
                  game.inventoryHandler.deselectItem();
                }
                else {
                  DragItem = {};
                  DragItem.type = 2;
                  DragItem.slot = $(this).data("slot");
                  if (self.selectedItem >= 0)
                    self.selectItem(self.selectedItem, false);
                  self.selectItem($(this).data("slot"), true);

                }
              });*/

              /*$('#equipBackground'+i).on('drop', function(event) {
                if (DragItem) {
                  var slot = $(this).data("slot");
                  game.client.sendItemSlot([1, DragItem.type, DragItem.slot, 1, 2, slot]);
                  DragItem = null;
                  game.inventoryHandler.deselectItem();
                }
              });

              $('#equipment'+i).on('dragover touchover', function(event) {
                event.preventDefault();
              });
              $('#equipment'+i).on('dragover touchover', function(event) {
                event.preventDefault();
              });

              $('#equipment'+i).on('dragstart touchstart', function(event) {
              	log.info("Began DragStart.")
                if (DragItem === null) {
              	  DragItem = {};
              	  DragItem.type = 2;
                  DragItem.slot = $(this).data("slot");
                }
              });*/
            }

            // TODO - TEMP REMOVE.
            //$('#equipment1').data("slot", 0);
            //$('#equipBackground1').data("slot", 0);
            //$('#equipment4').data("slot", 1);
            //$('#equipBackground4').data("slot", 1);

        },

        selectItem: function(realslot, select) {
          var self = this;
          log.info("equipment - selectItem" + realslot);
          if (select) {
            this.selectedItem = realslot;
            $('#equipBackground' + realslot).css({
              'border': self.scale + 'px solid white'
            });
          }
          else {
            $('#equipBackground' + realslot).css({
              'border': 'none'
            });
            this.selectedItem = -1;
          }
        },

        clearItem: function (slot) {
          $('#equipment'+slot).css({
            'background-image': "none",
            'box-shadow': "none"
          });
          $('#equipment'+slot).html('');
        },

        setEquipment: function(itemRooms) {
            for(var i = 0; i < itemRooms.length; ++i)
            {
              this.clearItem(i);
              var item = itemRooms[i];
              if (item.itemKind == -1) {
                this.equipment[item.slot] = null;
                continue;
              }
              if (item) {
                this.equipment[item.slot] = item;

                if (item.slot == 4)
                  game.player.setRange();
              }
            }
            this.refreshEquipment();
        },

        refreshEquipment: function() {
          var scale = game.renderer.guiScale;

          // Dumped from Char dialog.

          for (var i=0; i < this.maxNumber; ++i) {
            var item = this.equipment[i];
            var jqElement = '#equipment'+i;

            if (item && item.itemKind > 0 && item.itemKind < 1000) {
              item.name = ItemTypes.KindData[item.itemKind].name;
            }
            if (jqElement && item) {
              Items.jqShowItem($(jqElement), item, $(jqElement));

              /*var itemData = ItemTypes.KindData[item.itemKind];
              $(jqElement).css({
                'background-image': "url('img/" + scale + "/" + itemData.sprite + "')",
                'background-position': '-' + (itemData.offset[0] * scale * 16) + 'px -' + (itemData.offset[1] * scale * 16) + 'px',
                'line-height': (scale * 16) + 'px',
                'text-shadow': '-1px 0 black, 0 1px black, 1px 0 black, 0 -1px black',
                'color': 'white',
                'font-size': (scale * 6) + 'px',
                'text-align': 'center',
                'box-shadow': 'inset 0 0 0 ' + (scale * 16) + 'px rgba(255,0,0,' + (1 - (item.itemDurability / item.itemDurabilityMax)) + ')'
              });

              $(jqElement).attr(
                'title',
                Item.getInfoMsgEx(item)
              );
              $(jqElement).html(ItemTypes.getLevelByKind(item.itemKind) + '+' + item.itemNumber);*/
            }
            else {
              this.clearItem(i);
            }
          }
        },

    });

    return EquipmentHandler;
});
