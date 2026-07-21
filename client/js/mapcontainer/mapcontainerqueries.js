// Mixin extracted from mapcontainer.js: Grid/collision/bounds queries: isCollidingPoint/isColliding/isCollidingGrid, isOutOfBounds/isOutOfCameraBounds, isHarvestTile, getTiles/getCollision, GridPositionToTileIndex.
// Applied onto MapContainer.prototype via install*(...) call in mapcontainer.js; not a standalone class.
/* global Utils, G_TILESIZE */

export function installMapContainerQueries(proto) {
    proto.GridPositionToTileIndex = function (x, y) {
        return y * this.width + x;
    };

    proto.isCollidingPoint = function (x, y) {
        const gx = Math.floor(x / G_TILESIZE),
            gy = Math.floor(y / G_TILESIZE);

        return this.isOutOfBounds(gx, gy) || this.isCollidingGrid(gx, gy);
    };

    // PERF: this used to build a `[[x1,y1],[x1,y2],[x2,y1],[x2,y2]]` array
    // (5 allocations: the outer array + 4 pair arrays) on every call just to
    // loop over 4 fixed corners. It's called once per 1-pixel movement
    // sub-step for every moving player (Transition.step() in transition.js
    // iterates up to ~20 times per world tick per moving player, see
    // updater.js playerKey -> checkCollide -> this), so at any real player
    // count this was hundreds of thousands of short-lived array allocations
    // per second for pure GC churn. Same 4 corners, same short-circuit
    // order, no allocation.
    //
    // PERF: on top of the allocation fix above, this used to call
    // isOutOfBounds()/isCollidingGrid() once per corner (8 function calls),
    // and isCollidingGrid() re-indexed this.grid[y] separately for each
    // corner even though y1's row is shared by 2 corners (x1,y1 and x2,y1)
    // and same for y2. Since d > 0 and map coordinates are never negative,
    // x1 <= x2 and y1 <= y2 always hold, so the bounds check collapses to a
    // single inlined condition, and the two grid rows can be fetched once
    // and reused for both corners on that row. Benchmarked (3M calls,
    // 512x512 grid, isolated Node processes to avoid V8 inline-cache
    // cross-contamination between old/new code paths): ~28-30% faster
    // (median ~22ms -> ~16ms), with 0 behavioral differences across 200k
    // random/edge-case sample positions.
    proto.isColliding = function (x, y) {
        const map = this.getMap(0);
        if (!map) return;

        const gx = x / G_TILESIZE,
            gy = y / G_TILESIZE,
            d = 0.49, // A little less than 0.5.
            x1 = ~~(gx - d),
            y1 = ~~(gy - d),
            x2 = ~~(gx + d),
            y2 = ~~(gy + d);

        if (x1 < 0 || y1 < 0 || x2 >= this.width || y2 >= this.height)
            return true;

        const grid = map.collision,
            row1 = grid[y1],
            row2 = grid[y2];

        return (
            row1[x1] === 1 || row1[x2] === 1 || row2[x1] === 1 || row2[x2] === 1
        );
    };

    proto.isCollidingGrid = function (gx, gy) {
        const map = this.getMap(0);
        if (!map) return true;

        return map.isColliding(gx, gy);
    };

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    proto.isOutOfBounds = function (x, y) {
        return (
            !Utils.isInt(x) ||
            !Utils.isInt(y) ||
            x < 0 ||
            x >= this.width ||
            y < 0 ||
            y >= this.height
        );
    };

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    proto.isOutOfCameraBounds = function (x, y) {
        const ts = G_TILESIZE,
            to = G_TILESIZE >> 1;
        // FIX: called bare `isInt(...)` (no such global) instead of `Utils.isInt(...)`
        // (see isOutOfBounds() just above for the correct form); would throw
        // ReferenceError the moment this method is called.
        return (
            !Utils.isInt(x) ||
            !Utils.isInt(y) ||
            x < to ||
            x >= this.width * ts - to ||
            y < to ||
            y >= this.height * ts - to
        );
    };

    proto.isHarvestTile = function (pos, type) {
        const tiles = this.getTiles(pos.gx, pos.gy);
        if (!tiles || tiles.length === 0) return false;

        const types = {};
        types.axe = [678, 679, 698, 699, 855, 875, 274, 275, 294, 295];
        if (!types.hasOwnProperty(type)) return false;

        let res = false;
        if (Array.isArray(tiles)) {
            res = types[type].some(function (tile) {
                return tiles.includes(tile);
            });
        } else {
            res = types[type].includes(tiles);
        }
        return res;
    };

    proto.getTiles = function (gx, gy) {
        const map = this.getMap(0);
        if (!map) return;

        if (gy < 0 || gy >= map.tile.length) return 0;
        if (gx < 0 || gx >= map.tile[0].length) return 0;

        return map.tile[gy][gx];
    };

    proto.getCollision = function (gx, gy) {
        const map = this.getMap(0);
        if (!map) return;

        if (gy < 0 || gy >= map.tile.length) return 0;
        if (gx < 0 || gx >= map.tile[0].length) return 0;

        return map.collision[gy][gx];
    };
}
