/* global Types, Class */



define(['button2', 'entity/item', 'data/itemlootdata', 'data/items'],
  function(Button2, Item, ItemLoot, Items)
{
  var InventoryDialog = Class.extend({
    init: function() {
      this.maxInventoryNumber = 48;
      this.itemListCount = 24;
      this.inventory = [];

      this.scale = game.renderer.getUiScaleFactor();
      this.xscale = game.renderer.getIconScaleFactor();
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
      this.itemCooldown = 5000;
      this.cooldowns = [];
      this.cooldownTime = 0;

      this.isShowAllInventory = false;

      this.selectedItem = -1;

      this.pageIndex = 0;
      this.pageItems = 24;

      var self = this;

      this.jqActionButton = $('#invActionButton');

      this.closeButton = $('#inventoryCloseButton');
      this.closeButton.click(function(event) {
        game.inventoryMode = InventoryMode.MODE_NORMAL;
        self.deselectItem();
        self.hideInventory();
        self.refreshInventory();
        if (self.backPage) {
          self.backPage.show();
          self.backPage = null;
        }
      });

      $('#inventoryGearItems').click(function(event) {
        self.pageIndex = 0;
        self.deselectItem();
        self.refreshInventoryAll();
      });
      $('#inventoryGear2Items').click(function(event) {
        self.pageIndex = 1;
        self.deselectItem();
        self.refreshInventoryAll();
      });
    },

    selectInventory: function(jq) {
      if (!game || !game.ready)
        return;

      var type = $(jq).data("itemType");
      var slot = $(jq).data("itemSlot");

      log.info("selectInventory - click, slot:"+slot+", type:"+type);

      var item = this.getItem(type, slot);

      $('.inventorySellGold').html("0");
      if (item) {
        var kind = item.itemKind;
        if (game.inventoryMode === InventoryMode.MODE_ENCHANT ||
            game.inventoryMode === InventoryMode.MODE_REPAIR)
        {
          if (!ItemTypes.isEquipment(kind))
            return;
        }
        if (game.inventoryMode === InventoryMode.MODE_SELL ||
            game.inventoryMode === InventoryMode.MODE_AUCTION)
        {
          if (ItemTypes.isLootItem(kind))
            return;
        }
      }
      //log.info("slot=" + slot);
      //log.info("inventories " + JSON.stringify(this.inventory));
      if (item && this.selectedItem !== slot) {
          $('.inventorySellGoldFrame').show();
          this.selectItem(type, this.selectedItem, false);
          this.selectItem(type, slot, true);
          this.jqActionButton.data('itemType', type);
          this.jqActionButton.data('itemSlot', slot);

          var kind = item.itemKind;
          if (game.inventoryMode === InventoryMode.MODE_AUCTION) {
            var value = ~~(ItemTypes.getEnchantSellPrice(item)/2);
            $('.inventorySellGold').html(parseInt(value));
          }
          else if (game.inventoryMode === InventoryMode.MODE_SELL) {
            $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantSellPrice(item)));
          }
          else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
            $('.inventorySellGold').html(parseInt(ItemTypes.getRepairPrice(item)));
          }
          else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
            $('.inventorySellGold').html(parseInt(ItemTypes.getEnchantPrice(item)));
          }
          else if (game.inventoryMode === InventoryMode.MODE_BANK) {
            $('.inventorySellGoldFrame').hide();
          }
          else if (game.inventoryMode === InventoryMode.MODE_NORMAL) {
            $('.inventorySellGoldFrame').hide();
          }
          return;
      }

      if (item && this.selectedItem === slot) {
        var triggerClick = false;
        if (game.inventoryMode === InventoryMode.MODE_AUCTION ||
            game.inventoryMode === InventoryMode.MODE_SELL ||
            game.inventoryMode === InventoryMode.MODE_REPAIR ||
            game.inventoryMode === InventoryMode.MODE_ENCHANT ||
            game.inventoryMode === InventoryMode.MODE_BANK)
        {
          triggerClick = true;
        }
        if (triggerClick) {
          this.jqActionButton.data('itemType', type);
          this.jqActionButton.data('itemSlot', slot);
          this.jqActionButton.trigger("click");
        }
        this.deselectItem();
      }
    },

    activateItem: function (type, slot, item, btnPressed) {
      if (item) {
        var kind = item.itemKind;
        if (game.inventoryMode === InventoryMode.MODE_AUCTION) {
          if (ItemTypes.isLootItem(kind) || ItemTypes.isConsumableItem(kind))
            return;

          var value = ~~(ItemTypes.getEnchantSellPrice(item)/2);
          $('#auctionSellCount').val(value);
          game.app.showAuctionSellDialog(slot);
        }
        else if (game.inventoryMode === InventoryMode.MODE_SELL) {
          if (ItemTypes.isLootItem(kind))
            return;

          game.client.sendStoreSell(type, slot);
        }
        else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
          if (!ItemTypes.isEquipment(kind))
            return;

          game.equipment.repairItem(type, slot, item);
        }
        else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
          if (!ItemTypes.isEquipment(kind))
            return;

          game.equipment.enchantItem(type, slot, item);
        }
        else if (game.inventoryMode === InventoryMode.MODE_BANK) {
          if (!game.bankHandler.isBankFull()) {
            this.handler.moveItem(1, -1);
          }
        }
        else if (game.inventoryMode === InventoryMode.MODE_NORMAL) {
          if (this.selectedItem >= 0 && btnPressed)
            this.handler.dropItem(slot);
          else {
            if (DragItem)
              this.handler.useItem(DragItem.type, item);
          }
        }
        else {
          if (DragItem)
            this.handler.useItem(DragItem.type, item);
        }
      } else {
        this.handler.splitItem(1, slot);
      }
    },

    selectEquipment: function (event, type, slot) {
      var item = this.getItem(type, slot);
      if (item !== null && DragItem && DragItem.item !== item)
        this.deselectItem();

      if (this.selectedItem < 0)
      {
        this.selectInventory(event.target);
        this.handler.moveItem(2, slot, true);
        event.stopPropagation();
      }
    },

    loadInventoryEvents: function() {
      var self = this;

      var max = game.equipment.maxNumber;
      for (var i = 0; i < max; i++) {
        $('#equipment' + i).attr('draggable', true);
        $('#equipment' + i).draggable = true;

        $('#equipment'+i).data("itemType",2);
        $('#equipment'+i).data("itemSlot",i);

        $('#equipBackground'+i).data("itemType",2);
        $('#equipBackground'+i).data("itemSlot",i);

        $('#equipment'+i).on("click", function (e) {
        });

        $('#equipBackground'+i).on("click", function (e) {
          var type = $(this).data("itemType");
          var slot = $(this).data("itemSlot");

          if (self.selectedItem < 0) {
            self.selectEquipment(e, type, slot);
          }
          else {
            var dragItem = (DragItem) ? self.getItem(DragItem.type, DragItem.slot) : null;
            var item = self.getItem(type, slot);

            if (dragItem && item) {
              if (dragItem === item) {
                self.activateItem(type, slot, item);
              }
              else
                self.handler.moveItem(type, slot);
            }
            else if (dragItem) {
              self.handler.useItem(DragItem.type, dragItem);
            }
            else if (item) {
              self.handler.useItem(type, item);
            }
            self.deselectItem();
          }
          event.stopPropagation();
        });

        $('#equipment'+i).on('dragstart', function(event) {
          var slot = $(this).data("itemSlot");
          self.selectEquipment(event, 2, slot);
        });

        $('#equipment' + i).on('dragover', function(event) {
          event.preventDefault();
        });
        $('#equipBackground' + i).on('dragover', function(event) {
          event.preventDefault();
        });

        $('#equipBackground'+i).on('drop', function(event) {
          if (DragItem) {
            if ($(this).data("itemSlot") === DragItem.slot)
              return;

            self.handler.moveItem(2, $(this).data("itemSlot"));
            self.deselectItem();
          }
        });
      }

      for (var i = 0; i < this.pageItems; i++) {
        $('#inventory'+i).attr('draggable', true);
        $('#inventory'+i).draggable = true;

        $('#inventory'+i).data('itemType',0);
        $('#inventory'+i).data('itemSlot',i);
        $('#inventorybackground'+i).data('itemType',0);
        $('#inventorybackground'+i).data('itemSlot',i);

        $('#inventorybackground'+i).on('click', function(event) {
          var type = $(this).data("itemType");
          var slot = $(this).data("itemSlot");

          if (self.selectedItem >= 0)
          {
            var dragItem = (DragItem) ? self.getItem(DragItem.type, DragItem.slot) : null;
            var item = self.getItem(type, slot);
            if (dragItem && item) {
              if (dragItem === item) {
                self.activateItem(type, slot, item);
              }
              else {
                self.handler.moveItem(type, slot);
              }
            }
            else if (dragItem || item) {
              self.handler.splitItem(type, slot);
            }
            self.deselectItem();
          }
          else {
            self.selectInventory(this);
            self.handler.moveItem(0, slot, true);
          }
          event.stopPropagation();
        });

        $('#inventory'+i).on('dragstart', function(event) {
          if (self.selectedItem < 0) {
            self.selectInventory(this);
            self.handler.moveItem(0, $(this).data("itemSlot"), true);
            event.stopPropagation();
          }
        });

        $('#inventorybackground'+i).on('dragover', function(event) {
          event.preventDefault();
        });

        $('#inventory'+i).on('dragover', function(event) {
          event.preventDefault();
        });

        $('#inventorybackground'+i).on('drop', function(event) {
          if (DragItem) {
            if ($(this).data("itemSlot") === DragItem.slot)
              return;

            self.handler.splitItem(0, $(this).data("itemSlot"));
            self.deselectItem();
          }
        });
      }

      $('#game').on('dragover touchover', function(event) {
        event.preventDefault();
      });

      $('#game').on('drop touchend', function(event) {

        game.app.setMouseCoordinates(event);

        var invCheck = DragItem && DragItem.slot >= 0;

        if (invCheck) {
          self.handler.dropItem(self.getRealSlot(DragItem.slot));
          DragItem = null;
          self.deselectItem();
        }
      });

      this.sellButton = $('#invActionButton');
      this.sellButton.off().on('click', function(event) {
        var type = parseInt($(this).data('itemType'));
        var slot = parseInt($(this).data('itemSlot'));

        log.info("invActionButton - click, type:"+type+", slot:"+slot);
        var item = self.getItem(type, slot);

        self.activateItem(type, slot, item, true);
        self.deselectItem();
      });

      $('.inventoryGoldFrame').off().on('click', function(event) {
        if (game.inventoryMode === InventoryMode.MODE_BANK) {
          game.app.showDropDialog("bankgold");
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
      if (type === 2) {
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

    showInventoryButton: function() {
      var scale = this.scale;
      this.inventorybutton.setBackground({
        left: 196 * scale,
        top: 314 * scale,
        width: 17 * scale
      });
    },

    refreshInventory: function(index) {
      index = index || -1;
      if (index > -1) {
        item = this.getItem(0,index);
        if (item)
          this.showItems(index);
        else {
          this.makeEmptyInventory(index);
        }
        return;
      }
      this.refreshInventoryAll();
    },

    refreshInventoryAll: function () {
      this.makeEmptyInventoryAll();
      this.showItems(0,24);
      this.funcCooldown();
    },

    setCurrency: function(gold, gems) {
      $('.inventoryGold').text(Utils.getNumShortHand(gold, 2));
      $('.inventoryGems').text(gems);
    },

    /*removeItem: function (realslot) {
      var slotMin = (this.pageIndex * this.pageItems);
      var slotMax = slotMin + this.pageItems;
      if (realslot < slotMin || realslot >= slotMax)
        return;

      this.makeEmptyInventory(realslot % this.pageItems);
    },*/

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
      var jqGemsFrame = $('#allinventorywindow .inventoryGemsFrame');
      var jqActionButton = $('#invActionButton');
      jqGemsFrame.hide();
      if (game.inventoryMode === InventoryMode.MODE_AUCTION) {
        jqActionButton.text("LIST");
        jqActionButton.show();

      }
      else if (game.inventoryMode === InventoryMode.MODE_SELL) {
        jqActionButton.text("SELL");
        jqActionButton.show();
      }
      else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
        jqActionButton.text("ENCHANT");
        jqActionButton.show();
      }
      else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
        jqActionButton.text("REPAIR");
        jqActionButton.show();
      }
      else if (game.inventoryMode === InventoryMode.MODE_BANK) {
        jqActionButton.text("BANK");
        jqActionButton.show();
      }
			else if (game.inventoryMode === InventoryMode.MODE_NORMAL) {
        jqActionButton.text("DROP");
        jqActionButton.show();
        jqGemsFrame.show();
      }
      else {
				jqActionButton.hide();
      }
      this.refreshInventoryAll();
      $('#allinventorywindow').css('display', 'block');
    },

    hideInventory: function() {
      $('#allinventorywindow').css('display', 'none');
      game.inventoryMode = 0;
    },

    getItems: function (type, cond) {
        var items = [];
        for (var i = 0; i < this.pageItems; ++i) {
          var item = this.getItem(type, i);
          if (item && (!cond || (cond && cond(item))))
            items.push(item);
        }
        return items;
    },

    funcCooldownExec: function () {
      this.cooldownTime = Date.now();
      this.funcCooldown();
      game.shortcuts.cooldownItems();
    },

    funcCooldown: function() {
      var self = this;

      var fnCooldownItems = function () {
        var cond = function (item) { return ItemTypes.isConsumableItem(item.itemKind); };
        var items = self.getItems(0, cond);
        var cooldowns = [];
        for (var item of items) {
          var slot = item.slot % self.pageItems;
          cooldowns.push($('#inventoryHL'+slot));
        }
        return cooldowns;
      }

      var resetCooltime = function () {
        for (var ct of self.cooldowns) {
          ct.removeData('cooltime');
          ct.html('');
          ct.css({
            'background-color': 'transparent'
          });
        }
        clearInterval(self.coolTimeCallback);
        self.coolTimeCallback = null;
      };
      resetCooltime();

      if (self.cooldownTime != 0) {
        var setCooltimes = function () {
          self.cooldowns = fnCooldownItems();

          var elapsedTime = (Date.now() - self.cooldownTime);
          if (elapsedTime >= self.itemCooldown) {
            self.cooldownTime = 0;
            resetCooltime();
            return;
          }
          for (var ct of self.cooldowns) {
            ct.data('cooltime', true);
            ct.html(Math.ceil((self.itemCooldown-elapsedTime)/1000));
            ct.css({
              'background-color': '#FF000077'
            });
          }
        };

        this.coolTimeCallback = setInterval(function() {
          setCooltimes();
        }, 100);
        setCooltimes();
      }
    },

    getRealSlot: function (slot) {
      slot = slot || 0;
      return slot + (this.pageIndex * this.pageItems);
    },

    getItem: function (type, slot) {
      if (slot < 0) return null;
      if (type === 0) {
        return game.inventory.inventory[this.getRealSlot(slot)];
      }
      else if (type === 2)
        return game.equipment.equipment[slot];
      return null;
    },

    makeEmptyInventory: function(i) {

      $('#inventorybackground' + i).attr('class', '');

      var cooltime = $('#inventoryHL' + i);
      cooltime.css({
        'background-color': "transparent"
      });

      $('#inventory' + i).css({
        'display': 'none',
        'background-image': "none",
      });
      $('#inventory' + i).attr('title', '');
      $('#inventory' + i).html('');
      $('#slot' + i).html('');
    },

    makeEmptyInventoryAll: function() {
      for (var i = 0; i < this.pageItems; i++)
      {
        this.makeEmptyInventory(i);
      }
    },

    showItems: function(slotStart, slotEnd) {
      slotStart = slotStart || 0;
      slotEnd = slotEnd || slotStart+1;

      log.info("this.scale=" + this.scale);
      var scale = this.scale;

      // TODO - Work out why not emptying item shortcuts.
      for (var slot = slotStart; slot < slotEnd; ++slot)
      {
        var item = this.getItem(0, slot);
        if (!item)
        {
          this.makeEmptyInventory(slot);
          continue;
        }

        var itemKind = item.itemKind;
        var itemNumber = item.itemNumber;

        if (itemKind > 0) {
          var jq = $('#inventory' + slot);
          Items.jqShowItem(jq, item, jq);
        }

        var highlight = $('#inventoryHL' + slot);

        if (game.inventoryMode === InventoryMode.MODE_SELL ||
            game.inventoryMode === InventoryMode.MODE_AUCTION)
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
        else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
          if (ItemTypes.isEquippable(itemKind) &&  item.itemDurability !== item.itemDurabilityMax) {
            highlight.css({
              'background-color': 'transparent'
            });
          } else {
            highlight.css({
              'background-color': '#00000077'
            });
          }
        }
        else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
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
          if (!highlight.data('cooltime')) {
            highlight.css({
              'background-color': 'transparent'
            });
          }
        }
      }
    },
  });

  return InventoryDialog;
});
