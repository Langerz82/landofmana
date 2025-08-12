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

        decInventory: function(realslot) {
          var self = this;
          var item = this.inventory[realslot];
          var count = item.itemNumber;
          if (--count <= 0) {
            this.inventory[realslot] = null;
          }
          this.dialog.decInventory(realslot);
        },

        splitItem: function(type, slot) {
            if (!DragItem)
              return;

            var item2 = this.dialog.getItem(type, slot);
            var item = this.dialog.getItem(DragItem.type, DragItem.slot);
            if (!item) {
              return;
            }
            DragItem.type2 = type;
            DragItem.slot2 = slot;

            var kind = item.itemKind;
            var count = item.itemNumber;
            if ( (this.isStackitem(item) && !item2) ||
                 (this.isStackitem(item,true) && item2 && this.isStackitem(item2, true)))
            {
              $('#dropCount').val(count);

              game.app.SplitItem = DragItem;
              game.app.showDropDialog("splititems");
            } else {
              this.moveItem(type, slot);
            }
        },

        dropItem: function(itemSlot) {
            var pos = game.getMouseGridPosition();
            var item = this.inventory[itemSlot];
            if (!item)
              return;

            var kind = item.itemKind;
            var count = item.itemNumber;
            game.player.droppedX = pos.x;
            game.player.droppedY = pos.y;
            if(this.isStackitem(item))
            {
              $('#dropCount').val(count);
              game.app.DropItem = DragItem;
              game.app.showDropDialog("dropItems");
            } else {
              game.client.sendItemSlot([2, 0, itemSlot, 1]);
            }
        },

        isStackitem: function (item, maxStack) {
          return (ItemTypes.isStackedItem(item.itemKind) &&
            (item.itemNumber > 1) && (!maxStack || (maxStack && item.itemNumber < 100)));
        },

        useItem: function(type, item) {
          var player = game.player;
          var kind = item.itemKind;
          if (ItemTypes.isConsumableItem(kind)) {
            if(kind && this.dialog.coolTimeCallback === null
               && (ItemTypes.isHealingItem(kind) && player.stats.hp < player.stats.hpMax
               && player.stats.hp > 0) || (ItemTypes.isConsumableItem(kind) && !ItemTypes.isHealingItem(kind)))
            {
                this.decInventory(item.slot);
                game.client.sendItemSlot([0, 0, item.slot, 1]);
                game.audioManager.playSound("heal");
                game.shortcuts.refresh();
                return true;
            }
          } else if (ItemTypes.isEquippable(kind)) {
            game.equipment.useItem(type, item);
            return true;
          }
          return false;
        },

    		moveItem: function (type, slot, start) {
          DragItem = this._moveItem(DragItem, type, slot, start);
        },

        _moveItem: function (obj, type, slot, start) {
          start = start || false;

          if (start && obj === null) {
            return {"action": 1, "type": type, "slot": slot, "item": this.dialog.getItem(type,slot)};
          }

          if (!start && obj !== null) {
            var action = obj.action || 1;
            slot = (slot >= 0) ? this.dialog.getRealSlot(slot) : slot;
            obj.slot = (obj.type === 0) ? this.dialog.getRealSlot(obj.slot) : obj.slot;
            game.client.sendItemSlot([action, obj.type, obj.slot, obj.item.itemNumber, type, slot]);
            obj = null;
          }
          return null;
        },

        sendSplitItem: function (splitItem, count) {
          var item = splitItem.item;
          if(count > item.itemNumber)
            count = item.itemNumber;
          item.itemNumber = count;

          splitItem = this._moveItem(splitItem, splitItem.type2, splitItem.slot2);

          item.itemNumber -= count;
          if(item.itemNumber === 0)
          {
            item = null;
          }
        },

        sendDropItem: function (dropItem, count) {
          var item = dropItem.item;
          if (count <= 0)
            return;
          if(count > item.itemNumber)
            count = item.itemNumber;

          game.client.sendItemSlot([2, dropItem.type, dropItem.slot, count]);

          item.itemNumber -= count;
          if(item.itemNumber === 0)
          {
            item = null;
          }
        },
    });

    return InventoryHandler;
});
