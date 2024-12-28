var Messages = require("./message"),
    _ = require("underscore"),
    Utils = require("./utils");

module.exports = Updater = Class.extend({

	init: function(ws, map) {
    var self = this;
    this.ws = ws;
    this.server = ws;
    this.map = map;
    //this.tick = 5;
    this.time = Date.now();
    this.whoDist = (8 * G_TILESIZE);

    // TODO - Changed Path check is messy.

    this.charPathXF = function(c, m) {
      var x = c.x + m;
      c.setPosition(x, c.y);
      return c.nextStep();
    };

    this.charPathYF = function(c, m) {
      var y = c.y + m;
      c.setPosition(c.x, y);
      return c.nextStep();
    };

    this.playerPathXF = function(c, m) {
      var x = c.x + m;
      c.setPosition(x, c.y);
      if (x % self.whoDist == 0)
        c.map.entities.processWho(c);
      return c.nextStep();
    };

    this.playerPathYF = function(c, m) {
      var y = c.y + m;
      c.setPosition(c.x, y);
      if (y % self.whoDist == 0)
        c.map.entities.processWho(c);
      return c.nextStep();
    };

    this.playerKeyXF = function(c, m) {
      var x = c.x + m;
      if ((c.startMoving || (x % G_TILESIZE == 0)) && self.checkCollide(c,x,c.y))
      {
        c.forceStopMove();
        return true;
      }
      c.startMoving = false;
      c.setPosition(x, c.y);
      if (x % self.whoDist == 0)
        c.map.entities.processWho(c);

      if (c.checkStopDanger(c, c.orientation))
      {
        c.forceStopMove();
        return true;
      }
      return false;
    };

    this.playerKeyYF = function(c, m) {
      var y = c.y + m;
      if ((c.startMoving || (y % G_TILESIZE == 0)) && self.checkCollide(c,c.x,y))
      {
        c.forceStopMove();
        return true;
      }
      c.startMoving = false;
      c.setPosition(c.x, y);
      if (y % self.whoDist == 0)
        c.map.entities.processWho(c);

      if (c.checkStopDanger(c, c.orientation))
      {
        c.forceStopMove();
        return true;
      }
      return false;
    };

	},

  update: function() {
      var self = this,
          m = null;

      this.time = Date.now();

      var characters = this.map.entities.characters;
      for(var entityId in characters)
      {
        if (!characters.hasOwnProperty(entityId))
          continue;
        var entity = characters[entityId];
        if (!entity)
          continue;
        if (entity.isDying || entity.isDead || entity.isStunned)
        {
          continue;
        }
        if (entity instanceof Player) {
          this.updatePlayerKeyMovement(entity);
          if (entity.path)
            this.updatePlayerPathMovement(entity);
          entity.neighboursUpdated = false;
        }
        else {
          if (entity.path)
            this.updateCharacterPathMovement(entity);
        }
        m = entity.movement;
        if(m && m.inProgress) {
            m.step(this.time);
        }
      }
  },

  checkCollide: function (c, x, y) {
    if (c instanceof Player) {
      if (c.map.isColliding(x, y))
        return true;
      if (c.holdingBlock) {
        pos = c.nextTile();
        if (c.map.isColliding(pos[0], pos[1]))
          return true;
      }
      return false;
    }
  },

  /**
   * Moves the player one space, if possible
   */
  moveCharacter: function(char, axis, x, y) {
    //if (char.moveOrientation == Types.Orientations.NONE)
      //return false;

    if (this.checkCollide(char, axis, x, y)) {
    //if (axis % G_TILESIZE == 0) {
      //if (char.map.isColliding(x, y)) {
        c.setPosition(c.x, c.y);
        console.warn("char.isColliding("+char.id+","+x+","+y+")");
        return false;
      //}
    }

    /*if (char.isOverlapping()) {
      console.warn("char.isOverlapping("+char.id+","+x+","+y+")");
      return false;
    }*/
    return true;
  },

  updateCharacterPathMovement: function(c) {
      var self = this;

      var tick=c.tick * G_FRAME_INTERVALS;
      var o = c.orientation;

      if (c.isDying || c.isDead || c.freeze || c.isStunned)
      {
        return;
      }

      var canMove = c.movement.inProgress === false && c.isMovingPath();
      if(canMove) {
        if(o == Types.Orientations.LEFT) {
          c.movement.start(self.charPathXF,
             null,
             -tick);
        }
        else if(o == Types.Orientations.RIGHT) {
          c.movement.start(self.charPathXF,
             null,
             tick);
        }
        else if(o == Types.Orientations.UP) {
          c.movement.start(self.charPathYF,
             null,
             -tick);
        }
        else if(o == Types.Orientations.DOWN) {
          c.movement.start(self.charPathYF,
             null,
             tick);
        }
      }
  },

  updatePlayerPathMovement: function(c) {
      var self = this;

      var tick=c.tick * G_FRAME_INTERVALS;
      var o = c.orientation;

      if (c.isDying || c.isDead || c.freeze || c.isStunned)
      {
        return;
      }

      // TODO - Changed Path check is messy.
      var canMove = c.movement.inProgress === false && c.isMovingPath();
      if(canMove) {
        if(o == Types.Orientations.LEFT) {
          c.movement.start(self.playerPathXF,
             null,
             -tick);
        }
        else if(o == Types.Orientations.RIGHT) {
          c.movement.start(self.playerPathXF,
             null,
             tick);
        }
        else if(o == Types.Orientations.UP) {
          c.movement.start(self.playerPathYF,
             null,
             -tick);
        }
        else if(o == Types.Orientations.DOWN) {
          c.movement.start(self.playerPathYF,
             null,
             tick);
        }
      }
  },

  updatePlayerKeyMovement: function(c)
  {
    var self = this;
    var tick=c.tick * G_FRAME_INTERVALS;
    var o = c.moveOrientation;
    //var whoDist = 8;

    if (c.freeze || c.isMovingPath()) {
      //console.info("character is frozen.")
      return;
    }

    var canMove = c.movement.inProgress === false && o > 0;
    if(canMove) {
      if(o == Types.Orientations.LEFT) {
        c.movement.start(self.playerKeyXF,
           null,
           -tick);
      }
      else if(o == Types.Orientations.RIGHT) {
        c.movement.start(self.playerKeyXF,
           null,
           tick);
      }
      else if(o == Types.Orientations.UP) {
        c.movement.start(self.playerKeyYF,
           null,
           -tick);
      }
      else if(o == Types.Orientations.DOWN) {
        c.movement.start(self.playerKeyYF,
           null,
           tick);
      }
    }

  },
});
