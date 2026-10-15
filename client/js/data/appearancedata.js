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

// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// Was: define(['text!../../shared/data/appearance.json'], function(AppearancesJson) {...})
// text! loaded the JSON file's raw contents synchronously at build/load time. Every consumer of
// this module expects a plain array export, not a Promise, so the JSON is loaded synchronously
// via jQuery's AJAX ($.ajax with async: false) instead of fetch() - see data/fetchjsonsync.js.
import fetchJsonSync from '../lib/fetchjsonsync.js';

const appearanceParse = fetchJsonSync('shared/data/appearance.json');
const Appearances = appearanceParse.map((val) => ({
    name: val.name,
    type: val.type,
    sprite: val.sprite,
    buy: val.buy
}));

export default Appearances;
