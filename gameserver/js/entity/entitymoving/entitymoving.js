// Split (see entitymovingmovement.js/entitymovinggrid.js/entitymovingorientation.js):
// this file used to implement the "Movement Functions"/"Grid Functions"/
// "Orientation Functions" sections directly in the class body (it had grown
// to ~780 lines). Those are now installed onto EntityMoving.prototype from
// sibling files via the same installXxx(proto) mixin pattern used for
// character.js's split -- external behavior and every
// `entity.moveTo_(...)`/`entity.stop()`/`entity.isFacing(...)`-style call
// site throughout character.js/mob.js/player.js/mobai.js/updater.js is
// unchanged. Only the constructor and "Misc Functions" section remain here.
import Entity from "../entity.js";
import Scheduler from '../../scheduler.js';
import Transition from "../../transition.js";
import Utils from '../../utils.js';
import { installEntityMovingMovement } from './entitymovingmovement.js';
import { installEntityMovingGrid } from './entitymovinggrid.js';
import { installEntityMovingOrientation } from './entitymovingorientation.js';

/* global log, game */

class EntityMoving extends Entity {
  constructor(id, type, kind, x, y, map) {
    super(id, type, kind, x, y, map);
    const self = this;

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
  * BEGIN - Misc Functions.
  ******************************************************************************/

 onRemove(callback) {
   this.remove_callback = callback;
 }

 // PERF: was its own setTimeout per stun/freeze application; routed
 // through the shared Scheduler (gameserver/js/scheduler.js) instead of a
 // live Node timer per call.
 setFreeze(ms, callback) {
   const self = this;
   if (ms <= 0)
   {
     self.freeze = false;
     return;
   }
   this.freeze = true;
   this.freeze_callback = Scheduler.schedule(function() {
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

installEntityMovingMovement(EntityMoving.prototype);
installEntityMovingGrid(EntityMoving.prototype);
installEntityMovingOrientation(EntityMoving.prototype);

export default EntityMoving;
