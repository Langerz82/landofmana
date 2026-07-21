// Mixin extracted from entitymoving.js: spatial queries -- the file's original 'Grid
// Functions' BEGIN/END blocks (candidate-spot search around a destination,
// collision/entity-occupancy queries, simple tile-distance helpers) - getSpotsAround/
// getClosestSpot/isColliding/getEntitiesAround/isNear/nextDist/nextTile/isWithinPath.
// Installed directly onto EntityMoving.prototype via install*(...) call in
// entitymoving.js; not a standalone class -- see entitymovingpath.js's header comment
// for why a mixin rather than a composed sub-object.
/* global Utils, G_TILESIZE, game */

export function installEntityMovingSpatial(proto) {
    proto.getSpotsAroundFrom = function (dest, adjStart, adjEnd) {
        adjStart = adjStart || 1;
        adjEnd = adjEnd || 1;

        let coords = [];
        const start = Math.min(adjStart, adjEnd);
        const end = Math.max(adjStart, adjEnd);
        for (let i = start; i <= end; ++i) {
            coords = coords.concat(this.getSpotsAround(dest, i));
        }
        return coords;
    };

    proto.getSpotsAround = function (dest, adjDist, startBlocks = 4) {
        adjDist = adjDist || 1;
        const d = adjDist * G_TILESIZE;
        const iterations = adjDist * startBlocks;

        const pos = [dest.x, dest.y];
        const x2 = pos[0],
            y2 = pos[1];

        const sx = this.x,
            sy = this.y;

        let points = [];
        const sec = (2 * Math.PI) / iterations;
        let x,
            y,
            deg = 0;
        for (let i = 0; i < iterations; ++i) {
            deg += sec;
            // Math.round instead of ~~ (truncate-toward-zero). ~~ always rounds
            // down for positive coords, which biased every candidate point
            // toward one corner of the tile instead of landing symmetrically
            // around dest's exact position.
            x = x2 + ~~(Math.cos(deg) * d);
            y = y2 + ~~(Math.sin(deg) * d);
            points.push([x, y]);
        }
        points = points.filter(
            (v, i, a) =>
                a.findIndex((v2) => v2[0] === v[0] && v2[1] === v[1]) === i
        );

        const coords = [];
        let p,
            tp,
            len = points.length;
        for (let i = 0; i < len; ++i) {
            p = points[i];
            coords.push({
                d: Utils.realDistance([sx, sy], p),
                x: p[0],
                y: p[1]
            });
        }
        return coords;
    };

    proto.getClosestSpot = function (dest, adjStart, adjEnd) {
        adjStart = adjStart || 1;
        adjEnd = adjEnd || 1;
        let poss = this.getSpotsAroundFrom(dest, adjStart, adjEnd);
        const sx = this.x,
            sy = this.y;

        // PERF/FIX (carried over): the walkability filter here used to be declared
        // without `var`/`let` (an implicit global leak) and both filtering passes
        // below used to do `poss.splice(poss.indexOf(p), 1)` while iterating `poss`
        // with a `for...of` loop. Splicing during for-of iteration shifts every
        // following element down one index, so the iterator (which just advances
        // to "the next index") silently skips the element that slid into the
        // spot of the one just removed -- a colliding tile or an
        // entity-occupied tile immediately after a removed one could survive the
        // filter uninspected. This let mobs/players occasionally path onto a
        // blocked or occupied spot. It was also O(n^2) (indexOf + splice per
        // removal) where this is called on every follow()/followAttack() -- i.e.
        // every mob chase step and every player attack-move. Using .filter()
        // instead removes both the correctness bug and the O(n^2) cost.
        poss = poss.filter((p) => !this.isColliding(p.x, p.y));

        const entities = this.getEntitiesAround(adjEnd);

        const ts = G_TILESIZE;
        const tsh = ts >> 1;

        let x, y, tx, ty;
        poss = poss.filter((p) => {
            x = p.x;
            y = p.y;
            for (const e2 of entities) {
                if (!e2 || this === e2) continue;
                tx = e2.x;
                ty = e2.y;

                if (
                    typeof e2.isMovingPath === 'function' &&
                    e2.isMovingPath()
                ) {
                    const tp = e2.getLastMove();
                    if (tp) {
                        tx = tp[0];
                        ty = tp[1];
                    }
                }
                if (Math.abs(x - tx) <= tsh && Math.abs(y - ty) <= tsh) {
                    return false;
                }
            }
            return true;
        });

        if (poss.length === 0) return null;

        poss.sort(function (a, b) {
            return a.d - b.d;
        });

        return { x: poss[0].x, y: poss[0].y };
    };

    proto.isColliding = function (x, y) {
        if (typeof game === 'undefined') return this.map.isColliding(x, y);
        else {
            return game.mapContainer.isColliding(x, y);
        }
    };

    proto.getEntitiesAround = function (dist) {
        if (typeof game === 'undefined')
            return this.map.entities.getCharactersAround(this, dist);
        else {
            return game.getEntitiesAround(this.x, this.y, dist * G_TILESIZE);
        }
    };

    proto.isNear = function (character, distance) {
        const dx = Math.abs(this.x - character.x);
        const dy = Math.abs(this.y - character.y);

        return dx <= distance * G_TILESIZE && dy <= distance * G_TILESIZE;
    };

    proto.isNextToo = function (x, y) {
        const ts = G_TILESIZE;
        return Math.abs(this.x - x) <= ts && Math.abs(this.y - y) <= ts;
    };

    proto.nextDist = function (x, y, o, dist) {
        x = x || this.x;
        y = y || this.y;
        o = o || this.orientation;
        dist = dist || 1;

        switch (o) {
            case 1: // N
                return [x, y - dist];
            case 2: // S
                return [x, y + dist];
            case 3: // E
                return [x - dist, y];
            case 4: // W
                return [x + dist, y];
        }
        return [x, y];
    };

    proto.nextMove = function (x, y, o, dist) {
        // FIX: `dist` was computed via `dist || 1` and then ignored - a hardcoded `1` was
        // passed to nextDist() regardless, making the parameter dead/misleading. Use it.
        dist = dist || 1;
        return this.nextDist(x, y, o, dist);
    };

    proto.nextTile = function (x, y, o, dist) {
        // FIX: same issue as nextMove() above - the computed `dist` was discarded in favor of
        // a hardcoded G_TILESIZE.
        dist = dist || G_TILESIZE;
        return this.nextDist(x, y, o, dist);
    };

    // NOTE: no caller anywhere in the client or server codebase currently (grepped
    // for isWithinPath()) -- dead code. Left as-is rather than guess-fixed, since
    // the original "probably broken with new path code" TODO gives no reproduction
    // and there's no live call site to verify a fix against. Treat as
    // unverified/unsafe to call until it has a real caller and a test.
    proto.isWithinPath = function (coords) {
        let tCoords = null;
        if (typeof coords === 'object' && coords.x > 0 && coords.y > 0) {
            tCoords = [coords.x, coords.y];
        } else if (Array.isArray(coords) && coords.length === 2) {
            tCoords = [coords[0], coords[1]];
        }
        if (!tCoords) return null;

        if (this.path === null || this.path.length === 0) return null;

        const pathLen = this.path.length;
        for (let i = 0; i < pathLen; ++i) {
            if (
                this.path[i][0] === tCoords[0] &&
                this.path[i][1] === tCoords[1]
            )
                return {
                    x: tCoords[0],
                    y: tCoords[1],
                    step: i
                };
        }

        return null;
    };
}
