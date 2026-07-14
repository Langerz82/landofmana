// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import AStar from './lib/astar.js';

/* global Utils */

export default class Pathfinder {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = null;
        this.blankGrid = [];
        this.ignored = [];
        this.included = [];
    }

    isValidPath(path) {
        let pnode = null;
        if (!Array.isArray(path) || path.length < 2)
            return false;
        for (let node of path) {
            if (pnode) {
                if (pnode[0] === node[0] && pnode[1] === node[1])
                    return false;
                if (pnode[0] !== node[0] && pnode[1] !== node[1]) {
                    return false;
                }
            }
            pnode = node;
        }
        return true;
    }

    isValidGridPath(grid, path, isRealPath) {
        const ts = G_TILESIZE,
            ly = grid.length,
            lx = grid[0].length;

        // Check collision from an axis, n1 to n2, n3 is for the other axis.
        const c1to2on3 = function(n1, n2, n3, axis_x) {
            //console.info("c1to2on3 - n1:"+n1+",n2:"+n2+",n3:"+n3);
            n1 = Math.floor(n1), n2 = Math.floor(n2), n3 = Math.floor(n3);
            const i1 = Math.min(n1, n2), i2 = Math.max(n1, n2);
            if (axis_x) {
                for (let i = i1; i <= i2; i++) {
                    if (grid[n3][i]) {
                        return false;
                    }
                }
            } else {
                for (let i = i1; i <= i2; i++) {
                    if (grid[i][n3]) {
                        return false;
                    }
                }
            }
            return true;
        }

        const xf = function(x1, x2, y) {
            return c1to2on3(x1, x2, y, true);
        }
        const yf = function(y1, y2, x) {
            return c1to2on3(y1, y2, x, false);
        }

        const path2 = [];
        for (let i = 0; i < path.length; i++)
            path2[i] = path[i].slice();

        if (isRealPath) {
            for (let coord of path2) {
                coord[0] /= ts;
                coord[1] /= ts;
            }
        }

        let pCoord = null;

        for (let coord of path2) {
            if (coord[1] < 0 || coord[1] >= ly)
                return false;
            if (coord[0] < 0 || coord[0] >= lx)
                return false;

            if (pCoord) {
                if (coord[0] !== pCoord[0] && coord[1] !== pCoord[1])
                    return false;
                if (Math.abs(coord[0] - pCoord[0]) > 0) {
                    if (!xf(pCoord[0], coord[0], coord[1]))
                        return false;
                }
                else if (Math.abs(coord[1] - pCoord[1]) > 0) {
                    if (!yf(pCoord[1], coord[1], coord[0]))
                        return false;
                }
            }
            pCoord = coord;
        }
        return true;
    }

    // from https://chatgpt.com/c/6a3db155-e5c4-83ec-8fac-a774dc81df12
    getShortGrid(grid, start, end, e = 0) {
        const h = grid.length, w = grid[0].length;
        const minX = Math.max(Math.min(~~start[0], ~~end[0]) - e, 0);
        const maxX = Math.min(Math.max(Math.ceil(start[0]), Math.ceil(end[0])) + e, w - 1);
        const minY = Math.max(Math.min(~~start[1], ~~end[1]) - e, 0);
        const maxY = Math.min(Math.max(Math.ceil(start[1]), Math.ceil(end[1])) + e, h - 1);

        const crop = Array.from(
            { length: maxY - minY + 1 },
            (_, y) => new Uint8Array(grid[minY + y].slice(minX, maxX + 1))
        );

        return {
            crop,
            minX,
            minY,
            substart: [start[0] - minX, start[1] - minY],
            subend: [end[0] - minX, end[1] - minY]
        };
    }

    findNeighbourPath(start, end) {
        const ts = G_TILESIZE;

        // If its one space just return the start, end path.
        if ((Math.abs(start[0] - end[0]) <= ts && Math.abs(start[1] - end[1]) === 0) ||
            (Math.abs(start[1] - end[1]) <= ts && Math.abs(start[0] - end[0]) === 0))
            return [[start[0], start[1]], [end[0], end[1]]];

        return null;
    }

    findDirectPath(grid, start, end) {
        //var dx = Math.abs(Math.floor(start[0]) - Math.floor(end[0]));
        //var dy = Math.abs(Math.floor(start[1]) - Math.floor(end[1]));
        const dx = Math.abs(start[0] - end[0]);
        const dy = Math.abs(start[1] - end[1]);

        // PERF: findDirectPath() runs on essentially every click-to-move request. The
        // JSON.stringify() calls below used to run unconditionally as arguments to
        // log.info(), which itself is a no-op unless log.level is "debug"/"info" (see
        // lib/log.js) - so in the common (non-debug) case we were paying to stringify
        // these arrays on every path request just to throw the string away. Gate the
        // stringify behind the same check log.info() does internally.
        const debugLogging = log.level === "debug" || log.level === "info";

        let mp = [start, end];
        if (dx === 0 || dy === 0) {
            if (this.isValidGridPath(grid, mp)) {
                if (debugLogging) log.info("validpath-fdp1:" + JSON.stringify(mp));
                return mp;
            }
        }

        mp = [start, [start[0], end[1]], end];
        if (debugLogging) log.info("mp:" + JSON.stringify(mp));
        if (this.isValidGridPath(grid, mp)) {
            if (debugLogging) log.info("validpath-fdp2:" + JSON.stringify(mp));
            return mp;
        }

        mp = [start, [end[0], start[1]], end];
        if (debugLogging) log.info("mp:" + JSON.stringify(mp));
        if (this.isValidGridPath(grid, mp)) {
            if (debugLogging) log.info("validpath-fdp3:" + JSON.stringify(mp));
            return mp;
        }
        return null;
    }

    makeNodesMidPoints(result) {
        // Make nodes mid-points.
        for (let node of result) {
            if (node[0] % 1 === 0)
                node[0] += 0.5;
            if (node[1] % 1 === 0)
                node[1] += 0.5;
        }
        return result;
    }

    _popAndPushNewNodeInPath(node, result) {
        result.shift();
        result.unshift([node[0], node[1]]);
        let it2 = null;
        for (const it of result) {
            if (it2) {
                if (~~(it2[0]) === ~~(it[0]))
                    it[0] = it2[0];
                else if (~~(it2[1]) === ~~(it[1]))
                    it[1] = it2[1];
                else {
                    break;
                }
            }
            it2 = it;
        }
    }

    convertPathToRealPath(result, start, end) {
        let temp = Utils.copy2DArray(result);

        if (temp.length === 2) {
            temp = Utils.copy2DArray([start, end]);
        } else {
            this._popAndPushNewNodeInPath(start, temp);
            temp.reverse();
            this._popAndPushNewNodeInPath(end, temp);
            temp.reverse();
        }

        temp = this.makeNodesMidPoints(temp);
        return temp;
    }

    _fixDiagonalJumps(path) {
        let fixed = [path[0]];
        for (let i = 1; i < path.length; i++) {
            let prev = fixed[fixed.length - 1];
            let curr = path[i];

            if (prev[0] !== curr[0] && prev[1] !== curr[1]) {
                // Insert corner point
                fixed.push([curr[0], prev[1]]);
            }
            fixed.push(curr);
        }
        return fixed;
    }

    dropUneededNodes(path) {
        if (!Array.isArray(path) || path.length < 2)
            return path;

        const result = [path[0]];

        for (let i = 1; i < path.length; i++) {
            const curr = path[i];
            const prev = result[result.length - 1];

            // Remove consecutive duplicates.
            if (curr[0] === prev[0] && curr[1] === prev[1])
                continue;

            result.push(curr);

            // If we have three nodes, see if the middle one is unnecessary.
            while (result.length >= 3) {
                const a = result[result.length - 3];
                const b = result[result.length - 2];
                const c = result[result.length - 1];

                // Remove b if all three are on the same horizontal or vertical line.
                if ((a[0] === b[0] && b[0] === c[0]) ||
                    (a[1] === b[1] && b[1] === c[1])) {
                    result.splice(result.length - 2, 1);
                } else {
                    break;
                }
            }
        }

        return result;
    }

    AStar(grid, start, end) {
        const pStart = [~~start[0], ~~start[1]];
        const pEnd = [~~end[0], ~~end[1]];
        let path = AStar.AStar(grid, pStart, pEnd);
        if (path) {
            //path = this.convertPathToRealPath(path, start, end);
            path = this.dropUneededNodes(path);
            // PERF: was an unconditional log.info(JSON.stringify(path)) - AStar() is the
            // fallback pathfinder called on every path request that didn't resolve via the
            // cheap findDirectPath()/findShortPath() checks, so this stringified every fallback
            // path even with logging off. Gate it the same way findDirectPath() now does.
            if (log.level === "debug" || log.level === "info")
              log.info(JSON.stringify(path));
            return path;
        }
        return null;
    }

    findShortPath(crop, offsetX, offsetY, start, end) {
        const path = this.AStar(crop, start, end);
        // PERF/FIX: was console.info(...), which (unlike log.info) always logs and always pays
        // the JSON.stringify() cost regardless of log level - moved to the same gated log.info
        // pattern used elsewhere in this file so production builds don't stringify+spam the
        // console on every short-path resolution.
        if (path && (log.level === "debug" || log.level === "info")) {
            log.info("pathfinder.findShortPath - path: " + JSON.stringify(path));
        }
        return path;
    }

    findPath(grid, start, end, findIncomplete) {
        this.applyIgnoreList_(grid, true);
        this.applyIncludeList_(grid, true);

        const path = this.AStar(grid, start, end);
        // PERF/FIX: see findShortPath() above - was an unconditional console.info(JSON.stringify(...)).
        if (path && (log.level === "debug" || log.level === "info")) {
            log.info("pathfinder.findPath - path: " + JSON.stringify(path));
        }
        return path;
    }

    /**
     * Finds a path which leads the closest possible to an unreachable x, y position.
     *
     * Whenever A* returns an empty path, it means that the destination tile is unreachable.
     * We would like the entities to move the closest possible to it though, instead of
     * staying where they are without moving at all. That's why we have this function which
     * returns an incomplete path to the chosen destination.
     *
     * @private
     * @returns {Array} The incomplete path towards the end position
     */
    findIncompletePath_(start, end) {
        let perfect, x, y,
            incomplete = [];

        perfect = AStar.AStar(this.blankGrid, start, end);

        for (let i = perfect.length - 1; i > 0; i -= 1) {
            x = perfect[i][0];
            y = perfect[i][1];

            if (this.grid[y][x] === 0) {
                incomplete = AStar.AStar(this.grid, start, [x, y]); // FIX (carried over): was calling AStar(...) directly instead of AStar.AStar(...); threw TypeError, breaking the fallback path
                break;
            }
        }
        return incomplete;
    }

    /**
     * Removes colliding tiles corresponding to the given entity's position in the pathing grid.
     */
    ignoreEntity(entity) {
        if (entity) {
            this.ignored.push(entity);
        }
    }

    includeEntity(entity) {
        if (entity) {
            this.included.push(entity);
        }
    }

    applyIgnoreList_(grid, ignored) {
        const self = this;
        let x, y;

        _.each(this.ignored, function(entity) {
            x = entity.isMoving() ? entity.nextGridX : entity.gx;
            y = entity.isMoving() ? entity.nextGridY : entity.gy;

            if (x >= 0 && y >= 0) {
                //log.info("path.grid=["+x+","+y+"]");
                grid[y][x] = ignored ? 0 : 1;
            }
        });
    }

    applyIncludeList_(grid, included) {
        const self = this;
        let x, y;

        _.each(this.included, function(entity) {
            x = entity.isMoving() ? (entity.path.length > 0 ? entity.path[entity.path.length - 1][0] : entity.nextGridX) : entity.gx;
            y = entity.isMoving() ? (entity.path.length > 0 ? entity.path[entity.path.length - 1][1] : entity.nextGridY) : entity.gy;

            if (x >= 0 && y >= 0) {
                //log.info("path.grid=["+x+","+y+"]");
                grid[y][x] = included ? 1 : 0;
            }
        });
    }

    clearIgnoreList(grid) {
        this.applyIgnoreList_(grid, false);
        this.ignored = [];
    }

    clearIncludeList(grid) {
        this.applyIncludeList_(grid, false);
        // FIX: copy-paste from clearIgnoreList - was resetting `this.ignored` instead of `this.included`, so the
        // include list was never actually cleared and stale forced-walkable tiles leaked into later pathfinding.
        this.included = [];
    }
}
