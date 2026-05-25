
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
          if (self.entities.pathfinder.isPathTicksTooFast(p.tick, p.getSubPath(x, y), p.startMovePathTime)) {
            console.error("path - isPathTicksTooFast = true.");
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
              return false;
            }

            var x = c.x, y = c.y;

            if (o === 3 && c.x < c.ex)
            {
              res = true;
            }
            else if (o === 4 && c.x > c.ex)
            {
              res = true;
            }
            else if (o === 1 && c.y < c.ey)
            {
              res = true;
            }
            else if (o === 2 && c.y > c.ey)
            {
              res = true;
            }
            if (res) {
              c.setPosition(c.ex, c.ey);
              console.warn("WARN - PLAYER "+c.id+" not stopping.");
              console.warn("orientation: "+Utils.getOrientationString(o));
              console.warn("x :"+x+",y :"+y);
              console.warn("sx:"+c.ex+",sy:"+c.ey);
            }
            return res;
        };

        p.checkPathInterrupt = function (x,y) {
          var p = this;
          if (!p.isMovingPath())
            return false;

          var pathfinder = p.map.entities.pathfinder;

          if (!pathfinder.getPathSubDistance(p.path, x, y))
            return false;

          return pathfinder.isPathTicksTooFast(p.tick, p.getSubPath(x,y), p.startMovePathTime);
        };

        p.checkStartMove = function (x,y) {
            var p = this;

            if (p.mapStatus < 2)
              return false;

            if (p.map.isColliding(x, y)) {
              console.warn("char.isColliding("+p.id+","+x+","+y+")");
              return false;
            }

            if (p.checkPathInterrupt(x,y)) {
              return false;
            }

            if (!(p.x === x && p.y === y))
            {
              p.fixMove(x,y);
              return true;
            }
        }

        p.correctMove = function (x, y) {
            var p = this;
            if (!(p.ex === -1 && p.ey === -1) && !(p.x === x && p.y === y))
            {
              console.warn("ERROR - MOVING NOT SYNCHED PROPERLY, FORCING CLIENT UPDATE");
              console.info("player, orientation:"+p.moveOrientation);
              console.info("player, x:"+p.x+",y:"+p.y);
              console.info("player, sx:"+p.sx+",sy:"+p.sy);
              console.info("player, ex:"+p.ex+",ey:"+p.ey);

              p.resetMove(p.sx,p.sy);
            }
        };

        p.setMoveStopCallback(function () {
            var p = this;
            console.info("setMoveStopCallback");
            console.info("player, x:"+p.x+",y:"+p.y);
            //console.info("player, ex:"+p.x+",ey:"+p.y);
            //console.info("player, cx:"+p.sx+",cy:"+p.sy);

            if (p.checkStopDanger(p, p.moveOrientation))
              p.correctMove(p.ex,p.ey);

            p.endMoveTime = Date.now();
            //console.info("p.x:"+p.x+",p.y="+p.y);
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
