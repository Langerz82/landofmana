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

    getAdjacentTiles: function (min, max) {
      min = min || 0;
      max = max || G_TILESIZE;
      var x = this.x, y = this.y;

      var posArray = [];
      for(var i=min; i <= max; ++i) {
        posArray.push([x,y-i],[x,y+i],[x-i,y],[x+i,y]);
      }
      return posArray;
    },

    getTilePositionNextTo: function (orientation, dist) {
      orientation = orientation || this.orientation;
      dist = (dist || 1) * G_TILESIZE;

      var pos = [this.x,this.y];
      switch (orientation)
      {
        case 1:
          pos[0] -= dist;
          break;
        case 2:
          pos[0] += dist;
          break;
        case 3:
          pos[1] -= dist;
          break;
        case 4:
          pos[1] += dist;
          break;
      }
      return pos;
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

    isOverlapping: function(entities) {
      for(var entity of entities) {
        if (!entity || this === entity)
          continue;
        if (this.isOverlappingEntity(entity))
        {
          return true;
        }
      }
      return false;
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

  getState: function () {
    return this._getBaseState();
  },

  setRandomOrientation: function() {
    this.orientation = Utils.randomRangeInt(1,4);
  },

  spawn: function () {
    return new Messages.Spawn(this);
  },

  despawn: function () {
    return new Messages.Despawn(this);
  },

/* SERVER FUNCTIONS - END */

  clean: function() {
  },

});

module.exports = Entity;
