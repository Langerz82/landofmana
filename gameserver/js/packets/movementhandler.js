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

import Messages from '../message.js';
import { Types } from '../common.js';
import { G_TILESIZE, G_DEBUG } from '../constants.js';
import { tryMoveTo, tryStartPath, setMoveAnchor } from './movevalidator.js';

// Split out of packethandler.js -- CW_MOVE/CW_MOVEPATH/CW_TELEPORT_MAP, the
// three packets that move a player around (in-place stepping, click-to-move
// pathing, and map-to-map teleports/doors). Same constructor(packetHandler)
// convention as the other split-out handlers (combathandler.js,
// skillactionhandler.js, ...): cache `player`/`world` up front, reach back
// through `this.ph` for the couple of things that still live on the core
// PacketHandler (send(), and the move_callback registered via onMove()).
// How far (in pixels) outside a door's own rectangle the player may still be
// when using it. The server's path simulation can trail the client's by a
// network round trip when the client walks onto a door, so a strict
// "standing inside the door" check would reject legitimate teleports.
const DOOR_SLACK = G_TILESIZE * 4;

// Portal id the clients send for the admin-only "/warp [map]" chat command (doors are 0 and up, -1 is
// the town warp button and the login entry).
const WARP_PORTAL = -2;

// Tile offset (in pixels, a whole number of tiles) of position `v` from the start of a door
// spanning [start, start + size), clamped to the door -- used by edge doors (door.rel).
function relDoorOffset(v, start, size) {
    const tiles = Math.max(1, Math.floor(size / G_TILESIZE));
    const t = Math.floor((v - start) / G_TILESIZE);
    return Math.min(tiles - 1, Math.max(0, t)) * G_TILESIZE;
}

function isNearDoor(p, door) {
    const dx = Math.max(door.x - p.x, 0, p.x - (door.x + door.width));
    const dy = Math.max(door.y - p.y, 0, p.y - (door.y + door.height));
    return dx <= DOOR_SLACK && dy <= DOOR_SLACK;
}

class MovementHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = this.ph.player;
        this.world = this.ph.world;
    }

    // CW_MOVE: [time, entityId, state, orientation, x, y]
    //   state 0 = key released, stopped at x,y
    //   state 1 = key pressed/turned at x,y, now walking `orientation`
    //   state 2 = click-to-move path aborted, stopped at x,y
    // All validation lives in movevalidator.js; a rejected packet is
    // corrected exactly once, back to the server's own position.
    handleMoveEntity(message) {
        const entityId = parseInt(message[1]),
            state = parseInt(message[2]),
            orientation = parseInt(message[3]),
            x = parseInt(message[4]),
            y = parseInt(message[5]);

        const p = this.player;
        if (entityId !== p.id) return;

        if (!tryMoveTo(p, x, y)) {
            if (G_DEBUG)
                console.warn(
                    `handleMoveEntity - rejected state:${state} x:${x} y:${y} p.x:${p.x} p.y:${p.y}`
                );
            p.resetMove(p.x, p.y);
            return;
        }

        p.fixMove(x, y);
        if (state === 2) return;
        if (state === 1) p.startKeyMove(orientation);

        const msg = new Messages.Move(p, orientation, state, x, y);
        p.map.entities.sendNeighbours(p, msg, p);

        if (this.ph.move_callback) this.ph.move_callback();
    }

    // CW_MOVEPATH: [time, entityId, orientation, interrupted, path]
    handleMovePath(message) {
        const time = parseInt(message[0]),
            entityId = parseInt(message[1]),
            interrupted = parseInt(message[3]) !== 0,
            path = message[4];

        const p = this.player;
        if (entityId !== p.id) return;

        if (!tryStartPath(p, path)) {
            if (G_DEBUG)
                console.warn(
                    'handleMovePath - rejected path: ' + JSON.stringify(path)
                );
            p.resetMove(p.x, p.y);
            return;
        }

        p.fixMove(path[0][0], path[0][1]);
        p.movePath([time, interrupted], path);

        const msg = new Messages.MovePath(p, path);
        p.map.entities.sendNeighbours(p, msg);
    }

    // TODO - enterCallback x,y not being overridden sometimes,
    // and sending to wrong Map.
    handleTeleportMap(msg) {
        console.info('handleTeleportMap');
        const self = this;
        const mapId = parseInt(msg[0]),
            status = parseInt(msg[1]);
        console.info('status=' + status);
        let x = parseInt(msg[2]),
            y = parseInt(msg[3]);
        const portalId = parseInt(msg[4]);

        const p = this.player;
        // "/warp <map> <gx> <gy>" (admins): the tile to land on, in the target map's own tiles
        const warpTile = portalId === WARP_PORTAL && status === 0 && x >= 0 && y >= 0
            ? { gx: Math.floor(x), gy: Math.floor(y) } : null;
        if (status <= 0) {
            x = -1;
            y = -1;
        }

        // A refused transition request (status 0) is answered with status -1 and the player's
        // current map, so the client goes back to the map it is still on instead of waiting
        // forever on the one it already started loading.
        const reject = function (why) {
            console.info(why);
            if (status !== 0 || !p.map) return;
            self.ph.send([
                Types.Messages.WC_TELEPORT_MAP,
                p.map.index,
                -1,
                p.x,
                p.y,
                -1
            ]);
        };

        if (mapId < 0 || !self.world.maps[mapId]) {
            reject('Map non-index');
            return;
        }

        const map = self.world.maps[mapId];
        // FIX: was `map.ready` -- that's map.js's method that registers the
        // onLoad callback, not a load-state flag (see the FIX comments in
        // map.js's initMap() and worldserver.js's forEachMap() for the same
        // issue). A function reference is always truthy, so this check
        // never actually caught a target map that hadn't finished loading
        // yet -- it passed unconditionally as long as `map` existed at all,
        // letting a player teleport onto a map whose `entities`/`doors`
        // might not be initialized yet. `isReady` is the real boolean.
        if (!(map && map.isReady)) {
            reject('Map non-existant or not ready');
            return;
        }

        if (portalId >= 0 && portalId >= p.map.doors.length) {
            reject('Teleport does not exist.');
            return;
        }

        if (status === 0) {
            // FIX: this whole door/level validation block (and the
            // destination `pos`/`isDoor` it produces) used to run *after*
            // forceStop()/mapStatus=0/clearTarget()/handleTeleport()/
            // removePlayer() below had already mutated the player's state --
            // in particular p.map.entities.removePlayer(p), which despawns
            // the player for every nearby player, unregisters them from the
            // map's broadcaster, and drops them from the entity/spatial
            // index (see mapentities.js's removePlayer()). If door.tmap or
            // the level gate then rejected the request and `return`ed early
            // -- which a client with a stale door list, or a player simply
            // below the door's level requirement, hits in completely normal
            // play, not just a malicious client -- the player was left in
            // that half-removed state permanently: still nominally on their
            // current map, but invisible/unregistered on it, with mapStatus
            // stuck at 0 forever (movevalidator.js requires mapStatus>=2, so
            // they couldn't move again either), and no WC_TELEPORT_MAP
            // response ever sent to tell the client the transition didn't
            // happen. That's very likely what the old "Going through portal
            // when returning its looping" TODO here was actually describing
            // -- a rejected teleport leaving the player stuck mid-transition
            // looks exactly like an unresponsive loop from the client's
            // side. Validation now runs first and returns before touching
            // the player's map/entity state at all, same as the
            // mapId/map-ready/portalId-bounds checks above it already do.
            let pos = { x: p.x, y: p.y };
            let isDoor = false;
            // FIX: a teleport with no door (portalId -1) used to send the
            // player to a random start point on ANY ready map, from anywhere.
            // The clients only do that for (a) the initial entry, which
            // targets the map the player was already placed on at login
            // (WorldServer's onPlayerEnter), and (b) the town warp button /
            // warp chat command, which target map 0. Allow exactly those.
            // The "/warp [map]" chat command sends WARP_PORTAL (-2) instead, and is for admins only:
            // they may warp to any map. The town warp button (-1, map 0) stays open to everyone.
            if (portalId === WARP_PORTAL && !p.isAdmin) {
                self.ph.send(new Messages.Notify('CHAT', 'ADMIN_DENIED').serialize());
                reject('Warp command from a player who is not an admin rejected.');
                return;
            }
            if (portalId === -1 && map !== p.map && mapId !== 0 && !p.isAdmin) {
                reject('Teleport without a door to map ' + mapId + ' rejected.');
                return;
            }
            let warpPos = null;
            if (warpTile) {
                // an admin warp to a given tile: it must be on the map and not solid
                const why = warpTile.gx >= map.width || warpTile.gy >= map.height
                    ? 'is outside ' + (map.name || 'map ' + mapId) + ' (' + map.width + 'x' + map.height + ')'
                    : map.isCollidingPoint(warpTile.gx * G_TILESIZE + (G_TILESIZE >> 1), warpTile.gy * G_TILESIZE + (G_TILESIZE >> 1))
                      ? 'on ' + (map.name || 'map ' + mapId) + ' is a collision tile'
                      : null;
                if (why) {
                    self.ph.send(new Messages.Notify('CHAT', 'ADMIN_MESSAGE',
                        ['Cannot warp: tile ' + warpTile.gx + ',' + warpTile.gy + ' ' + why + '.']).serialize());
                    reject('Warp to tile ' + warpTile.gx + ',' + warpTile.gy + ' of map ' + mapId + ' refused: ' + why);
                    return;
                }
                warpPos = { x: warpTile.gx * G_TILESIZE + (G_TILESIZE >> 1), y: warpTile.gy * G_TILESIZE + (G_TILESIZE >> 1) };
            }
            if (portalId >= 0) {
                const door = p.map.doors[portalId];
                // FIX: `portalId` was only checked as a valid index into the
                // CURRENT map's doors array -- it names one specific real
                // door, but that door's own destination (`door.tmap`, set
                // in map.js's _getDoors) was never cross-checked against the
                // client-supplied `mapId` this handler otherwise trusts.
                // Nor was the door's level gate (`door.minLevel`/
                // `door.maxLevel`, also set in _getDoors) ever enforced. A
                // client could pick any valid door index on their current
                // map and pair it with any other ready map's id to land at
                // that door's tx/ty on an arbitrary destination map,
                // bypassing whatever level requirement that door was
                // configured with. Both are cheap, well-defined checks
                // against data the door object already carries.
                if (door.tmap !== mapId) {
                    reject('Teleport door does not lead to requested map.');
                    return;
                }
                if (p.level < door.minLevel || p.level > door.maxLevel) {
                    p.sendPlayer(
                        new Messages.Notify('CHAT', 'TELEPORT_LEVEL_REQUIRED', [
                            door.minLevel,
                            door.maxLevel
                        ])
                    );
                    reject('Teleport door level requirement not met.');
                    return;
                }
                // FIX: nothing checked the player was actually at this door,
                // so any door on the current map worked from anywhere on it.
                if (!isNearDoor(p, door)) {
                    reject('Player is not at teleport door ' + portalId + '.');
                    return;
                }
                if (door.tx >= 0 && door.ty >= 0) {
                    pos = { x: door.tx, y: door.ty };
                    if (door.rel) {
                        // edge door between map sections: keep the player's tile offset along
                        // the door, so crossing an edge at row 120 arrives at row 120 of the
                        // neighbouring section (clamped to the door's own extent)
                        pos.x += relDoorOffset(p.x, door.x, door.width);
                        pos.y += relDoorOffset(p.y, door.y, door.height);
                    }
                    pos.x += G_TILESIZE >> 1;
                    pos.y += G_TILESIZE >> 1;
                    isDoor = true;
                }
            }

            // A door must not put the player inside something solid on the destination map (e.g. crossing
            // a split map's edge where the tile across it is a tree or a wall): refuse the teleport, and
            // the client stays where it is (status -1) and won't retry until the player steps off the door.
            if (isDoor && map.isCollidingPoint(pos.x, pos.y)) {
                reject(
                    'Teleport destination ' +
                        Math.floor(pos.x / G_TILESIZE) +
                        ',' +
                        Math.floor(pos.y / G_TILESIZE) +
                        ' on map ' +
                        mapId +
                        ' is a collision tile.'
                );
                return;
            }

            // FIX: guards against a second CW_TELEPORT_MAP(status=0)
            // arriving while this player's previous transition is still in
            // flight -- committed past this point (mapStatus about to drop
            // to 0, player about to be removed/re-added), but before the
            // status=1 ack below sets mapStatus back to 2. Processing a
            // second one here would run removePlayer()/setMap()/addPlayer()
            // again on top of an already-in-progress transition -- duplicate
            // despawn/spawn broadcasts, and a second WC_TELEPORT_MAP
            // response racing the first -- which reads exactly like the
            // repeated map-load the old "portal looping" TODO described. A
            // well-behaved client only ever sends one status=0 request per
            // transition and waits for the full 0->1->2 round trip before
            // sending another, so this is defense against an out-of-sync or
            // buggy client re-sending, not something normal play should hit.
            if (p.teleportPending) {
                console.warn(
                    'handleTeleportMap - ignoring duplicate status=0 request, transition already in progress for player ' +
                        p.id
                );
                return;
            }
            p.teleportPending = true;

            p.forceStop();
            p.mapStatus = 0;
            p.clearTarget();

            p.handleTeleport();

            // FIX: was `removePlayer(p)` (destroy defaulting to true) --
            // removePlayer()/removeEntity() (mapentities.js) route a
            // destroying removal through Player.destroy() -> Character.die(),
            // which sets isDead=true and freeze=true. This call fires on
            // every same-session map transition, including the very first
            // teleport off the login map into the real world on entry -- so
            // a perfectly alive player got permanently marked isDead/frozen
            // the moment they entered the world, with no death screen and no
            // Respawn click available to clear it (canAttack()/modHp() both
            // gate on `!this.isDead`). The player is being moved to another
            // map, not removed from the game -- pass `false` so this leaves
            // the old map's registries without killing them.
            p.map.entities.removePlayer(p, false);

            // FIX (cleanup): `map.enterCallback(p)` was called here but its
            // result was immediately discarded by the `pos = {x: p.x, y: p.y}`
            // reassignment right below, and its actual purpose (a random
            // starting position for non-door teleports) is already handled
            // later in this function at `pos = p.map.getRandomStartingPosition()`
            // once `p.map` has been updated to the destination map. Removed the
            // dead call rather than leaving a no-op that looks load-bearing.

            p.setMap(map);

            if (warpPos) {
                pos = warpPos;
            } else if (!isDoor) {
                pos = p.map.getRandomStartingPosition();
            }

            p.map.entities.addPlayer(p);

            p.setPosition(pos.x, pos.y);
            p.forceStop();

            this.ph.send([
                Types.Messages.WC_TELEPORT_MAP,
                mapId,
                1,
                p.x,
                p.y,
                portalId
            ]);
        } else if (status === 1) {
            // FIX: the ack was honoured with no transition in flight, letting
            // a client re-run the spawn / processWho / move-anchor reset on
            // demand. Only accept it for the status=0 request it answers.
            if (!p.teleportPending) return;
            p.mapStatus = 2;
            // FIX: clears the in-flight guard set above once the client has
            // acked the transition (status=1) and the server has finished
            // the corresponding status=2 response below -- see the
            // teleportPending comment above for what this protects against.
            p.teleportPending = false;

            p.knownIds = [];

            p.setPosition(p.x, p.y);
            // The player was relocated by the server, so movement
            // validation restarts from here.
            setMoveAnchor(p, p.x, p.y);
            p.map.entities.processWho(p);
            p.map.entities.sendNeighbours(p, new Messages.Spawn(p), p);

            this.ph.send([
                Types.Messages.WC_TELEPORT_MAP,
                mapId,
                2,
                p.x,
                p.y,
                portalId
            ]);
        }
    }
}

export default MovementHandler;
