import EntityMoving from "./entitymoving.js";
import Messages from "../message.js";
import Timer from "../timer.js";
import Utils from '../utils.js';
import { Types } from '../common.js';
import _ from 'underscore';
import { G_TILESIZE } from '../main.js';
import Scheduler from '../scheduler.js';

class Character extends EntityMoving {
  constructor(id, type, kind, x, y, map) {
    super(id, type, kind, x, y, map);
    const self = this;

    //this.orientation = Types.Orientations.DOWN;

    // Speeds
    this.atkSpeed = 100;
    this.moveSpeed = 100;
    this.setMoveRate(this.moveSpeed);
    this.walkSpeed = 150;
    this.idleSpeed = Utils.randomInt(750, 1000);
    this.setAttackRate(1024);

    // Combat
    this.target = null;
    this.unconfirmedTarget = null;
    this.attackers = {};

    // Health
    this.stats = {};
    this.stats.hp = 0;
    this.stats.hpMax = 0;
    this.stats.ep = 0;
    this.stats.epMax = 0;

    // Modes
//    this.isDying = false;
    this.isDead = false;
    this.attackingMode = false;

    this.step = 0;

    this.orientation = 2;

    this.attackCooldown = null;
    this.moveCooldown = null;

    this.freeze = false;

    this.activeEffects = [];
    this.effects = {};
    this.invincible = false;

    this.mod = {
      accuracy: 1,
      damage: 1,
      defence: 1,
      attack: 1,
      attackTime: 1,
      crit: 1,
      dot: 0,
      dr: 0,
      time: 0,
      daze: 0,
      hate: 0
    };
  }

/*******************************************************************************
 * BEGIN - Stat Functions.
 ******************************************************************************/
   getHpMax() {
     return (this.stats) ? this.stats.hpMax : 0;
   }

   getEpMax() {
     return (this.stats) ? this.stats.epMax : 0;
   }

  resetHp() {
    const max = this.getHpMax();
    this.stats.hpMax = max;
    const diff= max - this.stats.hp;
    this.stats.hp = max;
    //try { throw new Error(); } catch(err) { console.info(err.stack); }
    const msg = new Messages.ChangePoints(this, diff, 0);
    this.map.entities.sendNeighbours(this, msg);
  }

  resetEp() {
    const max = this.getEpMax();
    this.stats.epMax = max;
    this.stats.ep = max;
  }

  // FIX: these four used `val = val || default`, which treats an explicit
  // 0 the same as "no argument passed" and silently substitutes the max
  // instead. Every current call site only ever calls these with no
  // argument (entity/player.js, packets/packethandler.js), where falling
  // back to the max is exactly the intended default, so this was never hit
  // in practice -- but it's a live trap for the next caller that needs
  // e.g. setHp(0) (an instant-kill effect), which would silently full-heal
  // instead. Checking for null/undefined instead of falsiness preserves
  // the "no argument -> default to max" behavior while letting an explicit
  // 0 through.
  setHp(val) {
    val = (val == null) ? this.getHpMax() : val;
    this.stats.hp = val;
  }

  setEp(val) {
    val = (val == null) ? this.getEpMax() : val;
    this.stats.ep = val;
  }

  setHpMax(val) {
    val = (val == null) ? this.getHpMax() : val;
    this.stats.hpMax = val;
    this.stats.hp = val;
  }

  setEpMax(val) {
    val = (val == null) ? this.getEpMax() : val;
    this.stats.epMax = val;
    this.stats.ep = val;
  }

  hasFullHealth() {
    return this.stats.hp === this.stats.hpMax;
  }

  hasFullEnergy() {
    return this.stats.ep === this.stats.epMax;
  }

  setAttackRange(range) {
    this.attackRange = range;
  }

  modHp(val) {
    const prev = this._modHp(val);
    return (typeof game !== 'undefined') ? prev : this.changePoints(prev, 0);
  }

  modEp(val) {
    const prev = this._modEp(val);
    return (typeof game !== 'undefined') ? prev : this.changePoints(0, prev);
  }

  _modHp(val) {
    const hp = this.stats.hp,
      max = this.stats.hpMax;

    let prev = hp;
    this.stats.hp = Utils.clamp(0, max, hp+val);
    prev -= this.stats.hp;
    return prev;
  }

  _modEp(val) {
    const ep = this.stats.ep,
      max = this.stats.epMax;

    let prev = ep;
    this.stats.ep = Utils.clamp(0, max, ep+val);
    prev -= this.stats.ep;
    return prev;
  }

