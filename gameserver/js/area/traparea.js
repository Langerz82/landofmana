import EntityArea from './entityarea.js';
import Timer from '../timer.js';
import TrapGroup from '../entity/trapgroup.js';
import Utils from '../utils.js';
import { G_TILESIZE } from '../constants.js';

// FIX/DEAD CODE: TrapArea is never instantiated anywhere in the codebase --
// map/mapmanager.js explicitly leaves it (and TrapGroup) unwired; see the
// NOTE there. Treat this whole file, entity/trapgroup.js, and entity/trap.js
// as not-implemented until TrapArea is actually wired into mapmanager.js and
// Messages.SwapSprite (trap.js's on()/off()) is implemented for real.
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
        let pos = null;
        // NOTE: this used to be `var threshold = threshold || 50;` --
        // `var` redeclaring a parameter name just reassigns the existing
        // binding (legal, if confusing); `let`/`const` doing the same
        // throws a SyntaxError ("already been declared"). `threshold` is
        // already a parameter, so this is just a plain reassignment.
        threshold = threshold || 50;

        let t = 0;
        while (t++ < threshold) {
            pos = [
                this.gx + Utils.randomInt(this.width / G_TILESIZE - width),
                this.gy + Utils.randomInt(this.height / G_TILESIZE - height)
            ];

            if (this.isGroupEmptyPositions(pos, width, height)) break;

            pos = null;
        }

        if (!pos) {
            console.error(
                'TrapArea - addRandomGroup - failed, threshold reached.'
            );
            return;
        }

        const group = new TrapGroup(
            kind,
            pos[0],
            pos[1],
            width,
            height,
            this.map,
            this.damage,
            this.switchInterval
        );

        this.addGroup(group);
    }

    isGroupEmptyPositions(pos, width, height) {
        console.info(
            'isGroupEmptyPositions: pos=[' +
                pos[0] +
                ',' +
                pos[1] +
                '],w=' +
                width +
                ',h=' +
                height
        );
        for (let i = 0; i < width; ++i) {
            for (let j = 0; j < height; ++j) {
                const x = pos[0] + i;
                const y = pos[1] + j;
                if (!this.map.entities.isGridPositionEmpty(x, y)) {
                    return false;
                }
            }
        }
        return true;
    }

    // FIX: was multiplying this.x/this.y/this.width/this.height by
    // G_TILESIZE, treating them as grid-scale coordinates. But Area's
    // constructor (area.js) stores x/y/width/height exactly as passed in
    // (this.x = x, no /G_TILESIZE conversion -- that's what the separate
    // this.gx/this.gy grid-scale fields are for), the same convention
    // Area.contains() already relies on (`x < this.x + this.width`,
    // comparing directly against world-scale coordinates with no scaling).
    // entity.x/entity.y are always world-scale too, so multiplying this
    // area's bounds by G_TILESIZE here inflated them by a factor of
    // G_TILESIZE, making isTouching() true almost everywhere (or, past
    // map edges, effectively never matching intended trap placement) --
    // whichever direction it broke, trap bounds would never correspond to
    // where the trap was actually placed. Currently dead code -- TrapArea
    // is never instantiated anywhere (see mapmanager.js's own NOTE) -- but
    // fixed for correctness in case the trap system is re-enabled later.
    isTouching(entity) {
        const ts = G_TILESIZE;
        const half = ts >> 1;
        const left = this.x - half;
        const right = this.x + this.width + half;
        const top = this.y - half;
        const bottom = this.y + this.height + half;

        return (
            entity.x >= left &&
            entity.x <= right &&
            entity.y >= top &&
            entity.y <= bottom
        );
    }

    // FIX: was calling the nonexistent this.isTouchingEntity(entity); the only
    // defined method on this class is isTouching(entity) above. This threw on
    // every update() call, so traps never actually applied damage.
    update(entity) {
        if (!this.checkTimer.isOver()) return;

        if (!this.isTouching(entity)) return;

        for (const group of this.groups) {
            group.update(entity);
        }
    }
}

export default TrapArea;
