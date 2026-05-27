var EntityMoving = require("./entitymoving"),
  Messages = require("../message"),
  Timer = require("../timer"),
  Transition = require("../transition");

module.exports = Character = EntityMoving.extend({
  init: function(id, type, kind, x, y, map) {
    var self = this;

    this._super(id, type, kind, x, y, map);

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

    this.orientation = this.setRandomOrientation();

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
  },

/*******************************************************************************
 * BEGIN - Stat Functions.
 ******************************************************************************/
   getHpMax: function () {
     return (this.stats) ? this.stats.hpMax : 0;
   },

   getEpMax: function () {
     return (this.stats) ? this.stats.epMax : 0;
   },

  resetHp: function () {
    var max = this.getHpMax();
    this.stats.hpMax = max;
    var diff= max - this.stats.hp;
    this.stats.hp = max;
    //try { throw new Error(); } catch(err) { console.info(err.stack); }
    msg = new Messages.ChangePoints(this, diff, 0);
    this.map.entities.sendNeighbours(this, msg);
  },

  resetEp: function () {
    var max = this.getEpMax();
    this.stats.epMax = max;
    this.stats.ep = max;
  },

  setHp: function (val) {
    val = val || this.getHpMax();
    this.stats.hp = val;
  },

  setEp: function (val) {
    val = val || this.getEpMax();
    this.stats.ep = val;
  },

  setHpMax: function (val) {
    val = val || this.getHpMax();
    this.stats.hpMax = val;
    this.stats.hp = val;
  },

  setEpMax: function (val) {
    val = val || this.getEpMax();
    this.stats.epMax = val;
    this.stats.ep = val;
  },

  hasFullHealth: function() {
    return this.stats.hp === this.stats.hpMax;
  },

  hasFullEnergy: function() {
    return this.stats.ep === this.stats.epMax;
  },

  setAttackRange: function(range) {
    this.attackRange = range;
  },

  modHp: function(val) {
    var hp = this.stats.hp,
      max = this.stats.hpMax;

    this.stats.hp = Utils.clamp(0, max, hp+val);
    return this.changePoints(val, 0);
  },

  modEp: function(val) {
    var ep = this.stats.ep,
      max = this.stats.epMax;

    this.stats.ep = Utils.clamp(0, max, ep+val);
    return this.changePoints(0, val);
  },

  changePoints: function(modhp, modep) {
    return new Messages.ChangePoints(this, modhp, modep);
  },

  onDamage: function (attacker, hpMod, epMod, crit, effects) {
    hpMod = hpMod || 0;
    epMod = epMod || 0;
    crit = crit || 0;
    effects = effects || 0;

    if (this.invincible)
      return;

    var prevHP = this.stats.hp;

    if (hpMod > 0)
      this.addAttacker(attacker);

    if (hpMod !== 0)
      this.stats.hp = Utils.clamp(0, this.stats.hpMax, (this.stats.hp-hpMod));
    if (epMod !== 0)
      this.stats.ep = Utils.clamp(0, this.stats.epMax, (this.stats.ep-epMod));

    var msg = new Messages.Damage([attacker, this, -hpMod, -epMod, crit, effects]);
    this.map.entities.sendNeighbours(attacker, msg);
  },

/*******************************************************************************
 * END - Stat Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Combat Functions.
 ******************************************************************************/

  hit: function(orientation) {
    this.setOrientation(orientation);
    this.stop();
  },

  onAggro: function(callback) {
    this.aggro_callback = callback;
  },

  onCheckAggro: function(callback) {
    this.checkaggro_callback = callback;
  },

  checkAggro: function() {
    if (this.checkaggro_callback) {
      this.checkaggro_callback();
    }
  },

  aggro: function(character) {
    if (this.aggro_callback) {
      this.aggro_callback(character);
    }
  },

  onDeath: function(callback) {
    this.death_callback = callback;
  },

  hurt: function() {
    var self = this;

    this.stopHurting();
    this.sprite = this.hurtSprite;
    this.hurting = setTimeout(this.stopHurting.bind(this), 75);
  },

  stopHurting: function() {
    this.sprite = this.normalSprite;
    clearTimeout(this.hurting);
  },

  /**
   * Makes the character attack another character. Same as Character.follow but with an auto-attacking behavior.
   * @see Character.follow
   */
  engage: function(character) {
    this.attackingMode = true;
    this.setTarget(character);
    //this.follow(character);
  },

  disengage: function() {
    this.attackingMode = false;
    this.removeTarget();
  },

  /**
   * Returns true if the character is currently attacking.
   */
  isAttacking: function() {
    return this.attackingMode;
  },

  /**
   * Returns true if this character is currently attacked by a given character.
   * @param {Character} character The attacking character.
   * @returns {Boolean} Whether this is an attacker of this character.
   */
  isAttackedBy: function(character) {
    if (Object.keys(this.attackers).length === 0) {
      return false;
    }
    return this.attackers.hasOwnProperty(character.id) &&
      this.attackers[character.id] === character;
  },

  isAttacked: function() {
    return !(Object.keys(this.attackers).length === 0);
  },

  /**
   * Registers a character as a current attacker of this one.
   * @param {Character} character The attacking character.
   */
  addAttacker: function(character) {
    if (!this.isAttackedBy(character)) {
      this.attackers[character.id] = character;
    }
  },

  /**
   * Unregisters a character as a current attacker of this one.
   * @param {Character} character The attacking character.
   */
  removeAttacker: function(character) {
    if (!this.isAttacked()) {
      return;
    }
    delete this.attackers[character.id];
  },

  removeAttackers: function() {
    this.attackers = {};
  },

  clearAttackerRefs: function () {
    var self = this;
    this.forEachAttacker(function (c) {
      c.removeAttacker(self);
    });
  },

  /**
   * Loops through all the characters currently attacking this one.
   * @param {Function} callback Function which must accept one character argument.
   */
  forEachAttacker: function(callback) {
    _.each(this.attackers, function(attacker) {
      callback(attacker);
    });
  },

  /**
   * Marks this character as waiting to attack a target.
   * By sending an "attack" message, the server will later confirm (or not)
   * that this character is allowed to acquire this target.
   *
   * @param {Character} character The target character
   */
  waitToAttack: function(character) {
    this.unconfirmedTarget = character;
  },

  /**
   * Returns true if this character is currently waiting to attack the target character.
   * @param {Character} character The target character.
   * @returns {Boolean} Whether this character is waiting to attack.
   */
  isWaitingToAttack: function(character) {
    return (this.unconfirmedTarget === character);
  },

  canAttack: function() {
    if (this.isDead === false && this.attackCooldown.isOver()) {
      return true;
    }
    return false;
  },

  setAttackRate: function(rate) {
    this.attackCooldown = new Timer(rate);
  },

  createAttackLink: function(target)
  {
      if (this.hasTarget())
      {
          this.removeTarget();
      }
      this.setTarget(target);

      target.addAttacker(this);
      this.addAttacker(target);
  },

  followAttack: function(entity) {
    var found = false;

    var spot = this.getClosestSpot(entity, 1, this.attackRange);

    if (spot && spot.x && spot.y)
      this.moveTo_(spot.x, spot.y);
  },

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
   setTarget: function(character) {
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
   },

   onSetTarget: function(callback) {
     this.settarget_callback = callback;
   },

   showTarget: function(character) {
     if(this.inspecting !== character && character !== this){
       this.inspecting = character;
       if(this.settarget_callback && this.target){
         this.settarget_callback(character, true);
       }
     }
   },

  /**
   * Removes the current attack target.
   */
  removeTarget: function() {
    var self = this;

    if (this.target) {
      if (this.target instanceof Character) {
        this.target.removeAttacker(this);
      }
      if (this.removetarget_callback) this.removetarget_callback(this.target.id);
      this.target = null;
    }
  },
  onRemoveTarget: function(callback) {
    this.removetarget_callback = callback;
  },

  /**
   * Returns true if this character has a current attack target.
   * @returns {Boolean} Whether this character has a target.
   */
  hasTarget: function() {
    return !(this.target === null);
  },

  canReachTarget: function() {
      return this.canReach(this.target);
  },

  canInteract: function (entity) {
    return this.isInReach(entity.x, entity.y);
  },

  canReach: function(entity) {
    var ts = G_TILESIZE;

    if (this.attackRange === 1)
      return this.isInReach(entity.x, entity.y, this.orientation);

    if (this.attackRange > 1)
    {
      var range = ~~(Utils.realDistance([entity.x,entity.y],[this.x,this.y])/ts);
      return range <= this.attackRange;
    }
    return false;
  },

  clearTarget: function () {
    this.target = null;
  },

/*******************************************************************************
 * END - Target Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - State Functions.
 ******************************************************************************/

  onDeath: function(callback) {
      this.death_callback = callback;
  },

  hasWeapon: function() {
      return false;
  },

  /**
   *
   */
  /*dead: function () {
    this.isDead = true;
    this.isDying = false;
    this.forceStop();
    this.freeze = true;
  },*/

  die: function(attacker) {
    var self = this;

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
  },

  endEffects: function () {
    for (var skilleffect of this.activeEffects)
    {
      skilleffect.endEffects();
    }
    this.activeEffects = [];
  },

  /*dying: function() {
    this.isDead = false;
    this.isDying = true;
  },*/

/*******************************************************************************
 * END - State Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Misc Functions.
 ******************************************************************************/

  onRemove: function(callback) {
    this.remove_callback = callback;
  },

  canMove: function() {
    if (this.isDead === false && this.moveCooldown.isOver()) {
      return true;
    }
    return false;
  },

  clean: function() {
    this.forEachAttacker(function(attacker) {
      attacker.disengage();
      attacker.idle();
    });
  },

/*******************************************************************************
 * END - Misc Function.
 ******************************************************************************/

});


module.exports = Character;
