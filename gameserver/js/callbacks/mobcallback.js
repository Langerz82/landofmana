var Messages = require("../message"),
    Formulas = require("../formulas"),
    ChestArea = require('../area/chestarea');

module.exports = MobCallback = Class.extend({

  init: function(){
  },

  setCallbacks: function (entity) {
    entity.onRespawn(function() {
        //this.setFreeze(2000);
        this.respawn();

        //this.map.entities.addMob(this);

        //if (this.area && this.area instanceof ChestArea)
            //mob.area.addToArea(this);
    });

    entity.onStep(function (x, y) {
  		 return;
  	});

		entity.onRequestPath(function(x, y) {
		    var ignored = [this];

		    if (this.target)
		    	ignored.push(this.target);

		    var path = this.map.entities.findPath(this, x, y, ignored);

        if (path && path.length == 1)
          console.error(this.id + " " + JSON.stringify(path));

				if (path && path.length > 1)
				{
            this.orientation = this.getOrientation([this.x,this.y], path[1]);
				    var msg = new Messages.MovePath(this, path);

				    this.map.entities.sendNeighbours(this, msg);
            return path;
				}
        return null;
		});

		entity.onStopPathing(function(x, y) {
		  //console.info("mob.onStopPathing");

      if (!this.hasTarget())
        this.setAiState(mobState.IDLE);

      if (this.aiState == mobState.CHASING)
        this.mobAI.checkReturn(this,x,y);
		});

    entity.onStartPathing(function () {
    });

    entity.onAbortPathing(function () {
      msg = new Messages.Move(this, this.orientation, 2, this.x, this.y);
      this.map.entities.sendNeighbours(this, msg);

      if (!this.target)
        this.setAiState(mobState.IDLE);
    });

    entity.onKilled(function (attacker, damage) {
      if (attacker instanceof Player) {
        attacker.skillHandler.setXPs();
        this.world.taskHandler.processEvent(attacker, PlayerEvent(EventType.DAMAGE, this, damage));
      }
    });

    entity.onDeath(function (attacker) {
      if (attacker instanceof Player) {
        this.world.taskHandler.processEvent(attacker, PlayerEvent(EventType.KILLMOB, this, 1));
      }
      this.world.loot.handleDropItem(this, attacker);
    })
  }
});
