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

import _ from 'underscore';
import AppearancesJson from '../../shared/data/appearance.json' with { type: 'json' };

const AppearanceData = [];

const ItemGearTypes = {
    weapon: [],
    weaponarcher: [],
    armor: [],
    armorarcher: []
};

/*AppearanceData.push({
  name: "blank",
  type: "",
  sprite: "",
  buy: 0
});*/

_.each(AppearancesJson, function (value, key) {
    AppearanceData.push({
        name: value.name,
        type: value.type,
        sprite: value.sprite,
        buy: value.buy
    });
    if (ItemGearTypes[value.type]) {
        ItemGearTypes[value.type].push({ key: key, val: value });
    }
});

//console.log(JSON.stringify(ItemGearTypes));

export { ItemGearTypes };
export const Data = AppearanceData;

export function getSpriteByID(id) {
    return AppearanceData[id].sprite;
}

export default { ItemGearTypes, Data, getSpriteByID };
