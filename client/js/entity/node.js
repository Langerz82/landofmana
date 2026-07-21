// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Utils */
import Entity from './entity.js';

export default class Node extends Entity {
    constructor(id, map, kind) {
        super(id, Types.EntityTypes.NODE, map, kind);
        this.level = 0;
        this.stats = {};
        this.idleSpeed = 150 + Utils.random(150);
    }

    resetHP() {
        this.stats.hp = this.stats.hpMax;
    }

    setHP(val) {
        val = val || this.stats.hpMax;
        this.stats.hp = val;
    }

    setMaxHP(hp) {
        this.stats.hpMax = hp;
        this.stats.hp = hp;
    }

    die() {
        if (this.death_callback) this.death_callback();
    }

    onDeath(callback) {
        this.death_callback = callback;
    }

    getAnimationByName() {
        if (this.isDying) return super.getAnimationByName('death');

        return super.getAnimationByName(this.name);
    }
}

// Reserved Node "kind" that identifies a chest. Must match the server's
// Node.CHEST_KIND (gameserver/js/entity/node.js) since it's transmitted
// as-is over the wire (the `kind` field of every spawn message).
Node.CHEST_KIND = 99;
