//import Utils from '../utils.js';
import Mob from '../entity/mob.js';

class PlayerCallback {
    constructor() {
    }

    setCallbacks(entity) {
        var self = this;
        var p = entity;
        this.player = entity;
        this.entities = p.map.entities;

        p.onStep(function (player, x, y) {
        });

        p.onRequestPath(function (x,y) {
            var path = this.entities.findPath(this, x, y);
            console.info("onRequestPath, id:"+this.id+", path:"+JSON.stringify(path));
            return
        });

        var attackFunc = function (p) {
            p.packetHandler.processAttack();
        };

        var stopPathing = function (p, x, y) {
            console.info("onStopPathing");
            p.setPosition(x,y);
            //p.forceStop();

            p.sx = p.x;
            p.sy = p.y;

            console.info("onStopPathing - p.id"+p.id+"p.x:"+p.x+",p.y="+p.y);
            attackFunc(p);
        };

        var abortPathing = function (p, path, x, y) {
            var dist = self.entities.pathfinder.getPathSubDistance(path, x, y);
            if (self.entities.pathfinder.isDistanceTooFast(p.tick, dist, p.startMovePathTime)) {
                console.error("path - isDistanceTooFast = true.");
                p.resetMove(p.sx,p.sy);
                return;
            }

            stopPathing(p,x,y);
        };

        p.onStopPathing(function (x, y) {
            console.info("onStopPathing");
            stopPathing(this,x,y);
        });

        p.onAbortPathing(function (path, x, y) {
            console.info("onAbortPathing");
            abortPathing(this,path,x,y);
        });

        p.checkStopDanger = function (c, o)
        {
            var res=false;

            if (c.ex === -1 && c.ey === -1)
            {
                return false;
            }
            else if (c.x === c.ex && c.y === c.ey)
            {
                return true;
            }

            var x = c.x, y = c.y;

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
            if (res) {
                c.setPosition(c.ex, c.ey);
                console.info("checkStopDanger, WARN - PLAYER "+c.id+" not stopping.");
                console.info("checkStopDanger, orientation: "+Utils.getOrientationString(o));
                console.info("checkStopDanger, x :"+x+",y :"+y);
                console.info("checkStopDanger, ex:"+c.ex+",ey:"+c.ey);
            }
            return res;
        };

        p.checkPathInterrupt = function (x,y) {
            if (!this.isMovingPath())
                return false;

            var pathfinder = this.map.entities.pathfinder;

            if (!pathfinder.isInPath(this.path, [x,y]))
                return true;

            var dist = pathfinder.getPathSubDistance(this.path, x, y);
            if (!dist) {
                if (this.path[0][0] === x && this.path[0][1] === y)
                    return false;

                console.info("checkPathInterrupt, getPathSubDistance = not found.");
                console.info("checkPathInterrupt, getPathSubDistance: path:"+JSON.stringify(this.path));
                console.info("checkPathInterrupt, getPathSubDistance: x:"+x+",y:"+y);
                return true;
            }

            var res = pathfinder.isDistanceTooFast(this.tick, dist, this.startMovePathTime);
            return res;
        };

        p.checkStartMove = function (x,y) {
            if (this.mapStatus < 2)
                return false;

            var pathfinder = this.map.entities.pathfinder;

            //console.info("checkStartMove - player, x:"+x+",y:"+y);
            //console.info("checkStartMove - player, p.sx:"+p.sx+",p.sy:"+p.sy);
            //console.info("checkStartMove - player, p.x:"+p.x+",p.y:"+p.y);
            //console.info("checkStartMove - player, ex:"+p.ex+",ey:"+p.ey);

            if (this.map.isColliding(x, y)) {
                console.info("checkStartMove - char.isColliding("+this.id+","+x+","+y+")");
                return false;
            }

            if (this.checkPathInterrupt(x,y)) {
                console.info("checkStartMove - checkPathInterrupt = true");
                this.resetMove(this.x,this.y);
                return false;
            }
            else {
                this.fixMove(x,y);
            }

            if (this.x === x && this.y === y) {
                console.info("checkStartMove - same coords.");
                return true;
            }

            if (this.isMoving())
            {
                var path = [[this.sx,this.sy],[x,y]];
                console.info("playercallback, checkStartMove, isMoving - path: "+JSON.stringify(path));

                if (!pathfinder.isValidPath(path)) {
                    console.info("playercallback, checkStartMove, isMoving - isValidPath false.");
                    return false;
                }
                if (!pathfinder.isValidGridPath(this.map.grid, path, true)) {
                    console.info("playercallback, checkStartMove, isMoving - isValidGridPath false.");
                    return false;
                }
                var dist = Math.abs(this.sx-x) + Math.abs(this.sy-y);
                console.info("playercallback, checkStartMove, isMoving - isDistanceTooFast.");
                return !pathfinder.isDistanceTooFast(this.tick, dist, this.startMoveTime);
            }

            console.info("checkStartMove - id:"+this.id+" different coords.");
            console.info("checkStartMove - id:"+this.id+" p.x:"+this.x+",p.y:"+this.y);
            console.info("checkStartMove - x:"+x+",y:"+y);
            return false;
        }

        p.correctMove = function (x, y) {
            if (!(this.ex === -1 && this.ey === -1) && !(this.x === x && this.y === y))
            {
                console.warn("ERROR - MOVING NOT SYNCHED PROPERLY, FORCING CLIENT UPDATE");
                console.info("player, orientation:"+this.orientation);
                console.info("player, x:"+this.x+",y:"+this.y);
                console.info("player, sx:"+this.sx+",sy:"+this.sy);
                console.info("player, ex:"+this.ex+",ey:"+this.ey);

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
