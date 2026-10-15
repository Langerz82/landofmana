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

import _ from 'underscore';
import NPCsJSON from '../../shared/data/npcs.json' with { type: 'json' };

const Properties = {};
const Kinds = NPCsJSON;
_.each(Kinds, function (value, key) {
    Properties[value.uid] = {
        uid: value.uid,
        kind: key,
        name: value.name ? value.name : value.uid
    };
});

const isNpc = function (kind) {
    return Kinds[kind] ? true : false;
};

export { Properties, Kinds, isNpc };
export default { Properties, Kinds, isNpc };
