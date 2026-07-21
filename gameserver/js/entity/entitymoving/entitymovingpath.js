// Extracted from entitymoving.js: the two "Movement Functions" sections
// (path-following, start/stop, per-tick step advancement). Installed
// directly onto EntityMoving.prototype (not composed as a sub-object) so
// every existing call site (`entity.moveTo_(...)`, `entity.stop()`, etc.,
// throughout character.js/mob.js/player.js/mobai.js/updater.js) keeps
// working unchanged -- Character (and everything that extends it) inherits
// this exactly as if it were still written directly in the class body.
// NOTE: file renamed from entitymovingmovement.js to entitymovingpath.js
// (and installEntityMovingMovement -> installEntityMovingPath) to match
// the client's naming for this same split (client's entitymovingpath.js).
import Timer from '../../timer.js';
import { Types } from '../../common.js';

/* global log, game */

export function installEntityMovingPath(proto) {

/*******************************************************************************
 * BEGIN - Movement Functions.
 ******************************************************************************/

  proto.moveTo_ = function(x, y, callback) {
    return this._moveTo(x, y, callback);
  }

  proto._moveTo = function(x, y, callback) {
    this.destination = {
      x: x,
      y: y
    };

    if (this.isMovingPath()) {
      this.continueTo(x, y);
    } else {
      const path = this.requestPathfindingTo(x, y);

      if (path)
        this.followPath(path);
    }
  }

  proto.requestPathfindingTo = function(x, y) {
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

  proto.onRequestPath = function(callback) {
    this.request_path_callback = callback;
  }

  proto.onStartPathing = function(callback) {
    this.start_pathing_callback = callback;
  }

  proto.onStopPathing = function(callback) {
    this.stop_pathing_callback = callback;
  }

  proto.onAbortPathing = function(callback) {
    this.abort_pathing_callback = callback;
  }

  proto.followPath = function(path) {
    if (!path) return;
    this.path = path;
    this.step = 0;

    if (this.start_pathing_callback) {
      this.start_pathing_callback(path);
    }
  }

  proto.continueTo = function(x, y) {
    this.newDestination = {x: x, y: y};
  }

  /**
   *
   */
  proto.go = function(x, y) {
    this.moveTo_(x, y);
  }

  /**
   * Makes the character follow another one.
   */
   proto.follow = function(entity, min, max) {
     min = min || 1;
     max = max || 1;

     const spot = this.getClosestSpot(entity, min, max);

     if (spot && spot.x && spot.y) {
       this.moveTo_(spot.x, spot.y);
       return true;
     }
     return false;
   }

   proto.getLastMove = function() {
       if (!this.path)
         return null;
       const lastPath = this.path[this.path.length-1];
       return lastPath;
   }

/*******************************************************************************
 * END - Movement Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Movement Functions.
 ******************************************************************************/

   proto.idle = function(orientation) {
     this.setOrientation(orientation || this.orientation);
     if (typeof(this.animate) === "function")
       this.animate("idle", this.idleSpeed);
   }

   proto.walk = function(orientation) {
     this.setOrientation(orientation || this.orientation);
     if (typeof(this.animate) === "function")
       this.animate("walk", this.walkSpeed);
   }

   proto.forceStop = function() {
     this.stop();
   }

   proto._forceStop = function() {
     this.stop();
   }

   /**
   * Stops a moving character.
   */
   proto.stop = function() {
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

   proto.stopPath = function() {
     this._stopPath();
   }

   proto._stopPath = function() {
       if (!this.isMovingPath()) return;

       const lnode = this.getLastMove();
       this.interrupted = !(this.x === lnode[0] && this.y === lnode[1]);

       this.step = 0;
       const path = this.path;
       this.path = null;
       this.newDestination = null;

       this.movement.stop();

       if (this.interrupted && this.abort_pathing_callback) {
           this.abort_pathing_callback(path, this.x, this.y); // old path
       } else if(this.stop_pathing_callback) {
           this.stop_pathing_callback(this.x, this.y);
       }
   }

  proto.onMoveStop = function(callback) {
    this.movestop_callback = callback;
  }

  proto.onHasMoved = function(callback) {
    this.hasmoved_callback = callback;
  }

  proto.hasMoved = function() {
    this.setDirty();
    if (this.hasmoved_callback) {
      this.hasmoved_callback(this);
    }
  }

  proto.setMoveRate = function(rate) {
    this.moveSpeed = rate;
    this.walkSpeed = ~~(rate / 4);
    this.moveCooldown = new Timer(rate);
    this.tick = Math.round(1000 / this.moveSpeed);
  }

  // New function to make coding easier.
  proto.getPathIndex = function(step) {
    // FIX: `!this.path === null` first negates this.path to a boolean, then
    // compares that boolean to null -- always false, so the null-path check
    // never actually fired, and `this.path.length` would throw if this.path
    // really were null. No current callers exercise this (dead code), but
    // fixed for correctness.
    if (this.path === null || this.path.length === 0)
      return null;
    if (step < 0 || step >= this.path.length)
      return null;
    return (this.path[step]);
  }

  proto.updateMovement = function() {
      const p = this.path,
          i = this.step;

      if (!p || i > (p.length-1))
        return;

      const orientation = this.getOrientation([this.x,this.y], p[i]);
      this.setOrientation(orientation);
      this.walk(this.orientation);
  }

  proto.nextStepPath = function() {
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

  proto.nextStep = function() {
      let stop = false, res = false,
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

  proto.onBeforeMove = function(callback) {
    this.before_move_callback = callback;
  }

  proto.onBeforeStep = function(callback) {
    this.before_step_callback = callback;
  }

  proto.onStep = function(callback) {
    this.step_callback = callback;
  }

  proto.isMoving = function() {
    return this.movement.inProgress;
  }

  proto.isMovingPath = function() {
    return (this.path && this.path.length > 0);
  }

  proto.hasNextStep = function() {
    return (this.path && this.path.length - 1 > this.step);
  }

  proto.hasChangedItsPath = function() {
    return !(this.newDestination === null);
  }

  proto.setPath = function(path) {
    this.path = path;
    this.step = 0;
    this.orientation = this.getOrientationTo(path[1]);
  }

  proto.movePath = function(path) {
    this.forceStop();
    this.setPosition(path[0][0], path[0][1]);
    this.setPath(path);
    this.walk();
  }

  proto.move = function(time, orientation, state, x, y) {

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

  proto.canMove = function() {
    if (this.isDead === false && this.moveCooldown.isOver()) {
      return true;
    }
    return false;
  }

  proto.getLastPosition = function() {
    if (this.path) {
      const lastMove = this.path[this.path.length-1];
      return lastMove;
    }
    return [this.x, this.y];
  }

/*******************************************************************************
 * END - Movement Functions.
 ******************************************************************************/

}
