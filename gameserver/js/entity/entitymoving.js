var Entity = require("./entity"),
  Messages = require("../message"),
  Timer = require("../timer"),
  Transition = require("../transition");

module.exports = EntityMoving = Entity.extend({
  init: function(id, type, kind, x, y, map) {
    var self = this;

    this._super(id, type, kind, x, y, map);

    // Position and orientation
    this.nextX = -1;
    this.nextY = -1;
    this.prevX = -1;
    this.prevY = -1;

    //this.orientation = Types.Orientations.DOWN;

    // Speeds
    this.moveSpeed = 100;
    this.setMoveRate(this.moveSpeed);
    this.walkSpeed = 150;
    this.idleSpeed = Utils.randomInt(750, 1000);

    this.followingMode = false;
    this.engagingPC = false;

    this.step = 0;

    this.orientation = this.setRandomOrientation();

    // Pathing
    this.movement = new Transition();

    this.path = null;
    this.newDestination = null;
    this.adjacentTiles = {};

    // Health
    this.moveCooldown = null;

    this.freeze = false;
  },

/*******************************************************************************
 * BEGIN - Orientation Functions.
 ******************************************************************************/

  setOrientation: function(orientation) {
    if (orientation) {
      this.orientation = orientation || 0;
    }
  },

  idle: function(orientation) {
    this.setOrientation(orientation);
  },

  walk: function(orientation) {
    this.setOrientation(orientation);
  },

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
      return Types.Orientations.RIGHT;
    } else if (this.x > character.x) {
      return Types.Orientations.LEFT;
    } else if (this.y > character.y) {
      return Types.Orientations.UP;
    } else {
      return Types.Orientations.DOWN;
    }
  },

  /**
   * Changes the character's orientation so that it is facing its target.
   */
  /*lookAt: function(target) {
    if (target) {
      this.orientation = this.getOrientationTo(target);
    }
  },*/

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

  getOrientationTo: function(object) {
      return this.getOrientation([this.x,this.y], [object.x,object.y])
  },

  getOrientation: function(p1, p2) {
      var x = Math.abs(p1[0]-p2[0]);
      var y = Math.abs(p1[1]-p2[1]);
      if(x > y) {
        if (p1[0] > p2[0])
          return Types.Orientations.LEFT;
        else
          return Types.Orientations.RIGHT;
      } else if(y > x) {
        if (p1[1] > p2[1])
          return Types.Orientations.UP;
        else
          return Types.Orientations.DOWN;
      }
      return Types.Orientations.NONE;
  },

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
    //console.info("isInReach:");
    //console.info("dx:"+Math.abs(this.x-x));
    //console.info("dy:"+Math.abs(this.y-y));
    //console.info("xa:"+a);
    //console.info("yb:"+b);
    return (Math.abs(this.x-x) <= a && Math.abs(this.y-y) <= b);
  },

  lookAt: function(x, y) {
      this.orientation = this.getOrientationTo([x, y]);
      this.idle(this.orientation);
      return this.orientation;
  },

  // Orientation Code.
  lookAtEntity: function(entity) {
      if (entity) {
          this.orientation = this.getOrientationTo(entity);
      }
      return this.orientation;
  },

  lookAtTile: function (x, y) {
    var tsh = G_TILESIZE >> 1;
    var pos = getGridPosition(x, y);
    pos = getPositionFromGrid(pos.gx, pos.gy);
    this.lookAt(pos.x+tsh,pos.y+tsh);
  },

