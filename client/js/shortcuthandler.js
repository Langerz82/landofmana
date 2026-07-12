// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global ItemTypes */
import SkillData from './data/skilldata.js';
import Items from './data/items.js';

let DragShortcut = null; // FIX: was a bare global assignment (no var), which throws ReferenceError under ES module strict mode

class Shortcut {
    constructor(parent, slot, type) {
      const self = this;

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

      const fnClick = function(e) {
        const slot = self.jq.data("slot");
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
        const slot = self.jq.data("slot");
        DragShortcut = {"slot": slot};
      });

      this.jqb.on('drop', function(e) {
        const slot = self.jq.data("slot");
        const newShortcut = self.parent.shortcuts[slot];
        let oldShortcut = null;
        if (DragShortcut)
          oldShortcut = self.parent.shortcuts[DragShortcut.slot];
        const tmp = Object.assign({}, newShortcut);
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
    }

    setup(slot) {
      //var slot = this.jq.data("slot");
      // TODO fill.
      if (this.isCoolingDown)
        return;

      if (DragItem) {
        const item = game.inventory.rooms[DragItem.slot];
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
    }

    install(slot, type, id) {
      this.slot = slot;
      this.type = type;
      this.shortcutId = id;

      if (this.type === 1) {
        this.cooldownTime = ItemTypes.KindData[id].cooldown;
        //this.itemKind = this.shortcutId;
      }
      else if (this.type === 2) {
        this.cooldownTime = ~~(SkillData.Data[id].recharge / 1000);
      }
      this.display();
    }

    clear() {
        this.jqnum.css("display", "none");
        this.jq.css("display", "none");
    }

    display() {
      this.jqnum.css("display", "block");
      this.jq.css("display", "block");

      if (this.type === 1) {
        const count = game.inventory.getItemTotalCount(this.shortcutId);
        const item = {itemKind: this.shortcutId, itemNumber: count};
        Items.jqShowItem(this.jq, item, this.jq, 1);
        this.jq.css("transform", "scale("+(56/48)+")");
        return;
      }
      else if (this.type === 2) {
        // Temp not Working
        const skill = null;
        SkillData.jqShowSkill(this.jq, this.shortcutId, this.jq, 1);
        this.jq.css("transform", "scale("+(56/48)+")");
        return;
      }
      this.clear();
    }

    exec() {
      if (this.cooldown && this.cooldown.cooltimeCounter > 0)
        return;

      let res = false;
      // display cooldown for all
      if (this.type === 1) {
        const item = game.inventory.getItemByKind(this.shortcutId);
        if (item)
          res = game.inventory.useItem(0, item);
      } else if (this.type === 2) {
        const skill = game.player.skillHandler.skills[this.shortcutId];
        if (skill)
          res = skill.execute();
      }

      if (res)
        this.parent.cooldownStart(this.type, this.shortcutId);

      this.display();
    }

    cooldownStart(time) {
      if (this.cooldown)
        this.cooldown.done();

      this.cooldown = new Cooldown(this);
      this.cooldown.start(time);

      if (this.type === 2)
        game.skillDialog.page.cooldownStart(this.shortcutId);
    }
}

class Cooldown {
    constructor(shortcut) {
      this.shortcut = shortcut;
      this.children = shortcut.parent.getSameShortcuts(shortcut);
    }

    start(time) {
      const self = this;

      this.cooltimeCounter = time;

      const funcCooldown = function () {
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

      for (let sc of this.children) {
        sc.isCoolingDown = true;
        sc.jqCooldown.show();
      }
    }

    tick() {
      this.children = this.shortcut.parent.getSameShortcuts(this.shortcut);

      if (this.cooltimeCounter === 0) {
        this.done();
        return;
      }

      this.show();
    }

    show() {
      for (let sc of this.children) {
        sc.jqCooldown.show();
        sc.jqCooldown.html(this.cooltimeCounter);
      }
    }

    done() {
      clearInterval(this.cooltimeTickHandle);
      this.cooltimeTickHandle = null;
      this.cooltimeCounter = 0;

      for (let sc of this.children) {
        sc.isCoolingDown = false;
        sc.jqCooldown.hide();
        sc.cooldown = null;
      }
      this.cooldown = null;
      this.shortcut.cooldown = null;
      // FIX: `delete this;` is a no-op (delete cannot remove a local/this binding); removed dead code, cleanup is already handled above
    }
}

export default class ShortcutHandler {
    constructor() {
      this.shortcuts = [];
      this.shortcutCount = 6;

      let shortcut;
      for (let i=0; i < this.shortcutCount; ++i) {
        shortcut = new Shortcut(this, i, 0);
        shortcut.clear();
        this.shortcuts.push(shortcut);
      }
    }

    installAll(arr) {
      let shortcut;
      let i=0;
      for (let sc of arr) {
        if (sc) {
          if (sc[0] >= this.shortcutCount)
            continue;
          this.shortcuts[sc[0]].install(sc[0], sc[1], sc[2]);
        }
      }
    }

    install(slot, type, shortcutId) {
      if (slot >= this.shortcutCount)
        return;

      if (this.shortcuts[slot])
        this.shortcuts[slot].install(slot, type, shortcutId);

      // This is a little hacky to apply the cooldown immediately if shortcut installed.
      // Considering it's not much overhead re-showing all child cooldowns it's fine.
      for (let sc of this.shortcuts) {
        if (sc && type === sc.type && shortcutId === sc.shortcutId && sc.cooldown)
        {
          sc.cooldown.show();
          break;
        }
      }
    }

    cooldownStart(type, shortcutId) {
        for (let slot of this.shortcuts) {
          if (!slot)
            continue;

          if (slot.type === type && slot.shortcutId === shortcutId)
          {
            slot.cooldownStart(slot.cooldownTime);
          }
        }
    }

    cooldownItems() {
      let itemslot = null;
      for (let slot of this.shortcuts) {
        if (slot.type === 1) {
          const cooldown = new Cooldown(slot);
          cooldown.start(slot.cooldownTime);
          break;
        }
      }
    }

    exec(slot) {
      if (this.shortcuts[slot])
        this.shortcuts[slot].exec();
    }

    refresh() {
      for (let sc of this.shortcuts) {
        sc.display();
      }
    }

    getSameShortcuts(shortcut) {
      const shortcuts = [];
      // FIX: the type-1 (item) branch matched on type alone, grouping every item shortcut in
      // the bar together regardless of shortcutId. That's inconsistent with cooldownStart()
      // (below), which is the actual source of truth for which shortcuts share a cooldown and
      // requires both type AND shortcutId to match - so using one consumable's cooldown was
      // visually shown on every item shortcut, not just the one that was used. Require
      // shortcutId here too; the two branches are now equivalent and could be merged, but kept
      // separate to preserve the original structure.
      for (let sc of this.shortcuts) {
        if (sc.type == 1 && sc.type === shortcut.type && sc.shortcutId === shortcut.shortcutId)
        {
          shortcuts.push(sc);
        }
        else if (sc.type === shortcut.type && sc.shortcutId === shortcut.shortcutId)
        {
          shortcuts.push(sc);
        }
      }
      return shortcuts;
    }
}
