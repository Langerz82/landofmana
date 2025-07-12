/* global Types, Class */



define(['button2', 'entity/item', 'data/itemlootdata', 'data/items'],
  function(Button2, Item, ItemLoot, Items)
{
  var InventoryHandler = Class.extend({
    init: function(game) {
      this.game = game;

      this.maxInventoryNumber = 48;
      this.itemListCount = 24;
      this.inventory = [];

      this.scale = this.game.renderer.getUiScaleFactor();
      this.xscale = this.game.renderer.getIconScaleFactor();
      log.info("this.scale=" + this.scale);

      this.inventorybutton = new Button2('#inventorybutton', {
        background: {
          left: 196 * this.scale,
          top: 314 * this.scale,
          width: 17 * this.scale
        },
        kinds: [0, 2],
        visible: false
      });

      this.coolTimeCallback = null;

      this.isShowAllInventory = false;

      this.selectedItem = -1;

      this.pageIndex = 0;
      this.pageItems = 24;

      var self = this;
      /*for (var i = 0; i < 4; i++) {
        $('#scinventorybackground' + i).bind("click", function(event) {
          if (self.game.ready) {
            $("#inventoryGearItems").trigger('click');
            var slot = parseInt(this.id.slice(21));

            log.info("inventoryNumber"+slot);
            var item = self.inventory[slot];
            if (item) {
              item.slot = self.getRealSlot(slot);
              if (ItemTypes.isConsumableItem(item.itemKind)) {
                this.useItem(0, item);
              }
            }
          }
        });
      }*/

      this.closeButton = $('#inventoryCloseButton');
      this.closeButton.click(function(event) {
        game.inventoryMode = InventoryMode.MODE_NORMAL;
        self.deselectItem();
        self.hideInventory();
        self.refreshInventory();
      });

      $('#inventoryGearItems').click(function(event) {
        self.pageIndex = 0;
        self.deselectItem();
        self.refreshInventory();
      });
      $('#inventoryGear2Items').click(function(event) {
        self.pageIndex = 1;
        self.deselectItem();
        self.refreshInventory();
      });
    },

    loadInventoryEvents: function() {
      var self = this;

      self.selectInventory = function(jq) {
        if (!self.game || !self.game.ready)
          return;

        var type = $(jq).data("itemType");
        var slot = $(jq).data("itemSlot");

        log.info("selectInventory - click, slot:"+slot+", type:"+type);

        var item = self.getItem(type, slot);

        $('.inventorySellGold').html("0");
        if (item) {
          var kind = item.itemKind;
          if (game.inventoryMode == InventoryMode.MODE_ENCHANT ||
              game.inventoryMode == InventoryMode.MODE_REPAIR)
          {
            if (!ItemTypes.isEquipment(kind))
              return;
          }
          if (game.inventoryMode == InventoryMode.MODE_SELL ||
              game.inventoryMode == InventoryMode.MODE_AUCTION)
          {
            if (ItemTypes.isLootItem(kind))
              return;
          }
        }
        //log.info("slot=" + slot);
        //log.info("inventories " + JSON.stringify(self.inventory));
        if (item && self.selectedItem != slot) {
            $('.inventorySellGoldFrame').show();
            self.selectItem(type, self.selectedItem, false);
            self.selectItem(type, slot, true);
            $('#invActionButton').data('itemType', type);
            $('#invActionButton').data('itemSlot', slot);

            var kind = item.itemKind;
            if (game.inventoryMode == InventoryMode.MODE_AUCTION) {
              var value = ~~(ItemTypes.getEnchantSellPrice(item)/2);
              $('.inventorySellGold').html(parseInt(value));
            }
            else if (game.inventoryMode == InventoryMode.MODE_SELL) {
              $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantSellPrice(item)));
            }
            else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
              $('.inventorySellGold').html(parseInt(ItemTypes.getRepairPrice(item)));
            }
            else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
              $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantPrice(item)));
            }
            else if (game.inventoryMode == InventoryMode.MODE_BANK) {
              $('.inventorySellGoldFrame').hide();
            }
            else if (game.inventoryMode == InventoryMode.MODE_NORMAL) {
              $('.inventorySellGoldFrame').hide();
            }
            return;
        }

        if (item && self.selectedItem == slot) {
          var triggerClick = false;
          if (game.inventoryMode == InventoryMode.MODE_AUCTION ||
              game.inventoryMode == InventoryMode.MODE_SELL ||
              game.inventoryMode == InventoryMode.MODE_REPAIR ||
              game.inventoryMode == InventoryMode.MODE_ENCHANT ||
              game.inventoryMode == InventoryMode.MODE_BANK)
          {
            triggerClick = true;
          }
          /*else {
            item.slot = self.getRealSlot(slot);
            this.useItem(type, item);
          }*/
          if (triggerClick) {
            $('#invActionButton').data('itemType', type);
            $('#invActionButton').data('itemSlot', slot);
            $('#invActionButton').trigger("click");
          }
          self.deselectItem();
        }
      }

