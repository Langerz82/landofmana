import Messages from "./message.js";
import _ from "underscore";
//import Utils from "./utils.js";
import { Types } from './common.js';
import { G_TILESIZE, G_FRAME_INTERVALS } from './constants.js';
import Player from './entity/player/player.js';

/* global Player */

class Updater {

	constructor(ws, map) {
    const self = this;
    this.ws = ws;
    this.server = ws;
    this.map = map;
    //this.tick = 5;
    this.time = Date.now();
    this.whoDist = (8 * G_TILESIZE);

    // TODO - Changed Path check is messy.
    this.charPath = function (c,x,y) {
      if (c.map.isCollidingPoint(x,y)) {
        try { throw new Error(); } catch (e) { console.error(e.stack); }
      }
      c.setPosition(x, y);
      return c.nextStep();
    };

    this.charPathXF = function(c, m) {
      const x = c.x + m;
      const y = c.y;
      return self.charPath(c,x,y);
    };

    this.charPathYF = function(c, m) {
      const x = c.x;
      const y = c.y + m;
      return self.charPath(c,x,y);
    };

    this.playerPathXF = function(c, m) {
      const x = c.x + m;
      const y = c.y;
      if (x % self.whoDist === 0)
        c.map.entities.processWho(c);
      c.setPosition(x, y);
      return c.nextStep();
    };

    this.playerPathYF = function(c, m) {
      const x = c.x;
      const y = c.y + m;
      if (y % self.whoDist === 0)
        c.map.entities.processWho(c);
      c.setPosition(x, y);
      return c.nextStep();
    };

    this.playerKey = function (c,x,y) {
      const stop = function () {
        c.forceStop();
        return true;
      }
      // FIX: stop() was called but its return value discarded, so execution
      // fell through to c.setPosition(x, y) regardless -- the collision
      // check "fired" but never actually stopped the player from moving
      // into the blocked tile. Return immediately once stopped.
      if (self.checkCollide(c,x,y))
      {
        return stop();
      }
      c.startMoving = false;
      c.setPosition(x, y);

      if (c.checkStopDanger(c, c.orientation))
      {
        return stop();
      }
      return false;

    }
    this.playerKeyXF = function(c, m) {
      const x = c.x + m;
      const y = c.y;
      if (x % self.whoDist === 0)
        c.map.entities.processWho(c);

      return self.playerKey(c,x,y,true);
    };

    this.playerKeyYF = function(c, m) {
      const x = c.x;
      const y = c.y + m;
      if (y % self.whoDist === 0)
        c.map.entities.processWho(c);

      return self.playerKey(c,x,y,false);
    };

	}

  update() {
      let self = this,
          m = null;

      this.time = Date.now();

      for(const entity of this.map.entities.characters.values())
      {
        if (entity.isDead || entity.isStunned)
        {
          continue;
        }
        if (entity instanceof Player) {
          this.updatePlayerKeyMovement(entity);
          if (entity.path)
            this.updatePlayerPathMovement(entity);
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
  }

  checkCollide(c, x, y) {
    if (c instanceof Player) {
      if (c.map.isColliding(x, y))
        return true;
      if (c.holdingBlock) {
        const pos = c.nextTile();
        if (c.map.isColliding(pos[0], pos[1]))
          return true;
      }
      return false;
    }
  }

  // NOTE: `moveCharacter(char, axis, x, y)` was removed from here -- it was
  // dead code (no callers anywhere in the codebase) and also broken: it
  // referenced an undefined `c` (should have been `char`) and called
  // `checkCollide(c, x, y)` with a mismatched argument list
  // (`char, axis, x, y` instead of `char, x, y`), so it would have thrown a
  // ReferenceError the moment anything actually called it.

  updateCharacterPathMovement(c) {
      const self = this;

      const tick=c.tick * G_FRAME_INTERVALS;
      const o = c.orientation;

      if (c.isDead || c.freeze || c.isStunned)
      {
        return;
      }

      const canMove = c.movement.inProgress === false && c.isMovingPath();
      if(canMove) {
        if(o === Types.Orientations.LEFT) {
          c.movement.start(self.charPathXF,
             null,
             -tick);
        }
        else if(o === Types.Orientations.RIGHT) {
          c.movement.start(self.charPathXF,
             null,
             tick);
        }
        else if(o === Types.Orientations.UP) {
          c.movement.start(self.charPathYF,
             null,
             -tick);
        }
        else if(o === Types.Orientations.DOWN) {
          c.movement.start(self.charPathYF,
             null,
             tick);
        }
      }
  }

  updatePlayerPathMovement(c) {
      const self = this;

      const tick=c.tick * G_FRAME_INTERVALS;
      const o = c.orientation;

      if (c.isDead || c.freeze || c.isStunned)
      {
        return;
      }

      // TODO - Changed Path check is messy.
      const canMove = c.movement.inProgress === false && c.isMovingPath();
      if(canMove) {
        if(o === 3) {
          c.movement.start(self.playerPathXF,
             null,
             -tick);
        }
        else if(o === 4) {
          c.movement.start(self.playerPathXF,
             null,
             tick);
        }
        else if(o === 1) {
          c.movement.start(self.playerPathYF,
             null,
             -tick);
        }
        else if(o === 2) {
          c.movement.start(self.playerPathYF,
             null,
             tick);
        }
      }
  }

  updatePlayerKeyMovement(c)
  {
    if (c.isDying || c.isDead || c.freeze || c.isStunned) {
        return;
    }

    const self = this;
    const tick=c.tick * G_FRAME_INTERVALS;
    const o = c.orientation;

    if (c.freeze || c.isMovingPath()) {
      //console.info("character is frozen.")
      return;
    }

    const canMove = c.movement.inProgress === false && o > 0 && c.keyMove;
    if(canMove) {
      if(o === 3) {
        c.movement.start(self.playerKeyXF,
           null,
           -tick);
      }
      else if(o === 4) {
        c.movement.start(self.playerKeyXF,
           null,
           tick);
      }
      else if(o === 1) {
        c.movement.start(self.playerKeyYF,
           null,
           -tick);
      }
      else if(o === 2) {
        c.movement.start(self.playerKeyYF,
           null,
           tick);
      }
    }

  }
}

export default Updater;
