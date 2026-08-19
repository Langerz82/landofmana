import Messages from '../message.js';
import { Types } from '../common.js';
import { G_LATENCY, G_TILESIZE, G_DEBUG } from '../constants.js';

// Split out of packethandler.js -- CW_MOVE/CW_MOVEPATH/CW_TELEPORT_MAP, the
// three packets that move a player around (in-place stepping, click-to-move
// pathing, and map-to-map teleports/doors). Same constructor(packetHandler)
// convention as the other split-out handlers (combathandler.js,
// skillactionhandler.js, ...): cache `player`/`world` up front, reach back
// through `this.ph` for the couple of things that still live on the core
// PacketHandler (send(), and the move_callback registered via onMove()).
class MovementHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = this.ph.player;
        this.world = this.ph.world;
    }

    // TODO map enforce for all calls.
    handleMoveEntity(message) {
        const time = parseInt(message[0]),
            entityId = parseInt(message[1]),
            state = parseInt(message[2]),
            orientation = parseInt(message[3]);
        // FIX: `x`/`y` need to be reassignable now (see the state === 0
        // guard added below), so these two moved out of the `const` group
        // above into their own `let` declaration.
        let x = parseInt(message[4]) || -1,
            y = parseInt(message[5]) || -1;

        const p = this.player;
        if (entityId !== p.id) return;

        // PERF/FIX: these reject-path console.warn/error calls used to run
        // unconditionally, right next to the `arr` log a few lines down
        // which *was* already gated with a PERF comment explaining exactly
        // this cost. Since these are reject paths, a client that moves
        // faster than allowed or with bad coordinates controls exactly how
        // often they fire, at whatever packet rate the connection allows --
        // gated the same way. Also switched `==` to `===` (line below) for
        // consistency with the rest of this function.
        if (state === 1 && p.hasMoveThrottled(G_LATENCY)) {
            if (G_DEBUG) console.warn('handleMoveEntity - moveThrottled');
            p.resetMove(p.x, p.y);
            return;
        }

        if (state === 2) {
            if (!p.checkStartMove(x, y)) {
                if (G_DEBUG) {
                    console.error(
                        'handleMoveEntity, checkStartMove - x:' +
                            x +
                            ',y:' +
                            y
                    );
                    console.error(
                        'handleMoveEntity, checkStartMove - p.x:' +
                            p.x +
                            ',p.y:' +
                            p.y
                    );
                }
                p.resetMove(p.x, p.y);
            }
            p.forceStop();
            return;
        }

        if (state === 1 && !p.checkStartMove(x, y)) {
            p.resetMove(p.x, p.y);
            return;
        }

        // FIX: state === 0 ("I stopped moving, here's my resting position"
        // -- see client/js/game/gamecallbacks.js's onKeyMove, which sends
        // this on every key-release) was the only one of the three
        // schema-legal move types (format.js bounds `state` to 0-2) with no
        // validation at all: state 1 ("start moving") is gated by
        // checkStartMove() just above, and state 2 ("explicit stop with
        // position confirm") gates the same way a bit further up. state 0
        // instead fell straight through to the shared tail below, which
        // calls `p.move(arr)` with the raw client-supplied x/y (bounded
        // only by format.js's generic 0..mapCoordsMax range) with no
        // collision or distance/speed check at all -- a teleport vector,
        // since `state` is entirely client-chosen and 0 is the
        // least-suspicious-looking value ("I just stopped"). Unlike the
        // state 1/2 checks above, an invalid state-0 position is corrected
        // (snapped back to the player's last known-good spot) rather than
        // the whole packet being dropped, and this still falls through to
        // the normal broadcast below -- a stop notification should never be
        // silently swallowed, since neighbouring players rely on it to see
        // where the player actually came to rest.
        if (state === 0 && !p.checkStartMove(x, y)) {
            p.resetMove(p.x, p.y);
            x = p.x;
            y = p.y;
        }

        const arr = [time, state, orientation, x, y];
        // PERF: runs on every movement packet from every player; gated for
        // the same reason as the recv() log in packethandler.js.
        if (G_DEBUG)
            console.info('handleMoveEntity - arr: ' + JSON.stringify(arr));
        if (state === 1) {
            p.move([time, 0, p.orientation, x, y]);
        }
        p.move(arr);

        const msg = new Messages.Move(p, orientation, state, x, y);
        p.map.entities.sendNeighbours(p, msg, p);

        if (this.ph.move_callback) this.ph.move_callback();
    }

    handleMovePath(message) {
        const time = parseInt(message.shift()),
            entityId = parseInt(message.shift()),
            orientation = parseInt(message.shift()),
            interrupted = parseInt(message.shift()) === 0 ? false : true;

        const path = message[0];

        const p = this.player;
        if (entityId !== p.id) return;

        if (path && p.hasMoveThrottled(G_LATENCY)) {
            p.resetMove(p.x, p.y);
            if (G_DEBUG) console.warn('handleMoveEntity - moveThrottled');
            return;
        }

        // PERF: runs on every path packet from every player.
        if (G_DEBUG) console.info(JSON.stringify(path));

        const x = path[0][0],
            y = path[0][1];

        if (!p.checkStartMove(x, y)) {
            p.resetMove(p.x, p.y);
            return;
        }

        p.forceStop();

        if (!p.isValidGridPath(path)) return;

        if (G_DEBUG)
            console.info(
                'packethandler: handleMoveEntity - movepath: ' +
                    JSON.stringify(path)
            );
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
        if (status <= 0) {
            x = -1;
            y = -1;
        }

        if (mapId < 0 || mapId >= self.world.maps.length) {
            console.info('Map non-index');
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
            console.info('Map non-existant or not ready');
            return;
        }

        if (portalId >= 0 && portalId >= p.map.doors.length) {
            console.info('Teleport does not exist.');
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
            // stuck at 0 forever (checkStartMove requires mapStatus>=2, so
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
                    console.info(
                        'Teleport door does not lead to requested map.'
                    );
                    return;
                }
                if (p.level < door.minLevel || p.level > door.maxLevel) {
                    p.sendPlayer(
                        new Messages.Notify('CHAT', 'TELEPORT_LEVEL_REQUIRED', [
                            door.minLevel,
                            door.maxLevel
                        ])
                    );
                    return;
                }
                if (door.tx >= 0 && door.ty >= 0) {
                    pos = { x: door.tx, y: door.ty };
                    pos.x += G_TILESIZE >> 1;
                    pos.y += G_TILESIZE >> 1;
                    isDoor = true;
                }
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

            p.map.entities.removePlayer(p);

            // FIX (cleanup): `map.enterCallback(p)` was called here but its
            // result was immediately discarded by the `pos = {x: p.x, y: p.y}`
            // reassignment right below, and its actual purpose (a random
            // starting position for non-door teleports) is already handled
            // later in this function at `pos = p.map.getRandomStartingPosition()`
            // once `p.map` has been updated to the destination map. Removed the
            // dead call rather than leaving a no-op that looks load-bearing.

            p.setMap(map);

            if (!isDoor) {
                pos = p.map.getRandomStartingPosition();
            }

            p.map.entities.addPlayer(p);

            p.setPosition(pos.x, pos.y);
            p.forceStop();
            p.move([Date.now(), 3, 1, pos.x, pos.y]);

            this.ph.send([
                Types.Messages.WC_TELEPORT_MAP,
                mapId,
                1,
                p.x,
                p.y,
                portalId
            ]);
        } else if (status === 1) {
            p.mapStatus = 2;
            // FIX: clears the in-flight guard set above once the client has
            // acked the transition (status=1) and the server has finished
            // the corresponding status=2 response below -- see the
            // teleportPending comment above for what this protects against.
            p.teleportPending = false;

            p.knownIds = [];

            p.setPosition(p.x, p.y);
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
