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
            orientation = parseInt(message[3]),
            x = parseInt(message[4]) || -1,
            y = parseInt(message[5]) || -1;

        const p = this.player;
        if (entityId !== p.id)
            return;

        if (state==1 && p.hasMoveThrottled(G_LATENCY))  {
            console.warn("handleMoveEntity - moveThrottled");
            p.resetMove(p.x,p.y);
            return;
        }

        if (state === 2) {
            if (!p.checkStartMove(x,y)) {
                console.error("handleMoveEntity, checkStartMove - x:"+x+",y:"+y);
                console.error("handleMoveEntity, checkStartMove - p.x:"+p.x+",p.y:"+p.y);
                p.resetMove(p.x,p.y);
            }
            p.forceStop();
            return;
        }

        if (state === 1 && !p.checkStartMove(x,y)) {
            p.resetMove(p.x,p.y);
            return;
        }

        const arr = [time, state, orientation, x, y];
        // PERF: runs on every movement packet from every player; gated for
        // the same reason as the recv() log in packethandler.js.
        if (G_DEBUG)
            console.info("handleMoveEntity - arr: "+JSON.stringify(arr));
        if (state === 1) {
            p.move([time, 0, p.orientation, x, y]);
        }
        p.move(arr);

        const msg = new Messages.Move(p, orientation, state, x, y);
        p.map.entities.sendNeighbours(p, msg, p);

        if (this.ph.move_callback)
            this.ph.move_callback();
    }

    handleMovePath(message) {
        const time = parseInt(message.shift()),
            entityId = parseInt(message.shift()),
            orientation = parseInt(message.shift()),
            interrupted = (parseInt(message.shift()) === 0) ? false : true;

        const path = message[0];

        const p = this.player;
        if (entityId !== p.id)
            return;


        if (path && p.hasMoveThrottled(G_LATENCY)) {
            p.resetMove(p.x,p.y);
            console.warn("handleMoveEntity - moveThrottled");
            return;
        }

        // PERF: runs on every path packet from every player.
        if (G_DEBUG)
            console.info(JSON.stringify(path));

        const x = path[0][0],
            y = path[0][1];

        if (!p.checkStartMove(x,y)) {
            p.resetMove(p.x,p.y);
            return;
        }

        p.forceStop();

        if (!p.isValidGridPath(path))
            return;

        if (G_DEBUG)
            console.info("packethandler: handleMoveEntity - movepath: "+JSON.stringify(path));
        p.movePath([time, interrupted], path);

        const msg = new Messages.MovePath(p, path);
        p.map.entities.sendNeighbours(p, msg);
    }

    // TODO - enterCallback x,y not being overridden sometimes,
    // and sending to wrong Map.
    handleTeleportMap(msg) {
        console.info("handleTeleportMap");
        const self = this;
        const mapId = parseInt(msg[0]),
            status = parseInt(msg[1]);
        console.info("status="+status);
        let x = parseInt(msg[2]), y = parseInt(msg[3]);
        const portalId = parseInt(msg[4]);

        const p = this.player;
        if (status <= 0)
        {
            x = -1;
            y = -1;
        }

        if (mapId < 0 || mapId >= self.world.maps.length)
        {
            console.info("Map non-index");
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
            console.info("Map non-existant or not ready");
            return;
        }

        if (portalId >= 0 && portalId >= p.map.doors.length) {
            console.info("Teleport does not exist.");
            return;
        }

        if (status === 0) {
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

            let pos = {x: p.x, y: p.y};
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
                    console.info("Teleport door does not lead to requested map.");
                    return;
                }
                if (p.level < door.minLevel || p.level > door.maxLevel) {
                    p.sendPlayer(new Messages.Notify("CHAT", "TELEPORT_LEVEL_REQUIRED", [door.minLevel, door.maxLevel]));
                    return;
                }
                if (door.tx >= 0 && door.ty >= 0) {
                    pos = {x: door.tx, y: door.ty};
                    pos.x += (G_TILESIZE >> 1);
                    pos.y += (G_TILESIZE >> 1);
                    isDoor = true;
                }
            }

            p.setMap(map);

// TODO - Going through portal when returning its looping.


            if (!isDoor) {
                pos = p.map.getRandomStartingPosition();
            }

            p.map.entities.addPlayer(p);

            p.setPosition(pos.x, pos.y);
            p.forceStop();
            p.move([Date.now(),3,1,pos.x,pos.y]);

            this.ph.send([Types.Messages.WC_TELEPORT_MAP, mapId, 1, p.x, p.y, portalId]);
        }
        else if (status === 1) {
            p.mapStatus = 2;

            p.knownIds = [];

            p.setPosition(p.x,p.y);
            p.map.entities.processWho(p);
            p.map.entities.sendNeighbours(p, new Messages.Spawn(p), p);

            this.ph.send([Types.Messages.WC_TELEPORT_MAP, mapId, 2, p.x, p.y, portalId]);
        }
    }
}

export default MovementHandler;
