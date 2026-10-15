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

// Side-effect module: shared/js/gametypes.js, shared/js/itemtypes.js, and utils.js are real ES
// modules (export default Types/ItemTypes/Utils), but every other file in this codebase
// references Types/ItemTypes/Utils as bare globals (Types.X, ItemTypes.X, Utils.X), the same way
// jQuery ($), underscore (_), PIXI, pako, BISON, and localforage are referenced. This module
// imports the three real exports once and re-exposes them as window globals so every consumer
// can keep using the bare-identifier style without importing them individually.
//
// This must be imported for its side effect BEFORE anything that reads these bare globals at
// module-evaluation time (not just inside a method body called later) - e.g. data/items.js and
// data/mobdata.js call ItemTypes.* / iterate with $.each(...) callbacks that reference ItemTypes
// as soon as they're imported, not lazily. That's why home.js imports this module before
// main.js (whose import graph pulls in every data/*.js file) - same ordering requirement as
// js/globalstate.js.
import Types from '../shared/js/gametypes.js';
import ItemTypes from '../shared/js/itemtypes.js';
import Utils from './utils.js';

window.Types = Types;
window.ItemTypes = ItemTypes;
window.Utils = Utils;
