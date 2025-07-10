define(['lib/astar'], function(AStar) {

    var Pathfinder = Class.extend({
        init: function(width, height) {
            this.width = width;
            this.height = height;
            this.grid = null;
            this.blankGrid = [];
            this.initBlankGrid_();
            this.ignored = [];
            this.included = [];
        },

        initBlankGrid_: function() {
            /*for(var i=0; i < this.height; i += 1) {
                this.blankGrid[i] = [];
                for(var j=0; j < this.width; j += 1) {
                    this.blankGrid[i][j] = 0;
                }
            }*/
        },

        checkValidPath: function (path) {
            var pnode = null;
            if (!Array.isArray(path) || path.length < 2)
              return false;
            for (var node of path) {
              if (pnode) {
                if (pnode[0] == node[0] || pnode[0] == node[1] || pnode[1] == node[0] || pnode[1] == node[1]) {
                  pnode = node;
                  continue;
                }
                return false;
              }
              pnode = node;
            }
            return true;
        },

        // TODO - Grid axis is not being checked properly.
         isValidPath: function (grid, path) {
           var ts = G_TILESIZE,
               ly = grid.length,
               lx = grid[0].length;

           // Check collision from an axis, n1 to n2, n3 is for the other axis.
           var c1to2on3 = function (n1,n2,n3,axis) {
             //log.info("c1to2on3 - n1:"+n1+",n2:"+n2+",n3:"+n3);
             n1 = Math.floor(n1), n2 = Math.floor(n2), n3=Math.floor(n3);
             var i1 = Math.min(n1,n2), i2 = Math.max(n1,n2);
             if (axis == "x") {
               for (var i=i1; i < i2; i++) {
                 if (grid[n3][i]) {
                   return false;
                 }
               }
             } else {
               for (var i=i1; i < i2; i++) {
                 if (grid[i][n3]) {
                   return false;
                 }
               }
             }
             return true;
           }

           var xf = function (x1,x2,y) {
             return c1to2on3(x1,x2,y,"x");
           }
           var yf = function (y1,y2,x) {
             return c1to2on3(y1,y2,x,"y");
           }

           var pCoord = null;
           for (var coord of path) {
             if (coord[1] < 0 || coord[1] >= ly)
               return false;
             if (coord[0] < 0 || coord[0] > lx)
               return false;

             if (pCoord) {
               if (coord[0] != pCoord[0] && coord[1] != pCoord[1])
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
         },

        getShortGrid: function (grid, start, end, gridEdges) {
          var ts = G_TILESIZE;
          start = [start[0], start[1]];
    			end = [end[0], end[1]];

          var minX = Math.max(Math.min(Math.floor(start[0]), Math.floor(end[0])) - gridEdges, 0);
          var maxX = Math.min(Math.max(Math.ceil(start[0]), Math.ceil(end[0])) + gridEdges, grid[0].length-1);
          var minY = Math.max(Math.min(Math.floor(start[1]), Math.floor(end[1])) - gridEdges, 0);
          var maxY = Math.min(Math.max(Math.ceil(start[1]), Math.ceil(end[1])) + gridEdges, grid.length-1);

    			var substart = [(start[0]-minX), (start[1]-minY)];
    			var subend = [(end[0]-minX), (end[1]-minY)];

    			//log.info(JSON.stringify(substart));
    			//log.info(JSON.stringify(subend));
    			//log.info("minX="+minX+",maxX="+maxX+",minY="+minY+",maxY="+maxY);


          maxX = Math.min(grid[0].length-1, maxX);
          maxY = Math.min(grid.length-1, maxY);
          var crop = new Array(maxY - minY);
    			for(var j=0, i = minY; i <= maxY; ++i) {
    				crop[j++] = new Uint8Array(grid[i].slice(minX, maxX));
    			}

    			return {
    				crop: crop,
    				minX: minX,
    				minY: minY,
    				substart: substart,
    				subend: subend};
        },

        findNeighbourPath: function(start, end) {
            var ts = G_TILESIZE;

                  // If its one space just return the start, end path.
      			if ((Math.abs(start[0] - end[0]) <= ts && Math.abs(start[1] - end[1]) == 0) ||
      				(Math.abs(start[1] - end[1]) <= ts && Math.abs(start[0] - end[0]) == 0))
      					return [[start[0], start[1]],[end[0],end[1]]];

      			return null;
		    },

        findShortPath: function(crop, offsetX, offsetY, start, end) {
            var ts = G_TILESIZE;
        		var path = [];
      			var subpath = AStar.AStar(crop, start, end);

      			if (subpath && subpath.length > 0)
      			{
      				//var path = subpath;
      				/*var len = subpath.length;
      				for (var j = 0; j < len; ++j)
      				{
      					path[j] = [subpath[j][0]+(offsetX),subpath[j][1]+(offsetY)];
      				}*/
      				//log.info(JSON.stringify(path));
      				log.info(JSON.stringify(subpath));
      				return subpath;
      			}

            return null;
        },

        findPath: function(grid, start, end, findIncomplete) {
            var path;

			      this.grid = grid;
            this.applyIgnoreList_(this.grid, true);
            this.applyIncludeList_(this.grid, true);

            path = AStar.AStar(this.grid, start, end);

            /*if(!path || path.length === 0 && findIncomplete === true) {
                // If no path was found, try and find an incomplete one
                // to at least get closer to destination.
                path = this.findIncompletePath_(start, end);
                //log.info("NO path to destination");
            }*/

            return path;
        },

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
        findIncompletePath_: function(start, end) {
            var perfect, x, y,
                incomplete = [];

            perfect = AStar.AStar(this.blankGrid, start, end);

            for(var i=perfect.length-1; i > 0; i -= 1) {
                x = perfect[i][0];
                y = perfect[i][1];

                if(this.grid[y][x] === 0) {
                    incomplete = AStar(this.grid, start, [x, y]);
                    break;
                }
            }
            return incomplete;
        },

        /**
         * Removes colliding tiles corresponding to the given entity's position in the pathing grid.
         */
        ignoreEntity: function(entity) {
            if(entity) {
                this.ignored.push(entity);
            }
        },
        includeEntity: function(entity) {
            if(entity) {
                this.included.push(entity);
            }
        },

        applyIgnoreList_: function(grid, ignored) {
            var self = this,
                x, y;

            _.each(this.ignored, function(entity) {
                x = entity.isMoving() ? entity.nextGridX : entity.gx;
                y = entity.isMoving() ? entity.nextGridY : entity.gy;

                if(x >= 0 && y >= 0) {
                	//log.info("path.grid=["+x+","+y+"]");
                    grid[y][x] = ignored ? 0 : 1;
                }
            });
        },

        applyIncludeList_: function(grid, included) {
            var self = this,
                x, y;

            _.each(this.included, function(entity) {
                x = entity.isMoving() ? (entity.path.length > 0 ? entity.path[entity.path.length-1][0] : entity.nextGridX) : entity.gx;
                y = entity.isMoving() ? (entity.path.length > 0 ? entity.path[entity.path.length-1][1] : entity.nextGridY) : entity.gy;

                if(x >= 0 && y >= 0) {
                	//log.info("path.grid=["+x+","+y+"]");
                    grid[y][x] = included ? 1 : 0;
                }
            });
        },

        clearIgnoreList: function(grid) {
            this.applyIgnoreList_(grid, false);
            this.ignored = [];
        },

        clearIncludeList: function(grid) {
            this.applyIncludeList_(grid, false);
            this.ignored = [];
        },

        /*
        // TODO - Note needed so maybe just remove.
        compressPath: function (path) {
          if (!Array.isArray(path))
            return path;

          if (path.length < 3)
            return path;

          var newPath = [];
          var lastDir = null;
          var pNode = null;

          console.warn("pathfinder - compressPath 1:"+path);
          for (var node of path)
          {
            if (pNode)
            {
              var dir = [node.x  - pNode.x, node.y - pNode.y];
              if (dir != lastDir)
              {
                newPath.push(pNode);
              }
              lastDir = dir;
            }
            pNode = node;
          }
          newPath.push(node);
          console.warn("pathfinder - compressPath 2:"+newPath);
          return newPath;
        },*/
    });

    return Pathfinder;
});
