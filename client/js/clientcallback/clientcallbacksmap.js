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

// Mixin extracted from clientcallbacks.js: map transitions (onPlayerTeleportMap, onMapStatus).
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Pathfinder from '../pathfinder.js';
/* global log, game */

export function installClientCallbacksMap(proto) {
    proto.onPlayerTeleportMap = function (data) {
        const mapId = Number(data[0]),
            x = Number(data[2]),
            y = Number(data[3]),
            portalId = Number(data[4]);
        const status = Number(data[1]);
        // status 2 (placed on the new map) only counts once the map has loaded and the player stands on it
        // (fnReady below sets mapStatus to 2 then): until then the player stays frozen (gamemovement.js's
        // freezeForTeleport(), playerlocalmovement.js's stop())
        if (status !== 2) game.mapStatus = status;
        const p = game.player;

        log.info(
            'ON PLAYER TELEPORT MAP:' +
                mapId +
                'status: ' +
                status +
                ',x:' +
                x +
                ',y:' +
                y
        );

        if (status === -1) {
            // The server refused the transition and is still keeping the player on map `mapId`
            // (the map they were on): go back to that map if another one was already loaded.
            if (
                game.prevMap &&
                game.prevMap.mapIndex === mapId &&
                game.currentMap !== game.prevMap
            ) {
                game.currentMap = game.prevMap;
            }
            game.mapIndex = mapId;
            game.mapStatus = 2;
            p.forceStop();
            p.clearTarget();
            p.freeze = false;
            p.suppressTeleportCheck = false;
            p.refusedDoorAt = { x: p.x, y: p.y };
            return;
        }

        if (status === 1) {
            // also covers map changes the server starts itself (e.g. a respawn): frozen until placed
            game.freezeForTeleport();
            log.info('spawnMap');

            // FIX (same-screen teleport flicker): blankFrame below exists to hide the
            // pop-in of a *new* screen loading (different map, or the same map scrolled
            // to a different area) by wiping the BACKGROUND/FOREGROUND tile graphics for
            // one frame (renderer.js's renderFrame -> clearTiles()). When the door's
            // destination (x,y) is already inside the current camera viewport - e.g. two
            // nearby portals on the same screen, or a portal that just nudges the player
            // a few tiles - nothing about the visible map actually changes, so that wipe
            // just produces a needless flash-to-black with nothing to redraw it against
            // (refreshGrid()'s dirty-check often finds the tileGrid unchanged and skips
            // drawTerrain() entirely - see clearTiles()'s own comment). Must be computed
            // here, before game.mapIndex is overwritten just below, since it needs the
            // map the player is *leaving* and the camera's pre-teleport viewport.
            const isSameScreen =
                game.mapIndex === mapId &&
                !!game.currentMap &&
                game.camera.isVisiblePosition(x, y);

            p.forceStop();
            game.mapIndex = mapId;
            p.mapIndex = mapId;
            p.clearTarget();
            game.initPlayer();
            // FIX: this used to run *before* game.initPlayer(), but initPlayer()
            // -> player.respawn() -> forceStop() -> stop() (entitymoving.js)
            // unconditionally sets `freeze = false` as part of stopping the
            // player's movement/animation state -- so setting freeze=true first
            // just got silently undone one line later, leaving the player
            // unfrozen for the entire status 0->2 map-transition window.
            // onKeyMove/onStopPathing's checkTeleport() (game.js) is only gated
            // on `!p.freeze`, so any movement/stop event firing mid-transition
            // re-evaluated checkTeleport() while the player's x/y were still
            // sitting on the origin door tile (setPositionSpawn to the real
            // destination doesn't happen until status 2). For a cross-map
            // portal that stale position rarely lines up with a door on the
            // unrelated destination map, but a same-map portal reuses the same
            // already-loaded map, which has the identical door at the identical
            // coordinates,
            // so getDoor(p) matched the same door again and re-triggered
            // teleportMaps() -> another full status 0->2 handshake, repeating
            // indefinitely. Setting freeze=true after initPlayer() (instead of
            // before) means it survives the internal forceStop() call here and
            // stays true until the legitimate final forceStop() at status 2
            // (below) actually completes the transition.
            p.freeze = true;
            // `game.prevMap` is a plain Map instance (map/mapcamera.js's
            // own render-grid/camera logic is merged onto Map.prototype - see its own
            // header comment), so `.doors` is read straight off it now, no getMap(0)
            // indirection needed. Still guarded against `game.prevMap` itself
            // being unset (e.g. the very first spawn, which never sets
            // prevMap - see gamemovement.js's teleportMaps()) rather than
            // assuming it's always populated by this point.
            const prevMap = game.prevMap;
            if (
                prevMap &&
                portalId >= 0 &&
                portalId < prevMap.doors.length
            ) {
                const portal = prevMap.doors[portalId];
                const orientation = portal.orientation;
                p.orientation = orientation;
                p.suppressTeleportCheck = true;
                // remembered until the player is placed (status 2), for the arrival-door guard below
                p.teleportOrientation = orientation;
            } else {
                p.teleportOrientation = null;
            }

            game.renderer.clearEntities();

            // PERF: game.entities is a Map now (see its declaration in
            // game.js) -- reset to a fresh empty Map instead of an object.
            delete game.entities;
            game.entities = new Map();
            delete game.camera.entities;
            game.camera.entities = {};
            delete game.camera.outEntities;
            game.camera.outEntities = {};
            delete game.items;
            game.items = {};

            log.info('Map loaded.');
            this.client.sendTeleportMap([mapId, 1, x, y, -1]);
            if (!isSameScreen) {
                game.renderer.blankFrame = true;
            }
        }

        if (status === 2) {
            log.info('spawnMap - Loaded');

            p.setPositionSpawn(x, y);

            const c = game.camera;

            game.initGrid();
            c.setRealCoords();

            game.pathfinder = new Pathfinder(0, 0);
            log.info('spawnMap - Cleared');

            const fnReady = function () {
                log.info('spawnPlayer - started');

                const p = game.player;

                game.addEntity(p);
                // The camera's draw lists were emptied when the transition started (status 1), and addEntity()
                // only puts an entity back on them if the camera already counts its tile as on screen. At this
                // point the camera can still be where it was on the previous map (e.g. at the top of a section
                // while the player arrives at the bottom of the next one), so the player stayed undrawn until
                // they moved. The player is the camera's focus and is always drawn: put them back directly.
                game.camera.entities[p.id] = p;
                game.camera.outEntities[p.id] = p;

                game.audioManager.updateMusic();

                game.mapStatus = 2;

                log.info('moveGrid');

                game.renderer.forceRedraw = true;
                log.info('spawnPlayer - finished');

                p.forceStop();

                // FIX: freeze was only ever cleared as a side effect of forceStop() ->
                // user.js's override -> this._forceStop() -> entitymoving.js's stop(),
                // which sets `this.freeze = false` internally. But that override
                // deliberately *skips* calling _forceStop() whenever
                // `fsm === "ATTACK"` (so a teleport landing mid-swing doesn't cut off
                // the attack animation) -- and with no explicit reset here, that left
                // freeze stuck `true` forever whenever the teleport completed while the
                // player's fsm hadn't yet settled back from "ATTACK", permanently
                // blocking movement (updater.js gates updateCharacterKeyMovement/
                // updatePlayerPathMovement/etc. on `!entity.freeze`). The teleport
                // transition is genuinely done at this point regardless of fsm state,
                // so clear it unconditionally here instead of relying on forceStop()'s
                // internal, conditional path to do it.
                p.freeze = false;

                // FIX: suppressTeleportCheck (game.js's checkTeleport) now stays true
                // for the whole transition instead of clearing itself after the first
                // read -- see checkTeleport's comment for why it can't be one-shot
                // (forceStop()'s internal stop() clears p.freeze as a side effect,
                // which meant relying on freeze alone let a second forceStop() call
                // slip a real re-entry through). This is the one place that's supposed
                // to explicitly clear it again, at the same genuine end-of-transition
                // point freeze itself gets cleared, so a real subsequent door trigger
                // (from the player's own later movement) isn't permanently suppressed.
                p.suppressTeleportCheck = false;

                // Arrival-door guard (see checkTeleport in gamecallbacks.js): when a door drops the
                // player on a tile that is itself a door, that door stays inactive while the player
                // keeps the orientation the teleport gave them, so it can't send them straight back.
                // Turning (or stepping off the door) makes it a normal door again.
                // The same after a warp or a respawn that happens to land on a door (with the orientation the
                // player arrived with).
                const arrivalDoor = game.currentMap.getDoor(p);
                p.arrivalDoorGuard = arrivalDoor
                    ? {
                          door: arrivalDoor,
                          orientation:
                              p.teleportOrientation != null ? p.teleportOrientation : p.orientation
                      }
                    : null;
                p.teleportOrientation = null;

                game.app.releaseKeys();
            };

            game.currentMap.allReady(function () {
                // NOTE: `this.allready` (bound to currentMap via allReady()'s
                // all_ready_func.call(this) - not a bug) is write-only; nothing in the
                // codebase currently reads it. Left in place as a harmless state flag rather
                // than removed, in case external/debug code relies on inspecting it.
                this.allready = true;
                fnReady();
            });
        }
    };

    proto.onMapStatus = function (mapId, status) {
        log.info('mapStatus=' + mapId + ',' + status);
        game.mapIndex = Number(mapId);
        game.mapStatus = Number(status);
    };
}
