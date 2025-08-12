define(['data/skilldata', 'data/items'], function(SkillData, Items) {
  DragShortcut = null;

  var Shortcut = Class.extend({
    init: function(parent, slot, type) {
      var self = this;

      this.parent = parent;
      this.slot = slot;
      this.type = type;
      this.shortcutId = -1;
      this.cooldownTime = 0;

      this.jq = $('#shortcut'+slot);
      this.jqb = $('#scbackground'+slot);
      this.jqCooldown = $('#scCD'+slot);
      this.jqnum = $('#shortcutnum'+slot);

      this.jq.attr('draggable', true);
      this.jq.draggable = true;

      this.jq.data("slot", slot);

      var fnClick = function(e) {
        var slot = self.jq.data("slot");
        if (ShortcutData || DragItem) {
          self.setup(slot);
          return false;
        }
        if (self.type > 0) {
          self.exec();
        }
        return false;
      };

      this.jqb.click(fnClick);

      this.jq.on('dragstart', function(e) {
        var slot = self.jq.data("slot");
        DragShortcut = {"slot": slot};
      });

      this.jqb.on('drop', function(e) {
        var slot = self.jq.data("slot");
        var newShortcut = self.parent.shortcuts[slot];
        var oldShortcut = null;
        if (DragShortcut)
          oldShortcut = self.parent.shortcuts[DragShortcut.slot];
        var tmp = Object.assign({}, newShortcut);
        if (newShortcut && oldShortcut) {
          if (newShortcut.isCoolingDown)
            return;
          if (oldShortcut.isCoolingDown)
            return;
          newShortcut.install(oldShortcut.slot, oldShortcut.type, oldShortcut.shortcutId);
          oldShortcut.install(tmp.slot, tmp.type, tmp.shortcutId);
        }
        else if (newShortcut && !oldShortcut)
        {
          self.setup(slot);
        }
        DragShortcut = null;
        ShortcutData = null;
        DragItem = null;
      });

      this.jqb.unbind('dragover').bind('dragover', function(event) {
          event.preventDefault();
      });
      this.jq.unbind('dragover').bind('dragover', function(event) {
          event.preventDefault();
      });
    },

    setup: function (slot) {
      //var slot = this.jq.data("slot");
      // TODO fill.
      if (this.isCoolingDown)
        return;

      if (DragItem) {
        var item = game.inventory.inventory[DragItem.slot];
        if (item && ItemTypes.isConsumableItem(item.itemKind)) {
          this.parent.install(slot, 1, item.itemKind);
        }
        game.inventoryDialog.deselectItem();
        DragItem = null;
      }
      if (ShortcutData) {
        this.parent.install(slot, 2, ShortcutData.index);
        game.skillDialog.page.clearHighlight();
        ShortcutData = null;
      }
      if (this.shortcutId > -1)
        game.client.sendShortcut(this.slot, this.type, this.shortcutId);
      this.display();
    },

    install: function (slot, type, id) {
      this.slot = slot;
      this.type = type;
      this.shortcutId = id;

      if (this.type === 1) {
        this.cooldownTime = 5;
        //this.itemKind = this.shortcutId;
      }
      else if (this.type === 2) {
        this.cooldownTime = ~~(SkillData.Data[id].recharge / 1000);
      }
      this.display();
    },

    clear: function () {
        this.jqnum.css("display", "none");
        this.jq.css("display", "none");
    },

    display: function () {
      this.jqnum.css("display", "block");
      this.jq.css("display", "block");

      if (this.type === 1) {
        var count = game.inventory.getItemTotalCount(this.shortcutId);
        var item = {itemKind: this.shortcutId, itemNumber: count};
        Items.jqShowItem(this.jq, item, this.jq, 1.5);
        return;
      }
      else if (this.type === 2) {
        // Temp not Working
        var skill = null;
        SkillData.jqShowSkill(this.jq, this.shortcutId, this.jq);
        return;
      }
      this.clear();
    },

    exec: function () {
      if (this.cooldown && this.cooldown.cooltimeCounter > 0)
        return;

      var res = false;
      // display cooldown for all
      if (this.type === 1) {
        var item = game.inventory.getItemByKind(this.shortcutId);
        if (item)
          res = game.inventory.useItem(0, item);
      } else if (this.type === 2) {
        var skill = game.player.skillHandler.skills[this.shortcutId];
        if (skill)
          res = skill.execute();
      }

      if (res)
        this.parent.cooldownStart(this.type, this.shortcutId);

      this.display();
    },

    cooldownStart: function (time) {
      if (this.cooldown)
        this.cooldown.done();

      this.cooldown = new Cooldown(this);
      this.cooldown.start(time);

      if (this.type === 2)
        game.skillDialog.page.cooldownStart(this.shortcutId);
    },

  });

  var Cooldown = Class.extend({
    init: function(shortcut) {
      this.shortcut = shortcut;
      this.children = shortcut.parent.getSameShortcuts(shortcut);
    },

    start: function (time) {
      var self = this;

      this.cooltimeCounter = time;

      var funcCooldown = function () {
        if (self.cooltimeCounter >= 0) {
          self.tick();
          self.cooltimeCounter -= 1;
        } else {
          self.done();
        }
      };

      clearInterval(this.cooltimeTickHandle);
      this.cooltimeTickHandle = setInterval(funcCooldown, 1000);

      funcCooldown();

      for (var sc of this.children) {
        sc.isCoolingDown = true;
        sc.jqCooldown.show();
      }
    },

    tick: function () {
      this.children = this.shortcut.parent.getSameShortcuts(this.shortcut);

      if (this.cooltimeCounter === 0) {
        this.done();
        return;
      }

      this.show();
    },

    show: function () {
      for (var sc of this.children) {
        sc.jqCooldown.show();
        sc.jqCooldown.html(this.cooltimeCounter);
      }
    },

    done: function () {
      clearInterval(this.cooltimeTickHandle);
      this.cooltimeTickHandle = null;
      this.cooltimeCounter = 0;

      for (var sc of this.children) {
        sc.isCoolingDown = false;
        sc.jqCooldown.hide();
        sc.cooldown = null;
      }
      this.cooldown = null;
      this.shortcut.cooldown = null;
      delete this;
    },
  });

  var ShortcutHandler = Class.extend({
    init: function() {
      this.shortcuts = [];
      this.shortcutCount = 8;

      var shortcut;
      for (var i=0; i < this.shortcutCount; ++i) {
        shortcut = new Shortcut(this, i, 0);
        shortcut.clear();
        this.shortcuts.push(shortcut);
      }
    },

    installAll: function (arr) {
      var shortcut;
      var i=0;
      for (var sc of arr) {
        if (sc)
          this.shortcuts[sc[0]].install(sc[0], sc[1], sc[2]);
      }
    },

    install: function (slot, type, shortcutId) {
      if (this.shortcuts[slot])
        this.shortcuts[slot].install(slot, type, shortcutId);

      // This is a little hacky to apply the cooldown immediately if shortcut installed.
      // Considering it's not much overhead re-showing all child cooldowns it's fine.
      for (var sc of this.shortcuts) {
        if (sc && type === sc.type && shortcutId === sc.shortcutId && sc.cooldown)
        {
          sc.cooldown.show();
          break;
        }
      }
    },

    cooldownStart: function (type, shortcutId) {
        for (var slot of this.shortcuts) {
          if (!slot)
            continue;

          if (slot.type === type && slot.shortcutId === shortcutId)
          {
            slot.cooldownStart(slot.cooldownTime);
          }
        }
    },

    cooldownItems: function () {
      var itemslot = null;
      for (var slot of this.shortcuts) {
        if (slot.type === 1) {
          var cooldown = new Cooldown(slot);
          cooldown.start(slot.cooldownTime);
          break;
        }
      }
    },

    exec: function (slot) {
      if (this.shortcuts[slot])
        this.shortcuts[slot].exec();
    },

    refresh: function () {
      for (var sc of this.shortcuts) {
        sc.display();
      }
    },

    getSameShortcuts: function (shortcut) {
      var shortcuts = [];
      for (var sc of this.shortcuts) {
        if (sc.type == 1 && sc.type === shortcut.type)
        {
          shortcuts.push(sc);
        }
        else if (sc.type === shortcut.type && sc.shortcutId === shortcut.shortcutId)
        {
          shortcuts.push(sc);
        }
      }
      return shortcuts;
    },

  });

  return ShortcutHandler;
});