  changePoints(modhp, modep) {
    return new Messages.ChangePoints(this, modhp, modep);
  }

  onDamage(attacker, hpMod, epMod, crit, effects) {
    hpMod = hpMod || 0;
    epMod = epMod || 0;
    crit = crit || 0;
    effects = effects || 0;

    if (this.invincible)
      return;

    const hpDiff = this._modHp(-hpMod);
    const epDiff = this._modEp(-epMod);

    if (hpMod > 0)
      this.addAttacker(attacker);

    const msg = new Messages.Damage([attacker, this, -hpDiff, -epDiff, crit, effects]);
    this.map.entities.sendNeighbours(attacker, msg);
  }

/*******************************************************************************
 * END - Stat Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Combat Functions.
 ******************************************************************************/

  hit(orientation) {
    this.setOrientation(orientation);
    this.stop();
  }

  onAggro(callback) {
    this.aggro_callback = callback;
  }

  onCheckAggro(callback) {
    this.checkaggro_callback = callback;
  }

  checkAggro() {
    if (this.checkaggro_callback) {
      this.checkaggro_callback();
    }
  }

  aggro(character) {
    if (this.aggro_callback) {
      this.aggro_callback(character);
    }
  }

  onDeath(callback) {
    this.death_callback = callback;
  }

  // PERF: hurt() fires on every single hit landed, by every player/mob in
  // combat -- the highest-frequency of the codebase's one-shot timer sites.
  // Was its own setTimeout per hit; routed through the shared Scheduler
  // (gameserver/js/scheduler.js) instead of a live Node timer per hit.
  hurt() {
    const self = this;

    this.stopHurting();
    this.sprite = this.hurtSprite;
    this.hurting = Scheduler.schedule(function () { self.stopHurting(); }, 75);
  }

  stopHurting() {
    this.sprite = this.normalSprite;
    // Scheduler.cancel() is a safe no-op for an already-fired/never-set
    // token, exactly like clearTimeout() was -- see scheduler.js.
    Scheduler.cancel(this.hurting);
    this.hurting = null;
  }

  /**
   * Makes the character attack another character. Same as Character.follow but with an auto-attacking behavior.
   * @see Character.follow
   */
  engage(character) {
    this.attackingMode = true;
    this.setTarget(character);
    //this.follow(character);
  }

  disengage() {
    this.attackingMode = false;
    this.removeTarget();
  }

  /**
   * Returns true if the character is currently attacking.
   */
  isAttacking() {
    return this.attackingMode;
  }

  /**
   * Returns true if this character is currently attacked by a given character.
   * @param {Character} character The attacking character.
   * @returns {Boolean} Whether this is an attacker of this character.
   */
  // PERF: was gated behind `if (Object.keys(this.attackers).length === 0)
  // return false;` -- an array allocation on every call (this is checked by
  // mobai.js's checkHitAggro() on every hit landed against an idle mob) just
  // to answer a question the hasOwnProperty()+identity check right below
  // already answers correctly on its own for an empty `attackers` too
  // (hasOwnProperty() on an empty object is simply false). No behavior
  // change, one fewer allocation per call.
  isAttackedBy(character) {
    return this.attackers.hasOwnProperty(character.id) &&
      this.attackers[character.id] === character;
  }

  isAttacked() {
    return !(Object.keys(this.attackers).length === 0);
  }

  /**
   * Registers a character as a current attacker of this one.
   * @param {Character} character The attacking character.
   */
  addAttacker(character) {
    if (!this.isAttackedBy(character)) {
      this.attackers[character.id] = character;
    }
  }

  /**
   * Unregisters a character as a current attacker of this one.
   * @param {Character} character The attacking character.
   */
  removeAttacker(character) {
    if (!this.isAttacked()) {
      return;
    }
    delete this.attackers[character.id];
  }

  removeAttackers() {
    this.attackers = {};
  }

  clearAttackerRefs() {
    const self = this;
    this.forEachAttacker(function (c) {
      c.removeAttacker(self);
    });
  }

  /**
   * Loops through all the characters currently attacking this one.
   * @param {Function} callback Function which must accept one character argument.
   */
  forEachAttacker(callback) {
    _.each(this.attackers, function(attacker) {
      callback(attacker);
    });
  }

  /**
   * Marks this character as waiting to attack a target.
   * By sending an "attack" message, the server will later confirm (or not)
   * that this character is allowed to acquire this target.
   *
   * @param {Character} character The target character
   */
  waitToAttack(character) {
    this.unconfirmedTarget = character;
  }

