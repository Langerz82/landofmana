var Messages = require("./message"),
    _ = require("underscore"),
    Utils = require("./utils"),
    Formulas = require("./formulas"),
    ChestArea = require('./area/chestarea');

module.exports = MobCallback = Class.extend({

  init: function(ws, map){
      this.world = ws;
      this.map = map;
  },

  setCallbacks: function (entity) {
    var self = this;

    entity.onRespawn(function() {
        entity.setFreeze(2000);
        entity.isDead = false;
        entity.droppedItem = false;
        self.addMob(mob);

        if (entity.area && entity.area instanceof ChestArea)
            mob.area.addToArea(entity);
    });

    entity.onStep(function (x, y) {
  		  if (!entity)
  		  	  return;

  	});

		entity.onRequestPath(function(x, y) {
		    var ignored = [entity];

		    if (entity.target)
		    	ignored.push(entity.target);

		    var path = self.map.entities.findPath(entity, x, y, ignored);

        if (path && path.length == 1)
          console.error(entity.id + " " + JSON.stringify(path));

				if (path && path.length > 1)
				{
            entity.orientation = entity.getOrientation([this.x,this.y], path[1]);
				    var msg = new Messages.MovePath(entity, path);

				    self.map.entities.pushNeighbours(entity, msg);
            return path;
				}
        return null;
		});

		entity.onStopPathing(function(x, y) {
		  //console.info("mob.onStopPathing");

      if (!entity.hasTarget())
        entity.setAiState(mobState.IDLE);

      if (entity.aiState == mobState.CHASING)
        entity.mobAI.checkReturn(entity,x,y);
		});

    entity.onStartPathing(function () {
    });

    entity.onAbortPathing(function () {
      msg = new Messages.Move(entity, entity.orientation, 2, entity.x, entity.y);
      self.map.entities.pushNeighbours(entity, msg);

      if (!entity.target)
        entity.setAiState(mobState.IDLE);
    });

    entity.onKilled(function (attacker, damage) {
      if (attacker instanceof Player) {
        self.world.taskHandler.processEvent(attacker, PlayerEvent(EventType.DAMAGE, entity, damage));
      }
    });
  }
});
