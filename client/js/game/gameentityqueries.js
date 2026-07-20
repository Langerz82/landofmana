// Mixin extracted from game.js: Read-only entity/grid lookups: getEntityAt/getMobAt/getPlayerAt/etc, isXAt predicates, forEach* iteration helpers.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Mob from './entity/mob.js';
import Player from './entity/player.js';
import NpcMove from './entity/npcmove.js';
import NpcStatic from './entity/npcstatic.js';
import Node from './entity/node.js';
/* global Types, ItemTypes, _ */

export function installGameEntityQueries(proto) {
        proto.entityIdExists = function(id) {
            return id in this.entities;
        };

        proto.getEntityById = function(id) {
            if(this.entities && id in this.entities) {
                return this.entities[id];
            }
            else if (this.items && id in this.items) {
            	return this.items[id];
            }
            //else {
            //}
        };

        proto.getNpcByQuestKind = function(npcQuestId){
            for(let id in this.npc){
                const entity = this.npc[id];
                if(entity.npcQuestId === npcQuestId){
                    return entity;
                }
            }
            return null;
        };

        proto.getEntityByName = function(name){
            for(let id in this.entities){
                const entity = this.entities[id];
                if(entity.name.toLowerCase() === name.toLowerCase()){
                    return entity;
                }
            }
            return null;
        };

        /**
         * Loops through all the entities currently present in the game.
         * @param {Function} callback The function to call back (must accept one entity argument).
         */
        proto.forEachEntity = function(callback, cond) {
            cond = cond || function (e) { return true; };
            for (let id in this.entities) {
              const entity = this.entities[id];
              if (cond(entity))
                callback(entity);
            }
        };

        /**
         * Same as forEachEntity but only for instances of the Mob subclass.
         * @see forEachEntity
         */
        proto.forEachMob = function(callback) {
            const cond = function (e) { return e.type === Types.EntityTypes.MOB; };
            this.forEachEntity(callback, cond);
        };

        /**
         *
         */
        proto.forEachVisibleTileIndex = function(callback) {
            const self = this;
      			this.camera.forEachVisibleValidPosition(function(x, y) {
                const index = self.mapContainer.GridPositionToTileIndex(x, y);
      			    callback(index, x, y);
      			});
        };

        /**
         *
         */
        proto.forEachVisibleTile = function(callback) {
            const self = this,
                mc = this.mapContainer,
                tg = mc.tileGrid;

            if(mc.gridReady) {
                this.forEachVisibleTileIndex(function(index, x, y) {
                    if(_.isArray(tg[y][x])) {
                        tg[y][x].forEach(function(index, x, y) {
                            callback(index, x, y);
                        });
                    }
                    else {
                        if(!_.isNaN(tg[y][x]))
                          callback(tg[y][x], x, y);
                    }
                });
            }
        };

        /**
         *
         */
        proto.forEachAnimatedTile = function(callback) {
            if(this.animatedTiles) {
                this.animatedTiles.forEach(callback);
            }
        };

        proto.getEntitiesAround = function(x, y, ts, unInclude = []) {
          ts = ts || G_TILESIZE;
          const pos = [[x+ts,y],[x-ts,y],[x,y+ts],[x,y-ts]];
          let entity = null;
          const entities = [];
          for (let p of pos) {
            entity = this.getEntityAt(p[0],p[1]);
            if (entity && unInclude.indexOf(entity) === -1)
              entities.push(entity);
          }
          return entities;
        };

        /**
         * Returns the entity located at the given position on the world grid.
         * @returns {Entity} the entity located at (x, y) or null if there is none.
         */
        proto.getEntityAt = function(x, y) {
            if(!this.mapContainer.mapLoaded)
        	    return null;

            const entities = this.camera.entities,
                len = Object.keys(entities).length;

            if(len > 0) {
              let entity = null;
              for (let k in entities) {
                  entity = entities[k];
                  if (!entity) continue;

                  if (entity.isOverPosition(x,y))
                    return entity;
              }
            }
            return null;
        };

        proto.getMobAt = function(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && entity instanceof Mob) {
                return entity;
            }
            return null;
        };

        proto.getPlayerAt = function(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && (entity instanceof Player) && (entity !== this.player)) {
                return entity;
            }
            return null;
        };

        proto.getNpcAt = function(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && (entity instanceof NpcMove || entity instanceof NpcStatic)) {
                return entity;
            }
            return null;
        };

        proto.getChestAt = function(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && (entity instanceof Node) && entity.kind === Node.CHEST_KIND) {
                return entity;
            }
            return null;
        };

        proto.getItemAt = function(x, y) {
            if(this.mapContainer.isOutOfBounds(x, y) || !this.itemGrid || !this.itemGrid[y]) {
                return null;
            }
            let items = this.itemGrid[y][x],
                item = null;

            if(_.size(items) > 0) {
                // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
                Object.values(items).forEach(function(i) {
                    if(ItemTypes.isConsumableItem(i.kind)) {
                        item = i;
                    }
                });

                // Else, get the first item of the stack
                if(!item) {
                    item = items[_.keys(items)[0]];
                }
            }
            return item;
        };

        proto.getItemsAt = function(x, y) {
            // FIX: this.map doesn't exist on game; use this.mapContainer like the rest of the codebase
            if(this.mapContainer.isOutOfBounds(x, y) || !this.itemGrid || !this.itemGrid[y]) {
                return null;
            }
            const items = this.itemGrid[y][x];

            return items;
        };

        /**
         * Returns true if an entity is located at the given position on the world grid.
         * @returns {Boolean} Whether an entity is at (x, y).
         */
        proto.isEntityAt = function(x, y) {
            return !_.isNull(this.getEntityAt(x, y));
        };

        proto.isMobAt = function(x, y) {
            return !_.isNull(this.getMobAt(x, y));
        };

        proto.isPlayerAt = function(x, y) {
            return !_.isNull(this.getPlayerAt(x, y));
        };

        proto.isItemAt = function(x, y) {
            return !_.isNull(this.getItemAt(x, y));
        };

        proto.isNpcAt = function(x, y) {
            return !_.isNull(this.getNpcAt(x, y));
        };

        proto.isChestAt = function(x, y) {
            return !_.isNull(this.getChestAt(x, y));
        };

        proto.forEachEntityRange = function(gx, gy, r, callback) {
            this.forEachEntity(function(e) {
    					if (e.gx >= gx-r && e.gx <= gx+r &&
    						e.gy >= gy-r && e.gy <= gy+r)
    					{
    						callback(e);
    					}
            });
        };

}
