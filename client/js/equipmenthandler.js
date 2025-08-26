/* global Types, Class */

define(['entity/item', 'data/items'], function(Item, Items) {
    var EquipmentHandler = Class.extend({
        init: function(game) {
            var self = this;
            this.game = game;
            this.equipment = [];
            this.maxNumber = 5;
            this.scale = 3;

            /*for (var i=0; i < this.maxNumber; ++i)
            {
              $('#equipment'+i).attr('draggable', true);
              $('#equipment'+i).draggable = true;
              $('#equipment'+i).data("slot", i);
              $('#equipBackground'+i).data("slot", i);
            }*/
        },

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
              if (item.itemKind === -1) {
                this.equipment[item.slot] = null;
                continue;
              }
              if (item) {
                this.equipment[item.slot] = item;

                if (item.slot === 4)
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
            }
            else {
              this.clearItem(i);
            }
          }
        },

        equip: function(item, itemSlot) {
            var itemKind = item.itemKind;

            var equipSlot = ItemTypes.getEquipmentSlot(itemKind);
            if (equipSlot > -1)
              game.client.sendItemSlot([1, 0, itemSlot, 0, 2, equipSlot]);

            //this.menu.close();
            game.statDialog.update();
        },

        unequip: function(itemSlot) {
            game.client.sendItemSlot([1, 2, itemSlot, 0, 0, -1]);
            game.statDialog.update();
        },

        repairItem: function (type, itemSlot, item) {
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
        },

        enchantItem: function (type, itemSlot, item) {
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
        },

        useItem: function (type, item) {
          if (type === 2) {
            this.unequip(item.slot);
          }
          else {
            this.equip(item, item.slot);
          }
        },

    });

    return EquipmentHandler;
});
