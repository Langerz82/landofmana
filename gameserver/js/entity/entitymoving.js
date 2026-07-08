import Entity from "./entity.js";
import Messages from "../message.js";
import Timer from "../timer.js";
import Transition from "../transition.js";
import Utils from '../utils.js';
import { Types } from '../common.js';
import { G_TILESIZE } from '../main.js';

/* global log, game */

class EntityMoving extends Entity {
  constructor(id, type, kind, x, y, map) {
    super(id, type, kind, x, y, map);
    var self = this;

    // Speeds
    this.moveSpeed = 100;
    this.setMoveRate(this.moveSpeed);
    this.walkSpeed = 150;
    this.idleSpeed = Utils.randomRangeInt(750, 1000);

    this.step = 0;

    this.orientation = 2; // DOWN

    // Pathing
    this.movement = new Transition(this);
    this.moveCooldown = null;
    this.path = null;
    this.newDestination = null;
    this.interrupted = false;

    this.freeze = false;
  }

/*******************************************************************************
 * BEGIN - Movement Functions.
 ******************************************************************************/

  moveTo_(x, y, callback) {
    return this._moveTo(x, y, callback);
  }

  _moveTo(x, y, callback) {
    this.destination = {
      x: x,
      y: y
    };

    if (this.isMovingPath()) {
      this.continueTo(x, y);
    } else {
      var path = this.requestPathfindingTo(x, y);

      if (path)
        this.followPath(path);
    }
  }

  requestPathfindingTo(x, y) {
    //log.info(JSON.stringify(this.path));
    if (Array.isArray(this.path) && this.path.length > 0) {
      return this.path;
    } else if (this.request_path_callback) {
      return this.request_path_callback(x, y);
    } else {
      log.info(this.id + " couldn't request pathfinding to " + x + ", " + y);
      log.info("char x:" + this.x + ",y: " + this.y + ", x:" + x + "y: " + y);
      try {
        throw new Error()
      } catch (e) {
        log.info(e.stack);
      }
      return null;
    }
  }

  onRequestPath(callback) {
    this.request_path_callback = callback;
  }

  onStartPathing(callback) {
    this.start_pathing_callback = callback;
  }

  onStopPathing(callback) {
    this.stop_pathing_callback = callback;
  }

  onAbortPathing(callback) {
    this.abort_pathing_callback = callback;
  }

  followPath(path) {
    if (!path) return;
    this.path = path;
    this.step = 0;

    if (this.start_pathing_callback) {
      this.start_pathing_callback(path);
    }
  }

  continueTo(x, y) {
    this.newDestination = {x: x, y: y};
  }

  /**
   *
   */
  go(x, y) {
    this.moveTo_(x, y);
  }

  /**
   * Makes the character follow another one.
   */
   follow(entity, min, max) {
     min = min || 1;
     max = max || 1;

     var spot = this.getClosestSpot(entity, min, max);

     if (spot && spot.x && spot.y) {
       this.moveTo_(spot.x, spot.y);
       return true;
     }
     return false;
   }

   getLastMove() {
       if (!this.path)
         return null;
       var lastPath = this.path[this.path.length-1];
       return lastPath;
   }

/*******************************************************************************
 * END - Movement Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Grid Functions.
 ******************************************************************************/
 getSpotsAroundFrom(dest, adjStart, adjEnd) {
   adjStart = adjStart || 1;
   adjEnd = adjEnd || 1;

   var coords = [];
   var start = Math.min(adjStart, adjEnd);
   var end = Math.max(adjStart, adjEnd);
   for (var i=start; i <= end; ++i) {
     coords = coords.concat(this.getSpotsAround(dest, i));
   }
   return coords;
 }

 getSpotsAround(dest, adjDist) {
   adjDist = adjDist || 1;
   var d = adjDist * G_TILESIZE;
   var iterations = adjDist * 4;

   var pos = [dest.x, dest.y];
   var x2 = pos[0],
       y2 = pos[1];

   var sx = this.x,
       sy = this.y;

   var points = [];
   var sec = 2 * Math.PI / iterations;
   var x, y, deg = 0;
   for (var i = 0; i < iterations; ++i) {
     deg += sec;
     x = ~~(x2 + (Math.cos(deg)*d));
     y = ~~(y2 + (Math.sin(deg)*d));
     points.push([x,y]);
   }
   points = points.filter((v,i,a)=>a.findIndex(v2=>(v2[0]===v[0] && v2[1]===v[1]))===i);

   var coords = [];
   var p, tp, len = points.length;
   for (var i=0; i < len; ++i) {
     p = points[i];
     coords.push({d: Utils.realDistance([sx,sy],p),x: p[0], y: p[1]});
   }
   return coords;
 }

