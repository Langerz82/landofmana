// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import Pathfinder from '../pathfinder.js';
import { G_TILESIZE, G_DEBUG } from '../constants.js';
import Utils from '../utils.js';

// Split out of map/mapentities.js -- findPath() alone was ~150 lines, the
// single biggest method in that file, and (unlike the entity-registry/
// proximity-query methods left behind there) it never touches the entity
// Maps -- only this.pathfinder/this.map/this.entitygrid. Those three stay
// as real, directly-writable properties on the owning MapEntities (`this.me`
// below) rather than being privately owned here, because external code
// reaches `map.entities.pathfinder.X()` and `map.entities.entitygrid`
// directly in several places (callbacks/playercallback.js,
// callbacks/npcmovecallback.js, entity/player.js) -- hiding them inside
// this class would have broken those call sites. MapEntities keeps its
// existing initPathFinder/initPathingGrid/findPath method names as one-line
// delegates, so nothing outside mapentities.js needs to change.
class MapPathfindingService {
    constructor(mapEntities) {
        this.me = mapEntities;
    }

    initPathFinder() {
        this.me.pathfinder = new Pathfinder(
            this.me.map.width,
            this.me.map.height
        );
    }

    initPathingGrid() {
        const map = this.me.map;
        console.info(
            'pathinggrid height:' + map.height + ', width:' + map.width
        );

        const grid = new Array(map.height);
        for (let i = 0; i < map.height; ++i) {
            grid[i] = new Uint8Array(map.width);
            for (let j = 0; j < map.width; ++j) {
                if (map.grid[i][j]) grid[i][j] = 1;
                else grid[i][j] = 0;
            }
        }
        this.me.entitygrid = grid.slice(0);

        console.info(
            'Initialized the pathing grid with static colliding cells.'
        );
    }

    // Makes `path` (pixel waypoints) start exactly at (x, y): (x, y), then the corner
    // that keeps every leg on one axis, then the old first waypoint, then the rest;
    // repeated and collinear waypoints are merged (dropUneededNodes).
    startAtPosition(path, x, y) {
        if (!path || path.length === 0) return path;
        const first = path[0];
        if (first[0] === x && first[1] === y) return path;
        const out = [[x, y]];
        if (first[0] !== x && first[1] !== y) {
            // one leg on each axis: go along the axis the next leg doesn't use first,
            // so the turn onto the path's own line happens on the tile centre
            const next = path[1];
            const nextAlongX = next && next[1] === first[1];
            out.push(nextAlongX ? [x, first[1]] : [first[0], y]);
        }
        for (const node of path) out.push([node[0], node[1]]);
        return this.me.pathfinder.dropUneededNodes(out);
    }

