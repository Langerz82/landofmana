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
import ItemLootJson from '../../shared/data/itemloot.json' with { type: 'json' };

const ItemLoot = [];

_.each(ItemLootJson, function (val, key) {
    ItemLoot[key] = {
        name: val.name,
        rarity: val.rarity,
        sprite: val.sprite,
        offset: val.offset,
        include: val.include ? val.include : null
    };
});

//console.info("ITEMLOOT="+JSON.stringify(ItemLoot));

export { ItemLoot };
export default { ItemLoot };
