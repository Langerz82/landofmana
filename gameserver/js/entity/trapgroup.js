import Trap from './trap.js';
import Timer from '../timer.js';
import { G_TILESIZE } from '../constants.js';

// FIX/DEAD CODE: TrapGroup is never instantiated anywhere in the codebase --
// only area/traparea.js's addRandomGroup() constructs one, and TrapArea
// itself is never instantiated either (map/mapmanager.js explicitly leaves
// both unwired; see the NOTE there and in entity/trap.js). Treat this whole
// file as not-implemented until TrapArea is actually wired into
// mapmanager.js and Messages.SwapSprite (trap.js's on()/off()) is
// implemented for real.
class TrapGroup {
    constructor(kind, x, y, width, height, map, damage, interval) {
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.traps = [];
        this.entities = {};
        this.map = map;
        this.damaging = false;
        this.switchTimer = new Timer(interval || 1000);
        // FIX: was `this.damage = this.damage || 0` -- reading
        // `this.damage` before it was ever assigned, so it was always
        // `undefined` and this always evaluated to 0, silently discarding
        // the real `damage` constructor parameter (passed in from
        // area/traparea.js's addRandomGroup()). Every trap group dealt 0
        // damage regardless of configuration.
        this.damage = damage || 0;
        this.damageInterval = 1000;

        this.generateTraps();
    }

    generateTraps() {
        const width = this.width;
        const height = this.height;

        const startID = this.map.entities.entityCount;

        let id = 0;
        let blockName;
        for (let j=0; j < height; ++j) {
            for (let i=0; i < width; ++i) {
                id = startID+(width*j+i);
                blockName = "trap"+id+"-"+j+"_"+i;

                const trap = new Trap(id, this.kind,
                    (this.x+i)*G_TILESIZE, (this.y+j)*G_TILESIZE,
                    this.map, this, blockName, i, j);
                this.map.entities.addEntity(trap);
                this.traps.push(trap);
            }
        }

        this.map.entities.entityCount += (width*height);
    }

    isTouching(entity) {
        const ts = G_TILESIZE;
        const half = ts >> 1;
        const left   = this.x * ts - half;
        const right  = (this.x + this.width) * ts + half;
        const top    = this.y * ts - half;
        const bottom = (this.y + this.height) * ts + half;

        return entity.x >= left && entity.x <= right &&
               entity.y >= top && entity.y <= bottom;
    }

    // FIX: this method threw before ever applying trap damage, and had further
    // broken references even past that first throw. Fixed, in order:
    // (1) called this.isTouchingEntity(entity), but the only defined method on
    //     this class is isTouching(entity) above -- name mismatch, threw immediately.
    // (2) inside the `for (const trap of this.traps)` loop, checked
    //     `trip.isTouchingEntity(entity)` -- "trip" is a typo for the loop's own
    //     `trap` variable, and isTouchingEntity doesn't exist (same as #1); should
    //     be `trap.isTouching(entity)`.
    // (3) referenced a bare `player` identifier below even though this method's
    //     parameter is named `entity` -- ReferenceError.
    // (4) `this.entities.getOwnProperty(id)` isn't a real method (it's
    //     `hasOwnProperty`), and `this.entities[id].isOverEntity(player)` isn't a
    //     real Timer method either -- Timer only exposes `isOver()` (see timer.js),
    //     which already returns true/restarts the cooldown once the damage
    //     interval has elapsed, so no second argument is needed.
    update(entity) {
        const dmg = this.damaging;

        if (this.switchTimer.isOver())
            this.damaging = !this.damaging;

        if (dmg !== this.damaging) {
            if (this.damaging) {
                for(const trap of this.traps) {
                    trap.on();
                }
            }
            else {
                for(const trap of this.traps) {
                    trap.off();
                }
            }
        }

        if (!this.damaging)
            return;

        if (!this.isTouching(entity))
            return;

        let victim = null;
        for(const trap of this.traps)
        {
            // FIX: `isTouching` is a bounding-box check defined only on
            // TrapGroup (above) and TrapArea, using this.width/this.height
            // -- individual Trap instances (entity/trap.js) don't have
            // those and don't define isTouching themselves, so this threw
            // "trap.isTouching is not a function" the instant a damaging
            // group's update() ran with an entity inside its bounding box.
            // Trap extends EntityMoving -> Entity, which already provides
            // isOverEntity() (a "within half a tile" point check) -- the
            // right per-tile check for "is this entity standing on this
            // specific trap tile."
            if (trap.isOverEntity(entity)) {
                victim = entity;
                break;
            }
        }

        const id = entity.id;

        if (!victim) {
            this.entities[id] = null;
            return;
        }

        if(this.entities.hasOwnProperty(id) && this.entities[id]) {
            if (this.entities[id].isOver())
                entity.onDamage(this, this.damage);
        }
        else {
            entity.onDamage(this, this.damage);
            this.entities[id] = new Timer(this.damageInterval);
        }
    }
}

export default TrapGroup;
