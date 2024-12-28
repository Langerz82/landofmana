
define(['./entity', '../transition', '../timer'], function(Entity, Transition, Timer) {

    var EntityMoving = Entity.extend({
  init: function(id, type, map, kind, x, y) {
    var self = this;

    this._super(id, type, map, kind, x, y);

    // Position and orientation
    //this.nextX = -1;
    //this.nextY = -1;
    //this.prevX = -1;
    //this.prevY = -1;

    // Speeds
    this.moveSpeed = 100;
    this.setMoveRate(this.moveSpeed);
    this.walkSpeed = 150;
    this.idleSpeed = randomInt(750, 1000);

    this.followingMode = false;

    this.step = 0;

    this.orientation = 0;

    // Pathing
    this.movement = new Transition(this);

    this.path = null;
    this.newDestination = null;
    this.adjacentTiles = {};


    this.freeze = false;
  },

/*******************************************************************************
 * BEGIN - Movement Functions.
 ******************************************************************************/

   moveTo_: function(x, y, callback) {
     return this._moveTo(x, y, callback);
   },

   _moveTo: function(x, y, callback) {
     this.destination = {
       x: x,
       y: y
     };
     this.adjacentTiles = {};

     if (this.isMovingPath()) {
       this.continueTo(x, y);
     } else {
       var path = this.requestPathfindingTo(x, y);

       if (path)
         this.followPath(path);
     }
   },

   requestPathfindingTo: function(x, y) {
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
   },

   onRequestPath: function(callback) {
     this.request_path_callback = callback;
   },

   onStartPathing: function(callback) {
     this.start_pathing_callback = callback;
   },

   onStopPathing: function(callback) {
     this.stop_pathing_callback = callback;
   },

   onAbortPathing: function(callback) {
     this.abort_pathing_callback = callback;
   },

   followPath: function(path) {
     if (!path) return;
     this.path = path;
     this.step = 0;

     if (this.followingMode) { // following a character
       path.pop();
     }

     if (this.start_pathing_callback) {
       this.start_pathing_callback(path);
     }
   },

   continueTo: function(x, y) {
     this.newDestination = {x: x, y: y};
   },

   /**
    *
    */
   go: function(x, y) {
     if (this.followingMode) {
       this.followingMode = false;
       this.target = null;
     }
     this.moveTo_(x, y);
   },

   /**
    * Makes the character follow another one.
    */
   follow: function(entity, dist) {
     var found = false;

     var spot = this.getClosestSpot(entity, dist);

     if (spot && spot.x && spot.y)
       this.moveTo_(spot.x, spot.y);
   },

   getLastMove: function () {
       if (!this.path)
         return null;
       var lastPath = this.path[this.path.length-1];
       return [lastPath[0],
         lastPath[1]];
   },

   getSpotsAroundFrom: function(dest, adjStart, adjEnd) {
     adjStart = adjStart || 1;
     adjEnd = adjEnd || 1;

     var coords = [];
     var start = Math.min(adjStart, adjEnd);
     var end = Math.max(adjStart, adjEnd);
     for (var i=start; i <= end; ++i) {
       coords = coords.concat(this.getSpotsAround(dest, i));
     }
     return coords;
   },

   getSpotsAround: function(dest, adjDist) {
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
       x = ~~(x2 + (Math.sin(deg)*d));
       y = ~~(y2 + (Math.cos(deg)*d));
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
   },

   getClosestSpot: function(dest, adjStart, adjEnd) {
     adjStart = adjStart || 1;
     adjEnd = adjEnd || 1;
     var coords = this.getSpotsAroundFrom(dest, adjStart, adjEnd);

     for (var i = (coords.length-1); i >= 0; --i)
     {
       var coord = coords[i];
       if (game.mapContainer.isColliding(coord.x, coord.y))
         coords.splice(i,1);
     }

     coords.sort(function(a,b) { return a.d-b.d; });

     return {x: coords[0].x, y: coords[0].y};
   },


   stopInPath: function(x,y) {
     if (this.isMovingPath()) {
       if (this.map.entities.pathfinder.isInPath(this.path, [x,y])) {
         this.setPosition(x,y);
         //this.stop();
         this.interrupted = true;
         this.forceStop();
       }
     }
   },

  idle: function(orientation) {
      this.setOrientation(orientation || this.orientation);
      this.animate("idle", this.idleSpeed);
  },

  walk: function(orientation) {
      this.setOrientation(orientation || this.orientation);
      this.animate("walk", this.walkSpeed);
  },

  forceStop: function () {
    this._forceStop();
    if (!this.isDying && !this.isDead && !this.hasAnimation('atk'))
        this.idle();
  },

  _forceStop: function() {
    if (this.path && this.movement.inProgress && this.abort_pathing_callback)
      this.abort_pathing_callback(this.x,this.y);

    this._stop();
  },

  /**
   * Stops a moving character.
   */
  _stop: function() {
    this.movement.stop();

    this.keyMove = false;
    this.moving = false;
    this.interrupted = false;
    this.path = null;
    this.newDestination = null;
    this.isReadyToMove = true;
    this.followingMode = false;
  },

  setMoveStopCallback: function (callback) {
    this.movestop_callback = callback;
  },

  onHasMoved: function(callback) {
    this.hasmoved_callback = callback;
  },

  hasMoved: function() {
    this.setDirty();
    if (this.hasmoved_callback) {
      this.hasmoved_callback(this);
    }
  },

  setMoveRate: function(rate) {
    this.moveSpeed = rate;
    this.walkSpeed = ~~(rate / 4);
    this.tick = Math.round(1000 / this.moveSpeed);
  },

  // New function to make coding easier.
  getPathIndex: function(step) {
    if (!this.path === null || this.path.length === 0)
      return null;
    if (step < 0 || step >= this.path.length)
      return null;
    return (this.path[step]);
  },

  updateMovement: function() {
      var p = this.path,
          i = this.step;

      if (!p || i > (p.length-1))
        return;

      var orientation = this.getOrientation([this.x,this.y], p[i]);
      this.orientation = orientation;
      this.setOrientation(orientation);
      this.walk(this.orientation);
  },

  /*updateWalk: function(a, b) {
      this.orientation = this.getOrientation(a, b);
      this.walk(this.orientation);
  },*/

  nextStepPath: function () {
    if (this.step == 0)
    {
      //this.orientation = this.getOrientationTo([this.path[1][0]-tsh,this.path[1][1]-tsh]);
      this.step++;
      this.updateMovement();
    }

    //log.info("nextStepPath - x:"+this.x+", y:"+this.y);
    if (this.step < this.path.length)
    {
      //log.info("next-x:"+this.path[this.step][0]+",next-y:"+this.path[this.step][1]);
      if (this.x == this.path[this.step][0] &&
          this.y == this.path[this.step][1])
      {
        this.step++;
        this.updateMovement();
        return true;
      }
      return false;
    }
    return false;
  },

  nextStep: function() {
      var stop = false, res = false,
          path, x, y;

      if(!this.isMovingPath() || this.freeze) {
        //log.info("NOT MOVING OR FREEZE!!!!!!!!!!!!!");
        this.interrupted = true;
        stop = true;
      }

      /*if(this.interrupted) {
          //log.info("nextStep - id:"+this.id+", interrupted=true");
          stop = true;
      }*/
      if (!stop)
      {
          res = this.nextStepPath();

          if (this.step >= this.path.length) {
            //log.info("nextStep - id:"+this.id+", step >= length");
            stop = true;
          }

          if(this.step_callback) {
              this.step_callback();
          }
      }

      if(this.hasChangedItsPath()) {
          this.setPosition(this.x, this.y);
          x = this.newDestination.x;
          y = this.newDestination.y;
          path = this.requestPathfindingTo(x, y);


          this.newDestination = null;
          this.followPath(path);
          return true;
      }

      if(stop) { // Path is complete or has been interrupted
        if(this.stop_pathing_callback) {
            this.stop_pathing_callback(this.x, this.y);

        this.forceStop();
        //log.info("nextStep - stopped, x:"+this.x+",y:"+this.y);
        }
        res = true;
      }

      return res;
  },

  onBeforeMove: function(callback) {
    this.before_move_callback = callback;
  },

  onBeforeStep: function(callback) {
    this.before_step_callback = callback;
  },

  onStep: function(callback) {
    this.step_callback = callback;
  },

  isMoving: function() {
    return this.movement.inProgress;
  },

  isMovingPath: function() {
    return (this.path && this.path.length > 0);
  },

  hasNextStep: function() {
    return (this.path && this.path.length - 1 > this.step);
  },

  hasChangedItsPath: function() {
    return !(this.newDestination === null);
  },

  movePath: function (path, orientation) {
    this.setOrientation(this.getOrientationTo([path[1][0],path[1][1]]));
    this.walk();

    this.path = path;
    this.step = 0;
  },

  setPosition: function (x, y) {
    this._setPosition(x,y);
  },

  move: function (time, orientation, state, x, y) {

    this.setOrientation(orientation);
    if (state == 1 && orientation != Types.Orientations.NONE)
    {
      this.forceStop();
      this.setPosition(x,y);
      this.walk(orientation);
    }
    else if (state == 0 || state == 2 || orientation == Types.Orientations.NONE)
    {
      this.forceStop();
      this.setPosition(x,y);
    }
  },

/*******************************************************************************
 * END - Movement Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Grid Functions.
 ******************************************************************************/

    isNear: function(character, distance) {
     var dx, dy, near = false;

     dx = Math.abs(this.x - character.x);
     dy = Math.abs(this.y - character.y);

     if (dx <= (distance*G_TILESIZE) && dy <= (distance*G_TILESIZE)) {
       near = true;
     }
     return near;
    },

   nextDist: function (x, y, o, dist) {
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
   },

   nextMove: function (x, y, o, dist) {
     return this.nextDist(x, y, o, 1);
   },

   nextTile: function (x, y, o, dist) {
     return this.nextDist(x, y, o, G_TILESIZE);
   },

   // New function to make coding easier.
   /// TODO - Fix, probably broken with new path code.
   isWithinPath: function(coords) {
     var tCoords = null;
     if (typeof(coords) === "Object" && coords.x > 0 && coords.y > 0) {
       tCoords = [coords.x, coords.y];
     } else if (Array.isArray(coords) && coords.length == 2) {
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
   },

/*******************************************************************************
 * END - Grid Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Orientation Functions.
 ******************************************************************************/

   /**
    * Gets the right orientation to face a target character from the current position.
    * Note:
    * In order to work properly, this method should be used in the following
    * situation :
    *    S
    *  S T S
    *    S
    * (where S is self, T is target character)
    *
    * @param {Character} character The character to face.
    * @returns {String} The orientation.
    */
   getOrientationTo: function(character) {
     if (this.x < character.x) {
       return 4;
     } else if (this.x > character.x) {
       return 3;
     } else if (this.y > character.y) {
       return 1;
     } else {
       return 2;
     }
   },

   getOrientation: function(p1, p2) {
       var x = Math.abs(p1[0]-p2[0]);
       var y = Math.abs(p1[1]-p2[1]);
       if(x > y) {
         if (p1[0] > p2[0])
           return 3;
         else
           return 4;
       } else if(y > x) {
         if (p1[1] > p2[1])
           return 1;
         else
           return 2;
       }
       return 0;
   },

  setOrientation: function(orientation) {
    if (orientation) {
      if (orientation != this.orientation && this.isMoving()) {
        try { throw new Error() } catch (e) { log.error(e.stack); }
      }
      this.orientation = orientation || 0;
    }
  },

  getOrientationTo: function(arr) {
      return this.getOrientation([this.x,this.y],arr);
  },

  /**
   * Changes the character's orientation so that it is facing its target.
   */
   lookAt: function(x, y) {
       this.setOrientation(this.getOrientationTo([x, y]));
       this.idle(this.orientation);
       return this.orientation;
   },

  // Orientation Code.
  lookAtEntity: function(entity) {
    this._lookAtEntity(entity);
  },

  _lookAtEntity: function(entity) {
      if (entity) {
          this.orientation = this.getOrientationTo([entity.x, entity.y]);
      }
      return this.orientation;
  },

  lookAtTile: function (x, y) {
    var tsh = G_TILESIZE >> 1;
    var pos = getGridPosition(x, y);
    pos = getPositionFromGrid(pos.gx, pos.gy);
    this.lookAt(pos.x+tsh,pos.y+tsh);
  },

  /*isNextToo: function (x,y,o) {
    var o = o || this.orientation;
    var ts = G_TILESIZE;
    //log.info("isNextToo:");
    //log.info("dx:"+Math.abs(this.x-x));
    //log.info("dy:"+Math.abs(this.y-y));
    return (Math.abs(this.x-x) <= ts && Math.abs(this.y-y) <= ts);
  },*/

  isInReach: function (x,y,o,r,rs) {
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
    //log.info("isInReach:");
    //log.info("dx:"+Math.abs(this.x-x));
    //log.info("dy:"+Math.abs(this.y-y));
    //log.info("xa:"+a);
    //log.info("yb:"+b);
    return (Math.abs(this.x-x) <= a && Math.abs(this.y-y) <= b);
  },

  isFacing: function (x, y) {
    var dx = this.x - x;
    var dy = this.y - y;

    switch (this.orientation)
    {
      case 1:
        return (dy > 0);
      case 2:
        return (dy < 0);
      case 3:
        return (dx > 0);
      case 4:
        return (dx < 0);
    }
    return false;
  },

  isFacingEntity: function (entity) {
      return this.isFacing(entity.x, entity.y);
  },

/*******************************************************************************
 * END - Orientation Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Misc Functions.
 ******************************************************************************/

   setFreeze: function(ms, callback) {
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
   },

/*******************************************************************************
 * END - Misc Functions.
 ******************************************************************************/

  });

  return EntityMoving;
});
