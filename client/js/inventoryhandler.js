// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global ItemTypes, Class */
import Item from './entity/item.js';
import Items from './data/items.js';
import ItemLoot from './data/itemlootdata.js';

export default class InventoryHandler {
        constructor(dialog) {
            this.rooms = [];
            this.maxNumber = 50;
            this.scale = 3;
            this.dialog = dialog;
            dialog.handler = this;
        }

        setMaxNumber(maxNumber) {
          this.maxNumber = maxNumber;
        }

        initInventory(itemArray) {
          this.setInventory(itemArray);
        }

        setInventory(itemArray) {
          for (let item of itemArray)
          {
            const i = item.slot;
            if (item.itemKind === -1)
            {
              this.rooms[i] = null;
              this.dialog.makeEmptyInventory(i);
              continue;
            }

            this.rooms[i] = item;
            const kind = item.itemKind;
            if (kind >= 1000 && kind < 2000)
              item.name = ItemLoot[kind - 1000].name;
            else
              item.name = ItemTypes.KindData[kind].name;

            this.dialog.refreshInventory(i);
          }
        }

        getItemInventorySlotByKind(kind) {
          for (let i = 0; i < this.maxNumber; i++) { // FIX: missing var, was leaking an implicit global
            const item = this.rooms[i];
            if (item && kind === item.itemKind)
              return i;
          }
        }

        isInventoryFull() {
          // FIX: checked `item === null`, but a slot that's never been
          // touched since login is `undefined` (a hole in the array), not
          // `null` -- only slots explicitly emptied via a WC_ITEMSLOT update
          // get set to null (see setInventory() above). undefined !== null,
          // so untouched empty slots were wrongly counted as occupied,
          // making lightly-used inventories falsely report "full" (this
          // gates bank withdrawals in dialog/bankdialog.js). Every sibling
          // scan method in this file (hasItem, getItemInventorySlotByKind)
          // correctly uses a truthy check instead.
          for (let i = 0; i < this.maxNumber; ++i) {
            const item = this.rooms[i];
            if (!item) {
              return false;
            }
          }
          return true;
        }

        hasItem(kind, count) {
          for (let i = 0; i < this.maxNumber; i++) { // FIX: missing var, was leaking an implicit global
            const item = this.rooms[i];
            if (item && kind === item.itemKind && item.itemNumber >= count) {
              return true;
            }
          }
          return false;
        }

        getItemCount(kind) {
          for (let i = 0; i < this.maxNumber; i++) { // FIX: missing var, was leaking an implicit global
            const item = this.rooms[i];
            if (item && kind === item.itemKind) {
              return item.itemNumber;
            }
          }
          return null;
        }

        getItemTotalCount(kind) {
          let total = 0;
          for (let i = 0; i < this.maxNumber; i++) { // FIX: missing var, was leaking an implicit global
            const item = this.rooms[i];
            if (item && kind === item.itemKind) {
              total += item.itemNumber;
            }
          }
          return total;
        }

        getItemByKind(kind) {
          for (let i = 0; i < this.maxNumber; i++) { // FIX: missing var, was leaking an implicit global
            const item = this.rooms[i];
            if (item && kind === item.itemKind) {
              item.slot = i;
              return item;
            }
          }
          return null;
        }

        hasItems(itemKind, itemCount){
            let a = 0;
            for(let item of this.rooms){
                if(item && item.itemKind === itemKind){
                	 a += item.itemNumber;
                	 if (a >= itemCount)
                    	return true;
                }
            }
            return false;
        }

        decInventory(realslot) {
          const item = this.rooms[realslot];
          let count = item.itemNumber;
          if (--count <= 0) {
            this.rooms[realslot] = null;
          } else {
            item.itemNumber = count; // FIX: decremented count was never written back, so displayed stack counts didn't update on single-use decrements
          }
        }

        splitItem(type, slot) {
            if (!DragItem)
              return;

            const item2 = this.dialog.getItem(type, slot);
            const item = this.dialog.getItem(DragItem.type, DragItem.slot);
            if (!item) {
              return;
            }
            DragItem.type2 = type;
            DragItem.slot2 = slot;

            const count = item.itemNumber;
            if ( (this.isStackitem(item) && !item2) ||
                 (this.isStackitem(item,true) && item2 && this.isStackitem(item2, true)))
            {
              $('#dropCount').val(count);

              game.app.SplitItem = DragItem;
              game.app.showDropDialog("splititems");
            } else {
              this.moveItem(type, slot);
            }
        }

        dropItem(itemSlot) {
            const pos = game.getMouseGridPosition();
            const item = this.rooms[itemSlot];
            if (!item)
              return;

            const count = item.itemNumber;
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
        }

        isStackitem(item, maxStack) {
          return (ItemTypes.isStackedItem(item.itemKind) &&
            (item.itemNumber > 1) && (!maxStack || (maxStack && item.itemNumber < 100)));
        }

        useItem(type, item) {
          const player = game.player;
          const kind = item.itemKind;
          if (ItemTypes.isConsumableItem(kind)) {
            // FIX: missing parens meant `|| (isConsumable && !isHealing)` short-circuited past the leading
            // `kind && coolTimeCallback === null` checks, so the cooldown gate was skipped entirely for
            // non-healing consumables (e.g. mana/buff potions); now the gate applies to both branches
            if(kind && this.dialog.coolTimeCallback === null
               && ((ItemTypes.isHealingItem(kind) && player.stats.hp < player.stats.hpMax
               && player.stats.hp > 0) || (ItemTypes.isConsumableItem(kind) && !ItemTypes.isHealingItem(kind))))
            {
                this.decInventory(item.slot);
                this.dialog.funcCooldownExec(item);
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
        }

    		moveItem(type, slot, start) {
          DragItem = this._moveItem(DragItem, type, slot, start);
        }

        _moveItem(obj, type, slot, start) {
          start = start || false;

          if (start && obj === null) {
            return {"action": 1, "type": type, "slot": slot, "item": this.dialog.getItem(type,slot)};
          }

          if (!start && obj !== null) {
            const action = obj.action || 1;
            game.client.sendItemSlot([action, obj.type, obj.slot, obj.item.itemNumber, type, slot]);
            obj = null;
          }
          return null;
        }

        sendSplitItem(splitItem, count) {
          let item = splitItem.item;
          if(count > item.itemNumber)
            count = item.itemNumber;
          item.itemNumber = count;

          splitItem = this._moveItem(splitItem, splitItem.type2, splitItem.slot2);

          item.itemNumber -= count;
          if(item.itemNumber === 0)
          {
            item = null;
          }
        }

        sendDropItem(dropItem, count) {
          let item = dropItem.item;
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
        }
}
