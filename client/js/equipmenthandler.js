// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global ItemTypes, Class */
import Item from './entity/item.js';
import Items from './data/items.js';

export default class EquipmentHandler {
        constructor(game) {
            var self = this;
            this.game = game;
            this.rooms = [];
            this.maxNumber = 5;
            this.scale = 3;

            /*for (var i=0; i < this.maxNumber; ++i)
            {
              $('#equipment'+i).attr('draggable', true);
              $('#equipment'+i).draggable = true;
              $('#equipment'+i).data("slot", i);
              $('#equipBackground'+i).data("slot", i);
            }*/
        }

/*
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
*/

        clearItem(slot) {
          $('#equipment'+slot).css({
            'background-image': "none",
            'box-shadow': "none"
          });
          $('#equipment'+slot).html('');
        }

        setEquipment(itemRooms) {
            for(var i = 0; i < itemRooms.length; ++i)
            {
              this.clearItem(i);
              var item = itemRooms[i];
              if (item.itemKind === -1) {
                this.rooms[item.slot] = null;

                if (item.slot === 4)
                  game.player.setRange();

                continue;
              }
              if (item) {
                this.rooms[item.slot] = item;

                if (item.slot === 4)
                  game.player.setRange();
              }
            }
            this.refreshEquipment();
        }

        refreshEquipment() {
          var scale = game.renderer.guiScale;

          // Dumped from Char dialog.

          for (var i=0; i < this.maxNumber; ++i) {
            var item = this.rooms[i];
            var jqElement = '#equipment'+i;

            if (item && item.itemKind > 0 && item.itemKind < 1000) {
              item.name = ItemTypes.KindData[item.itemKind].name;
            }
            if (jqElement && item) {
              Items.jqShowItem($(jqElement), item, $(jqElement));
            }
            else {
              this.clearItem(i);
            }
          }
        }

        equip(item, itemSlot) {
            var itemKind = item.itemKind;

            var equipSlot = ItemTypes.getEquipmentSlot(itemKind);
            if (equipSlot > -1)
              game.client.sendItemSlot([1, 0, itemSlot, 0, 2, equipSlot]);

            //this.menu.close();
            game.statDialog.update();
        }

        unequip(itemSlot) {
            game.client.sendItemSlot([1, 2, itemSlot, 0, 0, -1]);
            game.statDialog.update();
        }

        repairItem(type, itemSlot, item) {
          var self = this;
          if (!item) return;

          if(!game.ready) return;

          var price = ItemTypes.getRepairPrice(item);
          var strPrice = 'Cost ' + price + ' to Repair.';
          if (price > game.player.gold[0]) {
              game.showNotification(["SHOP", "SHOP_NOGOLD"]);
              return;
          }
          game.confirmDialog.confirm(strPrice, function(result) {
              if(result) {
                  game.client.sendStoreRepair(type, itemSlot);
              }
          });
        }

        enchantItem(type, itemSlot, item) {
          var self = this;
          if (!item) return;

          if(!game.ready) return;

          var price = ItemTypes.getEnchantPrice(item);
          var strPrice = 'Cost ' + price + ' to Enchant.';
          if (price > game.player.gold[0]) {
              game.showNotification(["SHOP", "SHOP_NOGOLD"]);
              return;
          }
          game.confirmDialog.confirm(strPrice, function(result) {
              if(result) {
                  game.client.sendStoreEnchant(type, itemSlot);
              }
          });
        }

        useItem(type, item) {
          if (type === 2) {
            this.unequip(item.slot);
          }
          else {
            this.equip(item, item.slot);
          }
        }

        getWeapon() {
          if (!this.rooms)
            return null;

          return this.rooms[4];
        }
}
