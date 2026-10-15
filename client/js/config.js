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

// Converted from AMD (define) to a native ES6 module.
const config = {};

// Master switch for verbose client-side debug logging -- mirrors the
// gameserver's G_DEBUG (gameserver/js/main.js), driven by config_build.json
// (or config_build_live.json for the live build)'s own "debug": 0/1 key
// instead of a value hardcoded in source, so it can be toggled per
// deployment (local dev vs. the live/production build) without editing any
// .js file. `false` here is just the fallback for the window before the
// fetch below resolves (or if it fails, or the key is absent); it's
// reassigned to the real config-driven value once config.build is set.
// Like the gameserver's G_DEBUG, this has to be `let`, not `const`: any
// other module that does `import { G_DEBUG } from './config.js'` gets a
// live binding, so this reassignment is all that's needed for every such
// import to see the up-to-date value once the config loads -- no need to
// re-check config.waitForConfig() at every gated call site.
export let G_DEBUG = false;

fetch('./config/config_build.json')
    .then((response) => response.json())
    .then((json) => {
        config.build = json;
        G_DEBUG = !!json.debug;
    })
    // FIX: no .catch meant a failed fetch (network blip, 404, offline) left config.build
    // unset forever with no visible error; waitForConfig() below would then poll silently
    // every 100ms with no way to ever succeed. Surface the failure so it's at least visible.
    .catch((err) => {
        console.error('Failed to load config/config_build.json:', err);
    });

config.waitForConfig = function (callback) {
    if (config.hasOwnProperty('build')) {
        callback();
        return true;
    }
    setTimeout(function () {
        config.waitForConfig(callback);
    }, 100);
    return false;
};

export default config;
