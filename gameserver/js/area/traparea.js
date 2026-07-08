import EntityArea from './entityarea.js';
import Timer from '../timer.js';
import TrapGroup from '../entity/trapgroup.js';
import Utils from '../utils.js';
import { G_TILESIZE } from '../main.js';

class TrapArea extends EntityArea {
    constructor(map, id, x, y, width, height, damage, switchInterval) {
        super(map, id, x, y, width, height);
        this.groups = [];
        this.checkTimer = new Timer(500);

        this.damage = damage || 0;
        this.switchInterval = switchInterval || 1000;
    }

    addGroup(group) {
        this.groups.push(group);
    }

    addRandomGroup(kind, width, height, threshold) {
        var pos = null;
        var threshold = threshold || 50;

        var t = 0;
        while(t++ < threshold) {
            pos = [this.gx + Utils.randomInt((this.width/G_TILESIZE) - width),
                   this.gy + Utils.randomInt((this.height/G_TILESIZE) - height)];

            if (this.isGroupEmptyPositions(pos, width, height))
                break;

            pos = null;
        }

        if (!pos) {
            console.error("TrapArea - addRandomGroup - failed, threshold reached.")
            return;
        }

        var group = new TrapGroup(kind, pos[0], pos[1], width, height, this.map,
            this.damage, this.switchInterval);

        this.addGroup(group);
    }

    isGroupEmptyPositions(pos, width, height) {
        console.info("isGroupEmptyPositions: pos=["+pos[0]+","+pos[1]+"],w="+width+",h="+height);
        for (var i=0; i < width; ++i) {
            for (var j=0; j < height; ++j) {
                var x = (pos[0]+i);
                var y = (pos[1]+j);
                if (!this.map.entities.isGridPositionEmpty(x,y))
                {
                    return false;
                }
            }
        }
        return true;
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

    // NOTE: pre-existing bug preserved from the original — calls
    // this.isTouchingEntity(entity) below, but the only defined method on this
    // class is isTouching(entity) above (same name-mismatch bug as in
    // entity/trapgroup.js) — would throw at runtime.
    update(entity) {
        if (!this.checkTimer.isOver())
            return;

        if (!this.isTouchingEntity(entity))
            return;

        for (var group of this.groups) {
            group.update(entity);
        }

    }
}

export default TrapArea;
