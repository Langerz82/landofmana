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
/* global Utils */

export default class Achievement {
    constructor(arr) {
        this.update(arr);
    }

    update(arr) {
        // FIX: parseInt() was an Array.prototype monkey-patch that has been
        // removed from utils.js; migrated to Utils.ArrayParseInt().
        // FIX (var cleanup): this was `var arr = ...`, re-declaring the `arr` parameter with var
        // (legal, since var redeclaration is a no-op reassignment) - converting it to `let`/`const`
        // instead would throw a SyntaxError (redeclaring a parameter with let/const is illegal).
        // Since `arr` is already in scope as the parameter, this is just a reassignment.
        arr = Utils.ArrayParseInt(arr);

        this.index = arr[0];
        this.type = arr[1];
        this.rank = arr[2] || 0;
        this.objectType = arr[3] || 0;
        this.objectKind = arr[4] || 0;
        this.count = arr[5] || 0;
        this.objectCount = arr[6] || 0;
        const objectCount = Utils.getNumShortHand(this.objectCount, 0);
        this.summary =
            lang.data['ACHIEVEMENTS_' + this.index].format(objectCount);
    }
}
