import Character from './character.js';
import Messages from '../message.js';
import MobCombat from './components/mobcombat.js';
import MobArea from '../area/mobarea.js';
import Utils from '../utils.js';
import Timer from '../timer.js';
import { Types, ItemTypes } from '../common.js';
import _ from 'underscore';
import MobData from '../data/mobdata.js';
import ItemData from '../data/itemdata.js';
import ItemLootData from '../data/itemlootdata.js';
import { mobState, G_TILESIZE } from '../main.js';
import Player from './player.js';

/* global _, Player */

class Mob extends Character {
    constructor(id, kind, x, y, map, mobArea) {

      //console.info("map.index"+map.index);
    	super(id, Types.EntityTypes.MOB, kind, x, y, map);

      this.world = this.map.entities.world;

    	//console.info("constructor x:"+x+",y:"+y);
    	//console.info("this.kind="+this.kind);

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
      this.level = this.level;

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

      this.combat = new MobCombat(this);
    }

    createBoss(multi) {
        this.creatureMulti = multi;
        this.stats.hp *= multi;
        this.stats.hpMax *= multi;
        this.spawnDelay *= multi;
        this.resetHp();

        for (const kind in this.drops) {
          if (ItemTypes.isEquipment(kind))
            this.drops[kind] *= multi;
        }
    }

    getXP() {
      return this.data.xp *
        this.data.attackMod *
        this.data.defenseMod *
        this.data.attackRateMod *
        this.data.hpMod *
        this.level *
        this.creatureMulti;
    }

    setMoveAI(duration)
    {
    	this.moveAICooldown = new Timer(duration);
    }
    canMoveAI()
    {
    	return this.moveAICooldown.isOver();
    }
    resetMoveAI(time)
    {
    	this.moveAICooldown.lastTime = time;
    }

    setAggroRate(duration)
    {
    	this.aggroCooldown = new Timer(duration);

    }
    canAggro()
    {
    	return this.aggroCooldown.isOver();
    }
    resetAggro(time)
    {
    	this.aggroCooldown.lastTime = time;
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
        return _.any(this.hatelist, function(obj) {
            return obj.entity === entity;
        });
    }

    // PERF: this used to call this.hates(entity) (a linear scan of
    // hatelist) and then, when it returned true, run a second linear scan
    // via _.detect() to find that same entry. hatelist is small (bounded by
    // however many characters are currently attacking this one mob) so this
    // was never a hot-path emergency, but there's no reason to scan it
    // twice for one lookup -- a single _.detect() covers both the "does it
    // exist" and "get the entry" cases.
    increaseHateFor(entity, points) {
        const existing = _.detect(this.hatelist, function (obj) {
            return obj.entity === entity;
        });
        if (existing) {
            existing.hate += points;
        }
        else {
            this.hatelist.push({ entity: entity, hate: points });
        }

        if (this.returnTimeout) {
            // Prevent the mob from returning to its spawning position
            // since it has aggroed a new player
            clearTimeout(this.returnTimeout);
            this.returnTimeout = null;
        }
    }

    // FIX: _.sortBy sorts ascending, so sorted[0] was the LEAST-hated
    // entity, not the most-hated one -- the opposite of what this method's
    // name and its only caller (handleMobHate, picking an aggro target)
    // need. Every mob was consistently attacking the weakest-threat player
    // instead of whoever had actually generated the most hate. Taking the
    // last element of the ascending sort gives the highest-hate entry.
    getMostHated(hateRank) {
        let i, playerId,
            sorted = _.sortBy(this.hatelist, function(obj) { return obj.hate; }),
            size = _.size(this.hatelist);

        if(sorted && sorted.length > 0) {
            return sorted[sorted.length - 1].entity;
        }
        return null;
    }

    forgetPlayer(playerId) {
        this.hatelist = _.reject(this.hatelist, function(obj) { return obj.entity.id === playerId; });
        //this.tankerlist = _.reject(this.tankerlist, function(obj) { return obj.id === playerId; });

        if(this.hatelist.length === 0 /*|| this.tankerlist === 0*/) {
            this.returnToSpawn();
        }
    }

    forgetEveryone() {
        this.hatelist = [];
        this.damageCount = {};
        this.dealtCount = {};
        this.clearAttackerRefs();
        this.removeAttackers();
    }

    execRespawn() {
      if (this.respawnCallback) {
          this.respawnCallback();
      }
      //this.respawn();
    }

    handleRespawn() {
        this.respawnTime = Date.now();
        this.mobAI.mobsToRespawn.push(this);
    }

    onRespawn(callback) {
        this.respawnCallback = callback;
    }

    respawn() {
      if (this.area && this.area instanceof MobArea) {
        const	pos = this.map.entities.spaceEntityRandomApart(3, this.area._getRandomPositionInsideArea.bind(this.area,100));
        console.warn("mob, handleRespawn - id:"+this.id+", pos:"+JSON.stringify(pos));
        if (pos) {
          this.setPosition(pos.x, pos.y);
        }
      }
      this.spawnX = this.x;
      this.spawnY = this.y;
      this.isDead = false;
      this.droppedItem = false;
      this.invincible = false;
      this.resetBehaviour();
      this.activeEffects = [];
      this.map.entities.sendNeighbours(this, new Messages.Spawn(this));
    }

    resetBehaviour() {
      this.disengage();
      this.forceStop();
      this.forgetEveryone();
      this.setAiState(mobState.IDLE);
      this.freeze = false;
    }

    resetPosition() {
    	  ///var x=this.spawnX, y=this.spawnY;
        this.setPosition(this.spawnX, this.spawnY);
        //var msg = new Messages.Move(this, this.orientation, false, this.x, this.y);
        //this.map.entities.sendNeighbours(this, msg);
    }

