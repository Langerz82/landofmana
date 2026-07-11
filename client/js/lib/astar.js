//import Utils from '../utils.js';

// NOTE: the original file ended with a bare top-level `return AStar;`
// after `module.exports` had already been set. That only "worked" because
// CommonJS modules are implicitly wrapped in a function by Node (so a
// top-level `return` just ends the file early); ES modules have no such
// wrapper and a top-level `return` is a SyntaxError. It has been dropped
// here since it was dead code anyway (module.exports/the export below had
// already been assigned).
//
// Also NOTE: the original declared this as `AStar = (function(){...}())`
// with no `var`, which (in the old sloppy-mode CommonJS world) leaked a
// second, true global also named `AStar` -- separate from whatever a
// `require('./lib/astar')` call captured. Other files (e.g. pathfinder.js)
// called `AStar.AStar(...)` relying on that leaked global rather than on
// their own `require()` result. Now that this is a real ES module with no
// global leakage, callers should import this module's default export and
// call `.AStar(...)` on it directly (pathfinder.js has been updated to do
// this).
const AStar = (function () {
    /**
     * A* (A-Star) algorithm for a path finder
     * @author  Andrea Giammarchi
     * @license Mit Style License
     */
    let gGrid;

    function diagonalSuccessors($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i) {
        if($N) {
            $E && !grid[N][E] && (result[i++] = {x:E, y:N});
            $W && !grid[N][W] && (result[i++] = {x:W, y:N});
        }
        if($S){
            $E && !grid[S][E] && (result[i++] = {x:E, y:S});
            $W && !grid[S][W] && (result[i++] = {x:W, y:S});
        }
        return result;
    }

    function diagonalSuccessorsFree($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i) {
        $N = N > -1;
        $S = S < rows;
        $E = E < cols;
        $W = W > -1;
        if($E) {
            $N && !grid[N][E] && (result[i++] = {x:E, y:N});
            $S && !grid[S][E] && (result[i++] = {x:E, y:S});
        }
        if($W) {
            $N && !grid[N][W] && (result[i++] = {x:W, y:N});
            $S && !grid[S][W] && (result[i++] = {x:W, y:S});
        }
        return result;
    }

    function nothingToDo($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i) {
        return result;
    }

    function grids(coord) {
      return gGrid[coord[0]][coord[1]];
    }

    // FIX: $N/$W required N/W to be > 0, excluding valid index 0 -- compare
    // with diagonalSuccessorsFree above, which correctly uses > -1 for the
    // same north/west boundary check. As written, pathfinding could never
    // move into row 0 or column 0 even when that cell was open, so entities
    // near the map's top or left edge could get stuck or take unnecessary
    // detours.
    function successors(find, x, y, grid, rows, cols){
        let
            N = (y - 1),
            S = (y + 1),
            E = (x + 1),
            W = (x - 1),
            $N = N >= 0 && !grids([N,x]),
            $S = S < (rows) && !grids([S,x]),
            $E = E < (cols) && !grids([y,E]),
            $W = W >= 0 && !grids([y,W]),
            result = [],
            i = 0;

        $N && (result[i++] = {x:x, y:N});
        $E && (result[i++] = {x:E, y:y});
        $S && (result[i++] = {x:x, y:S});
        $W && (result[i++] = {x:W, y:y});
        return find($N, $S, $E, $W, N, S, E, W, grid, rows, cols, result, i);
    }

    function diagonal(start, end, f1, f2) {
        return f2(f1(start.x - end.x), f1(start.y - end.y));
    }

    function euclidean(start, end, f1, f2) {
        const
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

    // PERF: A*'s open list used to be a plain array where, on every single
    // iteration of the search, we did a full linear scan to find the
    // lowest-f node (an O(n) scan) and then removed it with array.splice()
    // (another O(n), since splice has to shift every following element
    // down). That makes each step O(n) and the whole search O(n^2) in the
    // size of the open set. A binary min-heap keyed on node.f -- the
    // standard data structure for A*'s open list -- gets/removes the
    // lowest-f node in O(log n) instead. This matters a lot here since
    // pathfinding runs for every mob chase/roam tick and every player
    // click-to-move.
    class MinHeap {
        constructor() {
            this.items = [];
        }

        get length() {
            return this.items.length;
        }

        push(node) {
            const items = this.items;
            items.push(node);
            // Sift the new node up until its parent is no larger.
            let i = items.length - 1;
            while (i > 0) {
                const parent = (i - 1) >> 1;
                if (items[parent].f <= items[i].f) break;
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
                // Sift the root down to restore the heap property.
                let i = 0;
                const n = items.length;
                for (;;) {
                    const l = i * 2 + 1, r = i * 2 + 2;
                    let smallest = i;
                    if (l < n && items[l].f < items[smallest].f) smallest = l;
                    if (r < n && items[r].f < items[smallest].f) smallest = r;
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

    function AStar(grid, start, end, f) {
          gGrid = grid;
          let cols = grid[0].length,
              rows = grid.length,
              f1 = Math.abs,
              f2 = Math.max,
              list = {},
              result = [],
              open = new MinHeap(),
              adj, distance, find, i, j, current, next,
              endnode = {x:end[0], y:end[1], v:end[0]+end[1]*cols};

          open.push({x:start[0], y:start[1], f:0, g:0, turns: 0, v:start[0]+start[1]*cols});

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

          while (open.length > 0) {
              current = open.pop();

              if (current.v !== endnode.v) {
                  next = successors(find, current.x, current.y, grid, rows, cols);

                  for(i = 0, j = next.length; i < j; ++i){
                      adj = next[i];
                      adj.p = current;
                      adj.f = adj.g = 0;
                      adj.v = adj.x + adj.y * cols;
                      adj.turns = current.turns || 0;  // carry over turn count

                      if(!(adj.v in list)){
                        let turnPenalty = 0;

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

                        const stepCost = distance(adj, current, f1, f2);

                        adj.g = current.g + stepCost + turnPenalty;
                        adj.f = adj.g + distance(adj, endnode, f1, f2) + (adj.turns * 50); // secondary tie-breaker

                        open.push(adj);
                        list[adj.v] = 1;
                      }
                  }
              } else {
                  // Reconstruct path
                  i = 0;
                  do {
                      result[i++] = [current.x, current.y];
                  } while (current = current.p);
                  break;
              }
          }

          return (result && result.length > 0) ? result.reverse() : null; // reverse so start -> end
      }

  return {AStar};

}());

export default AStar;
