// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// Was: define(['./entity', '../transition', '../timer'], function(Entity, Transition, Timer) {
//        var EntityMoving = Entity.extend({ init: function(...) { this._super(...); ... }, ... });
//        return EntityMoving;
//      });
// this._super(...) inside init() -> super(...) inside constructor() (the only _super call in this file).
/* global Types, Utils */
import Entity from '../entity.js';
import Transition from '../../transition.js';

// EntityMoving's own behavior is split across these mixin modules for readability
// (entitymoving.js had grown to ~733 lines). Each install* call below merges plain-
// function methods onto EntityMoving.prototype; they're not subclasses/separate
// instances, just EntityMoving's own methods living in separate files.
import { installEntityMovingPath } from './entitymovingpath.js';
import { installEntityMovingSpatial } from './entitymovingspatial.js';
import { installEntityMovingOrientation } from './entitymovingorientation.js';

export default class EntityMoving extends Entity {
    constructor(id, type, mapIndex, kind, x, y) {
        super(id, type, mapIndex, kind, x, y);

        // Speeds
        this.moveSpeed = 100;
        this.setMoveRate(this.moveSpeed);
        this.walkSpeed = 150;
        this.idleSpeed = Utils.randomRangeInt(750, 1000);

        this.step = 0;

        this.orientation = 2; // DOWN

        // Pathing
        this.movement = new Transition(this);
        this.moveCooldown = null;
        this.path = null;
        this.newDestination = null;
        this.interrupted = false;

        this.freeze = false;
    }

    onRemove(callback) {
        this.remove_callback = callback;
    }

    setFreeze(ms, callback) {
        const self = this;
        if (ms <= 0) {
            self.freeze = false;
            return;
        }
        this.freeze = true;
        this.freeze_callback = setTimeout(function() {
            self.freeze = false;
            if (callback)
                callback(self);
        }, ms);
    }

}

installEntityMovingPath(EntityMoving.prototype);
installEntityMovingSpatial(EntityMoving.prototype);
installEntityMovingOrientation(EntityMoving.prototype);
