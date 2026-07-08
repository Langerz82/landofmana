import Messages from '../message.js';
//import Utils from '../utils.js';
import { G_TILESIZE } from '../main.js';

/* global log */

class Entity {
    constructor(id, type, kind, x, y, map) {
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
    }

    setPosition(x, y) {
      //console.info("setPosition - x:"+x+",y:"+y);
      //try { throw new Error(); } catch (e) { console.info(e.stack); }
      this._setPosition(x,y);
    }

    _setPosition(x, y) {
      var ts = G_TILESIZE;

      this.x = x;
      this.y = y;

      var gx = ~~(x / ts);
      var gy = ~~(y / ts);

      this.gx = gx;
      this.gy = gy;

      this.map.entities.removeSpatial(this);
      this.map.entities.addSpatial(this);
    }

/*
    setPositionGrid(x, y) {
        var ts = G_TILESIZE;

        this.x = x;
        this.y = y;

        var gx = ~~(x / ts);
        var gy = ~~(y / ts);

        this.gx = gx;
        this.gy = gy;
    },
*/

    setPositionSpawn(x, y) {
      log.info("setPositionSpawn - x:"+x+"y:"+y);

      this.setPosition(x, y);

      this.spawnGx = this.gx;
      this.spawnGy = this.gy;
    }

    ready(f) {
        this.ready_func = f;
    }

    onRemove(callback) {
      this.remove_callback = callback;
    }

    /**
     *
     */
    getDistanceToEntity(entity) {
        var distX = Math.abs(entity.x - this.x),
            distY = Math.abs(entity.y - this.y);

        return (distX > distY) ? distX : distY;
    }

    /**
     * Returns true if the entity is adjacent to the given one.
     * @returns {Boolean} Whether these two entities are adjacent.
     */
    isAdjacent(entity) {
        var adjacent = false;

        if(entity) {
        		adjacent = this.getDistanceToEntity(entity) > 1 ? false : true;
        }

        return adjacent;
    }

    /**
     *
     */
    isAdjacentNonDiagonal(entity) {
        var result = false;

        if(this.isAdjacent(entity) && !(this.x !== entity.x && this.y !== entity.y)) {
            result = true;
        }

        return result;
    }

    isDiagonallyAdjacent(entity) {
        return this.isAdjacent(entity) && !this.isAdjacentNonDiagonal(entity);
    }

    forEachAdjacentNonDiagonalPosition(callback, dist) {
        dist = dist || 1;
        callback(this.x - dist, this.y, 3);
        callback(this.x, this.y - dist, 1);
        callback(this.x + dist, this.y, 4);
        callback(this.x, this.y + dist, 2);
    }

    getAdjacentTiles(min, max) {
      min = min || 0;
      max = max || G_TILESIZE;
      var x = this.x, y = this.y;

      var posArray = [];
      for(var i=min; i <= max; ++i) {
        posArray.push([x,y-i],[x,y+i],[x-i,y],[x+i,y]);
      }
      return posArray;
    }

    getTilePositionNextTo(orientation, dist) {
      orientation = orientation || this.orientation;
      dist = (dist || 1) * G_TILESIZE;

      var pos = [this.x,this.y];
      switch (orientation)
      {
        case 3:
          pos[0] -= dist;
          break;
        case 4:
          pos[0] += dist;
          break;
        case 1:
          pos[1] -= dist;
          break;
        case 2:
          pos[1] += dist;
          break;
      }
      return pos;
    }

    isWithinDist(x,y,dist) {
      dist = dist || G_TILESIZE;
      var dx = Math.abs(this.x-x);
      var dy = Math.abs(this.y-y);
      return (dx <= dist && dy <= dist);
    }

    isWithinDistEntity(entity, dist) {
        return this.isWithinDist(entity.x, entity.y, dist);
    }

    isNextTooEntity(entity) {
        return this.isWithinDist(entity.x, entity.y, G_TILESIZE);
    }

    isNextTooPosition(x, y) {
        return this.isWithinDist(x, y, G_TILESIZE);
    }

    isOverEntity(entity) {
        return this.isWithinDist(entity.x, entity.y, (G_TILESIZE >> 1));
    }

    isOverPosition(x, y) {
        return this.isWithinDist(x, y, (G_TILESIZE >> 1));
    }

    isOverlappingEntity(entity) {
      return this.isWithinDist(entity.x,entity.y, G_TILESIZE-1);
    }

    isOverlapping(entities) {
      for(var entity of entities) {
        if (!entity || this === entity)
          continue;
        if (this.isOverlappingEntity(entity))
        {
          return true;
        }
      }
      return false;
    }

/* SERVER FUNCTIONS - START */

  _getBaseState() {
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
  }

  getState() {
    return this._getBaseState();
  }

  setRandomOrientation() {
    this.orientation = Utils.randomRangeInt(1,4);
  }

  spawn() {
    return new Messages.Spawn(this);
  }

  despawn() {
    return new Messages.Despawn(this);
  }

/* SERVER FUNCTIONS - END */

  clean() {
  }

}

export default Entity;
