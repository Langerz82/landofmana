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

      this.healingCoolTimeCallback = null;

      this.isShowAllInventory = false;

      this.selectedItem = -1;

      this.pageIndex = 0;
      this.pageItems = 24;

      var self = this;
      for (var i = 0; i < 4; i++) {
        $('#scinventorybackground' + i).bind("click", function(event) {
          if (self.game.ready) {
            $("#inventoryGearItems").trigger('click');
            var slot = parseInt(this.id.slice(21));

            log.info("inventoryNumber"+slot);
            var item = self.inventory[slot];
            if (item) {
              item.slot = self.getRealSlot(slot);
              if (ItemTypes.isConsumableItem(item.itemKind)) {
                game.useItem(item);
              }
            }
          }
        });
      }

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
      //DragItem = {};

      self.selectInventory = function(jq) {
        if (!self.game || !self.game.ready)
          return;

        var slot = $(jq).data("itemSlot");
        var type = $(jq).data("itemType");
        log.info("selectInventory - click, slot:"+slot+", type:"+type);

        var realslot = slot;
        var item = null;
        if (type == 0) {
          realslot += (self.pageIndex * self.pageItems);
          item = self.inventory[realslot];
        }
        else {
          item = game.equipmentHandler.equipment[slot];
        }

        //if (!item)
          //return;



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
        if (item && self.selectedItem != realslot) {
            $('.inventorySellGoldFrame').show();
            self.selectItem(type, self.selectedItem, false);
            self.selectItem(type, realslot, true);
            $('#invActionButton').data('itemType', type);
            $('#invActionButton').data('itemSlot', realslot);

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

        if (item && self.selectedItem == realslot) {
          var triggerClick = false;
          if (game.inventoryMode == InventoryMode.MODE_AUCTION) {
            triggerClick = true;
          }
          else if (game.inventoryMode == InventoryMode.MODE_SELL) {
            //log.info("item " + JSON.stringify(item));
            //$('.inventorySellGold').html(parseInt(ItemTypes.getEnchantSellPrice(item)));
            triggerClick = true;
          }
          else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
            //log.info("item " + JSON.stringify(item));
            //$('.inventorySellGold').html(parseInt(ItemTypes.getRepairPrice(item)));
            triggerClick = true;
          }
          else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
            //log.info("item " + JSON.stringify(item));
            //$('.inventorySellGold').html(parseInt(ItemTypes.getEnchantPrice(item)));
            triggerClick = true;
          }
          else if (game.inventoryMode == InventoryMode.MODE_BANK) {
            //log.info("item " + JSON.stringify(item));
            triggerClick = true;
          }
          else {
            item.slot = realslot;
            game.useItem(item, type);
          }
          if (triggerClick) {
            $('#invActionButton').data('itemType', type);
            $('#invActionButton').data('itemSlot', slot);
            $('#invActionButton').trigger("click");
          }
          self.deselectItem();
        }
        //self.deselectItem();
      }

