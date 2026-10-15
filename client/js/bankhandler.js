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

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Class */

export default class BankHandler {
    constructor(game) {
        this.game = game;
        this.maxNumber = 96;
        this.banks = {};
        this.jqBankGold = $('.bankGold');
    }

    initBank(itemArray) {
        for (const item of itemArray) {
            if (item) this.banks[item.slot] = item;
        }
    }

    setBank(itemArray) {
        for (const item of itemArray) {
            this.banks[item.slot] = item.itemKind === -1 ? null : item;
        }
    }

    setGold(gold) {
        this.gold = parseInt(gold);
        this.jqBankGold.text(this.gold);
    }

    isBankFull() {
        if (Object.keys(this.banks).length < this.maxNumber) return false;
        // FIX: was `this.maxBankNumber`, a property that is never set anywhere (constructor only sets `this.maxNumber`);
        // the loop ran 0 iterations, so isBankFull() always returned true once slot count reached maxNumber, even if
        // some of those slots had since been cleared to null (still open)
        for (let i = 0; i < this.maxNumber; i++) {
            if (!this.banks[i]) return false;
        }
        return true;
    }
}
