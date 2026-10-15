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

// Converted from AMD (define) + RequireJS bootstrap/require.config to a native ES6 module.
// This is the true entry point, meant to be loaded via <script type="module" src="js/home.js">
// (the user will wire this up in their own index.html update).
//
// 'lib/class' (Class) is no longer needed - every former Class.extend() usage in this codebase
// has been converted to a native ES6 class.
// require.config's baseUrl/paths/shim block is obsolete under native ES modules (there is no
// module loader to configure); every module now resolves via its own relative import path.
// underscore (_), jQuery ($), and PIXI remain classic (non-module) <script>-loaded globals - see
// js/lib/underscore.min.js's top-level `var p = this` UMD-style attach, which only works in a
// non-strict classic <script> (where top-level `this` is `window`); ES modules always run
// strict, where top-level `this` is `undefined`, so this file can't be safely `import`ed.
// Types/ItemTypes/Utils ARE real ES module exports (gametypes.js/itemtypes.js/utils.js), but the
// rest of the codebase still references them as bare globals like the above, so globaltypes.js
// imports them once and re-exposes them as window globals - it must run before main.js, whose
// import graph pulls in every data/*.js file that reads these bare globals at import time.
import './globaltypes.js';
import './main/main.js';
