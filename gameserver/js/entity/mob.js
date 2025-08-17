var Character = require('./character'),
  Messages = require('../message'),
  MobArea = require('../area/mobarea');

module.exports = Mob = Character.extend({
    init: function (id, kind, x, y, map, mobArea) {

      //console.info("map.index"+map.index);
    	this._super(id, Types.EntityTypes.MOB, kind, x, y, map);

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

      var tx=Number(x), ty=Number(y);
      this.spawnX = tx;
      this.spawnY = ty;

      this.stats = {};
      this.stats.attack = this.data.attack * this.level;
      this.stats.defense = this.data.defense * this.level;
      this.stats.hp = Math.max(this.data.hp * this.level - 40,1);
      //console.info("this.data.hp="+this.data.hp);
      this.stats.hpMax = this.stats.hp;
      //console.info("this.stats.hpMax="+this.stats.hpMax);
      this.stats.ep = this.data.ep * this.level;
      this.stats.epMax = this.stats.ep;

      this.stats.xp = this.data.xp * this.level;


      this.stats.mod = {
        attack: 0,
        defense: 0,
        damage: 0,
        health: 0
      };

      this.hatelist = [];
      this.hateCount = 0;
      //this.tankerlist = [];
      this.damageCount = {};
      this.dealtCount = {};

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

      this.aiState = mobState.IDLE;

      this.effects = {};

      this.activeEffects = [];
    },

    getXP: function () {
      return this.data.xp *
        this.data.attackMod *
        this.data.defenseMod *
        this.data.attackRateMod *
        this.data.hpMod *
        this.level;
    },

    setMoveAI: function (duration)
    {
    	this.moveAICooldown = new Timer(duration);
    },
    canMoveAI: function ()
    {
    	return this.moveAICooldown.isOver();
    },
    resetMoveAI: function (time)
    {
    	this.moveAICooldown.lastTime = time;
    },

    setAggroRate: function (duration)
    {
    	this.aggroCooldown = new Timer(duration);

    },
    canAggro: function ()
    {
    	return this.aggroCooldown.isOver();
    },
    resetAggro: function (time)
    {
    	this.aggroCooldown.lastTime = time;
    },

    onKilled: function (callback) {
      this.on_killed_callback = callback;
    },

    onDeath: function (callback) {
      this.on_death_callback = callback;
    },

    onDamage: function (attacker, hpMod, epMod, crit, effects) {
      var hp = this.stats.hp;
      var dmgRatio = (hpMod / this.stats.hpMax);
      log.info("dmgRatio: "+dmgRatio)
      if (!this.isMoving() && dmgRatio >= 0.5) {
        this.forceStop();
        this.setFreeze(1000, function (mob) { mob.attackTimer = Date.now(); });
      }

      this._super(attacker, hpMod, epMod, crit, effects);
      var hpDiff = hp - this.stats.hp;
      if (hpDiff > 0) {
        console.info ("onDamage hpMod:"+hpMod)
        attacker.onHitEntity(this, hpDiff);
        this.onHitByEntity(attacker, hpDiff);
      }
    },

    onHitEntity: function (target, dmg) {
      if (!this.dealtCount.hasOwnProperty(target.id))
        this.dealtCount[target.id] = 0;
      this.dealtCount[target.id] += dmg;
    },

    onHitByEntity: function (target, dmg) {
      if (!this.damageCount.hasOwnProperty(target.id))
        this.damageCount[target.id] = 0;
      this.damageCount[target.id] += dmg;
    },

    destroy: function () {
        this.isDead = true;
        this.endEffects();
        this.forgetEveryone();
        //this.clearAttackerRefs();
        //this.removeAttackers();
        this.clearTarget();

        this.resetBars();
        this.resetPosition();
        this.handleRespawn();
    },

    resetBars: function () {
      this.stats.hp = this.stats.hpMax;
      this.stats.ep = this.stats.epMax;
    },

    /*receiveDamage: function (points, playerId) {
        this.stats.hp -= points;
        if (this.stats.hp < 0) {
          this.stats.hp = 0;
        }
    },*/

    hates: function (entity) {
        return _.any(this.hatelist, function(obj) {
            return obj.entity === entity;
        });
    },

    increaseHateFor: function (entity, points) {
        if (this.hates(entity)) {
            _.detect(this.hatelist, function (obj) {
                return obj.entity === entity;
            }).hate += points;
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
    },

    getMostHated: function(hateRank) {
        var i, playerId,
            sorted = _.sortBy(this.hatelist, function(obj) { return obj.hate; }),
            size = _.size(this.hatelist);

        if(sorted && sorted[0]) {
            return sorted[0].entity;
        }
        return null;
    },

    forgetPlayer: function(playerId) {
        this.hatelist = _.reject(this.hatelist, function(obj) { return obj.entity.id === playerId; });
        //this.tankerlist = _.reject(this.tankerlist, function(obj) { return obj.id === playerId; });

        if(this.hatelist.length === 0 /*|| this.tankerlist === 0*/) {
            this.returnToSpawn();
        }
    },

    forgetEveryone: function () {
        this.hatelist = [];
        this.damageCount = {};
        this.dealtCount = {};
        this.clearAttackerRefs();
        this.removeAttackers();
    },

    handleRespawn: function () {
        var self = this;

        if (this.area && this.area instanceof MobArea) {
            // Respawn inside the area if part of a MobArea
            this.area.respawnMob(self, this.spawnDelay);
        }
        else {
            setTimeout(function () {
                //self.respawnMob();
                if (self.respawnCallback) {
                    self.respawnCallback();
                }
            }, this.spawnDelay);
        }
    },

    onRespawn: function (callback) {
        this.respawnCallback = callback;
    },

    revive: function () {
      this.spawnX = this.x;
      this.spawnY = this.y;
      this.isDead = false;
      this.freeze = false;
      this.droppedItem = false;
      this.resetBehaviour();
      this.activeEffects = [];
      this.map.entities.sendNeighbours(this, new Messages.Spawn(this));
    },

    resetBehaviour: function () {
      this.disengage();
      this.forceStop();
      this.forgetEveryone();
      this.setAiState(mobState.IDLE);
      this.freeze = false;
    },

    resetPosition: function () {
    	  ///var x=this.spawnX, y=this.spawnY;
        this.setPosition(this.spawnX, this.spawnY);
        //var msg = new Messages.Move(this, this.orientation, false, this.x, this.y);
        //this.map.entities.sendNeighbours(this, msg);
    },

    returnToSpawn: function() {
        var self = this;

        if (this.aiState === mobState.RETURNING)
          return;

        this.setAiState(mobState.RETURNING);

        //const self = this;
        //this.removeAttackers();
        this.forceStop();
        if (this.hasTarget())
          this.clearTarget();
        this.forgetEveryone();
        this.invincible = true;
        this.freeze = false;
        //this.resetHP();
        if (this.x === this.spawnX && this.y === this.spawnY) {
          this.returnedToSpawn();
          return;
        }
        this.go(this.spawnX, this.spawnY);
        console.warn("returnToSpawn - Path: "+JSON.stringify(this.path))
        //this.resetSpawn = true;
        if (!this.path || this.path.length === 0) {
          try { throw new Error(); } catch(err) { console.error(err.stack); }
          this.returnedToSpawn();
        }
        else {
          var pathTicks = this.map.entities.pathfinder.getPathTicks(this.path, this.spawnX, this.spawnY);
          var delay= Math.max(0, ~~(pathTicks / (this.tick / G_FRAME_INTERVAL_EXACT)));
          console.info("returnToSpawn.delay = "+delay);
          console.info("id="+this.id+",x="+this.spawnX+",y="+this.spawnY);
          //var self = this;
          //setTimeout(self.returnedToSpawn.bind(self), delay);
          //setTimeout(() => { this.returnedToSpawn() }, delay);
          setTimeout(function() {
            console.info("st - id="+self.id+",x="+self.spawnX+",y="+self.spawnY);
            //this = self2;

            self.returnedToSpawn();
            //self2.resetHP();
            //self2.setAiState(mobState.IDLE);
            //self2.setPosition(self2.spawnX,self2.spawnY);

          }, delay);
          /*this.returnTimeout = setTimeout(function () {
            self.returnedToSpawn();
          }, delay);*/
        }
    },

    onMove: function (callback) {
        this.moveCallback = callback;
    },

    move: function (x, y) {
        this.setPosition(x, y);
        this.orientation = Utils.getOrientationFromLastMove(this);
        if (this.moveCallback) {
            this.moveCallback(this);
        }
    },

    distanceToPos: function (x, y) {
    	 return Utils.distanceTo(this.x, this.y, x, y);
    },

    setItemLoot: function () {
      this.loot = {};
      this.lootTotal = 0;
      for (var lootId in ItemLootData.ItemLoot)
      {
        var loot = ItemLootData.ItemLoot[lootId];
        //console.info(JSON.stringify(loot));
        var chance = ~~(1000 / loot.rarity * loot.rarity);
        if (chance > 0)
          this.loot[lootId] = chance;
        this.lootTotal += this.loot[lootId];
      }
      //this.lootTotal *= ((200 - this.level)/50);
      this.lootTotal = ~~(this.lootTotal);
    },

    setDrops: function () {
      var dropLevel = Math.ceil(this.level / 10) * 10;
      //console.info("dropLevel="+dropLevel);
      for (var kind in ItemData.Kinds)
      {
    		var item = ItemData.Kinds[kind];
    		if (!item || item.legacy === 1)
    			continue;

        var diff = item.level - this.level;
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
   },

   Speech: function (key, value) {
		/*if (this.data.isSpeech === 0)
			return;

   	   	if (!value)
			value = Utils.random(MobSpeechData.Speech[key].length-1);
		return new Messages.Speech(this, key, value);*/
    return null;
   },

    getState: function () {
      //console.info("mob_state:"+JSON.stringify(basestate.concat(state)));
      return this._getBaseState().concat([this.level, this.stats.hp, this.stats.hpMax]);
    },

    setAiState: function (state) {
      //if (this.aiState === mobState.RETURNING)
        //try { throw new Error(); } catch(err) { console.error(err.stack); }
      this.aiState = state;
      //console.info(this.id + " has set aiState: " + state);
    },

    die: function (attacker) {
      var self = this;

      console.info("Entity is dead");
      this.isDead = true;
      this.map.entities.sendBroadcast(this.despawn());


      _.each(this.attackers, function(attacker) {
        self.on_killed_callback(attacker, self.damageCount[attacker.id]);
        attacker.onKillEntity(self);
      });

      if (this.on_death_callback)
        this.on_death_callback(attacker);

      this.damageCount = {};
      this.dealtCount = {};

      this.destroy();
    },

    baseCrit: function() {
      var modDiff = 0;
      var statDiff = (this.stats.attack+this.stats.mod.attack);
      var chance = ~~(Utils.clamp(5, 500, ~~(statDiff + modDiff)));
      //console.info("player - baseCrit: "+chance);
      return chance;
    },

    baseCritDef: function() {
      var modDiff = 0;
      var statDiff = (this.stats.defense+this.stats.mod.defense);
      var chance = ~~(Utils.clamp(5, 500, ~~(statDiff + modDiff)));
      //console.info("player - baseCritDef: "+chance);
      return chance;
    },

    baseDamage: function() {
      var dealt, absorbed, dmg;

      dealt = ~~(this.level * 6);
      dealt += (this.stats.attack+this.stats.mod.attack) * (6-Math.min(3, (this.level * 0.1)));

      dmg = ~~(dealt);

      //console.info("player - baseDamage: "+dmg);
      return dmg;
    },

    baseDamageDef: function() {
      var dealt, absorbed, dmg;

      dealt = ~~(this.level * 2);
      dealt += ((this.stats.defense+this.stats.mod.defense) * 2);

      dmg = ~~(dealt);
      //console.info("player - baseDamageDef: "+dmg);
      return dmg;
    },

    canReach: function(entity) {
      var o = this.orientation;
      this.lookAtEntity(entity);
      var res = this._super(entity);
      this.orientation = o;
      return res;
    },

    dropGold: function () {
      return Utils.randomRangeInt(this.level * 2, this.level * 3);
    },

    returnedToSpawn: function () {
      console.info("mob.returnedToSpawn");
      this.resetHP();
      this.resetPosition();
      this.resetBehaviour();
      this.invincible = false;
    },

    handleMobHate: function(tEntity, hatePoints)
    {
        console.info("handleMobHate");
        if (tEntity && tEntity instanceof Player)
        {
            this.increaseHateFor(tEntity, hatePoints);

            if (this.stats.hp > 0)
            {
              var hEntity = this.getMostHated();
              if (hEntity)
                this.createAttackLink(hEntity);
            }
        }
    },

    aggroPlayer: function (player, dmg)
    {
      dmg = dmg || 1;

      this.resetAggro(0);
      this.attackingMode = true;
    	this.handleMobHate(player, 1);
      this.setAiState(mobState.AGGRO);
      this.attackTimer = Date.now();
      this.freeze = false;
    },

    endEffects: function () {
      for (var skilleffect of this.activeEffects)
      {
        skilleffect.endEffects();
      }
      this.activeEffects = [];
    },

    goRoam: function (pos) {
      this.go(pos.x, pos.y);

      if (this.path)
      {
        this.aiState = mobState.ROAMING;
        this.spawnX = pos.x;
        this.spawnY = pos.y;
      }
    },

    canRoam: function () {
      return !this.hasTarget() && !this.isDead && !this.isReturning &&
        !this.isMoving() && this.aiState === mobState.IDLE;
    },
});

module.exports = Mob;
