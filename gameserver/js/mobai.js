import Messages from "./message.js";
import _ from "underscore";
import Utils from "./utils.js";
import Formulas from "./formulas.js";
import { mobState, G_TILESIZE, G_DEBUG } from './constants.js';

class MobAI {
  constructor(ws, map){
      this.world = this.server = this.worldServer = ws;
      this.map = map;
      //this.mobsMoving = 0;
      this.mobsToRespawn = [];
  }

  checkHitAggro(mob, sEntity) {
    if (mob.isStunned || mob.isAttacking())
			return;

    if (mob.aiState !== mobState.IDLE)
      return;

    if (mob.hasTarget())
      return;

    if (mob.isAttackedBy(sEntity))
      this.aggroPlayer(mob, sEntity);
    return;
  }

  checkAggro(mob) {
    //console.info("mobai.checkAggro");

    // Cache frequently accessed properties
    const now = Date.now();
    if (now - mob.lastAggroCheck < 1000) return;
    mob.lastAggroCheck = now;

    if (mob.isStunned || mob.isAttacking() || !mob.isAggressive) {
      //console.info("isDead isStunned isAttacking not isAggresive");
			return;
    }

    if (mob.aiState !== mobState.IDLE) {
      //console.info("not idle");
      return;
    }

    if (mob.hasTarget()) {
      //console.info("hasTarget");
      //this.aggroPlayer(mob, player);
      return;
    }

    //console.info("getPlayerArround.")
    if (!mob.canMoveAI())
      return;

    const players = this.map.entities.getPlayerAround(mob, mob.aggroRange);
    //console.info("players length: "+players.length);
    const level = (mob.level * 2);
		for (const player of players)
		{
      //console.info("player.name: "+player.name);

      if (player.isDead) {
        //console.info("player isDead or freeze.")
        continue;
      }

			if (level >= player.level)
			{
        //console.info("aggroPlayer.")
        mob.aggroPlayer(player);
			}
		}
  }

  checkHit(mob) {
        //var self = this;

        if (mob.aiState !== mobState.ATTACKING)
          return;

	    	if (mob.isStunned || !mob.target || mob.freeze)
	    		return;

        if (!mob.canReach(mob.target)) {
          mob.setAiState(mobState.CHASING);
          return;
        }

	    	//console.info("mob.target: "+mob.target.id);
	    	//console.info("mob.canAttack: "+ mob.canAttack(time));
	    	//console.info("mob.canReach: "+mob.isAdjacentNonDiagonal(mob.target));

			if (mob.canAttack())
			{
				// PERF: fires on every mob attack tick -- gated behind G_DEBUG.
				if (G_DEBUG)
					console.info("mob - Is Attacking");

				this.handleHurt(mob);
        }
  }

  update() {
    const now = Date.now();

    // Loop from the end to the beginning
    for (let i = this.mobsToRespawn.length - 1; i >= 0; i--) {
      const mob = this.mobsToRespawn[i];
      if ((now - mob.respawnTime) >= mob.spawnDelay)
      {
        mob.execRespawn();
        this.mobsToRespawn.splice(i, 1);
      }
    }

    const mobs = this.map.entities.mobs.values();
    for(const mob of mobs)
    {
      if (mob.isDead || mob.freeze)
        continue;

      // NOTE: this was `return` instead of `continue`. Since this is inside
      // a `for (const mob of mobs)` loop over every mob on the map, hitting
      // a single RETURNING mob used to abort AI processing for the rest of
      // the mobs on the map for that tick entirely, instead of just skipping
      // that one mob.
      if (mob.aiState === mobState.RETURNING)
        continue;

      if (mob.canAggro())
        this.checkAggro(mob);
      if (mob.hasTarget()) {
        this.checkChase(mob);
        this.checkHit(mob);
      }
    }
  }

