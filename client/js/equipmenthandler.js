// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global ItemTypes, Class */
import Item from './entity/item.js';
import Items from './data/items.js';

export default class EquipmentHandler {
        constructor(game) {
            this.game = game;
            this.rooms = [];
            this.maxNumber = 5;
            this.scale = 3;
            this.weaponSlot = 4;
        }

        clearItem(slot) {
          $('#equipment'+slot).css({
            'background-image': "none",
            'box-shadow': "none"
          });
          $('#equipment'+slot).html('');
        }

        setEquipment(itemRooms) {
            for(let i = 0; i < itemRooms.length; ++i)
            {
              this.clearItem(i);
              const item = itemRooms[i];
              if (item.itemKind === -1) {
                this.rooms[item.slot] = null;

                if (item.slot === this.weaponSlot)
                  game.player.setRange();

                continue;
              }
              if (item) {
                this.rooms[item.slot] = item;

                if (item.slot === this.weaponSlot)
                  game.player.setRange();
              }
            }
            this.refreshEquipment();
        }

        refreshEquipment() {
          const scale = game.renderer.guiScale;

          // Dumped from Char dialog.

          for (let i=0; i < this.maxNumber; ++i) {
            const item = this.rooms[i];
            const jqElement = '#equipment'+i;

            if (item && item.itemKind > 0 && item.itemKind < 1000) {
              item.name = ItemTypes.KindData[item.itemKind].name;
            }
            if (item) {
              // Note: jqShowItem()'s `size` param is left at its default (1)
              // here intentionally - passing `scale` (game.renderer.guiScale)
              // makes equipped-item icons render far too large.
              Items.jqShowItem($(jqElement), item, $(jqElement));
            }
            else {
              this.clearItem(i);
            }
          }
        }

        equip(item, itemSlot) {
            const itemKind = item.itemKind;

            const equipSlot = ItemTypes.getEquipmentSlot(itemKind);
            // FIX: statDialog.update() used to run unconditionally, even when
            // the item isn't equippable (equipSlot === -1) and nothing was
            // actually sent/equipped. Only refresh the stat dialog when an
            // equip request was actually sent.
            if (equipSlot > -1) {
              game.client.sendItemSlot([1, 0, itemSlot, 0, 2, equipSlot]);
              game.statDialog.update();
            }
        }

        unequip(itemSlot) {
            game.client.sendItemSlot([1, 2, itemSlot, 0, 0, -1]);
            game.statDialog.update();
        }

        repairItem(type, itemSlot, item) {
          if (!item) return;

          if(!game.ready) return;

          const price = ItemTypes.getRepairPrice(item);
          const strPrice = 'Cost ' + price + ' to Repair.';
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
          if (!item) return;

          if(!game.ready) return;

          const price = ItemTypes.getEnchantPrice(item);
          const strPrice = 'Cost ' + price + ' to Enchant.';
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

          return this.rooms[this.weaponSlot];
        }

        forEachArmor(callback) {
          // FIX: previously looked up the id via `this.rooms.indexOf(item)`
          // instead of using the real loop index. `rooms` routinely holds
          // multiple null/undefined (empty) slots, and indexOf() always
          // returns the *first* matching index -- so every empty slot after
          // the first got tagged with the wrong id (and the weapon-slot skip
          // could fail to trigger when the weapon slot itself was empty and
          // an earlier slot was also empty). Currently masked because the
          // only caller (playercombat.js baseDamageDef) skips falsy items,
          // but the id was wrong regardless. Use the actual index instead.
          for (let id = 0; id < this.rooms.length; ++id) {
            const item = this.rooms[id];
            if (!item)
              continue;
            if (id === this.weaponSlot)
              continue;
            callback(id, this.rooms[id]);
          }
        }
}
