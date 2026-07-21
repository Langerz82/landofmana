import Character from './character/character.js';
import MobCombat from './components/mobcombat.js';
import MobAggro from './components/mobaggro.js';
import MobRespawn from './components/mobrespawn.js';
import MobAIState from './components/mobaistate.js';
import Utils from '../utils.js';
import { Types } from '../common.js';
import MobData from '../data/mobdata.js';
import { mobState, G_TILESIZE } from '../constants.js';

// mob.js was split into entity/components/mobaggro.js (hate-list tracking
// + aggro decisions), entity/components/mobrespawn.js (boss/loot/drop
// setup + the death -> respawn -> return-to-spawn lifecycle), and
// entity/components/mobaistate.js (roam/move-tick AI state hooks), plus
// dropGold/getXP moving into the pre-existing entity/components/
// mobcombat.js. Every extracted method keeps a thin delegate here (see
// below) so no external call site (callbacks/mobcallback.js, mobai.js,
// packets/combathandler.js, etc.) had to change. Methods that call
// super.X() (onDamage, canReach, followAttack, die) can't be delegate-
// wrapped that way and stay directly on Mob, same reasoning as Player's
// onDamage/modHp/modEp.
class Mob extends Character {
    constructor(id, kind, x, y, map, mobArea) {

      //console.info("map.index"+map.index);
    	super(id, Types.EntityTypes.MOB, kind, x, y, map);

      this.world = this.map.entities.world;

    	//console.info("constructor x:"+x+",y:"+y);
    	//console.info("this.kind="+this.kind);

      this.combat = new MobCombat(this);
      this.aggro = new MobAggro(this);
      this.respawner = new MobRespawn(this);
      this.aiHandler = new MobAIState(this);

    	this.data = MobData.Kinds[this.kind];
	    //console.info(JSON.stringify(this.data));

      if (this.data.level > 0)
      	this.level = this.data.level;
      else
      {
      	if (mobArea)
      		this.level = Utils.randomRangeInt(Math.max(this.data.minLevel, mobArea.minLevel), Math.min(this.data.maxLevel, mobArea.maxLevel));
      	else
      		this.level = Utils.randomRangeInt(this.data.minLevel, this.data.maxLevel);
      }
      // NOTE: was `this.level = this.level;` -- a no-op self-assignment
      // left over from a previous edit (this.level is already fully set by
      // whichever branch above ran). Removed rather than "fixed", since
      // there's nothing for it to do.

      const tx=Number(x), ty=Number(y);
      this.spawnX = tx;
      this.spawnY = ty;

      //this.stats = {};
      this.stats.attack = this.data.attack * this.level;
      this.stats.defense = this.data.defense * this.level;
      this.stats.hpMax = Math.max(this.data.hp * this.level - 40,1);
      //console.info("this.data.hp="+this.data.hp);
      //this.stats.hpMax = this.stats.hp;
      //console.info("this.stats.hpMax="+this.stats.hpMax);
      this.stats.epMax = this.data.ep * this.level;
      //this.stats.epMax = this.stats.ep;

      this.stats.xp = this.data.xp * this.level;
      //this.setHpMax();
      //this.setEpMax();

      this.stats.mod = {
        attack: 0,
        defense: 0,
        damage: 0,
        health: 0
      };

      this.hatelist = [];
      this.hateCount = 0;
      //this.tankerlist = [];

      this.respawnTimeout = null;
      this.returnTimeout = null;
      this.isDead = false;

      this.aggroRange = this.data.aggroRange;
      this.attackRange = this.data.attackRange;
      this.isAggressive = this.data.isAggressive;

      this.moveSpeed = this.data.moveSpeed;
      this.setMoveRate(this.moveSpeed);
      //this.tick = this.data.tick;

      this.setAttackRate(this.data.attackRate);
      this.setAggroRate(this.data.reactionDelay >> 2);

      this.setMoveAI(Utils.randomRangeInt(50,150));

      this.setItemLoot();

      this.drops = {};
      this.questDrops = {};
      this.setDrops();

      this.spawnDelay = this.data.respawn;
      this.canCall = true;

      this.orientation = Utils.randomOrientation();

      this.isReturning = false;
      this.target = null;
      this.droppedItem = false;

      this.isBlocking = false;

      this.freeze = false;

      this.setAiState(mobState.IDLE);

      this.effects = {};

      this.activeEffects = [];

      this.damageCount = {};
      this.dealtCount = {};

      this.creatureMulti = 1;

      this.resetHp();
      this.resetEp();
    }

    // --- Aggro / hate-list delegates (entity/components/mobaggro.js) ---
    createBoss(multi) {
        return this.respawner.createBoss(multi);
    }

    getXP() {
      return this.combat.getXP();
    }

    setMoveAI(duration) {
        return this.aiHandler.setMoveAI(duration);
    }
    canMoveAI() {
        return this.aiHandler.canMoveAI();
    }
    resetMoveAI(time) {
        return this.aiHandler.resetMoveAI(time);
    }

    setAggroRate(duration) {
        return this.aggro.setAggroRate(duration);
    }
    canAggro() {
        return this.aggro.canAggro();
    }
    resetAggro(time) {
        return this.aggro.resetAggro(time);
    }

    onKilled(callback) {
      this.on_killed_callback = callback;
    }

    /*onDeath(callback) {
      this.on_death_callback = callback;
    },*/

