
module.exports = PlayerCallback = Class.extend({

  	init: function() {
  	},

	 setCallbacks: function (entity) {
    		var self = this;
        var p = entity;
        this.player = entity;
        this.entities = p.map.entities;

    		//console.info("assigning callbacks to "+self.player.id);

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

            // TODO - Maybe just remove.
            if (self.entities.pathfinder.isPathTicksTooFast(p, p.fullpath, p.startMovePathTime)) {
              console.error("path - isPathTicksTooFast = true.");
              p.resetMove(p.sx,p.sy);
              return;
            }
            //p.setPosition(p.sx,p.sy);
            //else
            p.setPosition(x,y);

            p.sx = p.x;
            p.sy = p.y;
            //p.forceStop();
            console.info("p.x:"+p.x+",p.y="+p.y);
            attackFunc(p);
        };

        p.onStopPathing(function (x, y) {
            console.info("onStopPathing");
            stopPathing(this,x,y);
        });

        p.onAbortPathing(function (x, y) {
            console.info("onAbortPathing");
            stopPathing(this,x,y);
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
              //console.warn("checkStopDanger - coordinates equal");
              return true;
            }

            var x = c.x, y = c.y;

            if (o === Types.Orientations.LEFT && c.x < c.ex)
            {
              res = true;
            }
            else if (o === Types.Orientations.RIGHT && c.x > c.ex)
            {
              res = true;
            }
            else if (o === Types.Orientations.UP && c.y < c.ey)
            {
              res = true;
            }
            else if (o === Types.Orientations.DOWN && c.y > c.ey)
            {
              res = true;
            }
            if (res) {
              c.setPosition(c.ex, c.ey);
              console.warn("WARN - PLAYER "+c.id+" not stopping.");
              console.warn("orientation: "+Utils.getOrientationString(o));
              console.warn("x :"+x+",y :"+y);
              console.warn("sx:"+c.ex+",sy:"+c.ey);
              //c.checkStopDanger = false;
            }
            return res;
        };

        p.checkStartMove = function (x,y) {
            var p = this;

            var fnNotCorrectPos = function(x,y) {
              var dx = Math.abs(p.x-x), dy = Math.abs(p.y-y);
              var tx = Math.trunc(p.x) - Math.trunc(x) === 0;
              var ty = Math.trunc(p.y) - Math.trunc(y) === 0;
              if ((tx && dy !== 0) || (ty && dx !== 0))
              {
                var path = [[p.x,p.y],[x,y]];
                //if(p.map.entities.pathfinder.isValidPath(p.map.grid, path)) {
                if (!p.endMoveTime || !p.map.entities.pathfinder.isPathTicksTooFast(p, path, p.endMoveTime))
                {
                  console.error("FIXED MOVE");
                  p.fixMove(x,y);
                  return true;
                }
                //}
              }

              console.error("PLAYER NOT IN CORRECT POSITION");
              console.info("p.x:"+p.x+",p.y:"+p.y);
              console.info("c.x:"+x+",c.y:"+y);
              console.error("dx:"+dx+",dy:"+dy);
              p.resetMove(p.x,p.y);
              return false;
            };

            if (!(p.x === x && p.y === y))
            {
              return fnNotCorrectPos(x,y);
            }
            return true;
        }

        p.correctMove = function (x, y) {
            var p = this;
            if (!(p.ex === -1 && p.ey === -1) && !(p.x === x && p.y === y))
            {
              //try { throw new Error(); } catch(err) { console.info(err.stack); }
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
            //p.moveOrientation = 0;
            console.info("setMoveStopCallback");
            console.info("player, x:"+p.x+",y:"+p.y);
            //console.info("player, ex:"+p.x+",ey:"+p.y);
            //console.info("player, cx:"+p.sx+",cy:"+p.sy);

            p.checkStopDanger(p, p.moveOrientation);

            p.correctMove(p.ex,p.ey);
            p.endMoveTime = Date.now();
            //p.sendCurrentMove();
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
