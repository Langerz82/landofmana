var Utils = require('.././utils');

module.exports = AStar = (function () {

    /**
     * Advanced A* (A-Star) algorithm for a path finder.
     * This does pixel based path finding, for map grids and is an advance
     * on the original authors code.
     *
     * @originalAuthor  Andrea Giammarchi
     * @revisedAuthor  Langerz82
     * @license Mit Style License.
     */

     var asGridCellSize = 16;
     var gGrid = null;

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
       return gGrid[~~(coord[0])][~~(coord[1])];
     }
     function successors(find, x, y, grid, rows, cols){
         x = ~~(x) + 0.5;
         y = ~~(y) + 0.5;

         var
             N = (y - 1),
             S = (y + 1),
             E = (x + 1),
             W = (x - 1),
             $N = N > 0 && !grids([N,x]),
             $S = S < (rows+1) && !grids([S,x]),
             $E = E < (cols+1) && !grids([y,E]),
             $W = W > 0 && !grids([y,W]),
             result = [],
             i = 0
         ;

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
       var
           cols = grid[0].length,
           rows = grid.length,
           limit = cols * rows,
           f1 = Math.abs,
           f2 = Math.max,
           list = {},
           result = [],
           //open = [{x:~~(start[0]), y:~~(start[1]), f:0, g:0, v:~~(start[0])+~~(start[1])*cols}],
           open = [{x:~~(start[0]), y:~~(start[1]), f:0, g:0, v:(start[0])+(start[1])*cols}],
           length = 1,
           adj, distance, find, i, j, max, min, current, next,
           //endnode = {x:(end[0]), y:(end[1]), v:(end[0])+(end[1])*cols};
           endnode = {x:~~(end[0]), y:~~(end[1]), v:~~(end[0])+~~(end[1])*cols};

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
           max = limit;
           min = 0;
           for(i = 0; i < length; ++i) {
               if((f = open[i].f) < max) {
                   max = f;
                   min = i;
               }
           };
           current = open.splice(min, 1)[0];
           if (current.v != endnode.v) {
           //if (Math.abs(current.x-endnode.x) >= 1 || Math.abs(current.y-endnode.y) >= 1) {
               --length;
               next = successors(find, current.x, current.y, grid, rows, cols);
               for(i = 0, j = next.length; i < j; ++i){
                   (adj = next[i]).p = current;
                   adj.f = adj.g = 0;
                   adj.v = ~~(adj.x) + ~~(adj.y) * cols;
                   if(!(adj.v in list)){
                       var extra = 0;
                       if (adj.p) {
                        adj.dir = getDir(adj, adj.p);
                        if (adj.p.dir && adj.p.dir != adj.dir)
                          extra = 2;
                       }
                       adj.f = (adj.g = current.g + distance(adj, current, f1, f2)) + distance(adj, endnode, f1, f2) + extra;
                       open[length++] = adj;
                       list[adj.v] = 1;
                   }
               }
           } else {
               i = length = 0;
               do {
                   result[i++] = [current.x, current.y];
               } while (current = current.p);

               var fn = function (node, result) {
                 result.shift();
                 result.unshift([node[0], node[1]]);
                 var it2 = null;
                 for (var it of result) {
                   if (it2) {
                     if (~~(it2[0]) == ~~(it[0]))
                       it[0] = it2[0];
                     else if (~~(it2[1]) == ~~(it[1]))
                       it[1] = it2[1];
                     else {
                       break;
                     }
                   }
                   it2 = it;
                 }
               };

               fn(end, result);
               result.reverse();
               fn(start, result);
           }
       } while (length);

       for (var i=2; i < result.length; ++i)
       {
         if ((Math.abs(result[i-2][0] - result[i][0]) > 0 &&
              Math.abs(result[i-2][1] - result[i][1]) == 0) ||
             (Math.abs(result[i-2][1] - result[i][1]) > 0  &&
              Math.abs(result[i-2][0] - result[i][0]) == 0))
         {
           result.splice(--i,1);
         }
       }

       //console.info(JSON.stringify(result));
       return result;
   }

  return {AStar};

}());

return AStar;
