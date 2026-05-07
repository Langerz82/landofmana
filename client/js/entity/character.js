
define(['./entitymoving', '../transition', '../timer'], function(EntityMoving, Transition, Timer) {

  var Character = EntityMoving.extend({
    init: function(id, type, mapIndex, kind) {
        var self = this;

        this._super(id, type, mapIndex, kind);

        this.orientation = Types.Orientations.DOWN;

        // Speeds
        this.atkSpeed = 64;

        this.setAttackRate(64);

        // Combat
        this.target = null;
        this.unconfirmedTarget = null;

        // Health
        this.stats = {};
        this.stats.hp = 0;
        this.stats.hpMax = 0;
        this.stats.ep = 0;
        this.stats.epMax = 0;

        // Modes
        this.isDying = false;
        this.isDead = false;
        this.attackingMode = false;
        this.followingMode = false;
        this.inspecting = null;

        this.isStunned = false;
        this.isAttacking = false;

        this.isReadyToMove = true;

        this.updateCharacter = false;

        this.requestMove = false;

        this.freeze = false;
        this.flagAttacking = false;

        this.observeTimer = new Timer(4096);

        //this.sprite = [];

        this.attackers = {};
    },

/*******************************************************************************
 * BEGIN - Stat Functions.
 ******************************************************************************/
    resetHP: function () {
      var max = this.stats.hpMax;
      this.stats.hp = max;
    },

    resetEP: function () {
      var max = this.stats.epMax;
      this.stats.ep = max;
    },

    setHP: function (val) {
      val = val || this.stats.hpMax;
      this.stats.hp = val;
    },

    setEP: function (val) {
      val = val || this.stats.epMax;
      this.stats.ep = val;
    },

    setMaxHP: function(hp) {
        this.stats.hpMax = hp;
        this.stats.hp = hp;
    },

    setMaxEP: function(ep) {
        this.stats.epMax = ep;
        this.stats.ep = ep;
    },

    modHealthBy: function (points) {
      this.stats.hp = (this.stats.hp+points).clamp(0, this.stats.hpMax);

      if(this.stats.hp == 0) {
          this.die();
      }
    },

    modEnergyBy: function (points) {
      this.stats.ep = (this.stats.ep+points).clamp(0, this.stats.epMax);
    },

    setAttackRange: function(range) {
        this.attackRange = range;
    },

/*******************************************************************************
 * END - Stat Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Attack Functions.
 ******************************************************************************/

    hit: function(orientation) {
        var self = this;
        this.setOrientation(orientation || this.orientation);
        this.fsm = "ATTACK";
        //this.freeze = true;
        this.animate("atk", this.atkSpeed, 1, function () {
          self.fsm = "IDLE";
          //self.freeze = false;
          self.idle(self.orientation);
        });
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
        this.followingMode = false;
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
        if(this.isDead === false && this.attackCooldown.isOver()) {
            return true;
        }
        return false;
    },

    setAttackRate: function(rate) {
        this.attackCooldown = new Timer(rate);
    },

/*******************************************************************************
 * END - Attack Functions.
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

    onRemoveTarget: function(callback){
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
 * BEGIN - Orientation Functions.
 ******************************************************************************/

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
           var orientation = this.getOrientationTo([entity.x, entity.y]);
           this.setOrientation(orientation);
       }
       if (typeof(this.animate) === "function" && !this.hasAnimation('atk'))
         this.idle(this.orientation);
       return this.orientation;
    },

/*******************************************************************************
 * END - Orientation Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Misc Function.
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
    dead: function () {
      this.isDead = true;
      this.isDying = false;
      this.forceStop();
      this.freeze = true;
    },

    die: function() {
        this.forceStop();
        this.removeTarget();
        this.isDying = true;
        this.freeze = true;
        clearTimeout(this.moveTimeout);

        if(this.death_callback) {
            this.death_callback();
        }
    },

    follow: function(entity, min, max) {
      min = min || 1;
      max = max || this.attackRange;

      var spot = this.getClosestSpot(entity, min, max);

      if (spot && spot.x && spot.y) {
        this.moveTo_(spot.x, spot.y);
        return true;
      }
      return false;
    },

    // Observe used for zoning.
    canObserve: function () {
      if (this.observeTimer.isOver())
        return true;
      return false;
    },

/*******************************************************************************
 * END - Misc Function.
 ******************************************************************************/

  });

  return Character;
});
