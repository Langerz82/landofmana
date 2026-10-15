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

import sanitizer from 'sanitizer';
import Utils from '../shared/js/utils.js';

Utils.sanitize = function (string) {
    // Strip unsafe tags, then escape as html entities.
    return sanitizer.escape(sanitizer.sanitize(string));
};

// PERF/FIX: consolidates a `try { throw new Error(); } catch (e) { ...
// e.stack ... }` idiom that was hand-duplicated across ~8 files in
// gameserver/js (pathfinder.js, map/pathfindingservice.js, format.js,
// ws/userconnection.js, entity/entitymoving/entitymovingpath.js,
// updater.js, entity/mob/mobrespawn.js, entity/player/player.js) purely to
// get the current call stack as a string for diagnostic logging. The
// throw/catch was never needed for that -- `new Error()` does not throw on
// its own, and `.stack` is populated the moment the Error is constructed --
// so every one of those sites was paying for exception machinery it didn't
// use. Callers keep using whatever logger they already did
// (console.error/warn/info, log.info, ...); this just replaces the
// boilerplate that produced the string.
Utils.captureStack = function () {
    return new Error().stack;
};

export default Utils;
