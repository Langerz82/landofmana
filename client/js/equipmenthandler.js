/* global Types, Class */

define(['entity/item', 'data/items'], function(Item, Items) {
    var EquipmentHandler = Class.extend({
        init: function(game) {
            var self = this;
            this.game = game;
            this.equipment = [];
            this.maxNumber = 5;
            this.scale = 3;

            for (var i=0; i < 5; ++i)
            {
              $('#equipment'+i).attr('draggable', true);
              $('#equipment'+i).draggable = true;
              $('#equipment'+i).data("slot", i);
              $('#equipBackground'+i).data("slot", i);
            }
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
