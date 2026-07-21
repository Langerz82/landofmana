import Messages from '../message.js';

class NpcMoveCallback {
    constructor() {}

    setCallbacks(entity) {
        //const self = entity;
        //console.info("assigning callbacks to "+self.entity.id);

        // FIX: was `function (entity, x, y)`, but entitymoving.js's
        // nextStep() always invokes this as `this.step_callback()` with zero
        // args -- entity/x/y were always undefined, so
        // `entitygrid[y][x] = 1` threw on every single movement step of
        // every roaming NPC. The exception was caught locally so gameplay
        // wasn't broken, but every NPC step paid for a try/catch plus 5
        // console.info calls (incl. a full stack trace) as pure log
        // spam/wasted CPU, scaling with NPC count.
        //
        // NOTE: a fully correct fix would clear the entity's *previous*
        // grid cell and mark its *new* one, but tracing this further found
        // a separate, pre-existing issue: entity.x/entity.y are never
        // reassigned while an entity walks a path via
        // followPath()/nextStep() -- only the initial jump in
        // entitymoving.js's movePath() and the instant repositioning in
        // mob.js's chase logic call setPosition(). So there is currently no
        // reliable "previous cell" to clear here. entitygrid also has no
        // remaining readers today (isCharacterAt(), its only consumer, is
        // commented out at every call site), so this just marks the
        // entity's current cell and skips the previous-cell clear. Revisit
        // together with NPC path-position tracking if entitygrid/
        // isCharacterAt is ever brought back into real use.
        entity.onStep(function () {
            const grid = this.map.entities.entitygrid;
            if (grid[this.y]) {
                grid[this.y][this.x] = 1;
            }
        });

        entity.onRequestPath(function (x, y) {
            const path = this.map.entities.findPath(this, x, y);
            //console.info("path="+JSON.stringify(path));
            if (path && path.length > 0) {
                const msg = new Messages.MovePath(this, path);
                this.map.entities.sendNeighbours(this, msg);
                return path;
            }
            return null;
        });
    }
}

export default NpcMoveCallback;