    returnToSpawn() {
        //var self = this;

        if (this.aiState === mobState.RETURNING)
          return;

        this.forceStop();
        this.setAiState(mobState.RETURNING);

        if (this.hasTarget())
          this.clearTarget();
        this.forgetEveryone();
        this.invincible = true;
        this.freeze = false;
        if (this.x === this.spawnX && this.y === this.spawnY) {
          this.returnedToSpawn();
          return;
        }
        this.go(this.spawnX, this.spawnY);
        //this.returningToSpawn = true;
        //console.info("returnToSpawn - Path: "+JSON.stringify(this.path))
        //console.info("returnToSpawn - mob.id: "+this.id);
        if (!this.path || this.path.length === 0) {
          try { throw new Error(); } catch(err) { console.error(err.stack); }
          this.returnedToSpawn();
        }
        //this.setAiState(mobState.RETURNING);
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
      this.loot = {};
      this.lootTotal = 0;
      for (const lootId in ItemLootData.ItemLoot)
      {
        const loot = ItemLootData.ItemLoot[lootId];
        //console.info(JSON.stringify(loot));
        // FIX: `1000 / loot.rarity * loot.rarity` algebraically cancels to a
        // flat 1000 for any rarity value, so every loot entry got the exact
        // same drop weight -- rarity had zero effect on odds. Dropping the
        // stray `* loot.rarity` restores rarity as an actual divisor: higher
        // rarity now yields a lower chance, as the field name implies.
        const chance = ~~(1000 / loot.rarity);
        if (chance > 0)
          this.loot[lootId] = chance;
        this.lootTotal += this.loot[lootId];
      }
      //this.lootTotal *= ((200 - this.level)/50);
      this.lootTotal = ~~(this.lootTotal);
    }

    setDrops() {
      const dropLevel = Math.ceil(this.level / 10) * 10;
      //console.info("dropLevel="+dropLevel);
      for (const kind in ItemData.Kinds)
      {
    		const item = ItemData.Kinds[kind];
    		if (!item || item.legacy === 1)
    			continue;

        const diff = item.level - this.level;
    		if (ItemTypes.isEquipment(kind))
    		{
          if (diff >= 0 && diff < 5)
            this.drops[kind] = 1;
          if (diff >= -5 && diff < 0)
            this.drops[kind] = 2;
          if (diff >= -10 && diff < -5)
            this.drops[kind] = 5;
    		}
      }

      if (this.level >= 15 && this.level < 25)
        this.drops[310] = 250;
      if (this.level >= 25 && this.level < 35)
        this.drops[311] = 250;
      if (this.level >= 35 && this.level < 45)
        this.drops[312] = 250;
      if (this.level >= 45)
        this.drops[313] = 250;

      // Potions.
      if (this.level < 20)
        this.drops[34] = 250;
      else
        this.drops[36] = 250;
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

    setAiState(state) {
      //if (this.aiState === mobState.RETURNING)
      //console.error("mob, setAiState - state:"+state);
      //try { throw new Error(); } catch(err) { console.error(err.stack); }
      this.aiState = state;
      //console.info(this.id + " has set aiState: " + state);
    }

    die(attacker) {
      const self = this;

      //console.info("Entity is dead");

      this.map.entities.sendBroadcast(this.despawn());

      _.each(this.attackers, function(attacker) {
        if (self.on_killed_callback) {
          self.on_killed_callback(attacker, self.damageCount[attacker.id]);
        }
        attacker.onKillEntity(self, self.damageCount[attacker.id],
          self.dealtCount[attacker.id]);
      });

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
      return Utils.randomRangeInt(this.level * 2, this.level * 3) * (this.creatureMulti);
    }

    returnedToSpawn() {
      console.info("mob.returnedToSpawn");
      //console.warn("mob.returnedToSpawn: mob id "+this.id+", actual delay:"+(Date.now()-this.startReturn));
      console.info("st - id="+this.id+",x="+this.spawnX+",y="+this.spawnY);
      if (!(this.x == this.spawnX && this.y === this.spawnY)) {
        //console.error("mob, returnedToSpawn: incorrect spawn coords.");
        //console.error("mob, returnedToSpawn: sx:"+this.spawnX+", sy:"+this.spawnY);
        //console.error("mob, returnedToSpawn: x:"+this.x+", y:"+this.y);
      }
      this.resetHp();
      this.resetPosition();
      this.resetBehaviour();
      this.invincible = false;
    }

    handleMobHate(tEntity, hatePoints)
    {
        console.info("handleMobHate");
        if (tEntity && tEntity instanceof Player)
        {
            this.increaseHateFor(tEntity, hatePoints);

            if (this.stats.hp > 0)
            {
              const hEntity = this.getMostHated();
              if (hEntity)
                this.createAttackLink(hEntity);
            }
        }
    }

    aggroPlayer(player, dmg)
    {
      dmg = dmg || 1;

      this.resetAggro(0);
      this.attackingMode = true;
    	this.handleMobHate(player, 1);
      this.setAiState(mobState.AGGRO);
      this.attackTimer = Date.now();
      this.freeze = false;
    }

    endEffects() {
      for (const skilleffect of this.activeEffects)
      {
        skilleffect.endEffects();
      }
      this.activeEffects = [];
    }

    goRoam(pos) {
      this.go(pos.x, pos.y);

      if (this.path)
      {
        this.setAiState(mobState.ROAMING);
        this.spawnX = pos.x;
        this.spawnY = pos.y;
      }
    }

    canRoam() {
      return !this.hasTarget() && !this.isDead && !this.isReturning &&
        !this.isMoving() && this.aiState === mobState.IDLE;
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
