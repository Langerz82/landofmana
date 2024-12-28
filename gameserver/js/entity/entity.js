var Messages = require('../message');

module.exports = Entity = cls.Class.extend({
        init: function(id, type, kind, x, y, map) {
            var self = this;

			      this.type = type;
            this.id = id;
            this.kind = kind;
            this.map = map;
            this.mapIndex = map.index;

            this.shadowOffsetY = 0;

            // Position
            //this.setPosition(0, 0);

            // Modes
            this.isLoaded = false;
            this.isHighlighted = false;
            this.visible = true;
            this.isFading = false;

            this.prevX=0;
            this.prevY=0;
            this.prevOrientation=null;
            this.name = "";
            this.nameOffsetY = -10;

            this.isCritical = false;
            this.isHeal = false;

            this.shadowOffsetY = 0;

            // Position
            this.setPosition(Number(x), Number(y));
            //this.x = ;
            //this.y = Number(y);

            this.orientation = Utils.randomOrientation();
        },

        setName: function(name) {
            this.name = name;
        },

        setPosition: function(x, y) {
            var ts = G_TILESIZE;

            this.x = x;
            this.y = y;

            var gx = (x >> 4);
            var gy = (y >> 4);

            if (typeof this.gx === "undefined") this.gx = gx;
            if (typeof this.gy === "undefined") this.gy = gy;

            if (x % ts == 0) this.gx = gx;
            if (y % ts == 0) this.gy = gy;

            //if (this.map.entities.spatial)
              //return;

            var spx = ~~(gx / G_SPATIAL_SIZE);
            var spy = ~~(gy / G_SPATIAL_SIZE);

            if (!this.hasOwnProperty("sx"))
              this.spx = spx;
            if (!this.hasOwnProperty("sy"))
              this.spy = spy;
            if (!this.hasOwnProperty("spatialMap"))
              this.spatialMap = this.map;

// TODO - FIx.
            //console.info("this.spx:"+this.spx+",this.spy:"+this.spy);
            //console.info("spx:"+spx+",spy:"+spy);
            var sameMap = (this.spatialMap == this.map);
            if (!sameMap) {
              var spatial = this.spatialMap.entities.spatial[this.spy][this.spx];
              Utils.removeFromArray(spatial, this);
            }
            else {
              if (this.spx != spx || this.spy != spy)
              {
                var spatial = this.map.entities.spatial[this.spy][this.spx];
                Utils.removeFromArray(spatial, this);
              }
              else {
                var spatial = this.map.entities.spatial[spy][spx];
                if (!spatial.includes(this))
                  spatial.push(this);
                /*var index = spatial.indexOf(this);
                if (index == -1) {
                  spatial.push(this);
                }*/
              }
            }
            this.spx = spx;
            this.spy = spy;

            this.spatialMap = this.map;
        },

        ready: function(f) {
            this.ready_func = f;
        },

        clean: function() {
        },

        log_info: function(message) {
            console.info("["+this.id+"] " + message);
        },

        log_error: function(message) {
            console.error("["+this.id+"] " + message);
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
            callback(this.x - 1, this.y, Types.Orientations.LEFT);
            callback(this.x, this.y - 1, Types.Orientations.UP);
            callback(this.x + 1, this.y, Types.Orientations.RIGHT);
            callback(this.x, this.y + 1, Types.Orientations.DOWN);

        },

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
			var pos = null;
			if (entity) {
				pos = {};
				// This is a quick & dirty way to give mobs a random position
				// close to another entity.
				var r = Utils.random(4);

				pos.x = entity.x;
				pos.y = entity.y;
				if (r === 0) {
					pos.y -= 16;
				}
				if (r === 1) {
					pos.y += 16;
				}
				if (r === 2) {
					pos.x -= 16;
				}
				if (r === 3) {
					pos.x += 16;
				}
			}
			return pos;
	    },

	    setRandomOrientation: function() {
			r = Utils.random(4);

			if(r === 0)
				this.orientation = Types.Orientations.LEFT;
			if(r === 1)
				this.orientation = Types.Orientations.RIGHT;
			if(r === 2)
				this.orientation = Types.Orientations.UP;
			if(r === 3)
				this.orientation = Types.Orientations.DOWN;
	    },

      isWithinDist: function (x,y,dist) {
        dist = dist || G_TILESIZE;
        var dx = Math.abs(this.x-x);
        var dy = Math.abs(this.y-y);
        return (dx <= dist && dy <= dist);
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

      getSpriteName: function (spriteNum) {
        return AppearanceData.getSpriteByID(spriteNum);
      },

      destroy: function () {
      },
});

module.exports = Entity;
