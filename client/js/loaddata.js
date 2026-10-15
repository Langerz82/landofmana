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
export default class LoadData {
    constructor() {
        const self = this;

        this.loaded = false;
        this.tilesets = [];

        const loader = new PIXI.Loader();

        loader.add('ts-1-1', 'img/common/ts-1-1.png');
        loader.add('ts-1-2', 'img/common/ts-1-2.png');

        loader.load(function (loader, resources) {
            self.tilesets = [
                resources['ts-1-1'].texture,
                resources['ts-1-2'].texture
            ];
        });
        loader.onComplete.add(() => {
            self.loaded = true;
        });
    }
}
