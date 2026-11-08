// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

// Extracted from shortcuthandler.js: Shortcut (a single hotbar slot). Previously one of three
// classes (Shortcut/Cooldown/ShortcutHandler) declared in that one file. Same split pattern
// used for dialog/appearancedialog.js.
/* global ItemTypes */
import SkillData from '../data/skilldata.js';
import Items from '../data/items.js';
import Cooldown from './cooldown.js';

let DragShortcut = null; // FIX: was a bare global assignment (no var), which throws ReferenceError under ES module strict mode

// What a shortcut slot press (click, its 1-8 key, gamepad L1/R1 combo - all
// trigger the slot's click) should put on the bar instead of running the
// shortcut: a skill highlighted in the open skills window
// ({type: 2, id: skillIndex}) or an item highlighted in the open inventory
// ({type: 1, id: itemKind}, id -1 when it isn't a potion / food). null when
// nothing is waiting, so the press runs the shortcut.
// FIX: setup() used to take any DragItem as an inventory item
// (game.inventory.rooms[DragItem.slot]) - a highlighted bank or equipment
// item (DragItem.type 1 / 2) put whatever inventory item shared that slot
// number on the bar. And a skill left highlighted after the skills window was
// closed (Escape, the menu button) turned the next shortcut press into an
// assign instead of running it.
function shortcutPick() {
    if (ShortcutData && $('#skillsDialog').is(':visible'))
        return { type: 2, id: ShortcutData.index };
    if (
        DragItem &&
        DragItem.type === 0 &&
        $('#allinventorywindow').is(':visible')
    ) {
        const item = game.inventory.rooms[DragItem.slot];
        if (item)
            return {
                type: 1,
                id: ItemTypes.isConsumableItem(item.itemKind)
                    ? item.itemKind
                    : -1
            };
    }
    return null;
}

export default class Shortcut {
    constructor(parent, slot, type) {
        const self = this;

        this.parent = parent;
        this.slot = slot;
        this.type = type;
        this.shortcutId = -1;
        this.cooldownTime = 0;

        this.jqBody = $('#shortcut' + slot);
        this.jqBackground = $('#scbackground' + slot);
        this.jqCooldown = $('#scCD' + slot);
        this.jqNum = $('#shortcutnum' + slot);

        this.jqBody.attr('draggable', true);
        this.jqBody.draggable = true;

        this.jqBody.data('slot', slot);

        const fnClick = function (e) {
            const slot = self.jqBody.data('slot');
            const pick = shortcutPick();
            if (pick) {
                self.setup(slot, pick);
                return false;
            }
            if (self.type > 0) {
                self.exec();
            }
            return false;
        };

        this.jqBackground.click(fnClick);

        this.jqBody.on('dragstart', function (e) {
            const slot = self.jqBody.data('slot');
            DragShortcut = { slot: slot };
        });

        this.jqBackground.on('drop', function (e) {
            const slot = self.jqBody.data('slot');
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

        this.jqBackground.unbind('dragover').bind('dragover', function (event) {
            event.preventDefault();
        });
        this.jqBody.unbind('dragover').bind('dragover', function (event) {
            event.preventDefault();
        });
    }

    // Put the highlighted skill / inventory item (shortcutPick()) on this slot.
    setup(slot, pick) {
        if (this.isCoolingDown) return;

        pick = pick || shortcutPick();
        if (!pick) return;

        if (pick.type === 1) {
            if (pick.id > -1) this.parent.install(slot, 1, pick.id);
            game.inventoryDialog.deselectItem();
            DragItem = null;
        } else if (pick.type === 2) {
            this.parent.install(slot, 2, pick.id);
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
        this.jqNum.css('display', 'none');
        this.jqBody.css('display', 'none');
    }

    display() {
        this.jqNum.css('display', 'block');
        this.jqBody.css('display', 'block');

        if (this.type === 1) {
            const count = game.inventory.getItemTotalCount(this.shortcutId);
            const item = { itemKind: this.shortcutId, itemNumber: count };
            Items.jqShowItem(this.jqBody, item, this.jqBody, 1);
            this.jqBody.css('transform', 'scale(' + 56 / 48 + ')');
            return;
        } else if (this.type === 2) {
            // Temp not Working
            SkillData.jqShowSkill(this.jqBody, this.shortcutId, this.jqBody, 1);
            this.jqBody.css('transform', 'scale(' + 56 / 48 + ')');
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