 getClosestSpot(dest, adjStart, adjEnd) {
   adjStart = adjStart || 1;
   adjEnd = adjEnd || 1;
   var poss = this.getSpotsAroundFrom(dest, adjStart, adjEnd);
   var sx = this.x, sy = this.y;

   for (var p of poss)
   {
     if (this.isColliding(p.x, p.y))
       poss.splice(poss.indexOf(p),1);
   }

   var entities = this.getEntitiesAround(adjEnd);

   //console.info("entities: "+JSON.stringify(entities));
   var ts = G_TILESIZE;
   var tsh = ts >> 1;

   var x, y, tx, ty;
   for (var p of poss) {
     x = p.x;
     y = p.y;
     for(var e2 of entities) {
       if (!e2 || this === e2)
         continue;
       tx = e2.x;
       ty = e2.y;

       if (typeof(e2.isMovingPath) === "function" && e2.isMovingPath()) {
         var tp = e2.getLastMove();
         if (tp) {
           tx = tp[0];
           ty = tp[1];
         }
       }
       if ( Math.abs(x-tx) <= tsh && Math.abs(y-ty) <= tsh)
       {
         //console.info("ENTITY ON TARGET SPOT!");
         poss.splice(poss.indexOf(p),1);
       }
     }
   }

   if (poss.length === 0)
     return null;

   poss.sort(function(a,b) { return a.d-b.d; });

   return {x: poss[0].x, y: poss[0].y};
 }

 isColliding(x, y) {
   if (typeof (game) === "undefined")
     return this.map.isColliding(x,y);
   else {
     return game.mapContainer.isColliding(x,y);
   }
 }

 getEntitiesAround(dist) {
   if (typeof (game) === "undefined")
     return this.map.entities.getCharactersAround(this, dist);
   else {
     return game.getEntitiesAround(this.x,this.y, dist * G_TILESIZE);
   }
 }

/*******************************************************************************
 * END - Grid Functions.
******************************************************************************/

/*******************************************************************************
 * BEGIN - Movement Functions.
 ******************************************************************************/

   idle(orientation) {
     this.setOrientation(orientation || this.orientation);
     if (typeof(this.animate) === "function")
       this.animate("idle", this.idleSpeed);
   }

   walk(orientation) {
     this.setOrientation(orientation || this.orientation);
     if (typeof(this.animate) === "function")
       this.animate("walk", this.walkSpeed);
   }

   forceStop() {
     this.stop();
   }

   _forceStop() {
     this.stop();
   }

   /**
   * Stops a moving character.
   */
   stop() {
       if (this.isMoving() && !this.isMovingPath()) {
           if (this.movestop_callback) this.movestop_callback();
       }

       this._stopPath();
       this.movement.stop();
       this.freeze = false;

       // Always force idle when stopping (unless pathing)
       if (typeof this.idle === "function") {
           this.idle(this.orientation);
       }
   }

   stopPath() {
     this._stopPath();
   }

   _stopPath() {
       if (!this.isMovingPath()) return;

       var lnode = this.getLastMove();
       this.interrupted = !(this.x === lnode[0] && this.y === lnode[1]);

       this.step = 0;
       var path = this.path;
       this.path = null;
       this.newDestination = null;

       this.movement.stop();

       if (this.interrupted && this.abort_pathing_callback) {
           this.abort_pathing_callback(path, this.x, this.y); // old path
       } else if(this.stop_pathing_callback) {
           this.stop_pathing_callback(this.x, this.y);
       }
   }

  onMoveStop(callback) {
    this.movestop_callback = callback;
  }

  onHasMoved(callback) {
    this.hasmoved_callback = callback;
  }

  hasMoved() {
    this.setDirty();
    if (this.hasmoved_callback) {
      this.hasmoved_callback(this);
    }
  }