  /**
   * Returns true if this character is currently waiting to attack the target character.
   * @param {Character} character The target character.
   * @returns {Boolean} Whether this character is waiting to attack.
   */
  isWaitingToAttack(character) {
    return (this.unconfirmedTarget === character);
  }

  canAttack() {
    if (this.isDead === false && this.attackCooldown.isOver()) {
      return true;
    }
    return false;
  }

  setAttackRate(rate) {
    this.attackCooldown = new Timer(rate);
  }

  createAttackLink(target)
  {
      if (this.hasTarget())
      {
          this.removeTarget();
      }
      this.setTarget(target);

      target.addAttacker(this);
      this.addAttacker(target);
  }

  followAttack(entity) {
    const found = false;

    const spot = this.getClosestSpot(entity, 1, this.attackRange);

    if (spot && spot.x && spot.y)
      this.moveTo_(spot.x, spot.y);
  }

/*******************************************************************************
 * END - Combat Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Target Functions.
 ******************************************************************************/

   /**
    * Sets this character's attack target. It can only have one target at any time.
    * @param {Character} character The target character.
    */
   setTarget(character) {
       //try { throw new Error(); } catch(err) { console.error(err.stack); }
        if (character === null || character.isDying || character.isDead) {
        	     this.removeTarget();
        	     return;
        }
        if(this.target !== character) { // If it's not already set as the target
           if(this.hasTarget()) {
               this.removeTarget(); // Cleanly remove the previous one
           }
           this.target = character;
           if(this.settarget_callback){
               this.settarget_callback(character, true);
           }
       } else {
           console.debug(character.id + " is already the target of " + this.id);
       }
   }

   onSetTarget(callback) {
     this.settarget_callback = callback;
   }

   showTarget(character) {
     if(this.inspecting !== character && character !== this){
       this.inspecting = character;
       if(this.settarget_callback && this.target){
         this.settarget_callback(character, true);
       }
     }
   }

  /**
   * Removes the current attack target.
   */
  // NOTE: was `const self = this;` here, unused -- nothing in this method
  // needed a captured reference to `this` (no nested callback loses binding
  // the way hurt()/setFreeze() elsewhere in this file do).
  removeTarget() {
    if (this.target) {
      if (this.target instanceof Character) {
        this.target.removeAttacker(this);
      }
      if (this.removetarget_callback) this.removetarget_callback(this.target.id);
      this.target = null;
    }
  }
  onRemoveTarget(callback) {
    this.removetarget_callback = callback;
  }

  /**
   * Returns true if this character has a current attack target.
   * @returns {Boolean} Whether this character has a target.
   */
  hasTarget() {
    return !(this.target === null);
  }

  canReachTarget() {
      return this.canReach(this.target);
  }

  canInteract(entity) {
      return this.isNextTooEntity(entity) && this.isFacingEntity(entity);
  }

  canReach(entity) {
    const ts = G_TILESIZE;

    if (this.attackRange === 1)
      return this.canInteract(entity);

    if (this.attackRange > 1)
    {
      return this.isWithinDistEntity(entity, this.attackRange * G_TILESIZE);
    }
    return false;
  }

  clearTarget() {
    this.target = null;
  }

/*******************************************************************************
 * END - Target Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - State Functions.
 ******************************************************************************/

  hasWeapon() {
      return false;
  }

  /**
   *
   */
  /*dead() {
    this.isDead = true;
    this.isDying = false;
    this.forceStop();
    this.freeze = true;
  },*/

  die(attacker) {
    const self = this;

    console.info("character, die: called.");
    this.forceStop();
    //try { throw new Error(); } catch(err) { console.info(err.stack); }
    this.removeTarget();
    //this.isDying = true;
    this.isDead = true;
    this.freeze = true;
    clearTimeout(this.moveTimeout);

    this.removeAttackers();
    this.endEffects();

    if (this.death_callback) {
      this.death_callback(attacker);
    }
  }

  endEffects() {
    for (const skilleffect of this.activeEffects)
    {
      skilleffect.endEffects();
    }
    this.activeEffects = [];
  }

  /*dying() {
    this.isDead = false;
    this.isDying = true;
  },*/

/*******************************************************************************
 * END - State Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Misc Functions.
 ******************************************************************************/

  onRemove(callback) {
    this.remove_callback = callback;
  }

  canMove() {
    if (this.isDead === false && this.moveCooldown.isOver()) {
      return true;
    }
    return false;
  }

  clean() {
    this.forEachAttacker(function(attacker) {
      attacker.disengage();
      attacker.idle();
    });
  }

/*******************************************************************************
 * END - Misc Function.
 ******************************************************************************/

}

export default Character;
