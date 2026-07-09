import Entity from './entity.js';
//import Utils from '../utils.js';
import Messages from '../message.js';
import { Types } from '../common.js';
import Area from '../area/area.js';

class Node extends Entity {
    constructor(id, kind, x, y, map, level, type) {
        super(id, Types.EntityTypes.NODE, kind, x, y, map);
        this.stats = {};
        this.level = level;

        this.setDrops();
        this.spawnDelay = 60000;

        this.spriteName = "nodeset"+kind;
        this.animName = "node"+type;
    }

    getState() {
        const arr = this._getBaseState();
        return arr.concat([this.level, this.spriteName, this.animName, this.weaponType]);
    }

    onDeath(callback) {
        this.death_callback = callback;
    }

    die() {
        this.isDead = true;
        this.map.entities.sendNeighbours(this, new Messages.Despawn(this));

        this.handleRespawn();
        if (this.death_callback) {
            this.death_callback();
        }
    }

    setDrops() {
        this.drops = {};

        if (this.kind === 2) {
            if (this.level === 1)
                this.drops[301] = 2000;
            if (this.level === 2)
                this.drops[302] = 2000;
            if (this.level === 3)
                this.drops[303] = 2000;
            else
                this.drops[304] = 2000;
        }
    }

    respawn() {
        this.isDead = false;
        this.map.entities.sendNeighbours(this, new Messages.Spawn(this));
    }

    handleRespawn() {
        const self = this;

        if (this.area && this.area instanceof Area) {
            // Respawn inside the area if part of a MobArea
            this.area.respawn(this, this.spawnDelay);
        }
        else {
            setTimeout(function () {
                self.respawn();
                if (self.respawnCallback) {
                    self.respawnCallback();
                }
            }, this.spawnDelay);
        }
    }
}

export default Node;