  setMoveRate(rate) {
    this.moveSpeed = rate;
    this.walkSpeed = ~~(rate / 4);
    this.moveCooldown = new Timer(rate);
    this.tick = Math.round(1000 / this.moveSpeed);
  }

  // New function to make coding easier.
  getPathIndex(step) {
    if (!this.path === null || this.path.length === 0)
      return null;
    if (step < 0 || step >= this.path.length)
      return null;
    return (this.path[step]);
  }

  updateMovement() {
      var p = this.path,
          i = this.step;

      if (!p || i > (p.length-1))
        return;

      var orientation = this.getOrientation([this.x,this.y], p[i]);
      this.setOrientation(orientation);
      this.walk(this.orientation);
  }

  nextStepPath() {
    if (this.step === 0)
    {
      this.step++;
      this.updateMovement();
    }

    if (this.step < this.path.length)
    {
      if (this.x === this.path[this.step][0] &&
          this.y === this.path[this.step][1])
      {
        this.step++;
        this.updateMovement();
        return true;
      }
    }
    return false;
  }

  nextStep() {
      var stop = false, res = false,
          path, x, y;

      if (this.freeze)
        return false;

      if (!this.isMovingPath()) {
        this.interrupted = true;
        stop = true;
      }

      if (!stop)
      {
          res = this.nextStepPath();
          if (this.step >= this.path.length) {
            stop = true;
          }

          if(this.step_callback) {
              this.step_callback();
          }
      }

      if (this.hasChangedItsPath()) {
          this.setPosition(this.x, this.y);
          x = this.newDestination.x;
          y = this.newDestination.y;
          path = this.requestPathfindingTo(x, y);


          this.newDestination = null;
          this.followPath(path);
          return true;
      }

      if(stop) { // Path is complete or has been interrupted
        this.forceStop();
        res = true;
      }
      return res;
  }

  onBeforeMove(callback) {
    this.before_move_callback = callback;
  }

  onBeforeStep(callback) {
    this.before_step_callback = callback;
  }

  onStep(callback) {
    this.step_callback = callback;
  }

  isMoving() {
    return this.movement.inProgress;
  }

  isMovingPath() {
    return (this.path && this.path.length > 0);
  }

  hasNextStep() {
    return (this.path && this.path.length - 1 > this.step);
  }

  hasChangedItsPath() {
    return !(this.newDestination === null);
  }

  setPath(path) {
    this.path = path;
    this.step = 0;
    this.orientation = this.getOrientationTo(path[1]);
  }

  movePath(path) {
    this.forceStop();
    this.setPosition(path[0][0], path[0][1]);
    this.setPath(path);
    this.walk();
  }

  move(time, orientation, state, x, y) {

    this.setOrientation(orientation);
    if (state === 1 && orientation !== Types.Orientations.NONE)
    {
      this.forceStop();
      this.setPosition(x,y);
      this.walk(orientation);
    }
    else if (state === 0 || state === 2 || orientation === Types.Orientations.NONE)
    {
      this.forceStop();
      this.setPosition(x,y);
    }
  }

  canMove() {
    if (this.isDead === false && this.moveCooldown.isOver()) {
      return true;
    }
    return false;
  }

  getLastPosition() {
    if (this.path) {
      var lastMove = this.path[this.path.length-1];
      return lastMove;
    }
    return [this.x, this.y];
  }

/*******************************************************************************
 * END - Movement Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Grid Functions.
 ******************************************************************************/

  isNear(character, distance) {
    var dx = Math.abs(this.x - character.x);
    var dy = Math.abs(this.y - character.y);

    return (dx <= (distance*G_TILESIZE) && dy <= (distance*G_TILESIZE));
  }

  isNextToo(x,y) {
    var ts = G_TILESIZE;
    return (Math.abs(this.x-x) <= ts && Math.abs(this.y-y) <= ts);
  }

  nextDist(x, y, o, dist) {
    x = x || this.x;
    y = y || this.y;
    o = o || this.orientation;
    dist = dist || 1;

    switch (o)
    {
      case 1:
        return [x,y-dist];
      case 2:
        return [x,y+dist];
      case 3:
        return [x-dist,y];
      case 4:
        return [x+dist,y];
    }
    return [x,y];
  }

  nextMove(x, y, o, dist) {
    dist = dist || 1;
    return this.nextDist(x, y, o, 1);
  }

