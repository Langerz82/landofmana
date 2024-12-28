var Messages = require("./message"),
    _ = require("underscore"),
    Utils = require("./utils");

module.exports = NpcMoveController = Class.extend({

	init: function(entity) {
		this.entity = entity;
		this.setCallbacks();
	},

	setCallbacks: function () {
		var self = this;
		//console.info("assigning callbacks to "+self.entity.id);

		self.entity.onStep(function (entity, x, y) {
      //console.info("onStep = " + x + "," + y);
      try {
		    entity.map.entities.entitygrid[entity.y][entity.x] = 0;
		    entity.map.entities.entitygrid[y][x] = 1;
      }
      catch (e)
      {
        console.info(e.stack);
        console.info(entity.x + "," + entity.y + "," + x + "," + y);
        console.info(entity.id);
        console.info(entity.path);
        console.info(entity.step);

      }
		});

    self.entity.onRequestPath(function (x,y) {
      //console.info("onRequestPath = " + x + "," + y);
      var path = self.entity.map.entities.findPath(self.entity, x, y);
      //console.info("path="+JSON.stringify(path));
      if (path && path.length > 0)
      {
        var msg = new Messages.MovePath(self.entity, path);
        self.entity.map.entities.pushNeighbours(self.entity, msg);
        return path;
      }
      //self.entity.forceStop();
      return null;
    });

	},

  randomMove: function() {
    var self = this;
    var entity = this.entity;

    if(entity && !entity.hasTarget() && !entity.isDead && !entity.isMoving()) {
      var canRoam = (Utils.randomRangeInt(0,100) === 1);
      if(!canRoam || entity.map.entities.getPlayerAroundCount(entity,20) == 0)
        return;
      var	pos = entity.map.entities.getRandomPosition(entity, 2);
      if (pos && !(pos.x == entity.x && pos.y == entity.y))
      {
          //if (entity.map.entities.isCharacterAt(pos.x,pos.y))
          //   return;
          entity.go(pos.x, pos.y);
          //entity.nextStep();
      }
    }
  },

	checkMove: function(time) {
		var npc = this.entity;

		if (npc.isDead)
			return;

    if (!npc.freeze && npc.isMoving() && npc.canMove())
		{
			npc.nextStep();
		}
	}
});
