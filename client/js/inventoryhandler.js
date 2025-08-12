/* global Types, Class */

define(['entity/item', 'data/items', 'data/itemlootdata'], function(Item, Items, ItemLoot) {
    var InventoryHandler = Class.extend({
        init: function(dialog) {
            var self = this;
            this.inventory = [];
            this.maxNumber = 48;
            this.scale = 3;
            this.pageItems = 24;
            this.dialog = dialog;
            dialog.handler = this;
        },

        setMaxNumber: function(maxNumber) {
          this.maxNumber = maxNumber;
        },

        initInventory: function(itemArray) {
          this.pageIndex = 0;
          this.setInventory(itemArray);
        },

        setInventory: function(itemArray) {
          for (var item of itemArray)
          {
            var i = item.slot;
            if (item.itemKind === -1)
            {
              this.inventory[i] = null;
              this.dialog.makeEmptyInventory(i);
              continue;
            }

            this.inventory[i] = item;
            var kind = item.itemKind;
            if (kind >= 1000 && kind < 2000)
              item.name = ItemLoot[kind - 1000].name;
            else
              item.name = ItemTypes.KindData[kind].name;

            var count = this.dialog.getRealSlot();
            if (i >= count && i < (count + this.pageItems))
              this.dialog.refreshInventory(i);
          }
        },

        getItemInventorySlotByKind: function(kind) {
          for (i = 0; i < this.maxNumber; i++) {
            var item = this.inventory[i];
            if (item && kind === item.itemKind)
              return i;
          }
        },

        isInventoryFull: function() {
          for (var i = 0; i < this.maxNumber; ++i) {
            var item = this.inventory[i];
            if (item === null) {
              return false;
            }
          }
          return true;
        },

        hasItem: function(kind, count) {
          for (i = 0; i < this.maxNumber; i++) {
            var item = this.inventory[i];
            if (item && kind === item.itemKind && item.itemNumber >= count) {
              return true;
            }
          }
          return false;
        },

        getItemCount: function(kind) {
          for (i = 0; i < this.maxNumber; i++) {
            var item = this.inventory[i];
            if (item && kind === item.itemKind) {
              return item.itemNumber;
            }
          }
          return null;
        },

        getItemTotalCount: function(kind) {
          var total = 0;
          for (i = 0; i < this.maxNumber; i++) {
            var item = this.inventory[i];
            if (item && kind === item.itemKind) {
              total += item.itemNumber;
            }
          }
          return total;
        },

        getItemByKind: function(kind) {
          for (i = 0; i < this.maxNumber; i++) {
            var item = this.inventory[i];
            if (item && kind === item.itemKind) {
              item.slot = i;
              return item;
            }
          }
          return null;
        },

        hasItems: function(itemKind, itemCount){
            var a = 0;
            for(var item of this.inventory){
                if(item && item.itemKind === itemKind){
                	 a += item.itemNumber;
                	 if (a >= itemCount)
                    	return true;
                }
            }
            return false;
        },


    });

    return InventoryHandler;
});
