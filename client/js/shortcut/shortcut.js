// Extracted from shortcuthandler.js: Shortcut (a single hotbar slot). Previously one of three
// classes (Shortcut/Cooldown/ShortcutHandler) declared in that one file. Same split pattern
// used for dialog/appearancedialog.js.
/* global ItemTypes */
import SkillData from '../data/skilldata.js';
import Items from '../data/items.js';
import Cooldown from './cooldown.js';

let DragShortcut = null; // FIX: was a bare global assignment (no var), which throws ReferenceError under ES module strict mode

export default class Shortcut {
    constructor(parent, slot, type) {
        const self = this;

        this.parent = parent;
        this.slot = slot;
        this.type = type;
        this.shortcutId = -1;
        this.cooldownTime = 0;

        this.jq = $('#shortcut' + slot);
        this.jqb = $('#scbackground' + slot);
        this.jqCooldown = $('#scCD' + slot);
        this.jqnum = $('#shortcutnum' + slot);

        this.jq.attr('draggable', true);
        this.jq.draggable = true;

        this.jq.data('slot', slot);

        const fnClick = function (e) {
            const slot = self.jq.data('slot');
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

        this.jq.on('dragstart', function (e) {
            const slot = self.jq.data('slot');
            DragShortcut = { slot: slot };
        });

        this.jqb.on('drop', function (e) {
            const slot = self.jq.data('slot');
            const newShortcut = self.parent.shortcuts[slot];
            let oldShortcut = null;
            if (DragShortcut)
                oldShortcut = self.parent.shortcuts[DragShortcut.slot];
            const tmp = Object.assign({}, newShortcut);
            if (newShortcut && oldShortcut) {
                if (newShortcut.isCoolingDown) return;
                if (oldShortcut.isCoolingDown) return;
                newShortcut.install(
                    oldShortcut.slot,
                    oldShortcut.type,
                    oldShortcut.shortcutId
                );
                oldShortcut.install(tmp.slot, tmp.type, tmp.shortcutId);
            } else if (newShortcut && !oldShortcut) {
                self.setup(slot);
            }
            DragShortcut = null;
            ShortcutData = null;
            DragItem = null;
        });

        this.jqb.unbind('dragover').bind('dragover', function (event) {
            event.preventDefault();
        });
        this.jq.unbind('dragover').bind('dragover', function (event) {
            event.preventDefault();
        });
    }

    setup(slot) {
        // TODO fill.
        if (this.isCoolingDown) return;

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
        } else if (this.type === 2) {
            this.cooldownTime = ~~(SkillData.Data[id].recharge / 1000);
        }
        this.display();
    }

    clear() {
        this.jqnum.css('display', 'none');
        this.jq.css('display', 'none');
    }

    display() {
        this.jqnum.css('display', 'block');
        this.jq.css('display', 'block');

        if (this.type === 1) {
            const count = game.inventory.getItemTotalCount(this.shortcutId);
            const item = { itemKind: this.shortcutId, itemNumber: count };
            Items.jqShowItem(this.jq, item, this.jq, 1);
            this.jq.css('transform', 'scale(' + 56 / 48 + ')');
            return;
        } else if (this.type === 2) {
            // Temp not Working
            SkillData.jqShowSkill(this.jq, this.shortcutId, this.jq, 1);
            this.jq.css('transform', 'scale(' + 56 / 48 + ')');
            return;
        }
        this.clear();
    }

    exec() {
        if (this.cooldown && this.cooldown.cooltimeCounter > 0) return;

        let res = false;
        // display cooldown for all
        if (this.type === 1) {
            const item = game.inventory.getItemByKind(this.shortcutId);
            if (item) res = game.inventory.useItem(0, item);
        } else if (this.type === 2) {
            const skill = game.player.skillHandler.skills[this.shortcutId];
            if (skill) res = skill.execute();
        }

        if (res) this.parent.cooldownStart(this.type, this.shortcutId);

        this.display();
    }

    cooldownStart(time) {
        if (this.cooldown) this.cooldown.done();

        this.cooldown = new Cooldown(this);
        this.cooldown.start(time);

        if (this.type === 2)
            game.skillDialog.page.cooldownStart(this.shortcutId);
    }
}
