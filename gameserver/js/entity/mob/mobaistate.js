import Timer from '../../timer.js';
import { mobState } from '../../constants.js';

// Split out of entity/mob.js -- the mob's roam/attack "AI state" hooks
// (move-tick cooldown gating and the idle-roam decision) that js/mobai.js
// (the actual per-tick AI loop, a separate top-level file) calls into every
// game tick. Named mobaistate.js (component: MobAIState) to stay distinct
// from that unrelated top-level mobai.js.
//
// NOTE: `aiState` itself (the state *value*, e.g. mobState.IDLE/AGGRO/...)
// stays a plain field directly on Mob rather than moving into this
// component -- it's read directly (not through a method) from several
// external files (callbacks/mobcallback.js, mobai.js, packets/
// combathandler.js), so hiding it behind a component instance would break
// every one of those direct `mob.aiState` reads. Only the methods that
// read/mutate it move here; they operate on entity.aiState via the usual
// constructor(entity) back-reference.
class MobAIState {
    constructor(entity) {
        this.entity = entity;
    }

    setMoveAI(duration) {
    	this.entity.moveAICooldown = new Timer(duration);
    }

    canMoveAI() {
    	return this.entity.moveAICooldown.isOver();
    }

    resetMoveAI(time) {
    	this.entity.moveAICooldown.lastTime = time;
    }

    setAiState(state) {
      //if (this.aiState === mobState.RETURNING)
      //console.error("mob, setAiState - state:"+state);
      //try { throw new Error(); } catch(err) { console.error(err.stack); }
      this.entity.aiState = state;
      //console.info(this.id + " has set aiState: " + state);
    }

    goRoam(pos) {
      const entity = this.entity;
      entity.go(pos.x, pos.y);

      if (entity.path)
      {
        entity.setAiState(mobState.ROAMING);
        entity.spawnX = pos.x;
        entity.spawnY = pos.y;
      }
    }

    canRoam() {
      const entity = this.entity;
      return !entity.hasTarget() && !entity.isDead && !entity.isReturning &&
        !entity.isMoving() && entity.aiState === mobState.IDLE;
    }
}

export default MobAIState;
