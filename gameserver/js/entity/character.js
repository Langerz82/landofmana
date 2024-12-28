var EntityMoving = require("./entitymoving"),
  Messages = require("../message"),
  Timer = require("../timer"),
  Transition = require("../transition");

module.exports = Character = EntityMoving.extend({
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

    // Modes
    this.isDead = false;
    this.isDying = false;

    this.attackingMode = false;
    this.followingMode = false;
    this.engagingPC = false;



    this.observeTimer = new Timer(4096);

    this.step = 0;

    this.orientation = this.setRandomOrientation();

    // Pathing
    this.movement = new Transition(this);

    this.path = null;
    this.newDestination = null;
    this.adjacentTiles = {};

    // Health
    this.stats = {};
    this.stats.hp = 0;
    this.stats.hpMax = 0;
    this.stats.ep = 0;
    this.stats.epMax = 0;

    this.attackCooldown = null;
    this.moveCooldown = null;

    this.attackerLevel = 0;
    this.defenderLevel = 0;
    this.moveLevel = 0;

    this.armor = null;
    this.weapon = null;

    this.freeze = false;

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

    this.neighboursUpdated  = false;
  },

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

/*******************************************************************************
 * END - Combat Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Attack Functions.
 ******************************************************************************/

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
    if (Object.keys(this.attackers).length == 0) {
      return false;
    }
    return this.attackers.hasOwnProperty(character.id) &&
      this.attackers[character.id] === character;
  },

  isAttacked: function() {
    return !(Object.keys(this.attackers).length == 0);
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
    if (this.isDead == false && this.attackCooldown.isOver()) {
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

/*******************************************************************************
 * END - Attack Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Target Functions.
 ******************************************************************************/

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

  canInteract: function (entity) {
    return this.isInReach(entity.x, entity.y);
  },

  canReach: function(entity) {
    var ts = G_TILESIZE;

    if (this.attackRange === 1)
      return this.isInReach(entity.x, entity.y, this.orientation);

    if (this.attackRange > 1)
    {
      var range = ~~(Utils.realDistance([entity.x,entity.y],[this.x,this.y])/G_TILESIZE);
      return range <= this.attackRange;
    }
    return false;
  },

  clearTarget: function () {
    this.target = null;
  },

  /**
   * Sets this character's attack target. It can only have one target at any time.
   * @param {Character} character The target character.
   */
  setTarget: function(character) {
    if (character == null) {
      this.removeTarget();
      return;
    }
    if (this.target !== character) { // If it's not already set as the target
      if (this.hasTarget()) {
        this.removeTarget(); // Cleanly remove the previous one
      }
      this.unconfirmedTarget = null;
      this.target = character;
      if (this.settarget_callback) {
        var targetName = this.target.spriteName;
        if (MobData.Kinds[character.kind] && targetName)
          this.settarget_callback(character, targetName, character.level);
      }
    } else {
      console.info(character.id + " is already the target of " + this.id);
    }
  },

  /**
   * Changes the character's orientation so that it is facing its target.
   */
  lookAt: function(target) {
    if (target) {
      this.orientation = this.getOrientationTo(target);
    }
  },

  clearTarget: function() {
    this.target = null;
  },

  /*turnTo: function(orientation) {
    this.orientation = orientation;
    this.idle();
  },*/

/*******************************************************************************
 * END - Target Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - State Functions.
 ******************************************************************************/

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
    console.warn("CHARACTER DIED!!!!!!!!!!!!!!!!!!!!!")
    this.forceStop();
    //try { throw new Error(); } catch(err) { console.info(err.stack); }
    this.removeTarget();
    this.isDying = true;
    this.isDead = true;
    if (this.death_callback) {
      this.death_callback();
    }
  },

  dying: function() {
    this.isDead = false;
    this.isDying = true;
  },

/*******************************************************************************
 * END - State Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Stat Functions.
 ******************************************************************************/

  resetHP: function () {
    var max = (typeof(this.getHPMax) === "function") ? this.getHPMax() : this.stats.hpMax;
    this.stats.hpMax = max;
    var diff= max - this.stats.hp;
    this.stats.hp = max;
    //try { throw new Error(); } catch(err) { console.info(err.stack); }
    msg = new Messages.ChangePoints(this, diff, 0);
    this.map.entities.pushNeighbours(this, msg);
  },

  resetEP: function () {
    var max = (typeof(this.getEPMax) === "function") ? this.getEPMax() : this.stats.epMax;
    this.stats.epMax = max;
    this.stats.ep = max;
  },

  setHP: function (val) {
    val = val || (typeof(this.getHPMax) === "function") ? this.getHPMax() : this.stats.hpMax;
    this.stats.hp = val;
  },

  setEP: function (val) {
    val = val || (typeof(this.getEPMax) === "function") ? this.getEPMax() : this.stats.epMax;
    this.stats.ep = val;
  },

  onDamage: function (attacker, hpMod, epMod, crit, effects) {
    hpMod = hpMod || 0;
    epMod = epMod || 0;
    crit = crit || 0;
    effects = effects || 0;

    if (hpMod > 0)
      this.addAttacker(attacker);

    if (hpMod != 0)
      this.stats.hp = Utils.clamp(0, this.stats.hpMax, (this.stats.hp-hpMod));
    if (epMod != 0)
      this.stats.ep = Utils.clamp(0, this.stats.epMax, (this.stats.ep-epMod));

    var msg = new Messages.Damage([attacker, this, -hpMod, -epMod, crit, effects]);
    this.map.entities.pushNeighbours(attacker, msg);
  },

  canMove: function() {
    if (this.isDead == false && this.moveCooldown.isOver()) {
      return true;
    }
    return false;
  },

  modHealthBy: function(val) {
    var hp = this.stats.hp,
      max = this.stats.hpMax;

    this.stats.hp = Utils.clamp(0, max, hp+val);
    return this.changePoints(val, 0);
  },

  modEnergyBy: function(val) {
    var ep = this.stats.ep,
      max = this.stats.epMax;

    this.stats.ep = Utils.clamp(0, max, ep+val);
    return this.changePoints(0, val);
  },

  hasFullHealth: function() {
    return this.stats.hp === this.stats.hpMax;
  },

  hasFullEnergy: function() {
    return this.stats.ep === this.stats.epMax;
  },

  changePoints: function(modhp, modep) {
    return new Messages.ChangePoints(this, modhp, modep);
  },

  setMaxHpMax: function(hp) {
    this.stats.hpMax = hp;
    this.stats.hp = hp;
  },

  setAttackRange: function(range) {
    this.attackRange = range * G_TILESIZE;
  },

/*******************************************************************************
 * END - Stat Functions.
 ******************************************************************************/

/*******************************************************************************
 * BEGIN - Misc Functions.
 ******************************************************************************/

  /*attack: function() {
    return new Messages.Attack(this.id, this.target.id);
  },*/

  clean: function() {
    this.forEachAttacker(function(attacker) {
      attacker.disengage();
      attacker.idle();
    });
  },

  onRemove: function(callback) {
    this.remove_callback = callback;
  },

  getClosestSpot: function(dest, adjStart, adjEnd) {
    adjStart = adjStart || 1;
    adjEnd = adjEnd || 1;
    var poss = this.getSpotsAroundFrom(dest, adjStart, adjEnd);
    var sx = this.x, sy = this.y;

    for (var p of poss)
    {
      if (this.map.isColliding(p.x, p.y))
        poss.splice(poss.indexOf(p),1);
    }

    //if (!this.neighboursUpdated) {
      var entities = this.map.entities.getCharactersAround(dest, adjEnd);
      //this.neighboursUpdated = true;
    //}

    //var entities = this.map.entities.getCharactersAround({x:x2,y:y2}, 6);
    //console.info("entities: "+JSON.stringify(entities));
    var ts = G_TILESIZE;
    var tsh = ts >> 1;

    var x, y, tx, ty;
    for (var p of poss) {
      x = p.x;
      y = p.y;
      for(var e2 of entities) {
        if (!e2 || this == e2)
          continue;
        tx = e2.x;
        ty = e2.y;

        if (e2.isMovingPath()) {
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

    if (poss.length == 0)
      return null;

    poss.sort(function(a,b) { return a.d-b.d; });

    return {x: poss[0].x, y: poss[0].y};
  },

  followAttack: function(entity) {
    var found = false;

    var spot = this.getClosestSpot(entity, 1, this.attackRange);

    if (spot && spot.x && spot.y)
      this.moveTo_(spot.x, spot.y);
  },

/*******************************************************************************
 * END - Misc Functions.
 ******************************************************************************/

});


module.exports = Character;