    findPath(character, x, y, ignoreList) {
        const pathfinder = this.me.pathfinder;
        const map = this.me.map;

        if (pathfinder && character) {
            const grid = map.grid;
            let path = null;
            const pS = [character.x, character.y];
            const ts = G_TILESIZE;

            if (map.isColliding(character.x, character.y)) {
                return null;
            }

            const pE = [x, y];
            if (map.isColliding(x, y)) {
                return null;
            }

            // PERF: unlike the isValidGridPath()/character-position sanity
            // checks further down in this function (genuine invariant
            // violations -- the pathfinding math produced something that
            // shouldn't be possible -- which is why those are left as
            // unconditional anomaly signals), a start===end path request is
            // an ordinary, expected outcome, not a bug: it's simply "no path
            // needed". findPath()'s own callers (entitymoving.js's
            // requestPathfindingTo -> _moveTo) already treat a null return as
            // a normal no-op. Combat routinely hits this -- e.g.
            // mobai.js's checkChase() calls mob.follow(target) again on every
            // tick a mob stays overlapping its target, and getClosestSpot()
            // can resolve to the mob's own current position when it's
            // already correctly placed -- so this was paying for a full
            // stack-trace capture and log on a frequent, routine combat path.
            // Gated behind G_DEBUG like the equivalent per-request diagnostic
            // logging elsewhere in this codebase.
            if (pS[0] === pE[0] && pS[1] === pE[1]) {
                // PERF/FIX: consolidated the try/throw/catch stack capture
                // into Utils.captureStack() (utils.js) -- see that file for
                // why the throw/catch was unnecessary in the first place.
                // Still gated behind G_DEBUG as before.
                if (G_DEBUG) console.info(Utils.captureStack());
                return null;
            }

            const fgpS = [~~(pS[0] / ts), ~~(pS[1] / ts)];
            const fgpE = [~~(pE[0] / ts), ~~(pE[1] / ts)];
            const shortGrid = pathfinder.getShortGrid(grid, fgpS, fgpE, 3);
            const sgrid = shortGrid.crop;
            const spS = shortGrid.substart;
            const spE = shortGrid.subend;
            // Exact (decimal) grid positions for A*, which handles sub-tile
            // start/end points itself. findDirectPath() below still works on
            // the tile-snapped spS/spE.
            const gpS = [pS[0] / ts, pS[1] / ts];
            const gpE = [pE[0] / ts, pE[1] / ts];
            let subpath = null;

            // PERF: findPath runs for every mob chase/roam/player click-path
            // request -- these JSON.stringify calls used to run
            // unconditionally on every single call, so they're gated behind
            // G_DEBUG like the rest of the pathfinding trace logging.
            if (G_DEBUG) {
                console.info('findDirectPath - spS:' + JSON.stringify(spS));
                console.info('findDirectPath - spE:' + JSON.stringify(spE));
            }
            subpath = pathfinder.findDirectPath(sgrid, spS, spE);

            if (subpath) {
                subpath = pathfinder.makeNodesMidPoints(subpath);
                subpath = pathfinder.dropUneededNodes(subpath);
                if (G_DEBUG)
                    console.info(
                        'findDirectPath - subpath:' + JSON.stringify(subpath)
                    );
                if (!pathfinder.isValidGridPath(sgrid, subpath)) {
                    // PERF/FIX: consolidated into Utils.captureStack(), see
                    // above.
                    console.error(Utils.captureStack());
                    return null;
                }
                let res = pathfinder.getFullFromShortPath(
                    subpath,
                    shortGrid.minX,
                    shortGrid.minY
                );
                // FIX (mobs stopped mid-step): the direct path is built from the start
                // *tile* (fgpS, then makeNodesMidPoints), so it always begins at the
                // tile's centre, not where the character actually is. A character that
                // was stopped mid-step (e.g. a mob giving up a chase) is a few pixels off
                // that centre, and waypoints only count as reached on an exact x and y
                // match (entitymovingpath.js nextStepPath), so it walked alongside the
                // path, never hit the next waypoint and kept walking past it - e.g. a
                // mob walking home overshot its spawn. Start the path at the real
                // position instead, stepping onto the tile centre first if needed
                // (inside the start tile, so no new collision), one axis at a time.
                res = this.startAtPosition(res, character.x, character.y);
                if (G_DEBUG)
                    console.info('findDirectPath - res:' + JSON.stringify(res));
                if (!pathfinder.isValidGridPath(map.grid, res, true)) {
                    // PERF/FIX: consolidated into Utils.captureStack(), see
                    // above.
                    console.error(Utils.captureStack());
                    return null;
                }
                return res;
            }

            if (!path) {
                subpath = pathfinder.findShortPath(
                    sgrid,
                    shortGrid.minX,
                    shortGrid.minY,
                    [gpS[0] - shortGrid.minX, gpS[1] - shortGrid.minY],
                    [gpE[0] - shortGrid.minX, gpE[1] - shortGrid.minY]
                );
                if (subpath)
                    path = pathfinder.getFullFromShortPath(
                        subpath,
                        shortGrid.minX,
                        shortGrid.minY
                    );
                if (G_DEBUG)
                    console.info(
                        'findPath - shortPath:' + JSON.stringify(path)
                    );
            }

            if (!path) {
                console.warn('findPath - DANGER - findPath LONGGG');
                // PERF/FIX: this fallback's padding was 10 tiles. Benchmarked
                // getShortGrid+findShortPath (the actual crop+A* pipeline)
                // across synthetic sparse/medium/dense terrain at several
                // start->end distances: in dense/maze-like obstacle areas
                // (the exact case this fallback exists for -- it only runs
                // after the primary e=3 short-grid attempt already failed),
                // e=10 still left a meaningful chunk of searches failing
                // outright (returning no path at all): 8.3% at 20 tiles,
                // 5% at 40 tiles, 3.3% at 70 tiles. The failure-rate curve
                // flattens out around e=15-16 (going bigger than that pays
                // for a larger crop without meaningfully reducing failures
                // further -- the remaining few percent are genuinely
                // disconnected/blocked regions no amount of padding fixes).
                // 16 trades a somewhat larger crop on this already-rare
                // "DANGER" path for meaningfully fewer total pathfinding
                // failures in dense terrain.
                const longGrid = pathfinder.getShortGrid(grid, fgpS, fgpE, 16);
                const lpS = [gpS[0] - longGrid.minX, gpS[1] - longGrid.minY];
                const lpE = [gpE[0] - longGrid.minX, gpE[1] - longGrid.minY];
                path = pathfinder.findShortPath(
                    longGrid.crop,
                    longGrid.minX,
                    longGrid.minY,
                    lpS,
                    lpE
                );
                if (path) {
                    path = pathfinder.dropUneededNodes(path);
                    path = pathfinder.getFullFromShortPath(
                        path,
                        longGrid.minX,
                        longGrid.minY
                    );
                }
                if (G_DEBUG)
                    console.info('findPath - longPath:' + JSON.stringify(path));
            }

            // FIX (mobs giving up a chase they could finish): the e=16 search above
            // still fails when the way round is a long detour (a river with the bridge
            // further along, a cliff edge) - on map1 about 1 in 1500 chases needed more
            // room. One wider try (e=32) before giving up; it only runs once both
            // smaller searches have failed.
            if (!path) {
                const wideGrid = pathfinder.getShortGrid(grid, fgpS, fgpE, 32);
                path = pathfinder.findShortPath(
                    wideGrid.crop,
                    wideGrid.minX,
                    wideGrid.minY,
                    [gpS[0] - wideGrid.minX, gpS[1] - wideGrid.minY],
                    [gpE[0] - wideGrid.minX, gpE[1] - wideGrid.minY]
                );
                if (path) {
                    path = pathfinder.dropUneededNodes(path);
                    path = pathfinder.getFullFromShortPath(
                        path,
                        wideGrid.minX,
                        wideGrid.minY
                    );
                }
            }

            if (!path) {
                console.error(
                    'findPath - Error while finding the path to ' +
                        x +
                        ', ' +
                        y +
                        ' for ' +
                        character.id
                );
                return null;
            }
            if (!pathfinder.isValidGridPath(map.grid, path, true)) {
                // PERF/FIX: consolidated into Utils.captureStack(), see
                // above.
                console.error(Utils.captureStack());
                return null;
            }
            if (!(path[0][0] === character.x && path[0][1] === character.y)) {
                console.error(Utils.captureStack());
                return null;
            }
            return path;
        }
        return null;
    }
}

export default MapPathfindingService;