// TODO: FIX BROKEN.
      for (var i = 0; i <= 4; i++) {
        // TODO - Check if not needed.
        //$('#characterEquip'+i).data("itemType",2);
        //$('#characterEquip'+i).data("itemSlot",i);
        $('#equipment' + i).attr('draggable', true);
        $('#equipment' + i).draggable = true;

        $('#equipment'+i).data("itemType",2);
        $('#equipment'+i).data("itemSlot",i);

        $('#equipBackground'+i).data("itemType",2);
        $('#equipBackground'+i).data("itemSlot",i);

        var equipItem = function (slot) {
          if (DragItem) {
            game.client.sendItemSlot([1, DragItem.type, DragItem.slot, 1, 2, slot]);
            DragItem = null;
            self.deselectItem();
          }
          else {
            DragItem = {};
            DragItem.action = 1;
            DragItem.type = 2;
            DragItem.slot = slot;
          }
        };

        var getEquipment = function (slot) {
          if (slot < 0) return null;
          return game.equipmentHandler.equipment[slot];
        };

        $('#equipBackground'+i).on("click", function (e) {
          var slot = $(this).data("itemSlot");
          if (self.selectedItem >= 0) {
            equipItem(slot);
          }
          else {
            if (self.selectedItem == -1 && (slot >= 0 && getEquipment(slot) == null))
              return;

            self.selectInventory(this);
            equipItem(slot);
          }
        });

        $('#equipment'+i).on('dragstart touchstart', function(event) {
          if (self.selectedItem < 0) {
            self.selectInventory(this);
            equipItem($(this).data("itemSlot"));
          }
        });

        $('#equipment' + i).on('dragover touchover', function(event) {
          event.preventDefault();
        });

        $('#equipBackground'+i).on('drop touchend', function(event) {
          equipItem($(this).data("itemSlot"));
        });
      }

      for (var i = 0; i < 24; i++) {
        $('#inventory' + i).attr('draggable', true);
        $('#inventory' + i).draggable = true;

        $('#inventorybackground' + i).data('itemType',0);
        $('#inventorybackground' + i).data('itemSlot',i);
        //$('#inventory' + i).data('itemType',0);
        //$('#inventory' + i).data('itemSlot',i);
        //$('#inventorybackground' + i).click(selectInventory);

				var moveItem = function (realslot) {
          //var realslot = slot; // + (self.pageIndex * self.pageItems);

          if (DragItem === null) {
            DragItem = {};
            DragItem.type = 0;
            DragItem.slot = realslot;
          }
          else {
            var action = DragItem.action || 1;
            game.client.sendItemSlot([action, DragItem.type, DragItem.slot, 1, 0, realslot]);
            DragItem = null;
            self.deselectItem();
          }
				};

				/*var dropItem = function (slot) {
          var realslot = slot + (self.pageIndex * self.pageItems);
				};*/

        var itemslot = function (slot) {
          return slot + (self.pageIndex * self.pageItems);
        }

        /*var getItem = function (realslot) {
          if (realslot < 0) return null;
          return self.inventory[realslot];
        };*/

        $('#inventorybackground'+i).on('click tap', function(event) {
          var slot = $(this).data("itemSlot");
          var realslot = itemslot(slot);

          var hasSelected = (self.selectedItem == -1);

          if (!hasSelected && self.getItem(slot) == null) {
            if (game.gamepad.isActive())
                moveItem(realslot);
            self.deselectItem();
            return;
          }
          if (!hasSelected) {
            self.selectInventory(this);
            if (game.gamepad.isActive())
              moveItem(realslot);
            return;
          }

          var isSame = (self.selectedItem == realslot);
          if (hasSelected || !isSame)
            self.selectInventory(this);
          if (!game.renderer.isDesktop || isSame || hasSelected)
            moveItem(realslot);
        });

        $('#inventorybackground'+i).on('dragstart touchstart', function(event) {
          if (self.selectedItem == -1)
            self.selectInventory(this);
          if (!DragItem)
					  moveItem(itemslot($(this).data("itemSlot")));
        });

        $('#inventory' + i).on('dragover touchover', function(event) {
          event.preventDefault();
        });

        $('#inventorybackground' + i).on('drop touchend', function(event) {
          if (DragItem)
					  moveItem(itemslot($(this).data("itemSlot")));
        });
      }

      $('#game').on('dragover touchover', function(event) {
        event.preventDefault();
      });

      $('#game').on('drop touchend', function(event) {

        self.game.app.setMouseCoordinates(event);

        var invCheck = DragItem && DragItem.slot >= 0;

        if (invCheck) {
          var mousePos = self.game.getMouseGridPosition();
          self.game.dropItem(DragItem.slot, mousePos.x, mousePos.y);
          DragItem = null;
        }
      });

      this.sellButton = $('#invActionButton');
      this.sellButton.off().on('click', function(event) {
        var game = self.game;

        var type = parseInt($(this).data('itemType'));
        var slot = parseInt($(this).data('itemSlot'));

        log.info("invActionButton - click, type:"+type+", slot:"+slot);
        var item = self.inventory[slot];
        if (type === 2)
          item = game.equipmentHandler.equipment[slot];

        self.deselectItem();
        if (item) {
          var kind = item.itemKind;
          if (game.inventoryMode == InventoryMode.MODE_AUCTION) {
            if (ItemTypes.isLootItem(kind) || ItemTypes.isConsumableItem(kind))
              return;

              var value = ~~(ItemTypes.getEnchantSellPrice(item)/2);
              $('#auctionSellCount').val(value);
              game.app.showAuctionSellDialog(slot);
              //game.client.sendAuctionSell(slot);
          }
          else if (game.inventoryMode == InventoryMode.MODE_SELL) {
            if (ItemTypes.isLootItem(kind))
              return;

              game.client.sendStoreSell(type, slot);
          }
          else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
              if (!ItemTypes.isEquipment(kind))
                return;

              game.repairItem(type, item, slot);
          }
          else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
              if (!ItemTypes.isEquipment(kind))
                return;

              game.enchantItem(type, item, slot);
          }
          else if (game.inventoryMode == InventoryMode.MODE_BANK) {
            if (!game.bankHandler.isBankFull()) {
              game.client.sendItemSlot([1, type, slot, 1, 1, -1]);
            }
          }
        }
      });

      $('.inventoryGoldFrame').off().on('click', function(event) {
        if (self.game.bankDialog.visible) {
          self.game.app.showDropDialog(-1);
        }
      });
    },

    deselectItem: function() {
      DragItem = null;
      this.selectItem(this.selectedType, this.selectedItem, false);
    },

    selectItem: function(type, realslot, select) {
      pageslot = realslot % this.pageItems;
      htmlItem = $('#inventorybackground' + pageslot);
      if (type == 2) {
        htmlItem = $('#equipBackground'+realslot);
      }
      this.selectedType = type;
      if (select) {
        this.selectedItem = realslot;
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
        //for (var i=0; i < 24; ++i)
        this.showInventoryItems(0,24);
      }
      else if (this.pageIndex === 1) {
        //for (var i=24; i < 48; ++i)
        this.showInventoryItems(24,48);
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
        for(var i in this.inventory){
            if(this.inventory[i] && this.inventory[i].itemKind === itemKind){
            	 a += this.inventory[i].itemNumber;
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
      for (var i = slotStart; i < slotEnd; ++i)
      {
        var item = this.inventory[i];
        var itemSlot = i % this.pageItems;
        if (!item)
        {
          this.makeEmptyInventory(itemSlot);
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

        /*if (ItemTypes.isConsumableItem(itemKind)) {
          if (itemKind > 0) {

            $('#scinventory' + itemSlot).css({
              'background-image': "url('img/" + scale + "/" + spriteName + "')",
              'background-position': '-' + (itemData.offset[0] * scale * 24) + 'px -' + (itemData.offset[1] * scale * 24) + 'px',
              'background-size': (144 * scale) + "px " + (24 * scale) + "px",
              'background-offset': '-' + scale + "px -" + scale + "px"
            });


            $('#scinventory' + itemSlot).attr('title', Item.getInfoMsgEx(item));
            $('#scinventory' + itemSlot).html(itemNumber);
          }
        }*/

        if (itemKind > 0) {
          var jq = $('#inventory' + itemSlot);
          Items.jqShowItem(jq, item, jq);

          //jq.attr('title', Item.getInfoMsgEx(item));
          //jq.html(itemNumber);
        }

        /*if (ItemTypes.isEquippable(itemKind)) {
          $('#inventory' + itemSlot).html(ItemTypes.getLevelByKind(itemKind) + '+' + itemNumber);
        } else {
          if (itemNumber > 1)
            $('#inventory' + itemSlot).html(itemNumber);
        }*/


        var highlight = $('#inventoryHL' + itemSlot);

        var ct = highlight.data('cooltime');
        if (ct && ct > 0) {
          highlight.css({
            'background-color': '#FF000077'
          });
          /*var shortcut = $('#scinventoryHL' + itemSlot);
          shortcut.css({
            'background-color': '#FF000077'
          });*/
          //return;
        }

        //var parent = $('#inventory' + itemSlot).parent();
        //parent.data('itemSlot', i);
        if (game.inventoryMode == InventoryMode.MODE_SELL ||
            game.inventoryMode == InventoryMode.MODE_AUCTION)
        {
          if (ItemTypes.isEquippable(itemKind)) {
            //$('#inventory' + itemSlot).addClass('active');
            highlight.css({
              'background-color': 'transparent'
            });
          } else {
            //$('#inventory' + itemSlot).removeClass('active');
            highlight.css({
              'background-color': '#00000077'
            });
            //parent.data('itemSlot', -1);
          }
        }
        else if (game.inventoryMode == InventoryMode.MODE_REPAIR) {
          if (ItemTypes.isEquippable(itemKind) &&  item.itemDurability != item.itemDurabilityMax) {
            //$('#inventory' + itemSlot).addClass('active');
            highlight.css({
              'background-color': 'transparent'
            });
          } else {
            //$('#inventory' + itemSlot).removeClass('active');
            highlight.css({
              'background-color': '#00000077'
            });
            //parent.data('itemSlot', -1);
          }
        }
        else if (game.inventoryMode == InventoryMode.MODE_ENCHANT) {
          if (ItemTypes.isEquippable(itemKind) && item.itemNumber < 25) {
            //$('#inventory' + itemSlot).addClass('active');
            highlight.css({
              'background-color': 'transparent'
            });
          } else {
            //$('#inventory' + itemSlot).removeClass('active');
            highlight.css({
              'background-color': '#00000077'
            });
            //parent.data('itemSlot', -1);
          }
        }
        else {
          //$('#inventory' + itemSlot).addClass('active');
          highlight.css({
            'background-color': 'transparent'
          });
        }
      }
    },

    setMaxInventoryNumber: function(maxInventoryNumber) {
      var i = 0;
      this.maxInventoryNumber = maxInventoryNumber;

      /*for (i = 0; i < maxInventoryNumber; i++) {
        $('#inventorybackground' + i).css('display', 'block');
        $('#inventorynumber' + i).css('display', 'block');
      }*/
    },

    makeEmptyInventory: function(i) {
      i = (i % this.pageItems);

      $('#inventorybackground' + i).attr('class', '');

      if (i >= 0 && i < 6)
      {
        $('#scinventory' + i).css('background-image', "none");
        $('#scinventory' + i).attr('title', '');
        $('#scinventory' + i).html("");
      }

      $('#inventoryHL' + i).css({
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
      /*else if (game.inventoryMode == InventoryMode.MODE_BANK) {
        $('#invActionButton').text("BANK");
        $('#invActionButton').show();
      }*/
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

      if (this.healingCoolTimeCallback === null) {
        //var cooltime = $('#scinventoryHL'+slot);
        var cooltime2 = $('#inventoryHL'+slot);

        var ct = '5';
        cooltime2.data('cooltime', ct);

        //cooltime.html(ct);
        cooltime2.html(ct);

        this.healingCoolTimeCallback = setInterval(function() {
          var ct = parseInt(cooltime2.data('cooltime'));
          cooltime2.data('cooltime', (--ct).toString());

          //cooltime.html(ct);
          cooltime2.html(ct);

          if (ct <= 0) {
            clearInterval(self.healingCoolTimeCallback);
            /*cooltime.css({
             'background-color': 'transparent'
           });*/
            cooltime2.css({
             'background-color': 'transparent'
            });
            self.healingCoolTimeCallback = null;
            //cooltime.html('');
            cooltime2.html('');
          }

        }, 1000);

        var count = this.inventory[slot].itemNumber;
        count -= 1;
        if (count <= 0) {
          this.inventory[slot] = null;
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
      for (var i = 6; i < this.maxInventoryNumber; ++i) {
        var item = this.inventory[i];
        if (item == null) {
          return false;
        }
      }
      return true;
    },

    hasItem: function(kind, count) {
      for (i = 6; i < this.maxInventoryNumber; i++) {
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

    getItem: function (slot) {
      var realslot = slot + (this.pageIndex * this.pageItems);
      if (realslot < 0) return null;
      if (!this.inventory[realslot])
        return null;
      return this.inventory[realslot];
    },
  });

  return InventoryHandler;
});
