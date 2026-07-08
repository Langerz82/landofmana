import _ from 'underscore';
import Area from './area.js';

class EntityArea extends Area {
    constructor(map, id, x, y, width, height, elipse, excludeId) {
        super(map, id, x, y, width, height, elipse, excludeId);
        this.entities = [];
        this.hasCompletelyRespawned = true;
    }

    removeFromArea(entity) {
        var i = _.indexOf(_.pluck(this.entities, 'id'), entity.id);
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

    respawn(entity, delay) {
        var self = this;
        delay = entity.spawnDelay || delay;

        this.removeFromArea(entity);

        setTimeout(function() {
            var	pos = self.map.entities.spaceEntityRandomApart(2, self._getRandomPositionInsideArea.bind(self,20), self.entities);

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
