// A* path finder for an axis-aligned tile grid, working in *decimal* grid
// coordinates.
//
//   AStar.AStar(grid, start, end, options?)
//
//   grid    - grid[y][x], truthy = blocked tile.
//   start   - [x, y] in grid units, may be decimal (e.g. [3.7, 5.25]).
//             The tile a point is in is [Math.floor(x), Math.floor(y)].
//   end     - [x, y] in grid units, may be decimal.
//   options - optional { turnCost }:
//               turnCost - extra cost (in tiles of distance) charged every
//                          time the path changes direction. The default
//                          (1000) means "fewest direction changes first,
//                          then shortest"; a small value such as 2-5 trades
//                          a few extra turns for noticeably shorter paths.
//
// Returns an array of [x, y] nodes (start -> end), or null if no path exists.
//   - The first node is exactly `start` and the last is exactly `end`.
//   - Every segment is horizontal or vertical (no diagonals).
//   - Only nodes where the direction changes are included, so a straight
//     run is a single segment no matter how many tiles it covers.
//   - Intermediate nodes may be decimal: the first segment stays on the
//     start's own row/column line (e.g. y = 5.25), the last segment on the
//     end's, and any segments in between run along tile centres (n + 0.5).
//
// How it works: A* runs over (tile, direction-of-travel) states rather than
// just tiles, so it can genuinely minimise direction changes (a tile-only
// search marks a tile visited from whichever direction reaches it first and
// can't tell that arriving from another direction would save a turn later).
// The heuristic is Manhattan distance plus turnCost x a lower bound on the
// turns still needed, so the search stays tight even with a large turnCost.
// The tile path is then converted into decimal "lanes": a horizontal segment
// can run at any y inside its tile row without touching another tile, so it
// is placed on the start's/end's own line where possible, which removes the
// little sidesteps you get from snapping the start/end to tile centres.
//
// Originally based on the A* path finder by Andrea Giammarchi (MIT Style
// License); rewritten for decimal coordinates and turn-minimising search.
const AStar = (function () {
    // Directions: 0 = +x (east), 1 = -x (west), 2 = +y (south), 3 = -y (north).
    // d ^ 1 is the reverse direction; d < 2 means horizontal.
    const DX = [1, -1, 0, 0];
    const DY = [0, 0, 1, -1];

    const DEFAULT_TURN_COST = 1000;

    // Lower bound on the number of direction changes still needed to reach a
    // tile (dx, dy) away when currently travelling in direction d (-1 = not
    // moving yet).
    function minTurns(d, dx, dy) {
        if (d < 0) return dx !== 0 && dy !== 0 ? 1 : 0;
        let along, across;
        if (d < 2) {
            along = d === 0 ? dx : -dx;
            across = dy;
        } else {
            along = d === 2 ? dy : -dy;
            across = dx;
        }
        if (across === 0) return along >= 0 ? 0 : 2;
        return along >= 0 ? 1 : 2;
    }

    // Binary min-heap on f; ties prefer the larger g (deeper node), which
    // makes A* head straight for the goal instead of fanning out sideways.
    class MinHeap {
        constructor() {
            this.items = [];
        }

        get length() {
            return this.items.length;
        }

        static less(a, b) {
            return a.f < b.f || (a.f === b.f && a.g > b.g);
        }

        push(node) {
            const items = this.items;
            items.push(node);
            let i = items.length - 1;
            while (i > 0) {
                const parent = (i - 1) >> 1;
                if (!MinHeap.less(items[i], items[parent])) break;
                const tmp = items[parent];
                items[parent] = items[i];
                items[i] = tmp;
                i = parent;
            }
        }

        pop() {
            const items = this.items;
            const top = items[0];
            const last = items.pop();
            if (items.length > 0) {
                items[0] = last;
                let i = 0;
                const n = items.length;
                for (;;) {
                    const l = i * 2 + 1,
                        r = l + 1;
                    let smallest = i;
                    if (l < n && MinHeap.less(items[l], items[smallest]))
                        smallest = l;
                    if (r < n && MinHeap.less(items[r], items[smallest]))
                        smallest = r;
                    if (smallest === i) break;
                    const tmp = items[smallest];
                    items[smallest] = items[i];
                    items[i] = tmp;
                    i = smallest;
                }
            }
            return top;
        }
    }

    // Best-known g per (tile, direction) state. Small searches (every cropped
    // short-grid search) use flat typed arrays that are reused between calls,
    // invalidated by bumping a generation stamp instead of being cleared.
    // Very large grids (e.g. a full 1024x1024 map fallback) would need tens of
    // MB of buffers, and A* only touches a fraction of the states anyway, so
    // those fall back to a Map.
    const DENSE_STATE_LIMIT = 1 << 20;
    let denseG = new Float64Array(0);
    let denseStamp = new Uint32Array(0);
    let generation = 0;

    function makeBestStore(stateCount) {
        if (stateCount > DENSE_STATE_LIMIT) {
            const map = new Map();
            return {
                get: (s) => {
                    const v = map.get(s);
                    return v === undefined ? Infinity : v;
                },
                set: (s, g) => {
                    map.set(s, g);
                }
            };
        }
        if (denseG.length < stateCount) {
            denseG = new Float64Array(stateCount);
            denseStamp = new Uint32Array(stateCount);
            generation = 0;
        }
        generation = (generation + 1) >>> 0;
        if (generation === 0) {
            denseStamp.fill(0);
            generation = 1;
        }
        const gen = generation,
            g = denseG,
            stamp = denseStamp;
        return {
            get: (s) => (stamp[s] === gen ? g[s] : Infinity),
            set: (s, v) => {
                stamp[s] = gen;
                g[s] = v;
            }
        };
    }

    function isBlocked(grid, x, y) {
        return !!grid[y][x];
    }

    // Tile-level search. Returns the goal node (follow .p back to the start)
    // or null.
    function searchTiles(grid, sx, sy, ex, ey, turnCost) {
        const rows = grid.length,
            cols = grid[0].length,
            best = makeBestStore(rows * cols * 4),
            open = new MinHeap();

        open.push({
            x: sx,
            y: sy,
            d: -1,
            g: 0,
            f:
                Math.abs(ex - sx) +
                Math.abs(ey - sy) +
                turnCost * minTurns(-1, ex - sx, ey - sy),
            p: null
        });

        while (open.length > 0) {
            const n = open.pop();

            // Stale heap entry: a cheaper way into this state was found after
            // this one was queued.
            if (n.d >= 0 && n.g > best.get((n.y * cols + n.x) * 4 + n.d))
                continue;

            if (n.x === ex && n.y === ey) return n;

            for (let d = 0; d < 4; d++) {
                // Never reverse straight back onto the previous tile.
                if (n.d >= 0 && d === (n.d ^ 1)) continue;

                const nx = n.x + DX[d],
                    ny = n.y + DY[d];
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                if (isBlocked(grid, nx, ny)) continue;

                const g = n.g + 1 + (n.d >= 0 && d !== n.d ? turnCost : 0);
                const s = (ny * cols + nx) * 4 + d;
                if (g >= best.get(s)) continue;
                best.set(s, g);

                const hx = ex - nx,
                    hy = ey - ny;
                open.push({
                    x: nx,
                    y: ny,
                    d,
                    g,
                    f:
                        g +
                        Math.abs(hx) +
                        Math.abs(hy) +
                        turnCost * minTurns(d, hx, hy),
                    p: n
                });
            }
        }
        return null;
    }

    // Collapse the tile path into straight segments: [{ d, x, y }] where x, y
    // is the segment's first tile after the turn (enough to know which row or
    // column a segment runs along).
    function toSegments(goal) {
        const nodes = [];
        for (let n = goal; n; n = n.p) nodes.push(n);
        nodes.reverse();

        const segs = [];
        for (let i = 1; i < nodes.length; i++) {
            const n = nodes[i];
            if (segs.length === 0 || segs[segs.length - 1].d !== n.d)
                segs.push({ d: n.d, x: n.x, y: n.y });
        }
        return segs;
    }

    // Turn tile segments into decimal nodes. Each segment is a line at a fixed
    // coordinate (its "lane"): y for horizontal segments, x for vertical ones.
    function toDecimalPath(segs, start, end) {
        const sx = start[0],
            sy = start[1],
            ex = end[0],
            ey = end[1];
        const K = segs.length;

        // Same tile: at most one turn needed, anywhere inside the tile is fine.
        if (K === 0) {
            if (sx === ex && sy === ey) return [[sx, sy]];
            if (sx === ex || sy === ey)
                return [
                    [sx, sy],
                    [ex, ey]
                ];
            return [
                [sx, sy],
                [ex, sy],
                [ex, ey]
            ];
        }

        // One straight run of tiles. If start and end aren't on exactly the
        // same line, finish with a small sidestep inside the end tile.
        if (K === 1) {
            const horizontal = segs[0].d < 2;
            if (horizontal ? sy === ey : sx === ex)
                return [
                    [sx, sy],
                    [ex, ey]
                ];
            return [
                [sx, sy],
                horizontal ? [ex, sy] : [sx, ey],
                [ex, ey]
            ];
        }

        const lane = (k) => {
            const seg = segs[k];
            const horizontal = seg.d < 2;
            if (k === 0) return horizontal ? sy : sx;
            if (k === K - 1) return horizontal ? ey : ex;
            return horizontal ? seg.y + 0.5 : seg.x + 0.5;
        };

        const path = [[sx, sy]];
        for (let k = 0; k < K - 1; k++) {
            // A corner sits where a horizontal lane meets a vertical one.
            const a = lane(k),
                b = lane(k + 1);
            path.push(segs[k].d < 2 ? [b, a] : [a, b]);
        }
        path.push([ex, ey]);
        return path;
    }

    function AStar(grid, start, end, options) {
        if (!grid || !grid.length || !grid[0] || !grid[0].length) return null;

        const rows = grid.length,
            cols = grid[0].length;
        const turnCost =
            options && typeof options === 'object' && options.turnCost >= 0
                ? options.turnCost
                : DEFAULT_TURN_COST;

        const tsx = Math.floor(start[0]),
            tsy = Math.floor(start[1]),
            tex = Math.floor(end[0]),
            tey = Math.floor(end[1]);

        if (tsx < 0 || tsy < 0 || tsx >= cols || tsy >= rows) return null;
        if (tex < 0 || tey < 0 || tex >= cols || tey >= rows) return null;
        // The start tile may be marked blocked (e.g. by the entity standing
        // on it); the destination may not.
        if (isBlocked(grid, tex, tey)) return null;

        const goal = searchTiles(grid, tsx, tsy, tex, tey, turnCost);
        if (!goal) return null;

        return toDecimalPath(toSegments(goal), start, end);
    }

    return { AStar };
})();

export default AStar;
