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

import GameTypes from '../shared/js/gametypes.js';
import ItemTypes from '../shared/js/itemtypes.js';

const Types = GameTypes;

import Utils from './utils.js';

import AppearanceData from './data/appearancedata.js';

// Export everything that was globally assigned
export { _, GameTypes, ItemTypes, Types, Utils, AppearanceData };

// For backward compatibility (if other files still use global-like access)
export default {
    _,
    GameTypes,
    ItemTypes,
    Types,
    Utils,
    AppearanceData
};

global._ = _;
global.GameTypes = GameTypes;
global.ItemTypes = ItemTypes;
global.Types = Types;
global.Utils = Utils;
global.AppearanceData = AppearanceData;
