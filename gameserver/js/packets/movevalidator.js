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


import { G_FRAME_INTERVAL, G_MAX_LATENCY } from '../constants.js';

// Server-authoritative validation for player movement packets
// (CW_MOVE / CW_MOVEPATH).
//
// Replaces the old spread of checks -- checkStartMove/checkPathInterrupt/
// correctMove (playercallback.js), isValidGridPath(path, time)/
// hasMoveThrottled (player.js) and isDistanceTooFast (pathfinder.js) --
// with one rule: a reported position is accepted only if the player could
// have legally walked there from the last position the server accepted, in
// the server time that has passed since then.
//
//   Route:  the target must be walkable, and either on a straight,
//           collision-free, axis-aligned line from the last accepted
//           position (key movement), or on the click-to-move path the
//           server last accepted.
//   Timing: measured with the server's own clock only. The client's `time`
//           field is never used for validation (it is client-controlled,
//           so an old timestamp used to make the speed check always pass).
//
// Timing uses a per-player movement clock (p.moveClock): the server time by
// which all distance accepted so far "should" have been walked. Each
// accepted move pushes it forward by how long that distance takes at the
// player's speed, and a move is rejected if that would put the clock more
// than G_MAX_LATENCY ahead of now. The clock is never allowed to lag
// more than G_MAX_LATENCY behind the previous accepted packet, so
// slack can't be banked or re-earned by spamming packets: sustained speed
// is capped at the real move speed, with a one-off burst of at most about
// twice the slack to absorb network jitter.

// The latency slack is G_MAX_LATENCY (constants.js): config.json's
// "max_latency" in ms, default 100.

// Resets the last-accepted position, e.g. after the server corrects
// (resetMove) or relocates (teleport/respawn) the player.
export function setMoveAnchor(p, x, y, now = Date.now()) {
    p.moveAnchor = { map: p.map, x: x, y: y, path: null, at: now };
    p.moveClock = now;
}

function getMoveAnchor(p, now) {
    if (!p.moveAnchor || p.moveAnchor.map !== p.map)
        setMoveAnchor(p, p.x, p.y, now);
    return p.moveAnchor;
}

// Pixel distance along a legal route from the anchor to (x,y), or -1 if
// there's no legal route.
function routeDistance(p, anchor, x, y) {
    const pathfinder = p.map.entities.pathfinder;

    if (anchor.path) {
        if (!pathfinder.isInPath(anchor.path, [x, y])) return -1;
        return pathfinder.getPathSubDistance(anchor.path, x, y);
    }

    if (anchor.x === x && anchor.y === y) return 0;

    const line = [
        [anchor.x, anchor.y],
        [x, y]
    ];
    if (!pathfinder.isValidPath(line)) return -1;
    if (!pathfinder.isValidGridPath(p.map.grid, line, true)) return -1;
    return Math.abs(x - anchor.x) + Math.abs(y - anchor.y);
}

// Validates a reported position. On success it becomes the new anchor and
// true is returned; on failure nothing changes and the caller corrects the
// player (once).
export function tryMoveTo(p, x, y, now = Date.now()) {
    if (p.mapStatus < 2) return false;
    if (p.map.isColliding(x, y)) return false;

    const anchor = getMoveAnchor(p, now);
    const dist = routeDistance(p, anchor, x, y);
    if (dist < 0) return false;

    // The server moves a player `tick` pixels per G_FRAME_INTERVAL ms
    // (updater.js steps tick * G_FRAME_INTERVALS px every G_UPDATE_INTERVAL).
    const msPerPixel = G_FRAME_INTERVAL / Math.max(p.tick, 1);
    const clock =
        Math.max(p.moveClock, anchor.at - G_MAX_LATENCY) +
        dist * msPerPixel;
    if (clock > now + G_MAX_LATENCY) return false;

    p.moveAnchor = { map: p.map, x: x, y: y, path: null, at: now };
    p.moveClock = clock;
    return true;
}

// Validates a click-to-move path: it must be a legal grid path, and its
// first waypoint (the client's current position) must pass tryMoveTo().
// Later packets are then measured along this path.
export function tryStartPath(p, path, now = Date.now()) {
    const pathfinder = p.map.entities.pathfinder;
    if (!pathfinder.isValidPath(path)) return false;
    if (!pathfinder.isValidGridPath(p.map.grid, path, true)) return false;
    if (!tryMoveTo(p, path[0][0], path[0][1], now)) return false;

    p.moveAnchor.path = path;
    return true;
}
