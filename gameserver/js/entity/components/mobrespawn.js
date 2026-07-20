import Messages from '../../message.js';
import MobArea from '../../area/mobarea.js';
import ItemData from '../../data/itemdata.js';
import ItemLootData from '../../data/itemlootdata.js';
import { ItemTypes } from '../../common.js';
import { mobState, G_DEBUG } from '../../constants.js';

// Split out of entity/mob.js -- everything to do with a mob's spawn/death/
// respawn lifecycle (boss scaling, loot-table + drop-table setup, going
// dead -> queued for respawn -> back on the map, and "returning to spawn"
// after losing aggro) was the largest self-contained cluster directly on
// the Mob class body, including the extensive RETURNING-DEBUG logging used
// to chase the "mob permanently stuck/unattackable" bug. Same
// constructor(entity) convention as the other entity/components/*.js
// files. Reaches into the aggro and AI-state clusters (forgetEveryone,
// setAiState) through entity.X(...) (Mob's own thin delegates), same as
// any other cross-component call in this codebase.
class MobRespawn {
    constructor(entity) {
        this.entity = entity;
    }

    createBoss(multi) {
        const entity = this.entity;
        entity.creatureMulti = multi;
        entity.stats.hp *= multi;
        entity.stats.hpMax *= multi;
        entity.spawnDelay *= multi;
        entity.resetHp();

        for (const kind in entity.drops) {
          if (ItemTypes.isEquipment(kind))
            entity.drops[kind] *= multi;
        }
    }

    execRespawn() {
      const entity = this.entity;
      if (entity.respawnCallback) {
          entity.respawnCallback();
      }
      //this.respawn();
    }

    handleRespawn() {
        const entity = this.entity;
        entity.respawnTime = Date.now();
        entity.mobAI.mobsToRespawn.push(entity);
    }

    onRespawn(callback) {
        this.entity.respawnCallback = callback;
    }

    respawn() {
      const entity = this.entity;
      if (entity.area && entity.area instanceof MobArea) {
        const	pos = entity.map.entities.spaceEntityRandomApart(3, entity.area._getRandomPositionInsideArea.bind(entity.area,100));
        // PERF: fires on every mob respawn across every mob area on the
        // map -- respawn volume during active farming/combat isn't
        // negligible (this server targets ~875 mobs across 51 areas, see
        // G_SPATIAL_SIZE in main.js). JSON.stringify + unconditional
        // console.warn on that path is pure diagnostic cost; gate it.
        if (G_DEBUG)
            console.warn("mob, handleRespawn - id:"+entity.id+", pos.x:"+(pos && pos.x)+", pos.y:"+(pos && pos.y));
        if (pos) {
          entity.setPosition(pos.x, pos.y);
        }
      }
      entity.spawnX = entity.x;
      entity.spawnY = entity.y;
      entity.isDead = false;
      entity.droppedItem = false;
      entity.invincible = false;
      entity.resetBehaviour();
      entity.activeEffects = [];
      entity.map.entities.sendNeighbours(entity, new Messages.Spawn(entity));
    }

    resetBehaviour() {
      const entity = this.entity;
      entity.disengage();
      entity.forceStop();
      entity.forgetEveryone();
      entity.setAiState(mobState.IDLE);
      entity.freeze = false;
    }

    resetPosition() {
    	  const entity = this.entity;
        entity.setPosition(entity.spawnX, entity.spawnY);
        //var msg = new Messages.Move(this, this.orientation, false, this.x, this.y);
        //this.map.entities.sendNeighbours(this, msg);
    }

