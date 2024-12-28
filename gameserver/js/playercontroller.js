var Messages = require("./message"),
    _ = require("underscore"),
    Utils = require("./utils");

module.exports = PlayerController = Class.extend({

	init: function(entity) {
		this.player = entity;
    this.entities = this.player.map.entities;
		this.setCallbacks();
	},


	setCallbacks: function () {
		var self = this;
		//console.info("assigning callbacks to "+self.player.id);

		self.player.onStep(function (player, x, y) {
		  //self.player.map.entities.entitygrid[self.player.y][self.player.x] = 0;
		  //self.player.map.entities.entitygrid[y][x] = 1;
		});

    self.player.onRequestPath(function (x,y) {
      var p = self.player;
      //p.stx = p.x;
      //p.sty = p.y;

      return self.entities.findPath(p, x, y);
    });

    var checkContinueMove = function (x,y) {
      //var o = self.player.orientation;
      //self.player.continueMove(o);
    };

    var attackFunc = function (p) {
      //if ((p.sx == -1 && p.sy == -1) || (p.x == p.sx && p.y == p.sy))
      //if (p.x == p.sx && p.y == p.sy)
        p.packetHandler.processAttack();
    };


    var stopPathing = function (x, y) {
      console.info("onStopPathing");
      var p = self.player;

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

    self.player.onStopPathing(function (x, y) {
      console.info("onStopPathing");
      stopPathing(x,y);
    });

    self.player.onAbortPathing(function (x, y) {
      console.info("onAbortPathing");
      stopPathing(x,y);
    });

    self.player.checkStopDanger = function (c, o)
    {
      var res=false;

      if (c.ex == -1 && c.ey == -1)
      {
        return false;
      }
      if (c.x == c.ex && c.y == c.ey)
      {
        //console.warn("checkStopDanger - coordinates equal");
        return true;
      }

      var x = c.x, y = c.y;

      if (o == Types.Orientations.LEFT && c.x < c.ex)
      {
        res = true;
      }
      else if (o == Types.Orientations.RIGHT && c.x > c.ex)
      {
        res = true;
      }
      else if (o == Types.Orientations.UP && c.y < c.ey)
      {
        res = true;
      }
      else if (o == Types.Orientations.DOWN && c.y > c.ey)
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

    self.player.checkStartMove = function (x,y) {
      var p = self.player;
      if (!(p.x == x && p.y == y))
      {
        var dx = Math.abs(p.x-x), dy = Math.abs(p.y-y);
        //if ((dx+dy) < 32)
          //return true;
        console.error("PLAYER NOT IN CORRECT POSITION");
        console.info("p.x:"+p.x+",p.y:"+p.y);
        console.info("c.x:"+x+",c.y:"+y);
        console.error("dx:"+dx+",dy:"+dy);
        p.resetMove(p.x,p.y);
        return false;
      }
      return true;
    }

    self.player.correctMove = function (x, y) {
      var p = self.player;
      if (!(p.ex == -1 && p.ey == -1) && !(p.x == x && p.y == y))
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

    self.player.setMoveStopCallback(function () {
      var p = self.player;
      //p.moveOrientation = 0;
      console.info("setMoveStopCallback");
      console.info("player, x:"+p.x+",y:"+p.y);
      //console.info("player, ex:"+p.x+",ey:"+p.y);
      //console.info("player, cx:"+p.sx+",cy:"+p.sy);

      p.checkStopDanger(p, p.moveOrientation);

      p.correctMove(p.ex,p.ey);
      //p.sendCurrentMove();
      //console.info("p.x:"+p.x+",p.y="+p.y);
      attackFunc(p);
    });

	}
});
