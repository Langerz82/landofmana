// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
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

// Mixin extracted from inventorydialog.js: item cooldown timer management:
// funcCooldownExec, funcCooldown.
// Applied onto InventoryDialog.prototype via install*(...) call in inventorydialog.js; not a standalone class.
/* global ItemTypes */

export function installInventoryDialogCooldown(proto) {
    proto.funcCooldownExec = function (item) {
        const itemData = ItemTypes.KindData[item.itemKind];
        this.cooldownTime = itemData.cooldown;
        this.funcCooldown();
        // FIX: cooldownItems() used to take no argument and just grab the
        // first item-type shortcut it found; now that it matches on the
        // specific item's shortcutId (see shortcuthandler.js), the kind
        // actually used has to be passed through.
        game.shortcuts.cooldownItems(item.itemKind);
    };

    proto.funcCooldown = function () {
        const self = this;

        const fnCooldownItems = function () {
            const cond = function (item) {
                return ItemTypes.isConsumableItem(item.itemKind);
            };
            const items = self.getItems(0, cond);
            const cooldowns = [];
            for (let item of items) {
                cooldowns.push(self.jqInventoryHighlights[item.slot]);
            }
            return cooldowns;
        };

        const resetCooltimeItems = function () {
            for (let ct of self.cooldowns) {
                ct.removeData('cooltime');
                ct.html('');
                ct.css({
                    'background-color': 'transparent'
                });
            }
        };
        resetCooltimeItems();

        const setCooltimes = function () {
            self.cooldowns = fnCooldownItems();
            if (self.cooldownTime === 0) {
                resetCooltimeItems();
                clearInterval(self.coolTimeCallback);
                self.coolTimeCallback = null;
                return;
            }
            for (let ct of self.cooldowns) {
                ct.data('cooltime', true);
                ct.html(self.cooldownTime);
                ct.css({
                    'background-color': '#FF000077'
                });
            }
        };

        const fnInterval = function () {
            setCooltimes();
            self.cooldownTime--;
        };

        if (this.cooldownTime > 0) {
            if (this.coolTimeCallback == null) {
                this.coolTimeCallback = setInterval(fnInterval, 1000);
                fnInterval();
            } else {
                setCooltimes();
            }
        }
    };
}
