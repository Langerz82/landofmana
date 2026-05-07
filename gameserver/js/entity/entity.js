var Messages = require('../message');

module.exports = Entity = cls.Class.extend({
      init: function(id, type, kind, x, y, map) {
          var self = this;

          this.type = type;
          this.id = id;
          this.kind = kind;
          this.map = map;
          this.mapIndex = map.index;

          // Position
          //this.setPosition(0, 0);

          // Modes
          this.isLoaded = false;
          this.visible = true;
          this.isFading = false;

          this.name = "";

          this.isCritical = false;
          this.isHeal = false;

          this.shadowOffsetY = 0;

          // Position
          this.setPosition(Number(x), Number(y));
          //this.x = ;
          //this.y = Number(y);

          this.orientation = Utils.randomOrientation();
      },

      setPosition: function (x, y) {
        this._setPosition(x,y);
      },

      _setPosition: function(x, y) {
        var ts = G_TILESIZE;

        this.x = x;
        this.y = y;

        var gx = ~~(x / ts);
        var gy = ~~(y / ts);

        this.gx = gx;
        this.gy = gy;

        var spx = ~~(gx / G_SPATIAL_SIZE);
        var spy = ~~(gy / G_SPATIAL_SIZE);

        if (!this.hasOwnProperty("spx"))
          this.spx = spx;
        if (!this.hasOwnProperty("spy"))
          this.spy = spy;
        if (!this.hasOwnProperty("spatialMap"))
          this.spatialMap = this.map;

// TODO - FIx.
        //console.info("this.spx:"+this.spx+",this.spy:"+this.spy);
        //console.info("spx:"+spx+",spy:"+spy);
        var sameMap = (this.spatialMap === this.map);
        if (!sameMap) {
          var spatial = this.spatialMap.entities.spatial[this.spy][this.spx];
          Utils.removeFromArray(spatial, this);
        }
        else {
          if (this.spx !== spx || this.spy !== spy)
          {
            var spatial = this.map.entities.spatial[this.spy][this.spx];
            Utils.removeFromArray(spatial, this);
          }
          else {
            var spatial = this.map.entities.spatial[spy][spx];
            if (!spatial.includes(this))
              spatial.push(this);
          }
        }
        this.spx = spx;
        this.spy = spy;

        this.spatialMap = this.map;
      },

/*
      setPositionGrid: function(x, y) {
          var ts = G_TILESIZE;

          this.x = x;
          this.y = y;

          var gx = ~~(x / ts);
          var gy = ~~(y / ts);

          this.gx = gx;
          this.gy = gy;
      },
*/

      setPositionSpawn: function(x, y) {
        log.info("setPositionSpawn - x:"+x+"y:"+y);

        this.setPosition(x, y);

        this.spawnGx = this.gx;
        this.spawnGy = this.gy;
      },

      ready: function(f) {
          this.ready_func = f;
      },

      onRemove: function(callback) {
        this.remove_callback = callback;
      },

      /**
       *
       */
      getDistanceToEntity: function(entity) {
          var distX = Math.abs(entity.x - this.x),
              distY = Math.abs(entity.y - this.y);

          return (distX > distY) ? distX : distY;
      },

      /**
       * Returns true if the entity is adjacent to the given one.
       * @returns {Boolean} Whether these two entities are adjacent.
       */
      isAdjacent: function(entity) {
          var adjacent = false;

          if(entity) {
          		adjacent = this.getDistanceToEntity(entity) > 1 ? false : true;
          }

          return adjacent;
      },

      /**
       *
       */
      isAdjacentNonDiagonal: function(entity) {
          var result = false;

          if(this.isAdjacent(entity) && !(this.x !== entity.x && this.y !== entity.y)) {
              result = true;
          }

          return result;
      },

      isDiagonallyAdjacent: function(entity) {
          return this.isAdjacent(entity) && !this.isAdjacentNonDiagonal(entity);
      },

      forEachAdjacentNonDiagonalPosition: function(callback) {
          callback(this.x - 1, this.y, 3);
          callback(this.x, this.y - 1, 1);
          callback(this.x + 1, this.y, 4);
          callback(this.x, this.y + 1, 2);
      },

      isWithinDist: function (x,y,dist) {
        dist = dist || G_TILESIZE;
        var dx = Math.abs(this.x-x);
        var dy = Math.abs(this.y-y);
        return (dx <= dist && dy <= dist);
      },

      isWithinDistEntity: function (entity, dist) {
          return this.isWithinDist(entity.x, entity.y, dist);
      },

      isNextTooEntity: function (entity) {
          return this.isWithinDist(entity.x, entity.y, G_TILESIZE);
      },

      isNextTooPosition: function (x, y) {
          return this.isWithinDist(x, y, G_TILESIZE);
      },

      isOverEntity: function (entity) {
          return this.isWithinDist(entity.x, entity.y, (G_TILESIZE >> 1));
      },

      isOverPosition: function (x, y) {
          return this.isWithinDist(x, y, (G_TILESIZE >> 1));
      },

      isOverlappingEntity: function (entity) {
        return this.isWithinDist(entity.x,entity.y, G_TILESIZE-1);
      },

/* SERVER FUNCTIONS - START */

	    _getBaseState: function () {
  			return [
  				parseInt(this.id, 10),
          parseInt(this.type),
  				parseInt(this.kind),
          this.name,
          parseInt(this.map.index),
  				parseInt(this.x),
  				parseInt(this.y),
          parseInt(this.orientation || 0)
  			];
	    },

	    getMapIndex: function ()
	    {
	    	return this.map.index;
	    },

      getState: function () {
        return this._getBaseState();
      },

      spawn: function () {
        return new Messages.Spawn(this);
      },

      despawn: function () {
        //var blood2 = (blood === null) ? 1 : blood;
        //try { throw new Error(); } catch (e) { console.info(e.stack); }
        return new Messages.Despawn(this);
      },

      getPositionNextTo: function (entity) {
        var ts = G_TILESIZE;
        var pos = null;
        if (entity) {
          pos = {};
          // This is a quick & dirty way to give mobs a random position
          // close to another entity.
          var r = Utils.random(4);

          pos.x = entity.x;
          pos.y = entity.y;
          if (r === 0) {
            pos.y -= ts;
          }
          if (r === 1) {
            pos.y += ts;
          }
          if (r === 2) {
            pos.x -= ts;
          }
          if (r === 3) {
            pos.x += ts;
          }
        }
        return pos;
      },

      setRandomOrientation: function() {
        r = Utils.random(4);

        if(r === 0)
          this.orientation = 1; // N
        if(r === 1)
          this.orientation = 2; // S
        if(r === 2)
          this.orientation = 3; // E
        if(r === 3)
          this.orientation = 4; // W
      },
/* SERVER FUNCTIONS - END */
});

module.exports = Entity;