  nextTile(x, y, o, dist) {
    dist = dist || G_TILESIZE;
    return this.nextDist(x, y, o, G_TILESIZE);
  }

  // New function to make coding easier.
  /// TODO - Fix, probably broken with new path code.
  isWithinPath(coords) {
    var tCoords = null;
    if (typeof(coords) === "Object" && coords.x > 0 && coords.y > 0) {
      tCoords = [coords.x, coords.y];
    } else if (Array.isArray(coords) && coords.length === 2) {
      tCoords = [coords[0], coords[1]];
    }
    if (!tCoords) return null;

    if (this.path === null || this.path.length === 0)
      return null;

    var pathLen = this.path.length;
    for (var i = 0; i < pathLen; ++i) {
      if (this.path[i][0] === tCoords[0] && this.path[i][1] === tCoords[1])
        return {
          x: tCoords[0],
          y: tCoords[1],
          step: i
        };
    }

    return null;
  }

/*******************************************************************************
 * END - Grid Functions.
 ******************************************************************************/

 /*******************************************************************************
  * BEGIN - Orientation Functions.
  ******************************************************************************/

    getOrientation(p1, p2) {
        var x = Math.abs(p1[0]-p2[0]);
        var y = Math.abs(p1[1]-p2[1]);
        if(x > y) {
          if (p1[0] > p2[0])
            return 3; // W
          else
            return 4; // E
        } else if(y > x) {
          if (p1[1] > p2[1])
            return 1; // N
          else
            return 2; // S
        }
        return 0;
    }

   setOrientation(orientation) {
     if (orientation) {
       this.orientation = orientation || 0;
     }
   }

   getOrientationTo(arr) {
       return this.getOrientation([this.x,this.y],arr);
   }

   /**
    * Changes the character's orientation so that it is facing its target.
    */
    lookAt(x, y) {
        this.setOrientation(this.getOrientationTo([x, y]));
        this.idle(this.orientation);
        return this.orientation;
    }

   // Orientation Code.
   lookAtEntity(entity) {
     this._lookAtEntity(entity);
   }

   _lookAtEntity(entity) {
      if (entity) {
          var orientation = this.getOrientationTo([entity.x, entity.y]);
          this.setOrientation(orientation);
      }
      return this.orientation;
   }

   lookAtTile(x, y) {
     var tsh = G_TILESIZE >> 1;
     var pos = Utils.getGridPosition(x, y);
     pos = Utils.getPositionFromGrid(pos.gx, pos.gy);
     this.lookAt(pos.x+tsh,pos.y+tsh);
   }

   isInReach(x,y,o,r,rs) {
     var o = o || this.orientation;
     var ts = G_TILESIZE;
     var rs = rs || ts >> 1;
     var r = r || ts + rs;

     var a = rs, b = rs;
     switch (o) {
       case Types.Orientations.UP:
       case Types.Orientations.DOWN:
         b=r;
         break;
       case Types.Orientations.LEFT:
       case Types.Orientations.RIGHT:
         a=r;
         break;
       case Types.Orientations.NONE:
         return false;
     }
     //console.info("isInReach:");
     //console.info("dx:"+Math.abs(this.x-x));
     //console.info("dy:"+Math.abs(this.y-y));
     //console.info("xa:"+a);
     //console.info("yb:"+b);
     return (Math.abs(this.x-x) <= a && Math.abs(this.y-y) <= b);
   }


   isFacing(x, y) {
     return this.orientation === this.getOrientationTo([x, y]);
   }

   isFacingEntity(entity) {
       return this.isFacing(entity.x, entity.y);
   }

 /*******************************************************************************
  * END - Orientation Functions.
  ******************************************************************************/

 /*******************************************************************************
  * BEGIN - Misc Functions.
  ******************************************************************************/

 onRemove(callback) {
   this.remove_callback = callback;
 }

 setFreeze(ms, callback) {
   var self = this;
   if (ms <= 0)
   {
     self.freeze = false;
     return;
   }
   this.freeze = true;
   this.freeze_callback = setTimeout(function() {
     self.freeze = false;
     //this.freeze_callback = null;
     if (callback)
       callback(self);
   }, ms);
 }

/*******************************************************************************
 * END - Misc Functions.
 ******************************************************************************/

}

export default EntityMoving;