    onDamage(attacker, hpMod, epMod, crit, effects) {
      const hp = this.stats.hp;
      //var dmgRatio = (hpMod / this.stats.hpMax);
      //log.info("dmgRatio: "+dmgRatio)

      let hpDiff = this.stats.hp;

      super.onDamage(attacker, hpMod, epMod, crit, effects);

      hpDiff -= this.stats.hp;
      if (hpDiff > 0) {
        //console.info ("onDamage hpDiff:"+hpDiff)
        this.onHitByEntity(attacker, hpDiff);
      }

      if (this.stats.hp <= 0)
      {
        this.die(attacker);
      }
    }

    destroy() {
        this.isDead = true;
        this.endEffects();
        this.forgetEveryone();
        //this.clearAttackerRefs();
        //this.removeAttackers();
        this.clearTarget();

        this.resetBars();
        this.resetPosition();
        this.handleRespawn();

        this.damageCount = {};
        this.dealtCount = {};
    }

    onHitEntity(target, dmg) {
      if (!this.dealtCount.hasOwnProperty(target.id))
        this.dealtCount[target.id] = 0;
      this.dealtCount[target.id] += dmg;
    }

    onHitByEntity(target, dmg) {
      if (!this.damageCount.hasOwnProperty(target.id))
        this.damageCount[target.id] = 0;
      this.damageCount[target.id] += dmg;
    }

    resetBars() {
      this.stats.hp = this.stats.hpMax;
      this.stats.ep = this.stats.epMax;
    }

    /*receiveDamage(points, playerId) {
        this.stats.hp -= points;
        if (this.stats.hp < 0) {
          this.stats.hp = 0;
        }
    },*/

    hates(entity) {
        return this.aggro.hates(entity);
    }

    increaseHateFor(entity, points) {
        return this.aggro.increaseHateFor(entity, points);
    }

    getMostHated() {
        return this.aggro.getMostHated();
    }

    forgetPlayer(playerId) {
        return this.aggro.forgetPlayer(playerId);
    }

    forgetEveryone() {
        return this.aggro.forgetEveryone();
    }

    // --- Respawn / spawn-lifecycle delegates (entity/components/mobrespawn.js) ---
    execRespawn() {
      return this.respawner.execRespawn();
    }

    handleRespawn() {
        return this.respawner.handleRespawn();
    }

    onRespawn(callback) {
        return this.respawner.onRespawn(callback);
    }

    respawn() {
      return this.respawner.respawn();
    }

    resetBehaviour() {
      return this.respawner.resetBehaviour();
    }

    resetPosition() {
    	  return this.respawner.resetPosition();
    }

    returnToSpawn() {
        return this.respawner.returnToSpawn();
    }

    onMove(callback) {
        this.moveCallback = callback;
    }

    move(x, y) {
        this.setPosition(x, y);
        //this.orientation = Utils.getOrientationFromLastMove(this);
        if (this.moveCallback) {
            this.moveCallback(this);
        }
    }

    distanceToPos(x, y) {
    	 return Utils.distanceTo(this.x, this.y, x, y);
    }

    setItemLoot() {
      return this.respawner.setItemLoot();
    }

    setDrops() {
      return this.respawner.setDrops();
    }

   Speech(key, value) {
		/*if (this.data.isSpeech === 0)
			return;

   	   	if (!value)
			value = Utils.random(MobSpeechData.Speech[key].length-1);
		return new Messages.Speech(this, key, value);*/
    return null;
   }

    getState() {
      //console.info("mob_state:"+JSON.stringify(basestate.concat(state)));
      return this._getBaseState().concat([this.level, this.stats.hp, this.stats.hpMax]);
    }

    // --- AI-state delegates (entity/components/mobaistate.js) ---
    setAiState(state) {
      return this.aiHandler.setAiState(state);
    }

    die(attacker) {
      const self = this;

      //console.info("Entity is dead");

      this.map.entities.sendBroadcast(this.despawn());

      // SIMPLIFY/PERF: `attackers` is a Map now (see character.js
      // constructor) -- underscore's _.each() reads plain-object keys via
      // Object.keys(), which is always empty for a Map, so the old
      // `_.each(this.attackers, ...)` here would have silently iterated
      // zero attackers after that change. Iterating .values() directly
      // avoids that trap entirely.
      for (const attacker of this.attackers.values()) {
        if (self.on_killed_callback) {
          self.on_killed_callback(attacker, self.damageCount[attacker.id]);
        }
        attacker.onKillEntity(self, self.damageCount[attacker.id],
          self.dealtCount[attacker.id]);
      }

      super.die(attacker);

      this.destroy();
    }

    onKillEntity(attacker) {

    }

    canReach(entity) {
      const o = this.orientation;
      this.lookAtEntity(entity);
      const res = super.canReach(entity);
      this.orientation = o;
      return res;
    }

    dropGold() {
      return this.combat.dropGold();
    }

    returnedToSpawn() {
      return this.respawner.returnedToSpawn();
    }

    handleMobHate(tEntity, hatePoints) {
        return this.aggro.handleMobHate(tEntity, hatePoints);
    }

    aggroPlayer(player, dmg) {
      return this.aggro.aggroPlayer(player, dmg);
    }

    goRoam(pos) {
      return this.aiHandler.goRoam(pos);
    }

    canRoam() {
      return this.aiHandler.canRoam();
    }

    followAttack(entity) {
      if (entity.isMoving()) {
        const pos = this.nextTile(entity.x,entity.y,entity.orientation);
        pos[0] = Math.floor(pos[0]/G_TILESIZE) * G_TILESIZE;
        pos[1] = Math.floor(pos[1]/G_TILESIZE) * G_TILESIZE;
        const obj = {x: pos[0], y: pos[1]};
        super.followAttack(obj);
      }
      else {
        super.followAttack(entity);
      }
    }
}

export default Mob;
