define(['data/skilldata', 'data/items'], function(SkillData, Items) {
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
      //this.jqCooldown = $('#shortcutCD'+index);
      this.jqnum = $('#shortcutnum'+slot);

      this.jq.data("slot", slot);

      var install = function() {

      };

      this.jq.click(function(e) {
        if (self.type > 0) {
          self.exec();
        }
        else {
          self.setup();
        }
      });
      this.jq.on('drop touchend', function(e) {
        self.setup();
      });
      this.jq.unbind('dragover').bind('dragover', function(event) {
          event.preventDefault();
      });
      /*this.jqb.unbind('dragover').bind('dragover', function(event) {
          event.preventDefault();
      });*/

    },

    setup: function () {
      var slot = this.jq.data("slot");
      // TODO fill.
      if (DragItem) {
        var item = game.inventory.getItem(DragItem.type, DragItem.slot);
        if (item) {
          this.install(slot, 1, item.itemKind);
        }
      }
      if (ShortcutData) {
        this.install(slot, 2, ShortcutData.index);
      }
      if (this.shortcutId > -1)
        game.client.sendShortcut(this.slot, this.type, this.shortcutId);
      this.display();
    },

    install: function (slot, type, id) {
      this.slot = slot;
      this.type = type;
      this.shortcutId = id;

      // get cooldown time.

      if (this.type == 1) {
        this.cooldownTime = 5;
      }
      else if (this.type == 2) {
        this.cooldownTime = ~~(SkillData.Data[id].recharge / 1000);
      }
      this.display();
      //game.client.sendShortcut(this.index, this.type, this.shortcutId);
    },

    display: function () {
      if (this.type == 1) {
        var count = game.inventory.getItemTotalCount(this.shortcutId);
        var item = {itemKind: this.shortcutId, itemNumber: count};
        Items.jqShowItem(this.jq, item, this.jq, 1.5);
      }
      else if (this.type == 2) {
        // Temp not Working
        var skill = null;
        SkillData.jqShowSkill(this.jq, this.shortcutId, this.jq);
      }
    },

    exec: function () {
      var children = this.parent.getSameShortcuts(this);
      for (var sc of children) {
        if (sc.cooldown && sc.cooldown.cooltimeCounter > 0)
          return;
      }

      var res = false;
      // display cooldown for all
      if (this.type == 1) {
        var item = game.inventory.getItemByKind(this.shortcutId);
        if (item)
          res = game.inventoryHandler.useItem(item);
      } else if (this.type == 2) {
        var skill = game.player.skillHandler.skills[this.shortcutId];
        if (skill)
          res = skill.execute();
      }

      if (res)
        this.cooldownStart(this.cooldownTime);

      this.display();
    },

    cooldownStart: function (time) {
      // show cooldown display.
      var children = this.parent.getSameShortcuts(this);
      this.cooldown = new Cooldown(this.parent, this);
      this.cooldown.start(time);
    },

  });

  var Cooldown = Class.extend({
    init: function(parent, shortcut) {
      this.parent = parent;
      this.shortcut = shortcut;
      this.children = this.parent.getSameShortcuts(shortcut);

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
      this.children = this.parent.getSameShortcuts(this.shortcut);
      for (var slot of this.children) {
        $('#scCD'+slot.slot).show();
      }
    },

    tick: function () {
      this.children = this.parent.getSameShortcuts(this.shortcut);

      if (this.cooltimeCounter == 0)
        this.done();

      for (var slot of this.children) {
        $('#scCD'+slot.slot).html(this.cooltimeCounter);
      }
    },

    done: function () {
      clearInterval(this.cooltimeTickHandle);
      this.cooltimeTickHandle = null;
      this.cooltimeCounter = 0;

      this.children = this.parent.getSameShortcuts(this.shortcut);

      for (var slot of this.children) {
        $('#scCD'+slot.slot).hide();
      }

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

    install: function (slot, type, index) {
      if (this.shortcuts[slot])
        this.shortcuts[slot].install(slot, type, index);
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
        if (sc.type == shortcut.type && sc.shortcutId == shortcut.shortcutId)
        {
          shortcuts.push(sc);
        }
      }
      return shortcuts;
    },

  });

  return ShortcutHandler;
});
