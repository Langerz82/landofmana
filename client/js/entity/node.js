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

    // FIX: this override was declared with no parameter and looked up
    // `this.name` instead - but `this.name` is the node's own display/log
    // label (set from the spawn payload as `entity.name = data[3]` in
    // clientcallbacksspawn.js, e.g. "node2"), not an animation key. The
    // actual animation name (e.g. the server's per-state animName, data[10]
    // at spawn, or whatever setAnimation()'s `this.getAnimationByName(name)`
    // call is really asking for afterwards) was silently discarded every
    // time. Spawning happened to work because entity.animate(animName, ...)
    // sets currentAnimation directly through setAnimation() the first time
    // regardless (setSprite() runs first, but the very next animation
    // lookup already goes through this override) - any animation change
    // after that (idle loop restart, harvest, re-orientation, etc.) asked
    // for the wrong key, failed the `name in this.animations` check in
    // Entity.getAnimationByName(), logged "No animation called <node name>",
    // and left the node's sprite stuck/not updating. Accept and forward the
    // real requested name; only the dying case is special-cased to 'death'.
    getAnimationByName(name) {
        if (this.isDying) return super.getAnimationByName('death');

        return super.getAnimationByName(name);
    }
}

// Reserved Node "kind" that identifies a chest. Must match the server's
// Node.CHEST_KIND (gameserver/js/entity/node.js) since it's transmitted
// as-is over the wire (the `kind` field of every spawn message).
Node.CHEST_KIND = 99;
