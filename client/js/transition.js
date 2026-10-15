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
export default class Transition {
    constructor(object) {
        this.startValue = 0;
        this.endValue = 0;
        this.duration = 0;
        this.inProgress = false;
        this.modValue = 0;
        this.object = object;
    }

    start(updateFunction, stopFunction, modValue) {
        this.updateFunction = updateFunction;
        this.stopFunction = stopFunction;
        this.modValue = modValue;
        this.inProgress = true;
    }

    step() {
        if (this.inProgress) {
            const inc = this.modValue;

            if (inc === 0) return;

            if (this.updateFunction) {
                let it;
                const itCount = Math.abs(inc);
                const mod = inc > 0 ? 1 : -1;
                for (it = 0; it < itCount; ++it) {
                    if (!this.inProgress) {
                        this.stop(this.object);
                        break;
                    }

                    if (this.updateFunction(this.object, mod)) {
                        this.stop(this.object);
                        break;
                    }
                }
            }
        }
    }

    stop() {
        if (this.stopFunction) this.stopFunction(this.object);

        this.inProgress = false;
    }
}