  checkChase(mob) {
      //var self = this;
      //console.info("mobAI - checkChase.");
      const target = mob.target;
      //console.info("##### New mob can move! ######");
      if (mob.aiState === mobState.RETURNING)
        return;

      if (mob.freeze)
      {
        //console.info(mob.id+" mob freeze.");
        return;
      }

      if (target.isDead)
			{
        mob.returnToSpawn();
        //console.info(mob.id+" mob target is dead.");
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

			if (!mob.canReach(target))
			{
        //console.info(mob.id+" not within range");
        if (mob.isMovingPath()) {
          //console.info(mob.id+" isMovingpath.");
          return;
        }

        if (mob.isMoving() && target.isMoving())
        {
          // PERF: checkChase runs per-tick for every chasing mob -- gated
          // behind G_DEBUG.
          if (G_DEBUG)
            console.info(mob.id+" monster and target is moving so abort.");
          return;
        }

        if (mob.canMoveAI()) {

          if (this.checkReturn(mob))
            return;

          // FIX: this "target hasn't moved since our last attempt, don't
          // waste a pathfind" shortcut used to sit above, before the
          // mob.canMoveAI() check, and returned unconditionally -- forever,
          // on every future tick, once ptx/pty locked onto a stationary
          // target the mob couldn't reach. That permanently skipped
          // checkReturn() (just above) too, since checkReturn() was only
          // ever reached past this shortcut. A mob that finished chasing to
          // a spot but still couldn't quite reach its target (e.g. blocked
          // by terrain, or the target stopped just out of range) would sit
          // there forever: not attacking, not re-pathing, not giving up and
          // returning to spawn. mobState.STUCK exists in main.js and
          // checkReturn() below already has a branch for it, but nothing
          // ever set it -- this shortcut is what needed to feed
          // checkReturn(), not a separate state. Moving it here (inside the
          // same canMoveAI() cooldown gate as the expensive path below, and
          // after checkReturn() gets its shot) keeps the "don't re-pathfind
          // against an unchanged target" optimization while guaranteeing
          // checkReturn()'s distance-based give-up check keeps running on
          // that same cadence instead of being permanently bypassed.
          if (!target.isMoving() && mob.ptx === mob.target.x && mob.pty === mob.target.y)
          {
            //console.info(mob.id+" path same as before and expensive.");
            mob.setMoveAI(Utils.randomRangeInt(25,50));
            return;
          }

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
              mob.returnToSpawn();
              return;
          }

        }
			}
      else {
        if (!mob.isMovingPath())
        {
          const entities = mob.map.entities.getCharactersAround(mob, 1);
          if (mob.isOverlapping(entities)) {
            mob.forceStop();
            mob.follow(mob.target);
            if (mob.path)
              return;
          }

          mob.forceStop();
          if (G_DEBUG)
            console.info(mob.id+" within range");
          mob.setAiState(mobState.ATTACKING);
        }

      }
  }

  handleHurt(mob) { // 9

        if (!mob || !mob.target || mob.freeze)
        	return;

      	if (mob.target.isInvincible)
      	{
      	    return;
      	}

        // PERF: handleHurt runs on every mob attack landed -- these
        // console.info calls used to fire unconditionally, so they're gated
        // behind G_DEBUG.
        if (G_DEBUG)
            console.info("handleHurt.");

        if(mob.target.stats.hp > 0)
        {
            mob.lookAtEntity(mob.target);

            if (G_DEBUG)
                console.info("handleHurt - mob")
            let dmg = Formulas.dmg(mob, mob.target, mob.attackTimer);
            const canCrit = Formulas.crit(mob, mob.target);
            mob.criticalHit = false;
            if (canCrit) {
            	    dmg *= 2;
            	    mob.criticalHit = true;
            }

            if (G_DEBUG)
                console.info("handleHurt");
            this.server.handleDamage(mob.target, mob, -dmg, mob.criticalHit);
            mob.attackTimer = Date.now();
            if (mob.target.isDead)
            {
              mob.returnToSpawn();
            }
        }
  }

  checkReturn(entity) {
      if (entity.aiState !== mobState.CHASING &&
          entity.aiState !== mobState.STUCK &&
          entity.aiState !== mobState.ROAMING)
      {
        return false;
      }

      const et = entity.target;
      if (et && et.isDead) {
        entity.returnToSpawn();
        return true;
      }

      if ((entity.distanceToPos(entity.spawnX, entity.spawnY) >= 16*G_TILESIZE) ||
          (et && entity.distanceToPos(et.x, et.y) >= 12*G_TILESIZE))
      {
          if (G_DEBUG)
            console.info("RETURN TO SPAWN!");
          entity.returnToSpawn();
          return true;
      }
      return false;
  }

  Roaming(player) {
      //var self = this;
      const maxDistance = 6;

      const mobs = this.map.entities.getMobsAround(player, 32);
  	  for (const mob of mobs) {
        if (!mob) continue;

        const rand = (Utils.randomInt(10) === 0);
        if (!rand)
          continue;

    		//console.info("Roaming playerCount="+playerCount);
  		  if(mob.canRoam()) {
          const area = mob.area;
          const dist = Utils.randomInt(maxDistance) * G_TILESIZE;
          const pos = mob.map.entities.spaceEntityRandomApart(2, area._getRandomPositionForEntity.bind(area,mob,dist), mobs);
          if (!pos)
            continue;

    			if (!(pos.x === mob.x && pos.y === mob.y))
    			{
              mob.goRoam(pos);
    			}
  		  }
	    }
  }

}

export default MobAI;
