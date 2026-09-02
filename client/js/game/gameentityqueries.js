// Mixin extracted from game.js: Read-only entity/grid lookups: getEntityAt/getMobAt/getPlayerAt/etc, isXAt predicates, forEach* iteration helpers.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Mob from '../entity/mob.js';
import Player from '../entity/player/player.js';
import NpcMove from '../entity/npcmove.js';
import NpcStatic from '../entity/npcstatic.js';
import Node from '../entity/node.js';
/* global Types, ItemTypes, _ */

export function installGameEntityQueries(proto) {
    // PERF: `this.entities` is a Map now, not a plain object -- see the
    // PERF comment on its declaration in game.js. `in`/bracket access
    // below became `.has()`/`.get()`.
    //
    // FIX: a plain object silently coerces every property key to a string,
    // so `this.entities[42]` and `this.entities["42"]` were always the
    // exact same lookup -- callers across the codebase are inconsistent
    // about whether they pass a real Number (most do, e.g. `Number(data[0])`)
    // or a raw, un-coerced value straight off a packet array (e.g.
    // clientcallbackssocial.js's `const id = data[0];` for party members --
    // confirmed via a repo-wide grep of every getEntityById/entityIdExists
    // call site). Every entity is stored under a real Number key (entity.id
    // is always constructed via Number(data[0])/parseInt(data[0]) -- see
    // entityfactory.js's callers), but Map.get()/has() use strict
    // (SameValueZero) key equality with no such coercion, so a caller
    // passing e.g. the string "42" would silently never match a real
    // Map key of 42 -- a correctness regression the old object version
    // never had. Coercing here, once, at the lookup boundary, keeps every
    // existing caller working exactly as before regardless of what type it
    // passes in. `id == null` is checked first and returned as "not found"
    // before coercing, rather than let `Number(null)` become 0 and
    // potentially collide with a real entity id of 0.
    proto.entityIdExists = function (id) {
        if (id == null) return false;
        return this.entities.has(Number(id));
    };

    proto.getEntityById = function (id) {
        if (id == null) return undefined;
        id = Number(id);
        if (this.entities && this.entities.has(id)) {
            return this.entities.get(id);
        } else if (this.items && id in this.items) {
            return this.items[id];
        }
        //else {
        //}
    };

    proto.getNpcByQuestKind = function (npcQuestId) {
        for (let id in this.npc) {
            const entity = this.npc[id];
            if (entity.npcQuestId === npcQuestId) {
                return entity;
            }
        }
        return null;
    };

    proto.getEntityByName = function (name) {
        for (const entity of this.entities.values()) {
            if (entity.name.toLowerCase() === name.toLowerCase()) {
                return entity;
            }
        }
        return null;
    };

    /**
     * Loops through all the entities currently present in the game.
     * @param {Function} callback The function to call back (must accept one entity argument).
     */
    // PERF: forEachEntity() is the busiest reader of `this.entities` --
    // updater.js's updateCharacters()/updateTransitions() each call it once
    // per frame, over every known entity. Iterating .values() directly
    // avoids both the `for...in` hasOwnProperty check and the extra
    // id -> entity lookup the old object version needed.
    proto.forEachEntity = function (callback, cond) {
        cond =
            cond ||
            function (e) {
                return true;
            };
        for (const entity of this.entities.values()) {
            if (cond(entity)) callback(entity);
        }
    };

    /**
     * Same as forEachEntity but only for instances of the Mob subclass.
     * @see forEachEntity
     */
    proto.forEachMob = function (callback) {
        const cond = function (e) {
            return e.type === Types.EntityTypes.MOB;
        };
        this.forEachEntity(callback, cond);
    };

    /**
     *
     */
    proto.forEachVisibleTileIndex = function (callback) {
        const self = this;
        this.camera.forEachVisibleValidPosition(function (x, y) {
            const index = self.currentMap.GridPositionToTileIndex(x, y);
            callback(index, x, y);
        });
    };

    /**
     *
     */
    proto.forEachVisibleTile = function (callback) {
        const self = this,
            mc = this.currentMap,
            tg = mc.tileGrid;

        if (mc.gridReady) {
            // NOTE: forEachVisibleTile has no live callers anywhere in
            // gameserver/shared/client (verified via search) - dead code.
            this.forEachVisibleTileIndex(function (index, x, y) {
                if (_.isArray(tg[y][x])) {
                    // FIX: Array.prototype.forEach's callback receives
                    // (element, arrayIndex, array), so the old parameter names
                    // `(index, x, y)` here shadowed the outer tile-grid x/y with
                    // the stack position and the array itself - callback() was
                    // invoked with garbage coordinates instead of the real grid
                    // x/y. Renamed the inner params so the outer x/y are used.
                    tg[y][x].forEach(function (stackedIndex) {
                        callback(stackedIndex, x, y);
                    });
                } else {
                    if (!_.isNaN(tg[y][x])) callback(tg[y][x], x, y);
                }
            });
        }
    };

    /**
     *
     */
    proto.forEachAnimatedTile = function (callback) {
        if (this.animatedTiles) {
            this.animatedTiles.forEach(callback);
        }
    };

    proto.getEntitiesAround = function (x, y, ts, unInclude = []) {
        ts = ts || G_TILESIZE;
        const pos = [
            [x + ts, y],
            [x - ts, y],
            [x, y + ts],
            [x, y - ts]
        ];
        let entity = null;
        const entities = [];
        for (let p of pos) {
            entity = this.getEntityAt(p[0], p[1]);
            if (entity && unInclude.indexOf(entity) === -1)
                entities.push(entity);
        }
        return entities;
    };

    /**
     * Returns the entity located at the given position on the world grid.
     * @returns {Entity} the entity located at (x, y) or null if there is none.
     */
    proto.getEntityAt = function (x, y) {
        if (!this.currentMap.mapLoaded) return null;

        // PERF: was computing `Object.keys(entities).length` on every call just
        // to guard against an empty object - that allocates a full array of keys
        // (thrown away immediately) on every single lookup, and this runs very
        // often (movecursor() alone calls into this several times per mouse
        // move). A for-in loop over an empty object simply doesn't iterate, so
        // the guard was unnecessary - dropped it.
        //
        // PERF (evaluated, not changed): this linear scan was flagged as a
        // potential O(n) hot path needing a grid index. It doesn't -
        // `this.camera.entities` (unlike `this.entities`, the full
        // world/map entity table) is populated only with entities the camera
        // currently considers visible (see gameinteractiontarget.js's
        // updateVisibleEntities()-style add/remove via camera.isVisible()),
        // so `entities` here is already bounded to on-screen entity count -
        // realistically a few dozen at most for this game's viewport/zoom,
        // never "every entity on the map". Each iteration is a cheap
        // isOverPosition() distance check with an early return on match, so
        // building and maintaining a spatial grid index for this would add
        // real complexity for no measurable win at that scale.
        const entities = this.camera.entities;
        let entity = null;
        for (let k in entities) {
            entity = entities[k];
            if (!entity) continue;

            if (entity.isOverPosition(x, y)) return entity;
        }
        return null;
    };

    proto.getMobAt = function (x, y) {
        const entity = this.getEntityAt(x, y);
        if (entity && entity instanceof Mob) {
            return entity;
        }
        return null;
    };

    proto.getPlayerAt = function (x, y) {
        const entity = this.getEntityAt(x, y);
        if (entity && entity instanceof Player && entity !== this.player) {
            return entity;
        }
        return null;
    };

    proto.getNpcAt = function (x, y) {
        const entity = this.getEntityAt(x, y);
        if (
            entity &&
            (entity instanceof NpcMove || entity instanceof NpcStatic)
        ) {
            return entity;
        }
        return null;
    };

    proto.getChestAt = function (x, y) {
        const entity = this.getEntityAt(x, y);
        if (
            entity &&
            entity instanceof Node &&
            entity.kind === Node.CHEST_KIND
        ) {
            return entity;
        }
        return null;
    };

    proto.getItemAt = function (x, y) {
        if (
            this.currentMap.isOutOfBounds(x, y) ||
            !this.itemGrid ||
            !this.itemGrid[y]
        ) {
            return null;
        }
        let items = this.itemGrid[y][x],
            item = null;

        if (_.size(items) > 0) {
            // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
            Object.values(items).forEach(function (i) {
                if (ItemTypes.isConsumableItem(i.kind)) {
                    item = i;
                }
            });

            // Else, get the first item of the stack
            if (!item) {
                item = items[_.keys(items)[0]];
            }
        }
        return item;
    };

    proto.getItemsAt = function (x, y) {
        // FIX: this.map doesn't exist on game; use this.currentMap like the rest of the codebase
        if (
            this.currentMap.isOutOfBounds(x, y) ||
            !this.itemGrid ||
            !this.itemGrid[y]
        ) {
            return null;
        }
        const items = this.itemGrid[y][x];

        return items;
    };

    /**
     * Returns true if an entity is located at the given position on the world grid.
     * @returns {Boolean} Whether an entity is at (x, y).
     */
    proto.isEntityAt = function (x, y) {
        return !_.isNull(this.getEntityAt(x, y));
    };

    proto.isMobAt = function (x, y) {
        return !_.isNull(this.getMobAt(x, y));
    };

    proto.isPlayerAt = function (x, y) {
        return !_.isNull(this.getPlayerAt(x, y));
    };

    proto.isItemAt = function (x, y) {
        return !_.isNull(this.getItemAt(x, y));
    };

    proto.isNpcAt = function (x, y) {
        return !_.isNull(this.getNpcAt(x, y));
    };

    proto.isChestAt = function (x, y) {
        return !_.isNull(this.getChestAt(x, y));
    };

    proto.forEachEntityRange = function (gx, gy, r, callback) {
        this.forEachEntity(function (e) {
            if (
                e.gx >= gx - r &&
                e.gx <= gx + r &&
                e.gy >= gy - r &&
                e.gy <= gy + r
            ) {
                callback(e);
            }
        });
    };
}