/*******************************************************************************
 * END - Orientation Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Pathing Functions.
 ******************************************************************************/

  /*onMoveChange: function (callback) {
      this.move_change_callback = callback;
  },*/

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
    //console.info(JSON.stringify(this.path));
    if (Array.isArray(this.path) && this.path.length > 0) {
      return this.path;
    } else if (this.request_path_callback) {
      return this.request_path_callback(x, y);
    } else {
      console.info(this.id + " couldn't request pathfinding to " + x + ", " + y);
      console.info("char x:" + this.x + ",y: " + this.y + ", x:" + x + "y: " + y);
      try {
        throw new Error()
      } catch (e) {
        console.info(e.stack);
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
    if (this.isAttacking()) {
      this.disengage();
    } else if (this.followingMode) {
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

/*******************************************************************************
 * END - Pathing Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Grid Functions.
 ******************************************************************************/
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

 isOverlapping: function() {
   var entities = this.map.entities.getCharactersAround(this, 1);
   for(var entity of entities) {
     if (!entity || this == entity)
       continue;
     if (this.isOverlappingEntity(entity))
     {
       return true;
     }
   }
   return false;
 },

/*******************************************************************************
 * END - Grid Functions.
******************************************************************************/

/*******************************************************************************
 * BEGIN - Movement Functions.
 ******************************************************************************/

  /**
   * Stops a moving character.
   */
  stop: function() {
    if (this.isMovingPath()) {
      this.interrupted = true;
      this.moving = false;
    }
  },

  forceStop: function() {
    this.movement.stop();
    this.orientation = 0;
    this.moveOrientation = 0;
    if (this.isMovingPath()) {
      if (this.interrupted && this.abort_pathing_callback)
        this.abort_pathing_callback(this.x, this.y);
      this.interrupted = false;
      this.path = null;
      this.newDestination = null;
      this.isReadyToMove = true;
      this.followingMode = false;
    }
    //this.idle(this.orientation);
    //if (this.movestop_callback)
      //this.movestop_callback();
  },

  forceStopMove: function() {
    console.info("character - forceStopMove - called");
    //console.info("forceStopMove - player, moveOrientation:"+this.moveOrientation);
    //console.info("forceStopMove - player, ex:"+this.x+",ey:"+this.y);
    //console.info("forceStopMove - player, cx:"+this.sx+",cy:"+this.sy);
    //try { throw new Error(); } catch(err) { console.info(err.stack); }

    this.movement.stop();
    //this.orientation = 0;
    this.moveOrientation = 0;
    this.freeze = false;
    //if (this.moving_callback)
      //clearInterval(this.moving_callback);
    //this.keyMove = false;
    //this.y = this.sy;
    if (this.movestop_callback)
      this.movestop_callback();

    //this.sx = this.x;
    //this.sy = this.y;
    //this.ex = -1;
    //this.ey = -1;

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
    this.moveCooldown = new Timer(rate);
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

      this.orientation = this.getOrientation([this.x,this.y], p[i]);
      this.walk(this.orientation);
  },

  /*updateWalk: function(a, b) {
      this.orientation = this.getOrientation(a, b);
      this.walk(this.orientation);
  },*/

  nextStepPath: function () {
    // Needed because x and y are moved != path[0].
    if (this.step == 0)
    {
      this.step++;
      this.updateMovement();
    }

    //console.info("nextStepPath - x:"+this.x+", y:"+this.y);
    if (this.step < this.path.length)
    {
      //console.info("next-x:"+this.path[this.step][0]+",next-y:"+this.path[this.step][1]);
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
        //console.info("NOT MOVING OR FREEZE!!!!!!!!!!!!!");
        this.interrupted = true;
        stop = true;
      }

      /*if(this.interrupted) {
          //console.info("nextStep - id:"+this.id+", interrupted=true");
          stop = true;
      }*/
      if (!stop)
      {
          res = this.nextStepPath();

          if (this.step >= this.path.length) {
            //console.info("nextStep - id:"+this.id+", step >= length");
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
        //console.info("nextStep - stopped, x:"+this.x+",y:"+this.y);
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

  isNear: function(character, distance) {
    var dx, dy, near = false;

    dx = Math.abs(this.x - character.x);
    dy = Math.abs(this.y - character.y);

    if (dx <= (distance*G_TILESIZE) && dy <= (distance*G_TILESIZE)) {
      near = true;
    }
    return near;
  },

  isNextToo: function (x,y,o) {
    var o = o || this.orientation;
    var ts = G_TILESIZE;
    //log.info("isNextToo:");
    //log.info("dx:"+Math.abs(this.x-x));
    //log.info("dy:"+Math.abs(this.y-y));
    return (Math.abs(this.x-x) <= ts && Math.abs(this.y-y) <= ts);
  },


  movePath: function (path, orientation) {
    this.orientation = this.getOrientationTo([path[1][0],path[1][1]]);
    /*if (orientation != orientation2) {
      console.error("orientation: "+orientation+","+orientation2);
      if (orientation2 > 0)
        orientation = orientation2;
    }
    this.setOrientation(orientation);*/
    this.walk();

    this.path = path;
    this.step = 0;
  },

  /*setPosition: function (x, y) {
    this._setPosition(x,y);
  },*/

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

  move: function (time, orientation, state, x, y) {

    this.orientation = orientation;
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

  canMove: function() {
    if (this.isDead == false && this.moveCooldown.isOver()) {
      return true;
    }
    return false;
  },

/*******************************************************************************
 * END - Movement Functions.
 ******************************************************************************/

/*******************************************************************************
 * START - MISC Functions.
 ******************************************************************************/

 onRemove: function(callback) {
   this.remove_callback = callback;
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

 // Server Character
 getState: function() {
   return this._getBaseState();
 },

/*******************************************************************************
 * END - MISC Functions.
 ******************************************************************************/

});


module.exports = EntityMoving;
