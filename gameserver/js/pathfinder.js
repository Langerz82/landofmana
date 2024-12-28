var astar = require('./lib/astar');
var Utils = require('./utils');

module.exports = Pathfinder = Class.extend({
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

  isPathTicksTooFast: function (entity, path, startTime) {
    console.info("pathFinder - isPathTicksTooFast:");
    var elapsed = Date.now() - startTime;

    var serverTicks = ~~(elapsed * (entity.tick / G_FRAME_INTERVAL_EXACT));
    //console.warn("entity.estDelay: "+entity.estDelay);
    serverTicks = Math.max(serverTicks, 0);
    var playerTicks = this.getPathTicks(path, entity.x, entity.y);
    if (playerTicks == 0) {
      console.warn("getPathTicks - "+JSON.stringify(path)+", x:"+entity.x+",y:"+entity.y);
      return false;
    }

    //if (entity.unclampedDelay > 0)
      //tMoves += entity.unclampedDelay;
    //console.info("entity.unclampedDelay:"+entity.unclampedDelay);
    //console.warn("SPEED CHECK. estMoves: "+estMoves+", tMoves: "+tMoves+", entity.latencyDiff: "+entity.latencyDiff);
    var tolerance = G_FRAME_INTERVAL * 2; //+ ~~(estMoves/100*G_UPDATE_INTERVAL);
    //var diff = tMoves - estMoves; // - entity.latencyDiff;
    //console.warn("SPEED HACK. playerTicks - tolerance: "+playerTicks+"-"+tolerance+", "+(playerTicks - tolerance)+" > serverTicks: "+serverTicks+", entity.latencyDiff: "+entity.latencyDiff);
    console.info("playerTicks:"+playerTicks);
    console.info("serverTicks:"+serverTicks);
    console.info("playerTicks - tolerance:"+(playerTicks - tolerance));
    if (serverTicks < (playerTicks - tolerance))
    {
      //try { throw new Error(); } catch(err) { console.info(err.stack); }
      //console.warn("playerTicks:"+playerTicks);
      //console.warn("serverTicks:"+serverTicks);
      console.warn("SPEED HACK. playerTicks - tolerance: "+playerTicks+"-"+tolerance+", "+(playerTicks - tolerance)+" > serverTicks: "+serverTicks+", entity.latencyDiff: "+entity.latencyDiff);
      //p.setPosition(p.stx,p.sty);
      return true;
    }
    return false;
  },

 // TODO - Incorrect when moving left.
  /*
   * getPathTicks:
   * path - The path to check. x,y = x-position and y-position
   * of the final coordinate that should be in the path.
   */
  getPathTicks: function (path, x, y) {
      count = 0;
      var n2 = null;
      for (var n1 of path) {
          if (n2) {
              if (x==n1[0] && x==n2[0] && y >= Math.min(n1[1],n2[1]) && y <= Math.max(n1[1],n2[1]))
              {
                count += Math.abs(n2[1]-y);
                break;
              }
              if (y==n1[1] && y==n2[1] && x >= Math.min(n1[0],n2[0]) && x <= Math.max(n1[0],n2[0]))
              {
                count += Math.abs(n2[0]-x);
                break;
              }
              else {
                count += Math.abs(n1[0]-n2[0]) + Math.abs(n1[1]-n2[1]);
              }
          }
          n2 = n1;
      }
      return count;
  },

  getPathTicks2: function (path) {
    var node2;
    var total = 0;
    for (var node1 of path) {
      if (node2) {
        total += Math.abs(node1[0]-node2[0]) + Math.abs(node1[1]-node2[1]);
      }
      node2 = node1;
    }
    return total;
  },

  getPathUntil: function (path, dist) {
      if (dist < 0)
        return null;

      var totalDist = this.getPathTicks2(path);
      var subDist = totalDist - dist;
      var node2;
      var newPath = [];
      var subTotal = 0;
      for (var node1 of path) {
        if (node2) {
          var dx = Math.abs(node1[0]-node2[0]);
          var dy = Math.abs(node1[1]-node2[1]);
          var dist = dx + dy;
          subTotal += dist;

          if (subTotal == subDist) {
            newPath.push(node1);
            break;
          }
          else if (subTotal > subDist) {
            var node3 = node1;
            var tdiff = subTotal - subDist;
            if (dx > 0)
              node3[0] += (node1[0]-node2[0] < 0) ? tdiff : -tdiff;
            if (dy > 0)
              node3[1] += (node1[1]-node2[1] < 0) ? tdiff : -tdiff;
            newPath.push(node3);
            break;
          }
        }
        node2 = node1;
        newPath.push(node1);
      }
      return newPath;
  },

  isInPath: function (path, node) {
    var tmpPath = path.map(function(arr) {
      return arr.slice();
    });
    var node1 = tmpPath.shift();
    for (var node2 of tmpPath) {
      if ((node1[0] == node2[0] && node1[1] >= node[1] && node2[1] <= node[1]) ||
        (node1[1] == node2[1] && node1[0] >= node[0] && node2[0] <= node[0]))
        return true;
      node1 = node2;
    }
    return false;
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

  isValidPath: function (grid, path) {
    var ts = G_TILESIZE,
        ly = grid.length,
        lx = grid[0].length;

    // Check collision from an axis, n1 to n2, n3 is for the other axis.
    var c1to2on3 = function (n1,n2,n3,axis) {
      //console.info("c1to2on3 - n1:"+n1+",n2:"+n2+",n3:"+n3);
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

    var path2 = [];
    for (var i = 0; i < path.length; i++)
        path2[i] = path[i].slice();

    for (var coord of path2) {
      coord[0] /= ts;
      coord[1] /= ts;
    }

    var pCoord = null;

    for (var coord of path2) {
      if (coord[1] < 0 || coord[1] >= ly)
        return false;
      if (coord[0] < 0 || coord[0] >= lx)
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
    start = [start[0]/ts, start[1]/ts];
		end = [end[0]/ts, end[1]/ts];

    var minX = Math.max(Math.min(Math.floor(start[0]), Math.floor(end[0])) - gridEdges, 0);
    var maxX = Math.min(Math.max(Math.ceil(start[0]), Math.ceil(end[0])) + gridEdges, grid[0].length-1);
    var minY = Math.max(Math.min(Math.floor(start[1]), Math.floor(end[1])) - gridEdges, 0);
    var maxY = Math.min(Math.max(Math.ceil(start[1]), Math.ceil(end[1])) + gridEdges, grid.length-1);

		start = [(start[0]-minX), (start[1]-minY)];
		end = [(end[0]-minX), (end[1]-minY)];

		//console.info(JSON.stringify(substart));
		//console.info(JSON.stringify(subend));
		//console.info("minX="+minX+",maxX="+maxX+",minY="+minY+",maxY="+maxY);

    maxX = Math.min(grid[0].length-1, maxX);
    maxY = Math.min(grid.length-1, maxY);
    var crop = new Array(maxY - minY);
    for(var j=0, i = minY; i <= maxY; ++i) {
      crop[j++] = grid[i].slice(minX, maxX);
    }

		return {
			crop: crop,
			minX: minX,
			minY: minY,
			substart: start,
			subend: end};
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
  		var path;
      //console.info("ASTAR(S): "+JSON.stringify(start)+","+JSON.stringify(end));
			var subpath = AStar.AStar(crop, start, end);

			if (subpath && subpath.length > 0)
			{
				var path = [];
				var len = subpath.length;
				for (var j = 0; j < len; ++j)
				{
					path[j] = [];
					path[j][0] = (subpath[j][0]+offsetX)*ts;
					path[j][1] = (subpath[j][1]+offsetY)*ts;
				}
				//console.info(JSON.stringify(path));
				//console.info(JSON.stringify(subpath));
				return path;
			}

      return null;
  },

  findPath: function(grid, start, end, findIncomplete) {
      var path;

      this.grid = grid;
      this.applyIgnoreList_(this.grid, true);
      this.applyIncludeList_(this.grid, true);

      //console.info("ASTAR: "+JSON.stringify(start)+","+JSON.stringify(end));
      path = AStar.AStar(this.grid, start, end);

      /*if(!path || path.length === 0 && findIncomplete === true) {
          // If no path was found, try and find an incomplete one
          // to at least get closer to destination.
          path = this.findIncompletePath_(start, end);
          //console.info("NO path to destination");
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
          	//console.info("path.grid=["+x+","+y+"]");
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
          	//console.info("path.grid=["+x+","+y+"]");
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

});
