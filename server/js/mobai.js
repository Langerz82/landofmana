var Messages = require("./message"),
    _ = require("underscore"),
    Utils = require("./utils"),
    Formulas = require("./formulas");

module.exports = MobAI = Class.extend({
  init: function(ws, map){
      this.world = this.server = this.worldServer = ws;
      this.map = map;
      //this.mobsMoving = 0;
  },

  checkHitAggro: function (mob, sEntity) {
    if (mob.isDead || mob.isStunned || mob.isAttacking())
			return;

    if (mob.aiState !== mobState.IDLE)
      return;

    if (mob.hasTarget())
      return;

    if (mob.isAttackedBy(sEntity))
      this.aggroPlayer(mob, sEntity);
    return;
  },

  checkAggro: function(mob) {
    //console.info("checkAggro");

    if (mob.isDead || mob.isStunned || mob.isAttacking() || !mob.isAggressive) {
      //console.info("isDead isStunned isAttacking not isAggresive");
			return;
    }

    if (mob.aiState != mobState.IDLE) {
      //console.info("not idle");
      return;
    }

    /*if (!mob.canAggro()) {
      //console.info("cannot Agrro.");
      return;
    }*/

    if (mob.hasTarget()) {
      //console.info("hasTarget");
      //this.aggroPlayer(mob, player);
      return;
    }

    //console.info("getPlayerArround.")
    if (!mob.canMoveAI())
      return;

    var players = this.map.entities.getPlayerAround(mob, mob.aggroRange);
    //console.info("players length: "+players.length);
    var level = (mob.level * 2);
		for (var player of players)
		{
      //console.info("player.name: "+player.name);

      if (player.isDead || player.freeze) {
        //console.info("player isDead or freeze.")
        continue;
      }

      //console.info("level diff - mob.level:"+(mob.level*2)+" player.level:"+player.level);
			if (level >= player.level.base)
			{
        //console.info("aggroPlayer.")
        this.aggroPlayer(mob, player);
			}
		}
  },

  aggroPlayer: function (mob, player, dmg)
  {
  	var self = this;
  	var ws = this.worldServer;
    dmg = dmg || 1;

    //mob.map.entities.pushNeighbours(mob, new Messages.Spawn(mob));
    mob.resetAggro(0);
    mob.attackingMode = true;
    //mob.setTarget(player);
    //mob.setFreeze(G_LATENCY);
  	mob.handleMobHate(player, 1);
  	//mob.createAttackLink(player);
    mob.setAiState(mobState.AGGRO);
    mob.attackTimer = Date.now();
    mob.freeze = false;
  },

  /*addHate: function (mob, player, dmg)
  {
  	var self = this;
  	var ws = this.worldServer;

    //mob.map.entities.pushNeighbours(mob, new Messages.Spawn(mob));
    mob.resetAggro(0);
    mob.attackingMode = true;
    //mob.setTarget(player);

    //mob.setFreeze(G_ROUNDTRIP);
  	ws.handleMobHate(mob, player, dmg);
    ws.createAttackLink(player, mob);
  	//ws.createAttackLink(mob, player);

    mob.setAiState(mobState.AGGRO);
  },*/

  checkHit: function(mob) {
        var self = this;
        //var ws = this.worldServer;

	    	if (mob.isStunned || !mob.target || mob.freeze)
	    		return;

        if (mob.aiState === mobState.FIRSTATTACK) {
          mob.setFreeze(mob.data.reactionDelay, function () {
            mob.setAiState(mobState.ATTACKING);
          });
          return;
        }

        if (!mob.canReach(mob.target)) {
          mob.setAiState(mobState.CHASING);
          return;
        }

        if (mob.aiState !== mobState.ATTACKING)
          return;

	    	//this.loadPreviousTarget(mob);
	    	//console.info("mob.target: "+mob.target.id);
	    	//console.info("mob.canAttack: "+ mob.canAttack(time));
	    	//console.info("mob.canReach: "+mob.isAdjacentNonDiagonal(mob.target));
        //var time = new Date().getTime();

  			if (mob.canAttack())
  			{
          //mob.forceStop();
  				console.info("mob - Is Attacking");
  				/*var canCallBackup = (Utils.random(Math.ceil(3200/mob.level)) === 1) && (mob.data && mob.data.special > 0);
  				if (canCallBackup && mob.level >= 10 && mob.canCall && mob.stats.hp < (mob.stats.hpMax * 0.5))
  				{
  					//self.map.entities.pushToAdjacentGroups(mob.group, mob.Speech("callBackup"));
  					mob.canCall = false;
  					var mobs = self.map.entities.getCharactersAround(mob, mob.data.aggroRange * 16);
  					var i =0;
  					for (var id in mobs)
  					{
  						if (++i == 3)
  							break;
  						if (mobs[id] instanceof Mob)
  						{
  							this.aggroPlayer(mobs[id], mob.target);
  							mobs[id].canCall = false;
  						}
  					}
  				}*/

  				/*var canCallAoe = (Utils.random(Math.ceil(300/mob.level)) === 1);
  				if (canCallAoe && mob.level >= 25)
  				{
  					var chars = self.map.entities.getCharactersAround(mob.target, Math.ceil(mob.level/5));
  					for (var id in chars)
  					{
  						if (chars[id] instanceof Player || chars[id] instanceof NpcPlayer)
  							this.handleHurt(chars[id]);
  					}
  				}*/

  				this.handleHurt(mob);
        }
  },

  update: function() {
    var mobs = this.map.entities.mobs;
    for(var mobId in mobs)
    {
      var mob = mobs[mobId];

      if (mob.isDead || mob.freeze)
        continue;

      if (mob.aiState == mobState.RETURNING)
        return;

      if (mob.canAggro())
        this.checkAggro(mob);
      if (mob.hasTarget()) {
        this.checkChase(mob);
        this.checkHit(mob);
      }
    }
  },

  checkChase: function(mob) {
      //var self = this;
      //console.info("mobAI - checkChase.");
      var target = mob.target;
      //console.info("##### New mob can move! ######");
      if (mob.freeze)
      {
        //console.info(mob.id+" mob freeze.");
        return;
      }

      if (target.isDead ||target.isDying)
			{
        //console.info(mob.id+" mob target is dead.");
        //mob.returnToSpawn();
				//mob.clearTarget();
				return;
			}

      if (mob.aiState === mobState.IDLE) {
        //console.info(mob.id+" mob is set to aggro.");
        mob.setAiState(mobState.AGGRO);
      }

      //console.info("mobAI - checkChase.");
      if (!(mob.aiState === mobState.AGGRO || mob.aiState === mobState.CHASING))
      {
        //console.info(mob.id+" mob is NOT aggro.");
        return;
      }

			//if (mob.canAggro())
			//{
        /*if (this.tryMovingToADifferentTile(mob) === true)
        {
          console.info(mob.id+" mob moving to different tile")
          return;
        }*/

        //console.info(mob.id+" target and canAggro");

        //if (mob.hasTarget() && !mob.isMovingPath())
          //mob.lookAtEntity(mob.target);\

        //if (!target || !(target instanceof Character))
          //return;

				if (!mob.canReach(target))
				{
          //console.info(mob.id+" not within range");
          if (mob.isMovingPath()) {
            //console.info(mob.id+" isMovingpath.");
            return;
          }

          if (!target.isMoving() && mob.ptx == mob.target.x && mob.pty == mob.target.y)
          {
            //console.info(mob.id+" path same as before and expensive.");
            return;
          }

          if (mob.isMoving() && target.isMoving())
          {
            console.info(mob.id+" monster and target is moving so abort.");
            return;
          }

          if (mob.canMoveAI()) {
            /*if (mob.isOverlapping()) {
              mob.forceStop();
              mob.follow(mob.target);
              return;
            }*/

            if (this.checkReturn(mob))
              return;

            /*if (mob.path > 1) {
              dest = mob.path[mob.path.length-1];
              dest[0] !=
            } && )*/
            //console.info(mob.id+" EXPENSIVE - mob following target.");
            //mob.lookAt(mob.target);
            //mob.setFreeze(G_LATENCY);

            mob.setMoveAI(Utils.randomRangeInt(25,50));
            mob.ptx = target.x;
            mob.pty = target.y;


            mob.followAttack(target);
            if (mob.path) {
              mob.setAiState(mobState.CHASING);
              return;
            }
            else
            {
                //mob.setAiState(mobState.STUCK);
                //console.info("MOB CANNOT GET PLAYER!");
                //mob.forceStop();
                mob.returnToSpawn();
                //mob.setAiState(mobState.IDLE);
                return;
            }

          }
				}
        else {
          if (!mob.isMovingPath())
          {
            if (mob.isOverlapping()) {
              mob.forceStop();
              mob.follow(mob.target);
              if (mob.path)
                return;
            }

            //mob.setFreeze(G_LATENCY);
            mob.forceStop();
            console.info(mob.id+" within range");
            //mob.setAggroRate((mob.moveSpeed+G_LATENCY));
            mob.setAiState(mobState.FIRSTATTACK);
          }

        }
			//}
    },

    handleHurt: function(mob){ // 9

        if (!mob.target || mob.freeze)
        	return;

      	if (mob.target.isInvincible)
      	{
      	    return;
      	}

        console.info("handleHurt.");

        if(mob && mob.target.stats.hp > 0 && mob instanceof Mob)
        {
            mob.lookAt(mob.target);

            console.info("handleHurt - mob")
            var dmg = Formulas.dmg(mob, mob.target, mob.attackTimer);
            var canCrit = Formulas.crit(mob, mob.target);
            if (canCrit) {
            	    dmg *= 2;
            	    mob.criticalHit = false;
            }
            mob.target.stats.hp -= dmg;
            if(mob.target.stats.hp <= 0) {
                mob.target.isDead = true;
            }

            //mob.addTanker(mob.target.id);

            console.info("handleHurtEntity");
            //if (mob.target instanceof Player)
            	    //mob.target.armorDamage += dmg;
            this.server.handleDamage(mob.target, mob, -dmg, mob.criticalHit);
            this.server.handleHurtEntity(mob.target, mob);
            mob.attackTimer = Date.now();
        }
    },

    checkReturn: function (entity) {
      if (entity.aiState !== mobState.CHASING &&
          entity.aiState !== mobState.STUCK &&
          entity.aiState !== mobState.ROAMING)
      {
        return false;
      }

      var et = entity.target;
      if (et && (et.isDying || et.isDead)) {
        entity.returnToSpawn();
        return true;
      }

      if ((entity.distanceToPos(entity.spawnX, entity.spawnY) >= 24*G_TILESIZE) ||
          (et && entity.distanceToPos(et.x, et.y) >= 12*G_TILESIZE))
      {
          console.info("RETURN TO SPAWN!");
          entity.returnToSpawn();
          return true;
      }
    },

    Roaming: function(player) {
      //var self = this;
      var dist = 5 * G_TILESIZE;

      var mobs = this.map.entities.getMobsAround(player, 32);
      var mob;
  	  for (mob of mobs) {
        if (!mob) continue;

        var rand = (Utils.randomInt(10) === 0);
        if (!rand)
          continue;

    		//console.info("Roaming playerCount="+playerCount);
  		  if(mob && !mob.hasTarget() && !mob.isDead && !mob.isReturning && !mob.isMoving() && mob.aiState == mobState.IDLE) {
          var area = mob.area;
          var pos = mob.map.entities.spaceEntityRandomApart(2, area._getRandomPositionForEntity.bind(area,mob,dist), mobs);
          if (!pos)
            continue;

    			if (!(pos.x == mob.x && pos.y == mob.y))
    			{
    				  mob.go(pos.x, pos.y);

              if (mob.path)
              {
                mob.aiState = mobState.ROAMING;
                mob.spawnX = pos.x;
                mob.spawnY = pos.y;
              }
    			}
  		  }
	    }
    },

});
