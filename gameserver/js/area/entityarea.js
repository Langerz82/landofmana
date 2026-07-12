import _ from 'underscore';
import Area from './area.js';
import Scheduler from '../scheduler.js';

class EntityArea extends Area {
    constructor(map, id, x, y, width, height, elipse, excludeId) {
        super(map, id, x, y, width, height, elipse, excludeId);
        this.entities = [];
        this.hasCompletelyRespawned = true;
    }

    // FIX/PERF: this used to build a whole throwaway array of ids via
    // _.pluck(this.entities, 'id') just to _.indexOf() into it -- an O(n)
    // allocation plus an O(n) scan to do what a single O(n) scan already
    // does. Worse, if the entity wasn't actually in this.entities for any
    // reason, _.indexOf() returns -1, and `this.entities.splice(-1, 1)`
    // doesn't no-op -- Array.splice() treats a negative index as "count
    // back from the end", so it silently removed this area's *last*
    // entity instead of the (missing) target one. This runs on every mob
    // death/respawn in the area (see respawn() below), across every mob
    // area in the world. Finding the index directly and guarding against
    // "not found" fixes both the wasted allocation and the wrong-entity
    // removal.
    removeFromArea(entity) {
        const i = this.entities.findIndex(e => e.id === entity.id);
        if (i < 0) return;
        this.entities.splice(i, 1);

        if (this.isEmpty() && this.hasCompletelyRespawned && this.emptyCallback) {
            this.hasCompletelyRespawned = false;
            this.emptyCallback();
        }
    }

    onEmpty(callback) {
        this.emptyCallback = callback;
    }

    addToArea(entity) {
        if (entity && entity.kind !== null) {
            this.entities.push(entity);
            entity.area = this;
        }

        if (this.isFull()) {
            this.hasCompletelyRespawned = true;
        }
    }

    setNumberOfEntities(nb) {
        this.nbEntities = nb;
    }

    isEmpty() {
        return !_.any(this.entities, function(entity) {
            return !entity.isDead;
        });
    }

    isFull() {
        return !this.isEmpty() && (this.nbEntities === _.size(this.entities));
    }

    // PERF: this runs on every mob death across every mob area in the world
    // (and every depleted area-bound node) -- at the mob counts this codebase
    // is benchmarked against (~875 mobs across 51 areas, see the
    // G_SPATIAL_SIZE comment in main.js), that's potentially dozens of these
    // pending at once during active play. Was its own setTimeout per
    // respawn; routed through the shared Scheduler
    // (gameserver/js/scheduler.js) instead of a live Node timer per call.
    respawn(entity, delay) {
        const self = this;
        delay = entity.spawnDelay || delay;

        this.removeFromArea(entity);

        Scheduler.schedule(function() {
            const	pos = self.map.entities.spaceEntityRandomApart(2, self._getRandomPositionInsideArea.bind(self,20), self.entities);

            if (pos) {
                entity.spawnX = pos.x;
                entity.spawnY = pos.y;
                entity.setPosition(pos.x,pos.y);
            }

            entity.respawn();
        }, delay);
    }
}

export default EntityArea;
