import Utils from '../utils.js';
import { G_TILESIZE } from '../constants.js';

// Split out of map/mapentities.js -- the bucket-grid mechanics behind every
// proximity query in the game (see the G_SPATIAL_SIZE comment in
// constants.js for how the cell size was chosen). This piece only ever
// touches its own grid/cell-size and the map's dimensions -- it has no
// dependency on MapEntities' entity registry (the players/mobs/items/...
// Maps), so unlike mapbroadcaster.js/pathfindingservice.js it doesn't need
// a back-reference to the owning MapEntities at all. Nothing outside
// mapentities.js reaches this class directly (confirmed: no external
// `entities.spatial`/`entities.spatialSize` access anywhere in the
// codebase) -- MapEntities keeps its existing getSpatialEntities/
// addSpatial/removeSpatial/updateSpatial method names as one-line
// delegates, so no external call site changes.
class SpatialIndex {
    constructor(map, size) {
        this.map = map;
        this.spatialSize = size;
        this.spatial = [];
        const spatialWidth = Math.ceil(map.width / size);
        const spatialHeight = Math.ceil(map.height / size);
        for(let i=0, j=0; i < spatialHeight; i++) {
            this.spatial[i] = [];
            for(j=0; j < spatialWidth; j++) {
                this.spatial[i][j] = [];
            }
        }
    }

    getSpatialEntities(arr)
    {
        const x1 = ~~(Math.max(arr[0],0) / this.spatialSize);
        const y1 = ~~(Math.max(arr[1],0) / this.spatialSize);
        const x2 = ~~(Math.min(arr[2],this.map.width-1) / this.spatialSize);
        const y2 = ~~(Math.min(arr[3],this.map.height-1) / this.spatialSize);

        const res = [];
        const l1 = this.spatial.length;
        let l2 = 0;
        for(let j = y1, i=0; j <= y2; ++j)
        {
            l2 = this.spatial[j].length;
            for(i = x1; i <= x2; ++i) {
                /*if (j < 0 || j >= l1)
                  continue;
                if (i < 0 || i >= l2)
                  continue;*/
                for (const entity of this.spatial[j][i]) {
                    if (!entity) continue;
                    res.push(entity);
                }
            }
        }
        return res;
    }

    add(entity) {
        // FIX: `!entity.x || !entity.y` treats a legitimate coordinate of
        // exactly 0 as "missing", silently skipping spatial-grid
        // registration for any entity sitting at x===0 or y===0 (the map
        // edge) -- making it invisible to proximity-based queries (combat
        // targeting, processWho, etc). Use null/undefined checks instead of
        // truthiness so 0 is treated as a valid coordinate.
        if (!entity || entity.x == null || entity.y == null) return;

        const ts = G_TILESIZE;
        const gx = ~~(entity.x / ts);
        const gy = ~~(entity.y / ts);

        const spx = ~~(gx / this.spatialSize);
        const spy = ~~(gy / this.spatialSize);

        // bounds check
        if (spy < 0 || spy >= this.spatial.length ||
            spx < 0 || spx >= this.spatial[spy].length) {
            return;
        }

        entity.spx = spx;
        entity.spy = spy;
        entity.spatialMap = true;

        this.spatial[spy][spx].push(entity);
    }

    // FIX: this used to recompute the entity's spatial cell from
    // entity.x/entity.y at call time instead of using the cell it was
    // actually stored under (entity.spx/entity.spy, set by add() above). By
    // the time remove() runs, entity.x/entity.y already hold the *new*
    // position -- Entity._setPosition() assigns this.x/this.y before
    // calling removeSpatial() -- so recomputing here found the entity's
    // *new* cell, not the old one it was actually sitting in. Whenever an
    // entity crossed a spatial-cell boundary (which every moving mob and
    // player does constantly), that meant this removal was a silent no-op:
    // Utils.removeFromArray() does an indexOf lookup and just finds nothing
    // in the wrong cell's array, and add() then pushed a second, live
    // reference into the new cell -- leaving a permanent "ghost" entry
    // behind in the old cell forever. Since this repeats on every boundary
    // crossing for the lifetime of the server, the spatial arrays grew
    // without bound, and every proximity query built on top of them
    // (getSpatialEntities -> getPlayerAround/getMobsAround/processWho/
    // combat targeting/pathfinding ignore-include lists) returned an
    // ever-growing set of stale duplicate entities that had long since
    // moved elsewhere. Using the entity's own stored spx/spy -- exactly the
    // cell it was last added to -- removes it from the right place.
    remove(entity) {
        if (entity.spatialMap) {
            const spx = entity.spx;
            const spy = entity.spy;

            // bounds check
            if (spy < 0 || spy >= this.spatial.length ||
                spx < 0 || spx >= this.spatial[spy].length) {
                return;
            }

            const spatial = this.spatial[spy][spx];
            Utils.removeFromArray(spatial, entity);
            entity.spatialMap = false;
        }
    }

    // PERF: setPosition() runs on every pixel-step of every moving entity's
    // movement -- Transition.step() (transition.js) can call it up to ~20
    // times per single 32ms world tick for one moving character (see the
    // PERF comment on Map.isColliding in map/map.js for the same loop) --
    // but the entity's spatial-grid cell (a coarser bucket of G_SPATIAL_SIZE
    // tiles, not a single tile) only actually changes on a small fraction of
    // those steps. Previously every single step paid a full remove()+add()
    // pair -- an indexOf+splice out of one array followed by a push into
    // another -- regardless of whether the cell changed at all. Skipping
    // the remove/add entirely when the newly-computed cell matches the
    // entity's current one avoids that wasted work on the overwhelming
    // majority of movement steps.
    update(entity) {
        if (!entity || entity.x == null || entity.y == null) return;

        const ts = G_TILESIZE;
        const gx = ~~(entity.x / ts);
        const gy = ~~(entity.y / ts);

        const spx = ~~(gx / this.spatialSize);
        const spy = ~~(gy / this.spatialSize);

        if (entity.spatialMap && entity.spx === spx && entity.spy === spy)
            return;

        this.remove(entity);
        this.add(entity);
    }
}

export default SpatialIndex;
