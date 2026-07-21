import Utils from '../utils.js';
import Mob from '../entity/mob/mob.js';
import { G_DEBUG } from '../constants.js';

class PlayerCallback {
    constructor() {
    }

    setCallbacks(entity) {
        const self = this;
        const p = entity;
        this.player = entity;
        this.entities = p.map.entities;

        p.onStep(function (player, x, y) {
        });

        p.onRequestPath(function (x,y) {
            const path = this.entities.findPath(this, x, y);
            // PERF: fires on every click-to-move path request from every
            // player -- this JSON.stringify ran unconditionally, unlike the
            // equivalent per-path-request logging already gated elsewhere
            // (player.js isValidGridPath, pathfinder.js findPath, etc.).
            if (G_DEBUG)
                console.info("onRequestPath, id:"+this.id+", path:"+JSON.stringify(path));
            // FIX: was a bare `return` (undefined), discarding the computed
            // `path` -- the sibling mob/NPC onRequestPath callbacks
            // (callbacks/mobcallback.js, callbacks/npcmovecallback.js) both
            // correctly return their computed path. Whatever calls this
            // callback (entitymoving.js's requestPathfindingTo -> _moveTo)
            // checks `if (path) this.followPath(path)`, so returning
            // undefined here silently meant a player's path request never
            // resulted in movement.
            return path;
        });

        const attackFunc = function (p) {
            // processAttack() moved into packets/combathandler.js as part of
            // splitting packethandler.js's combat logic out of the core
            // packet-handling class; reached the same way partymanager.js
            // already reaches packetHandler.partyHandler.handleAbandoned().
            p.packetHandler.combatHandler.processAttack();
        };

        const stopPathing = function (p, x, y) {
            // PERF: onStopPathing fires whenever a moving player's path
            // completes/stops -- gated behind G_DEBUG like the rest of the
            // per-movement-event logging in this file.
            if (G_DEBUG)
                console.info("onStopPathing");
            p.setPosition(x,y);
            //p.forceStop();

            p.sx = p.x;
            p.sy = p.y;

            if (G_DEBUG)
                console.info("onStopPathing - p.id"+p.id+"p.x:"+p.x+",p.y="+p.y);
            attackFunc(p);
        };

        const abortPathing = function (p, path, x, y) {
            const dist = self.entities.pathfinder.getPathSubDistance(path, x, y);
            if (self.entities.pathfinder.isDistanceTooFast(p.tick, dist, p.startMovePathTime)) {
                console.error("path - isDistanceTooFast = true.");
                p.resetMove(p.sx,p.sy);
                return;
            }

            stopPathing(p,x,y);
        };

        p.onStopPathing(function (x, y) {
            if (G_DEBUG)
                console.info("onStopPathing");
            stopPathing(this,x,y);
        });

        p.onAbortPathing(function (path, x, y) {
            if (G_DEBUG)
                console.info("onAbortPathing");
            abortPathing(this,path,x,y);
        });

        p.checkStopDanger = function (c, o)
        {
            let res=false;

            if (c.ex === -1 && c.ey === -1)
            {
                return false;
            }
            else if (c.x === c.ex && c.y === c.ey)
            {
                return true;
            }

            const x = c.x, y = c.y;

            if (o === 4 && x < c.ex)
            {
                res = true;
            }
            else if (o === 3 && x > c.ex)
            {
                res = true;
            }
            else if (o === 2 && y < c.ey)
            {
                res = true;
            }
            else if (o === 1 && y > c.ey)
            {
                res = true;
            }
            // PERF: checkStopDanger runs on every pixel-step of every
            // key-moving player (called from updater.js's playerKey, which
            // Transition.step() can invoke up to ~20 times per single world
            // tick -- see the PERF comments on Map.isColliding/setPosition
            // for the same loop). The `res` branch only fires on an actual
            // stop-danger anomaly, not on every step, but it's still gated
            // behind G_DEBUG for consistency with the rest of this file's
            // per-movement-event logging.
            if (res) {
                c.setPosition(c.ex, c.ey);
                if (G_DEBUG) {
                    console.info("checkStopDanger, WARN - PLAYER "+c.id+" not stopping.");
                    console.info("checkStopDanger, orientation: "+Utils.getOrientationString(o));
                    console.info("checkStopDanger, x :"+x+",y :"+y);
                    console.info("checkStopDanger, ex:"+c.ex+",ey:"+c.ey);
                }
            }
            return res;
        };

        p.checkPathInterrupt = function (x,y) {
            if (!this.isMovingPath())
                return false;

            const pathfinder = this.map.entities.pathfinder;

            if (!pathfinder.isInPath(this.path, [x,y]))
                return true;

            const dist = pathfinder.getPathSubDistance(this.path, x, y);
            if (!dist) {
                if (this.path[0][0] === x && this.path[0][1] === y)
                    return false;

                // PERF: checkPathInterrupt is called from checkStartMove
                // below, which runs on every movement/path packet from every
                // player -- the single hottest packet in the game (see the
                // PERF comment on processWho in map/mapentities.js). This
                // JSON.stringify ran unconditionally on this branch.
                if (G_DEBUG) {
                    console.info("checkPathInterrupt, getPathSubDistance = not found.");
                    console.info("checkPathInterrupt, getPathSubDistance: path:"+JSON.stringify(this.path));
                    console.info("checkPathInterrupt, getPathSubDistance: x:"+x+",y:"+y);
                }
                return true;
            }

            const res = pathfinder.isDistanceTooFast(this.tick, dist, this.startMovePathTime);
            return res;
        };

        // PERF: checkStartMove runs on every single movement/path packet
        // from every connected player -- packethandler.js's
        // handleMoveEntity/handleMovePath call it unconditionally on every
        // packet, making it the single hottest packet-handling path in the
        // game (see the G_SPATIAL_SIZE/processWho comments in main.js and
        // map/mapentities.js for the same "hottest path" designation). Every
        // branch below used to console.info unconditionally -- including a
        // JSON.stringify(path) on every in-progress move -- so this ran full
        // string-building/serialization on literally every packet regardless
        // of whether anyone was watching the log. Gated behind G_DEBUG like
        // the rest of the per-packet logging in packethandler.js/pathfinder.js.
        p.checkStartMove = function (x,y) {
            if (this.mapStatus < 2)
                return false;

            const pathfinder = this.map.entities.pathfinder;

            //console.info("checkStartMove - player, x:"+x+",y:"+y);
            //console.info("checkStartMove - player, p.sx:"+p.sx+",p.sy:"+p.sy);
            //console.info("checkStartMove - player, p.x:"+p.x+",p.y:"+p.y);
            //console.info("checkStartMove - player, ex:"+p.ex+",ey:"+p.ey);

            if (this.map.isColliding(x, y)) {
                if (G_DEBUG)
                    console.info("checkStartMove - char.isColliding("+this.id+","+x+","+y+")");
                return false;
            }

            if (this.checkPathInterrupt(x,y)) {
                if (G_DEBUG)
                    console.info("checkStartMove - checkPathInterrupt = true");
                this.resetMove(this.x,this.y);
                return false;
            }
            else {
                this.fixMove(x,y);
            }

            if (this.x === x && this.y === y) {
                if (G_DEBUG)
                    console.info("checkStartMove - same coords.");
                return true;
            }

            if (this.isMoving())
            {
                const path = [[this.sx,this.sy],[x,y]];
                if (G_DEBUG)
                    console.info("playercallback, checkStartMove, isMoving - path: "+JSON.stringify(path));

                if (!pathfinder.isValidPath(path)) {
                    if (G_DEBUG)
                        console.info("playercallback, checkStartMove, isMoving - isValidPath false.");
                    return false;
                }
                if (!pathfinder.isValidGridPath(this.map.grid, path, true)) {
                    if (G_DEBUG)
                        console.info("playercallback, checkStartMove, isMoving - isValidGridPath false.");
                    return false;
                }
                const dist = Math.abs(this.sx-x) + Math.abs(this.sy-y);
                if (G_DEBUG)
                    console.info("playercallback, checkStartMove, isMoving - isDistanceTooFast.");
                return !pathfinder.isDistanceTooFast(this.tick, dist, this.startMoveTime);
            }

            if (G_DEBUG) {
                console.info("checkStartMove - id:"+this.id+" different coords.");
                console.info("checkStartMove - id:"+this.id+" p.x:"+this.x+",p.y:"+this.y);
                console.info("checkStartMove - x:"+x+",y:"+y);
            }
            return false;
        }

        p.correctMove = function (x, y) {
            if (!(this.ex === -1 && this.ey === -1) && !(this.x === x && this.y === y))
            {
                console.warn("ERROR - MOVING NOT SYNCHED PROPERLY, FORCING CLIENT UPDATE");
                // PERF: this branch only fires on an actual desync (rare),
                // but gated behind G_DEBUG anyway for consistency with the
                // rest of this file -- the console.warn above stays
                // unconditional since it's the actual anomaly signal.
                if (G_DEBUG) {
                    console.info("player, orientation:"+this.orientation);
                    console.info("player, x:"+this.x+",y:"+this.y);
                    console.info("player, sx:"+this.sx+",sy:"+this.sy);
                    console.info("player, ex:"+this.ex+",ey:"+this.ey);
                }

                this.resetMove(this.sx,this.sy);
            }
        };

        p.onMoveStop(function () {
            //console.error("setMoveStopCallback - player, sx:"+p.sx+",sy:"+p.sy);
            //console.error("setMoveStopCallback - player, x:"+p.x+",y:"+p.y);
            //console.error("setMoveStopCallback - player, ex:"+p.ex+",ey:"+p.ey);

            this.keyMove = false;
            this.endMoveTime = Date.now();

            attackFunc(this);
        });

        p.onTeleport(function () {
            this.forEachAttacker(function(entity)
            {
                if (entity instanceof Mob)
                {
                    entity.returnToSpawn();
                }
            });
            this.clearAttackerRefs();
        });

        p.onKilled(function (attacker, damage) {
        });

        p.onDeath(function (attacker) {
            this.world.loot.handleDropItem(this, attacker);
        });

    }
}

export default PlayerCallback;
