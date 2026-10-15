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

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global ItemTypes */
import Entity from './entity.js';

// This helper was a bare top-level global before (not part of the AMD define() below),
// referenced elsewhere in the codebase (clientcallbacks.js, dialog/storedialog.js,
// dialog/craftdialog.js) as `ItemRoom`. ES module top-level declarations are module-scoped,
// not global, so it's exported here too and those call sites need to import it once converted.
export function ItemRoom(
    slot,
    itemKind,
    itemNumber,
    itemDurability,
    itemDurabilityMax,
    itemExperience
) {
    this.slot = slot;
    this.itemKind = itemKind;
    this.itemNumber = itemNumber;
    this.itemDurability = itemDurability;
    this.itemDurabilityMax = itemDurabilityMax;
    this.itemExperience = itemExperience;
}
// FIX: these were assigned onto the constructor function itself
// (ItemRoom.toArray = ...) instead of ItemRoom.prototype, so
// `new ItemRoom(...).toArray()` threw "not a function" and `.toString()`
// silently fell back to Object.prototype.toString ("[object Object]")
// instead of the intended CSV. Compare user.js's PlayerSummary, which
// assigns the analogous methods onto .prototype correctly.
ItemRoom.prototype.toArray = function () {
    return [
        parseInt(this.slot),
        this.itemKind,
        this.itemNumber,
        this.itemDurability,
        this.itemDurabilityMax,
        this.itemExperience
    ];
};
ItemRoom.prototype.toString = function () {
    return this.toArray().join(',');
};

export default class Item extends Entity {
    constructor(
        id,
        type,
        map,
        kind /*, type , durability, durabilityMax, experience*/
    ) {
        super(id, type, map, kind);

        this.kind = kind;
        this.type = type;
        this.wasDropped = false;
        this.count = 1;
    }

    getItemSpriteName() {
        const sprite = ItemTypes.KindData[this.kind].sprite;
        return sprite !== '' ? 'item-' + sprite : null;
    }

    // FLAG (not fixed): getInfoMsg() passes `this` (the Item entity) into getInfoMsgEx(),
    // which reads item.itemKind/itemNumber/itemDurability/itemDurabilityMax - none of which
    // this class's constructor ever sets (it only sets kind/type/wasDropped/count). It would
    // produce "undefined: Lv undefined..." or throw if ever called. Zero call sites currently
    // (every real caller uses the static `Item.getInfoMsgEx(itemRoom)` form with an actual
    // ItemRoom instance instead, e.g. data/items.js, dialog/bank/bankslot.js) - same class of
    // latent bug as the old _getBaseState() issue. Left unfixed rather than guessing a field
    // mapping, since the intended instance-method wire format is unclear; wire up or remove.
    getInfoMsg() {
        return this.getInfoMsgEx(this);
    }

    getInfoMsgEx(item) {
        let msg = '';
        if (ItemTypes.isEquipment(item.itemKind)) {
            msg =
                ItemTypes.getName(item.itemKind) +
                ': Lv ' +
                ItemTypes.getLevelByKind(item.itemKind) +
                (item.itemNumber ? '+' + item.itemNumber + ' ' : ' ') +
                item.itemDurability / 10 +
                '/' +
                item.itemDurabilityMax / 10;
            return msg;
        }
        return ItemTypes.getName(item.itemKind) || '';
    }
}
// Preserved from the original: the instance method is also copied onto the class itself so it
// can be called as Item.getInfoMsgEx(item) as well as instance.getInfoMsgEx(item).
Item.getInfoMsgEx = Item.prototype.getInfoMsgEx;