// TODO: FIX BROKEN.
      var activateItem = function (type, slot, item) {
        if (item) {
          var kind = item.itemKind;
          if (game.inventoryMode == InventoryMode.MODE_AUCTION) {
            if (ItemTypes.isLootItem(kind) || ItemTypes.isConsumableItem(kind))
              return;

            var value = ~~(ItemTypes.getEnchantSellPrice(item)/2);
            $('#auctionSellCount').val(value);
            game.app.showAuctionSellDialog(slot);
          }
          else if (game.inventoryMode == InventoryMode.MODE_SELL) {
            if (ItemTypes.isLootItem(kind))
              return;

            game.client.sendStoreSell(type, slot);
          }
          else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
            if (!ItemTypes.isEquipment(kind))
              return;

            game.repairItem(type, slot, item);
          }
          else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
            if (!ItemTypes.isEquipment(kind))
              return;

            game.enchantItem(type, slot, item);
          }
          else if (game.inventoryMode == InventoryMode.MODE_BANK) {
            if (!game.bankHandler.isBankFull()) {
              self.moveItem(1, -1);
            }
          }
          else
            self.useItem(DragItem.type, item);
        } else {
          self.splitItem(1, slot);
        }
      };

      for (var i = 0; i <= 4; i++) {
        $('#equipment' + i).attr('draggable', true);
        $('#equipment' + i).draggable = true;

        $('#equipment'+i).data("itemType",2);
        $('#equipment'+i).data("itemSlot",i);

        $('#equipBackground'+i).data("itemType",2);
        $('#equipBackground'+i).data("itemSlot",i);

        $('#equipBackground'+i).on("click tap", function (e) {
          var type = $(this).data("itemType");
          var slot = $(this).data("itemSlot");

          if (self.selectedItem == -1 && !DragItem)
          {
            self.selectInventory(this);
            self.moveItem(2, slot);
          }
          else {
            var dragItem = (DragItem) ? self.getItem(DragItem.type, DragItem.slot) : null;
            var item = self.getItem(type, slot);

            if (dragItem && item) {
              if (dragItem == item) {
                activateItem(type, slot, item);
              } else
                return;
            }
            else if (dragItem) {
              self.useItem(DragItem.type, dragItem);
            }
            else if (item) {
              self.useItem(type, item);
            }
            self.deselectItem();
          }
          event.stopPropagation();
        });

        $('#equipment'+i).on('dragstart touchstart', function(event) {
          if (self.selectedItem < 0) {
            self.selectInventory(this);
            self.moveItem(2, $(this).data("itemSlot"));
          }
        });

        $('#equipment' + i).on('dragover touchover', function(event) {
          event.preventDefault();
        });

        $('#equipBackground'+i).on('drop touchend', function(event) {
          if ($(this).data("itemSlot") == DragItem.slot)
            return;

          self.moveItem(2, $(this).data("itemSlot"));
          self.deselectItem();
        });
      }

      for (var i = 0; i < 24; i++) {
        $('#inventory' + i).attr('draggable', true);
        $('#inventory' + i).draggable = true;

        $('#inventorybackground' + i).data('itemType',0);
        $('#inventorybackground' + i).data('itemSlot',i);

        $('#inventorybackground'+i).on('click tap', function(event) {
          var type = $(this).data("itemType");
          var slot = $(this).data("itemSlot");

          if (self.selectedItem == -1 && !DragItem)
          {
            self.selectInventory(this);
            self.moveItem(0, slot);
          }
          else {
            var dragItem = (DragItem) ? self.getItem(DragItem.type, DragItem.slot) : null;
            var item = self.getItem(type, slot);
            if (dragItem && item) {
              if (dragItem == item) {
                activateItem(type, slot, item);
              }
              else {
                self.moveItem(type, slot);
              }
            }
            else if (dragItem || item) {
              self.splitItem(type, slot);
            }
            self.deselectItem();
          }
          event.stopPropagation();
        });

        $('#inventorybackground'+i).on('dragstart touchstart', function(event) {
          if (self.selectedItem == -1)
            self.selectInventory(this);
          if (!DragItem)
					  self.moveItem(0, $(this).data("itemSlot"));
        });

        $('#inventory' + i).on('dragover touchover', function(event) {
          event.preventDefault();
        });

        $('#inventorybackground' + i).on('drop touchend', function(event) {
          if ($(this).data("itemSlot") == DragItem.slot)
            return;

          if (DragItem)
					  self.splitItem(0, $(this).data("itemSlot"));
            self.deselectItem();
        });
      }

      $('#game').on('dragover touchover', function(event) {
        event.preventDefault();
      });

      $('#game').on('drop touchend', function(event) {

        self.game.app.setMouseCoordinates(event);

        var invCheck = DragItem && DragItem.slot >= 0;

        if (invCheck) {
          self.dropItem(self.getRealSlot(DragItem.slot));
          DragItem = null;
          self.deselectItem();
        }
      });

      this.sellButton = $('#invActionButton');
      this.sellButton.off().on('click', function(event) {
        var game = self.game;

        var type = parseInt($(this).data('itemType'));
        var slot = parseInt($(this).data('itemSlot'));

        log.info("invActionButton - click, type:"+type+", slot:"+slot);
        var item = self.getItem(type, slot);

        activateItem(type, slot, item);
        self.deselectItem();
      });

      $('.inventoryGoldFrame').off().on('click', function(event) {
        if (self.game.bankDialog.visible) {
          self.game.app.showDropDialog("bankgold");
        }
      });
    },

    deselectItem: function() {
      DragItem = null;
      this.selectItem(this.selectedType, this.selectedItem, false);
    },

    selectItem: function(type, slot, select) {
      //pageslot = realslot % this.pageItems;
      htmlItem = $('#inventorybackground' + slot);
      if (type == 2) {
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
    },

    moveShortcuts: function(x, y) {
      this.container.css({
        "left": this.game.mouse.x + "px",
        "top": this.game.mouse.y + "px"
      });
    },

    showInventoryButton: function() {
      var scale = this.scale;
      this.inventorybutton.setBackground({
        left: 196 * scale,
        top: 314 * scale,
        width: 17 * scale
      });
    },

    refreshInventory: function() {

      this.makeEmptyInventoryAll();

      if (this.pageIndex === 0) {
        this.showInventoryItems(0,24);
      }
      else if (this.pageIndex === 1) {
        this.showInventoryItems(0,24);
      }
    },

    setCurrency: function(gold, gems) {
      $('.inventoryGold').text(getGoldShortHand(gold));
      $('.inventoryGems').text(gems);
    },

    initInventory: function(itemArray) {
      this.pageIndex = 0;
      this.setInventory(itemArray);
      this.refreshInventory();
    },

    setInventory: function(itemArray) {
      for (var item of itemArray)
      {
        var i = item.slot;
        if (item.itemKind == -1)
        {
          this.inventory[i] = null;
          this.makeEmptyInventory(i);
          continue;
        }

        this.inventory[i] = item;
        var kind = item.itemKind;
        if (kind >= 1000 && kind < 2000)
          item.name = ItemLoot[kind - 1000].name;
        else
          item.name = ItemTypes.KindData[kind].name;

        var count = this.pageIndex * this.pageItems;
        if (i >= count && i < (count + this.pageItems))
          this.showInventoryItems(i);
      }
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

    showInventoryItems: function(slotStart, slotEnd) {
      slotStart = slotStart || 0;
      slotEnd = slotEnd || slotStart+1;

      log.info("this.scale=" + this.scale);
      var scale = this.scale;

      // TODO - Work out why not emptying item shortcuts.
      for (var slot = slotStart; slot < slotEnd; ++slot)
      {
        var item = this.getInventoryItem(slot);
        if (!item)
        {
          this.makeEmptyInventory(slot);
          continue;
        }

        var itemKind = item.itemKind;
        var itemNumber = item.itemNumber;

        var itemData;
        if (itemKind >= 1000 && itemKind < 2000) {
          itemData = ItemLoot[itemKind - 1000];
        } else {
          itemData = ItemTypes.KindData[itemKind];
        }
        var spriteName = itemData.sprite;
        if (itemKind >= 1000 && itemKind < 2000) {
          spriteName = game.sprites["itemloot"].file;
        } else if (ItemTypes.isEquippable(itemKind)) {
          spriteName = game.sprites["items"].file;
        }

        if (itemKind > 0) {
          var jq = $('#inventory' + slot);
          Items.jqShowItem(jq, item, jq);
        }

        var highlight = $('#inventoryHL' + slot);

        if (game.inventoryMode == InventoryMode.MODE_SELL ||
            game.inventoryMode == InventoryMode.MODE_AUCTION)
        {
          if (ItemTypes.isEquippable(itemKind)) {
            highlight.css({
              'background-color': 'transparent'
            });
          } else {
            highlight.css({
              'background-color': '#00000077'
            });
          }
        }
        else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
          if (ItemTypes.isEquippable(itemKind) &&  item.itemDurability != item.itemDurabilityMax) {
            highlight.css({
              'background-color': 'transparent'
            });
          } else {
            highlight.css({
              'background-color': '#00000077'
            });
          }
        }
        else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
          if (ItemTypes.isEquippable(itemKind) && item.itemNumber <= this.pageItems) {
            highlight.css({
              'background-color': 'transparent'
            });
          } else {
            highlight.css({
              'background-color': '#00000077'
            });
          }
        }
        else {
          highlight.css({
            'background-color': 'transparent'
          });
        }
      }
    },

    setMaxInventoryNumber: function(maxInventoryNumber) {
      var i = 0;
      this.maxInventoryNumber = maxInventoryNumber;
    },

    makeEmptyInventory: function(i) {
      i = (i % this.pageItems);

      $('#inventorybackground' + i).attr('class', '');

      /*if (i >= 0 && i < 6)
      {
        $('#scinventory' + i).css('background-image', "none");
        $('#scinventory' + i).attr('title', '');
        $('#scinventory' + i).html("");
      }*/

      var cooltime = $('#inventoryHL' + i);
      cooltime.css({
        'background-color': "transparent"
      });

      $('#inventory' + i).css({
        'background-image': "none",
      });
      $('#inventory' + i).attr('title', '');
      $('#inventory' + i).html('');
      $('#slot' + i).html('');
    },

    makeEmptyInventoryAll: function() {
      for (var i = 0; i < 24; i++)
      {
        this.makeEmptyInventory(i);
      }
    },


    toggleInventory: function(open) {
      this.isShowAllInventory = open || !this.isShowAllInventory;
      if (!$("#allinventorywindow").is(':visible')) {
        this.showInventory();
        game.gamepad.dialogOpen();
      } else {
        this.hideInventory();
      }
    },

    showInventory: function() {
      this.pageIndex = 0;
      $('.inventorySellGoldFrame').hide();
      if (game.inventoryMode == InventoryMode.MODE_AUCTION) {
        $('#invActionButton').text("LIST");
        $('#invActionButton').show();
      }
      else if (game.inventoryMode == InventoryMode.MODE_SELL) {
        $('#invActionButton').text("SELL");
        $('#invActionButton').show();
      }
      else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
        $('#invActionButton').text("ENCHANT");
        $('#invActionButton').show();
      }
      else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
        $('#invActionButton').text("REPAIR");
        $('#invActionButton').show();
      }
      else {
        $('#invActionButton').hide();
      }
      this.refreshInventory();
      $('#allinventorywindow').css('display', 'block');
    },

    hideInventory: function() {
      $('#allinventorywindow').css('display', 'none');
      game.inventoryMode = 0;
    },

    decInventory: function(slot) {
      var self = this;

      if (this.coolTimeCallback === null) {
        var cooltime = $('#inventoryHL'+slot);

        var ct = 5;
        cooltime.data('cooltime', ct);
        cooltime.html(ct);
        cooltime.css({
          'background-color': '#FF000077'
        });

        var resetCooltime = function () {
          clearInterval(self.coolTimeCallback);
          cooltime.css({
           'background-color': 'transparent'
          });
          self.coolTimeCallback = null;
          cooltime.html('');
        };

        this.coolTimeCallback = setInterval(function() {
          var ct = parseInt(cooltime.data('cooltime'));
          cooltime.data('cooltime', (--ct).toString());

          cooltime.html(ct);

          if (ct <= 0) {
            resetCooltime();
          }
        }, 1000);

        var item = this.getInventoryItem(slot);
        var count = item.itemNumber;
        if (--count <= 0) {
          resetCooltime();
          makeEmptyInventory(slot);
          item = null;
        }
        return true;
      }
      return false;
    },

    getItemInventorSlotByKind: function(kind) {
      for (i = 0; i < this.maxInventoryNumber; i++) {
        var item = this.inventory[i];
        if (item && kind == item.itemKind)
          return i;
      }
    },

    isInventoryFull: function() {
      for (var i = 0; i < this.maxInventoryNumber; ++i) {
        var item = this.inventory[i];
        if (item == null) {
          return false;
        }
      }
      return true;
    },

    hasItem: function(kind, count) {
      for (i = 0; i < this.maxInventoryNumber; i++) {
        var item = this.inventory[i];
        if (item && kind == item.itemKind && item.itemNumber >= count) {
          return true;
        }
      }
      return false;
    },

    getItemCount: function(kind) {
      for (i = 0; i < this.maxInventoryNumber; i++) {
        var item = this.inventory[i];
        if (item && kind == item.itemKind) {
          return item.itemNumber;
        }
      }
      return null;
    },

    getItemTotalCount: function(kind) {
      var total = 0;
      for (i = 0; i < this.maxInventoryNumber; i++) {
        var item = this.inventory[i];
        if (item && kind == item.itemKind) {
          total += item.itemNumber;
        }
      }
      return total;
    },

    getItemByKind: function(kind) {
      for (i = 0; i < this.maxInventoryNumber; i++) {
        var item = this.inventory[i];
        if (item && kind == item.itemKind) {
          item.slot = i;
          return item;
        }
      }
      return null;
    },

    getRealSlot: function (slot) {
      return slot + (this.pageIndex * this.pageItems);
    },

    getInventoryItem: function (slot) {
      return this.getItem(0, slot);
    },

    getItem: function (type, slot) {
      if (slot < 0) return null;
      if (type == 0) {
        return this.inventory[this.getRealSlot(slot)];
      }
      else if (type == 2)
        return game.equipmentHandler.equipment[slot];
      return null;
    },

    splitItem: function(type, slot) {
        var item = this.getItem(DragItem.type, DragItem.slot);
        if (!item) {
          return;
        }
        DragItem.type2 = type;
        DragItem.slot2 = slot;

        var kind = item.itemKind;
        var count = item.itemNumber;
        if(ItemTypes.isStackedItem(kind) && (count > 1))
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
        if((ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind) || ItemTypes.isCraftItem(kind)) &&
          (count > 1))
        {
          $('#dropCount').val(count);
          game.app.DropItem = DragItem;
          game.app.showDropDialog("dropItems");
        } else {
          game.client.sendItemSlot([2, 0, itemSlot, 1]);
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

    useItem: function(type, item) {
      var player = game.player;
      var kind = item.itemKind;
      if (ItemTypes.isConsumableItem(kind)) {
        if(kind && this.coolTimeCallback === null
           && (ItemTypes.isHealingItem(kind) && player.stats.hp < player.stats.hpMax
           && player.stats.hp > 0) || (ItemTypes.isConsumableItem(kind) && !ItemTypes.isHealingItem(kind)))
        {
            if(this.decInventory(item.slot))
            {
                game.client.sendItemSlot([0, 0, item.slot, 1]);
                game.audioManager.playSound("heal");
                game.shortcuts.refresh();
                return true;
            }
        }
      } else if (ItemTypes.isEquippable(kind)) {
        if (type == 2) {
          this.unequip(item.slot);
        }
        else {
          this.equip(item, item.slot);
        }
        return true;
      }
      return false;
    },

    moveItem: function (type, slot) {
      DragItem = this._moveItem(DragItem, type, slot);
    },

    _moveItem: function (obj, type, slot) {
      if (obj === null) {
        return {"action": 1, "type": type, "slot": slot, "item": this.getItem(type,slot)};
      }
      else {
        var action = obj.action || 1;
        var slot2 = (slot >= 0) ? this.getRealSlot(slot) : slot;
        obj.slot = (obj.type == 0) ? this.getRealSlot(obj.slot) : obj.slot;
        game.client.sendItemSlot([action, obj.type, obj.slot, obj.item.itemNumber, type, slot2]);
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
      if(item.itemNumber == 0)
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
      if(item.itemNumber == 0)
      {
        item = null;
      }
    }
  });

  return InventoryHandler;
});
