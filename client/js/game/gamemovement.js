// Mixin extracted from game.js: Pathfinding and movement: findPath, moveCharacter/isOverlapping, teleportMaps, makePlayerGoTo/GoToItem, clickMoveTo.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Player from '../entity/player.js';
import MapContainer from '../mapcontainer.js';
/* global Utils, G_TILESIZE, log */

export function installGameMovement(proto) {
        proto.teleportMaps = function(mapIndex, x, y, portalId)
        {
          const self = this;

        	x = x || -1;
        	y = y || -1;
          if (typeof(portalId) === "undefined")
            portalId = -1;

          if (this.mapContainer) {
            this.prevMapContainer = this.mapContainer;
            if (mapIndex === this.mapContainer.mapIndex) {
              this.mapStatus = 0;
              self.client.sendTeleportMap([mapIndex, 0, x, y, portalId]);
              return;
            }

            this.mapContainer = null;
          }


          log.info("teleportMaps");
          this.mapStatus = 0;
          this.mapContainer = new MapContainer(this, mapIndex, this.mapNames[mapIndex]);

          this.mapContainer.ready(function () {
              self.client.sendTeleportMap([mapIndex, 0, x, y, portalId]);
          });
        };

        proto.teleportFromTown = function(player) {
        };

        /**
         * Moves the current player to a given target location.
         */
        proto.makePlayerGoTo = function(x, y) {
            this.player.go(x, y);
        };

        /**
         * Moves the current player towards a specific item.
         */
        proto.makePlayerGoToItem = function(item) {
            const p = this.player;
            if (!item) return;
            if (!p.isNextTooEntity(item)) {
              p.follow(item);
            } else {
              this.client.sendLootMove(item);
            }
        };

         /**
           * Simplified findPath using AStar directly.
           * Allows exact start/end positions. Ensures path is axis-aligned (no diagonals).
           */
        proto.findPath = function(character, x, y, ignoreList, includeList) {
            const ts = G_TILESIZE;
            const self = this;

            const mc = this.mapContainer;
            if (!mc || !mc.gridReady || this.mapStatus < 2)
              return null;

            log.info("PATHFINDER CODE - simplified AStar");

            if(!this.pathfinder || !character)
            {
                // FIX: was unconditionally reading character.id even in the !character branch
                // this exists to guard against, throwing a TypeError instead of logging cleanly
                log.error("game.findPath - Error while finding the path to "+x+", "+y+" for "+(character ? character.id : "unknown"));
                return null;
            }

            const grid = this.mapContainer.maps[0].collision;
            if (!grid) {
              console.error("game.js findPath: grid not ready for pathing.")
              return null;
            }

            // Exact world positions
            const start = [character.x, character.y];
            const end = [x, y];

            // Check if start or end is colliding
            if (mc.isColliding(character.x, character.y)) {
              log.info("pathfind - isColliding start.");
              return null;
            }
            if (mc.isCollidingPoint(x, y)) {
              log.info("pathfind - isColliding end.");
              return null;
            }

            const pS = [start[0]/ts, start[1]/ts];
            const pE = [end[0]/ts, end[1]/ts];

            log.info("game.findPath - pS:", pS, "pE:", pE);

            // Bounds check
            const lx = grid[0].length;
            const ly = grid.length;
            if (pS[0] < 0 || pS[0] >= lx || pS[1] < 0 || pS[1] >= ly ||
                pE[0] < 0 || pE[0] >= lx || pE[1] < 0 || pE[1] >= ly) {
              log.error("game.findPath - path coordinates outside of dimensions.");
              return null;
            }

            // Grid coords for AStar (integer)
            const fpS = [Math.floor(pS[0]), Math.floor(pS[1])];
            const fpE = [Math.floor(pE[0]), Math.floor(pE[1])];

            // Apply ignore/include lists if provided (support for entities)
            if (ignoreList || includeList) {
              // Note: current Pathfinder methods modify grid in place - clone if needed for safety
              this.pathfinder.applyIgnoreList_(grid, true);  // temporarily mark as walkable
              this.pathfinder.applyIncludeList_(grid, true);
            }

            let gridExtra = Math.max(Math.abs(fpS[0]-fpE[0]), Math.abs(fpS[1]-fpE[1]));
            gridExtra = Math.max(3,gridExtra);

            const shortGrid = this.pathfinder.getShortGrid(grid, pS, pE, gridExtra);
            const sgrid = shortGrid.crop;
            const spS = shortGrid.substart;
            const spE = shortGrid.subend;
            const fspS = [Math.floor(spS[0]),Math.floor(spS[1])];
            const fspE = [Math.floor(spE[0]),Math.floor(spE[1])];
            let path = null;
            let longPath = false;

            // FIX: missing var - was an implicit global
            let gridPath = this.pathfinder.findDirectPath(sgrid, fspS, fspE);

            if (!gridPath) {
              log.info("game.findPath - using short path finder.");
              gridPath = this.pathfinder.findShortPath(sgrid,
                shortGrid.minX, shortGrid.minY, fspS, fspE);
              if (gridPath)
                log.info("game.findPath - validpath-mp4:"+JSON.stringify(path));
            }

            if (!gridPath) {
              log.info("game.findPath - using long path finder.");
              path = this.pathfinder.findPath(grid, fpS, fpE, false);
              // FIX: checked the still-falsy `gridPath` instead of the just-computed `path`, and never wrote the
              // result back to `gridPath` - the long-path fallback branch never ran and its result was discarded,
              // so any destination that needed the long path finder was reported as unreachable.
              if (path) {
                gridPath = path;
                longPath = true;
                shortGrid.minX = 0;
                shortGrid.minY = 0;
                log.info("game.findPath - validpath-mp5:"+JSON.stringify(path));
              }
            }

            // Use AStar

            // Restore grid if we modified it
            if (ignoreList || includeList) {
              this.pathfinder.clearIgnoreList(grid);
              this.pathfinder.clearIncludeList(grid);
            }

            if (!gridPath || gridPath.length < 1) {
              log.info("No path found with AStar");
              return null;
            }

            // Convert grid path to world coordinates (tile centers initially)
            let realpath = gridPath.map(node => [
              (shortGrid.minX + node[0] + 0.5) * ts,
              (shortGrid.minY + node[1] + 0.5) * ts
            ]);

            // Force exact start and end positions
            realpath[0] = start;
            realpath[realpath.length - 1] = end;

            // Ensure axis-aligned (no diagonal jumps)
            realpath = this.pathfinder._fixDiagonalJumps(realpath, start, end);

            // Clean up unnecessary nodes
            realpath = this.pathfinder.dropUneededNodes(realpath);

            // Final validation
            if (!this.pathfinder.isValidPath(realpath)) {
              console.error("Generated path failed validation");
              character.forceStop();
              return null;
            }

            log.info("Final simplified realPath:", realpath);
            return realpath;
        };

        /**
         * Moves the player one space, if possible
         */
        proto.moveCharacter = function(char, x, y, skipOverlap, skipGridCheck) {
          skipOverlap = skipOverlap || false;
          skipGridCheck = skipGridCheck || false;

          const o = char.orientation;
          if (o === Types.Orientations.NONE)
            return false;

          if (this.mapContainer.isColliding(x, y)) {
            return false;
          }

          if (char instanceof Player) {
            const block = char.holdingBlock;
            const tile = char.nextTile(x, y);
            if (block && this.mapContainer.isColliding(tile[0], tile[1]))
              return false;
          }

          if (!skipOverlap && this.isOverlapping(char, x, y)) {
            return false;
          }

          // This chunk of code makes sure character move into the grid.
          if (!skipGridCheck) {
            const midTile = (G_TILESIZE >> 1);
            const mx = (x % G_TILESIZE);
            const my = (y % G_TILESIZE);
            const check = (o === 1 || o === 2) ?
              (my === midTile) : (mx === midTile);
            if (char.stopKeyMove && check)
            {
              char.setPosition(x,y);
              return false;
            }
          }

          return true;
        };

        proto.isOverlapping = function(entity, x, y) {
            const entities = this.camera.entities;

            for (let k in entities) {
              const entity2 = entities[k];
              if (entity2 instanceof Player)
                continue;
              if (entity instanceof Player && entity.holdingBlock === entity2)
                continue;
              if (!entity2 || entity === entity2)
                continue;
              if (entity2.isDead || entity2.isDying)
                continue;

              if (!entity2.isWithinDist(entity.x, entity.y, G_TILESIZE-1) &&
                  entity2.isWithinDist(x, y, G_TILESIZE-1))
                return true;
            }
            return false;
        };

        proto.clickMoveTo = function(px, py) {
          log.info("makePlayerGoTo");

          const p = this.player;
          px = (Math.floor(px/G_TILESIZE)+0.5)*G_TILESIZE;
          py = (Math.floor(py/G_TILESIZE)+0.5)*G_TILESIZE;

          const colliding = this.mapContainer.isCollidingPoint(px,py);
          if (colliding)
          {
            const spots = p.getSortedTilesAround(px, py);
            for(const node of spots) {
              if (!this.mapContainer.isCollidingPoint(node.x,node.y)) {
                this.makePlayerGoTo(node.x, node.y);
                return;
              }
            }
          }
          else {
              this.makePlayerGoTo(px, py);
          }
        };

}
