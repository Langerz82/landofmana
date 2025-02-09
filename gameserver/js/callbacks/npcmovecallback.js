
module.exports = NpcMoveCallback = Class.extend({

	init: function() {
	},

	setCallbacks: function (entity) {
		var self = entity;
		//console.info("assigning callbacks to "+self.entity.id);

		entity.onStep(function (entity, x, y) {
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

    entity.onRequestPath(function (x,y) {
      //console.info("onRequestPath = " + x + "," + y);
      var path = self.entity.map.entities.findPath(self.entity, x, y);
      //console.info("path="+JSON.stringify(path));
      if (path && path.length > 0)
      {
        var msg = new Messages.MovePath(self.entity, path);
        self.entity.map.entities.sendNeighbours(self.entity, msg);
        return path;
      }
      //self.entity.forceStop();
      return null;
    });
	},
});
