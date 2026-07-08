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
        var width = this.width;
        var height = this.height;

        var startID = this.map.entities.entityCount;

        var id = 0;
        var blockName;
        for (var j=0; j < height; ++j) {
            for (var i=0; i < width; ++i) {
                id = startID+(width*j+i);
                blockName = "trap"+id+"-"+j+"_"+i;

                var trap = new Trap(id, this.kind,
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

    // NOTE: several pre-existing bugs preserved unchanged from the original source
    // (left as-is per the conversion policy of not silently fixing unrelated logic):
    // (1) calls this.isTouchingEntity(entity) below, but the only defined method on
    //     this class is isTouching(entity) above — name mismatch, would throw.
    // (2) inside the `for (var trap of this.traps)` loop, checks `trip.isTouchingEntity(entity)`
    //     — "trip" is a typo for "trap" (and isTouchingEntity doesn't exist either).
    // (3) references a bare `player` identifier below even though this method's
    //     parameter is named `entity`.
    // (4) `this.entities.getOwnProperty(id)` should be `hasOwnProperty`.
    update(entity) {
        var dmg = this.damaging;

        if (this.switchTimer.isOver())
            this.damaging = !this.damaging;

        if (dmg !== this.damaging) {
            if (this.damaging) {
                for(var trap of this.traps) {
                    trap.on();
                }
            }
            else {
                for(var trap of this.traps) {
                    trap.off();
                }
            }
        }

        if (!this.damaging)
            return;

        if (!this.isTouchingEntity(entity))
            return;

        var victim = null;
        for(var trap of this.traps)
        {
            if (trip.isTouchingEntity(entity)) {
                victim = entity;
                break;
            }
        }

        var id = entity.id;

        if (!victim) {
            this.entities[id] = null;
            return;
        }

        if(this.entities.getOwnProperty(id) && this.entities[id]) {
            if (this.entities[id].isOverEntity(player))
                player.onDamage(this, this.damage);
        }
        else {
            player.onDamage(this, this.damage);
            this.entities[id] = new Timer(this.damageInterval);
        }
    }
}

export default TrapGroup;