    returnToSpawn() {
        const entity = this.entity;
        //var self = this;

        if (entity.aiState === mobState.RETURNING)
          return;

        entity.forceStop();
        entity.setAiState(mobState.RETURNING);

        if (entity.hasTarget())
          entity.clearTarget();
        entity.forgetEveryone();
        entity.invincible = true;
        entity.freeze = false;
        // TEMP-DEBUG: tracking the "mob permanently stuck/unattackable" bug
        // report -- grep server logs for "RETURNING-DEBUG" to see the full
        // lifecycle of every RETURNING transition. Remove once root-caused.
        // PERF: returnToSpawn() fires routinely under real combat load
        // (every kill, retreat, or line-of-sight loss with an aggro'd mob),
        // so these were left unconditional even though they're the same
        // per-event debug logging the rest of the codebase gates behind
        // G_DEBUG. The no-path fallback also paid for a throw/catch purely
        // to capture a stack trace on a path that isn't an actual error.
        if (G_DEBUG)
            console.info("RETURNING-DEBUG enter id="+entity.id+" x="+entity.x+" y="+entity.y+" spawnX="+entity.spawnX+" spawnY="+entity.spawnY);
        if (entity.x === entity.spawnX && entity.y === entity.spawnY) {
          if (G_DEBUG)
              console.info("RETURNING-DEBUG already-at-spawn id="+entity.id);
          entity.returnedToSpawn();
          return;
        }
        entity.go(entity.spawnX, entity.spawnY);
        //this.returningToSpawn = true;
        //console.info("returnToSpawn - Path: "+JSON.stringify(this.path))
        //console.info("returnToSpawn - mob.id: "+this.id);
        if (G_DEBUG)
            console.info("RETURNING-DEBUG path-requested id="+entity.id+" pathLen="+(entity.path ? entity.path.length : 0));
        if (!entity.path || entity.path.length === 0) {
          if (G_DEBUG) {
              try { throw new Error(); } catch(err) { console.error(err.stack); }
              console.info("RETURNING-DEBUG no-path-fallback id="+entity.id);
          }
          entity.returnedToSpawn();
        }
        //this.setAiState(mobState.RETURNING);
    }

    returnedToSpawn() {
      const entity = this.entity;
      // TEMP-DEBUG: pairs with the "RETURNING-DEBUG enter" log in
      // returnToSpawn() -- every "enter" should be followed by an "exit"
      // shortly after. A mob id that shows "enter" but never "exit" is the
      // stuck-mob bug caught in the act.
      // PERF: fires on every mob that returns to spawn -- a routine, high
      // frequency event under real combat load. Gated behind G_DEBUG like
      // the rest of this per-event debug logging.
      if (G_DEBUG) {
          console.info("mob.returnedToSpawn");
          //console.warn("mob.returnedToSpawn: mob id "+this.id+", actual delay:"+(Date.now()-this.startReturn));
          console.info("st - id="+entity.id+",x="+entity.spawnX+",y="+entity.spawnY);
          console.info("RETURNING-DEBUG exit id="+entity.id+" aiState="+entity.aiState+" x="+entity.x+" y="+entity.y);
      }
      if (!(entity.x == entity.spawnX && entity.y === entity.spawnY)) {
        //console.error("mob, returnedToSpawn: incorrect spawn coords.");
        //console.error("mob, returnedToSpawn: sx:"+this.spawnX+", sy:"+this.spawnY);
        //console.error("mob, returnedToSpawn: x:"+this.x+", y:"+this.y);
      }
      entity.resetHp();
      entity.resetPosition();
      entity.resetBehaviour();
      entity.invincible = false;
    }

    setItemLoot() {
      const entity = this.entity;
      entity.loot = {};
      entity.lootTotal = 0;
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
          entity.loot[lootId] = chance;
        entity.lootTotal += entity.loot[lootId];
      }
      //this.lootTotal *= ((200 - this.level)/50);
      entity.lootTotal = ~~(entity.lootTotal);
    }

    setDrops() {
      const entity = this.entity;
      const dropLevel = Math.ceil(entity.level / 10) * 10;
      //console.info("dropLevel="+dropLevel);
      for (const kind in ItemData.Kinds)
      {
    		const item = ItemData.Kinds[kind];
    		if (!item || item.legacy === 1)
    			continue;

        const diff = item.level - entity.level;
    		if (ItemTypes.isEquipment(kind))
    		{
          if (diff >= 0 && diff < 5)
            entity.drops[kind] = 1;
          if (diff >= -5 && diff < 0)
            entity.drops[kind] = 2;
          if (diff >= -10 && diff < -5)
            entity.drops[kind] = 5;
    		}
      }

      if (entity.level >= 15 && entity.level < 25)
        entity.drops[310] = 250;
      if (entity.level >= 25 && entity.level < 35)
        entity.drops[311] = 250;
      if (entity.level >= 35 && entity.level < 45)
        entity.drops[312] = 250;
      if (entity.level >= 45)
        entity.drops[313] = 250;

      // Potions.
      if (entity.level < 20)
        entity.drops[34] = 250;
      else
        entity.drops[36] = 250;
   }
}

export default MobRespawn;
