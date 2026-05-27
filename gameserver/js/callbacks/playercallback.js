
module.exports = PlayerCallback = Class.extend({

  	init: function() {
  	},

	 setCallbacks: function (entity) {
    		var self = this;
        var p = entity;
        this.player = entity;
        this.entities = p.map.entities;

    		p.onStep(function (player, x, y) {
    		});

        p.onRequestPath(function (x,y) {
            var p = this;
            return self.entities.findPath(p, x, y);
        });

        var attackFunc = function (p) {
            p.packetHandler.processAttack();
        };

        var stopPathing = function (p, x, y) {
            console.info("onStopPathing");

            p.setPosition(x,y);

            p.sx = p.x;
            p.sy = p.y;

            console.info("p.x:"+p.x+",p.y="+p.y);
            attackFunc(p);
        };

        var abortPathing = function (p, x, y) {
          var dist = self.entities.pathfinder.getPathSubDistance(p.path, x, y);
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

        p.onAbortPathing(function (x, y) {
            console.info("onAbortPathing");
            abortPathing(this,x,y);
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
          var p = this;

          if (!p.isMovingPath())
            return false;

          var pathfinder = p.map.entities.pathfinder;

          var dist = pathfinder.getPathSubDistance(p.path, x, y);
          if (!dist) {
            console.error("getPathSubDistance = not found.");
            return true;
          }

          return pathfinder.isDistanceTooFast(p.tick, dist, p.startMovePathTime);
        };

        p.checkStartMove = function (x,y) {
            var p = this;

            if (p.mapStatus < 2)
              return false;

            //console.info("checkStartMove - player, x:"+x+",y:"+y);
            //console.info("checkStartMove - player, p.sx:"+p.sx+",p.sy:"+p.sy);
            //console.info("checkStartMove - player, p.x:"+p.x+",p.y:"+p.y);
            //console.info("checkStartMove - player, ex:"+p.ex+",ey:"+p.ey);

            if (p.map.isColliding(x, y)) {
              console.info("checkStartMove - char.isColliding("+p.id+","+x+","+y+")");
              return false;
            }

            if (p.checkPathInterrupt(x,y)) {
              console.info("checkStartMove - checkPathInterrupt = true");
              return false;
            }

            if (p.isMovingPath() && !(p.x === x && p.y === y))
            {
              console.info("checkStartMove - isMovingPath but wrong coords.");
              p.fixMove(x,y);
              return true;
            }

            if (p.x === x && p.y === y) {
              console.info("checkStartMove - same coords.");
              return true;
            }

            console.info("checkStartMove - different coords.");
            return false;
        }

        p.correctMove = function (x, y) {
            var p = this;
            if (!(p.ex === -1 && p.ey === -1) && !(p.x === x && p.y === y))
            {
              console.warn("ERROR - MOVING NOT SYNCHED PROPERLY, FORCING CLIENT UPDATE");
              console.info("player, orientation:"+p.orientation);
              console.info("player, x:"+p.x+",y:"+p.y);
              console.info("player, sx:"+p.sx+",sy:"+p.sy);
              console.info("player, ex:"+p.ex+",ey:"+p.ey);

              p.resetMove(p.sx,p.sy);
            }
        };

        p.setMoveStopCallback(function () {
            var p = this;
            //console.error("setMoveStopCallback - player, sx:"+p.sx+",sy:"+p.sy);
            //console.error("setMoveStopCallback - player, x:"+p.x+",y:"+p.y);
            //console.error("setMoveStopCallback - player, ex:"+p.ex+",ey:"+p.ey);

            p.keyMove = false;
            p.endMoveTime = Date.now();

            attackFunc(p);
        });

        p.onTeleport(function () {
          p.forEachAttacker(function(entity)
          {
              if (entity instanceof Mob)
              {
                entity.returnToSpawn();
              }
          });
          p.clearAttackerRefs();
        });

        p.onKilled(function (attacker, damage) {
        });

        p.onDeath(function (attacker) {
            p.world.loot.handleDropItem(p, attacker);
        });

  	}
});
