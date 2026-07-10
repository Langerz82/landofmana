import Trap from './trap.js';
import Timer from '../timer.js';
import { G_TILESIZE } from '../main.js';

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
        this.damage = this.damage || 0;
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
            if (trap.isTouching(entity)) {
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
