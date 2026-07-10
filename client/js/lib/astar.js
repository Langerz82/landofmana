// Converted from AMD (define) to a native ES6 module.
// Not a Class.extend() - this was already a plain closure/IIFE exporting an object with a single
// `.AStar` method (hence `AStar.AStar(grid, start, end)` at call sites), preserved as-is.
/**
 * A* (A-Star) algorithm for a path finder
 * @author  Andrea Giammarchi
 * @license Mit Style License
 */
var AStar = (function() {
    var gGrid;

    function diagonalSuccessors($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i) {
        if ($N) {
            $E && !grid[N][E] && (result[i++] = {x: E, y: N});
            $W && !grid[N][W] && (result[i++] = {x: W, y: N});
        }
        if ($S) {
            $E && !grid[S][E] && (result[i++] = {x: E, y: S});
            $W && !grid[S][W] && (result[i++] = {x: W, y: S});
        }
        return result;
    }

    function diagonalSuccessorsFree($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i) {
        $N = N > -1;
        $S = S < rows;
        $E = E < cols;
        $W = W > -1;
        if ($E) {
            $N && !grid[N][E] && (result[i++] = {x: E, y: N});
            $S && !grid[S][E] && (result[i++] = {x: E, y: S});
        }
        if ($W) {
            $N && !grid[N][W] && (result[i++] = {x: W, y: N});
            $S && !grid[S][W] && (result[i++] = {x: W, y: S});
        }
        return result;
    }

    function nothingToDo($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i) {
        return result;
    }

    function grids(coord) {
        return gGrid[coord[0]][coord[1]];
    }

    function successors(find, x, y, grid, rows, cols) {
        var
            N = (y - 1),
            S = (y + 1),
            E = (x + 1),
            W = (x - 1),
            $N = N >= 0 && !grids([N, x]),
            $S = S < (rows) && !grids([S, x]),
            $E = E < (cols) && !grids([y, E]),
            $W = W >= 0 && !grids([y, W]),
            result = [],
            i = 0;

        $N && (result[i++] = {x: x, y: N});
        $E && (result[i++] = {x: E, y: y});
        $S && (result[i++] = {x: x, y: S});
        $W && (result[i++] = {x: W, y: y});
        return find($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i);
    }

    function diagonal(start, end, f1, f2) {
        return f2(f1(start.x - end.x), f1(start.y - end.y));
    }

    function euclidean(start, end, f1, f2) {
        var
            x = start.x - end.x,
            y = start.y - end.y
        ;
        return f2(x * x + y * y);
    }

    function manhattan(start, end, f1, f2) {
        return f1(start.x - end.x) + f1(start.y - end.y);
    }

    function getDir(n1, n2) {
        if (n1.x < n2.x)
            return 1;
        if (n1.x > n2.x)
            return 2;
        if (n1.y < n2.y)
            return 3;
        if (n1.y > n2.y)
            return 4;
        return 0;
    }

    function AStar(grid, start, end, f) {
        gGrid = grid;
        var cols = grid[0].length,
            rows = grid.length,
            limit = cols * rows,
            f1 = Math.abs,
            f2 = Math.max,
            list = {},
            result = [],
            open = [{x: start[0], y: start[1], f: 0, g: 0, turns: 0, v: start[0] + start[1] * cols}],
            length = 1,
            adj, distance, find, i, j, max, min, current, next,
            endnode = {x: end[0], y: end[1], v: end[0] + end[1] * cols};

        switch (f) {
            case "Diagonal":
                find = diagonalSuccessors;
            case "DiagonalFree":
                distance = diagonal;
                break;
            case "Euclidean":
                find = diagonalSuccessors;
            case "EuclideanFree":
                f2 = Math.sqrt;
                distance = euclidean;
                break;
            default:
                distance = manhattan;
                find = nothingToDo;
                break;
        }
        find || (find = diagonalSuccessorsFree);

        do {
            max = Infinity;  // better than limit for large grids
            min = 0;
            for (i = 0; i < length; ++i) {
                if ((f = open[i].f) < max) {
                    max = f;
                    min = i;
                }
            }

            current = open.splice(min, 1)[0];

            if (current.v !== endnode.v) {
                --length;
                next = successors(find, current.x, current.y, grid, rows, cols);

                for (i = 0, j = next.length; i < j; ++i) {
                    adj = next[i];
                    adj.p = current;
                    adj.f = adj.g = 0;
                    adj.v = adj.x + adj.y * cols;
                    adj.turns = current.turns || 0;  // carry over turn count

                    if (!(adj.v in list)) {
                        var extra = 0;
                        var turnPenalty = 0;

                        if (current && typeof current.dir !== 'undefined') {
                            adj.dir = getDir(adj, current);

                            // Strong turn penalty
                            if (current.dir !== adj.dir && adj.dir !== 0) {
                                turnPenalty = 1000;           // Very high to prioritize fewer turns
                                adj.turns = current.turns + 1;
                            }
                        } else {
                            // First move - no turn yet
                            adj.dir = getDir(adj, current);
                        }

                        var stepCost = distance(adj, current, f1, f2);

                        adj.g = current.g + stepCost + turnPenalty;
                        adj.f = adj.g + distance(adj, endnode, f1, f2) + (adj.turns * 50); // secondary tie-breaker

                        open[length++] = adj;
                        list[adj.v] = 1;
                    }
                }
            } else {
                // Reconstruct path
                i = length = 0;
                do {
                    result[i++] = [current.x, current.y];
                } while (current = current.p);
            }
        } while (length);

        return (result && result.length > 0) ? result.reverse() : null; // reverse so start -> end
    }

    return {AStar};

}());

export default AStar;
