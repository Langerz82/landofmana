import NpcStatic from '../entity/npcstatic.js';
import NpcMove from '../entity/npcmove.js';
import Messages from '../message.js';
import MobAI from '../mobai.js';
import _ from 'underscore';
import Utils from '../utils.js';
import { ItemTypes } from '../common.js';
import Character from '../entity/character/character.js';
import Mob from '../entity/mob/mob.js';
import Item from '../entity/item.js';
import Player from '../entity/player/player.js';
import { Types } from '../common.js';
import NpcData from '../data/npcdata.js';
import { G_TILESIZE, G_SPATIAL_SIZE, G_DEBUG } from '../constants.js';
import SpatialIndex from './spatialindex.js';
import MapPathfindingService from './pathfindingservice.js';
import MapBroadcaster from './mapbroadcaster.js';

// This file used to hold the spatial-grid mechanics, the pathfinding
// orchestration, and the per-player packet queue directly, alongside the
// entity registry (the players/mobs/items/... Maps) and the proximity-query
// helpers built on top of them. The first three were self-contained enough
// to move out into spatialindex.js/pathfindingservice.js/mapbroadcaster.js;
// the registry and query methods stayed here because they call into each
// other and into the spatial index constantly (e.g. removeEntity() touches
// six different Maps and calls removeSpatial(); processWho() chains
// getSpatialEntities() -> isOffset() -> getEntityById() -> sendToPlayer()),
// so splitting those further would trade a flat, readable file for a maze
// of cross-object back-references. Every method this class used to
// implement directly for the extracted concerns (getSpatialEntities/
// addSpatial/removeSpatial/updateSpatial, initPathFinder/initPathingGrid/
// findPath, processPackets/sendToPlayer/sendBroadcast/sendNeighbours) is
// still callable exactly the same way -- `map.entities.X(...)` -- as a
// one-line delegate to the relevant helper, so nothing outside this file
// needed to change.
class MapEntities {
    constructor(id, server, map) {
        this.id = id;
        this.map = map;
        this.server = server;
        this.world = server;

        this.entities = new Map();
        this.players = new Map();
        this.characters = new Map();
        this.npcplayers = new Map();
        this.mobs = new Map();
        this.items = new Map();
        this.npcs = new Map();
        this.blocks = new Map();

        this.broadcaster = new MapBroadcaster(this);
        this.pathfindingService = new MapPathfindingService(this);

        //this.mobAreas = [];
        this.groups = {};

        this.pathfinder = null;
        this.pathingGrid = null;

        this.zoneGroupsReady = false;

        this.entityCount = 0;

        this.mobAI = null;

        this.cellsize = G_TILESIZE;

        this.harvest = {};

        this.initSpatialEntities(G_SPATIAL_SIZE);
    }

    initSpatialEntities(size) {
        this.spatialIndex = new SpatialIndex(this.map, size);
    }

    getSpatialEntities(arr) {
        return this.spatialIndex.getSpatialEntities(arr);
    }

    mapready() {
        this.initPathFinder();
        this.initPathingGrid();

        this.mobAI = new MobAI(this.server, this.map);
    }

    initPathFinder() {
        this.pathfindingService.initPathFinder();
    }

    spawnNpcs(count) {
        let npc;
        for (let i = 0; i < count; ++i) {
            npc = this._createNpc('Npc' + i);
        }
    }

    _createNpc(name) {
        const self = this;

        // NOTE: `pos` was a bare (undeclared) assignment in the original CommonJS
        // source, which created an implicit global there; declared with `var`
        // here since ES modules are always strict mode and forbid implicit
        // globals.
        const pos = this.spaceEntityRandomApart(2, function () {
            return self.map.getRandomPosition();
        });

        const npc = new NpcMove(
            ++this.entityCount,
            0,
            pos.x * G_TILESIZE,
            pos.y * G_TILESIZE,
            self.map
        );

        self.addNpcMove(npc);
        return npc;
    }

    initPathingGrid() {
        this.pathfindingService.initPathingGrid();
    }

    /*pushSpawnsToPlayer: function(player, ids) {
        this.processWho(this.player);
    },*/

    processWho(player, dist) {
        const width = player.config.screenWidth;
        const height = player.config.screenHeight;
        const self = this;
        const screens = [];

        // PERF: processWho is the single most frequently invoked query in the
        // codebase (see the G_SPATIAL_SIZE comment in main.js -- it fires on
        // essentially every move/attack/chat/spawn/despawn/harvest/block
        // broadcast). `ids` used to be run through Utils.ArrayParseInt(),
        // allocating a whole new array and calling parseInt() on every
        // element -- but knownIds is only ever populated via
        // `knownIds.push(entity.id)` (mapentities.js addPlayer/addEntity,
        // playeritems.js), and entity ids are always real numbers (assigned
        // from a numeric ++entityCount), never strings. That conversion was
        // pure allocation+parsing overhead on data that was already numeric,
        // paid on the hottest path in the game.
        const ids = player.knownIds;

        const pgx = ~~(player.x / G_TILESIZE);
        const pgy = ~~(player.y / G_TILESIZE);

        const arr = [pgx - width, pgy - height, pgx + width, pgy + height];
        const entities = this.getSpatialEntities(arr);

        for (const entity of entities) {
            if (entity && !(entity === player) && self.isOffset(player, entity))
                screens.push(entity.id);
        }

        // PERF: `_.difference(screens, ids)` calls `_.contains(ids, ...)` (a
        // linear indexOf-style scan of `ids`) once per element of `screens`,
        // so this was O(screens.length * ids.length) -- on the single
        // hottest query in the codebase (see the PERF comment on `ids`
        // above), paid on essentially every move/attack/chat/spawn/despawn.
        // `ids` (player.knownIds) only grows as a player explores/fights, so
        // this got quadratically worse the longer someone played and the
        // busier the area around them was. Building a Set from `ids` once
        // and filtering `screens` against it does the same de-dup in
        // O(screens.length + ids.length), with O(1) membership checks
        // instead of O(ids.length) ones.
        const knownSet = ids && ids.length > 0 ? new Set(ids) : null;
        const screenIds = knownSet
            ? screens.filter((id) => !knownSet.has(id))
            : screens;

        for (const id of screenIds) {
            const entity = self.getEntityById(id);
            if (entity && !(entity === player)) {
                player.knownIds.push(entity.id);
                self.sendToPlayer(player, entity.spawn());
                if (entity.path) {
                    const msg = new Messages.MovePath(entity, entity.path);
                    self.sendToPlayer(player, msg);
                }
            }
        }
    }

    isOffset(entity, entity2, extra, cameraHalfX, cameraHalfY) {
        extra = (extra || 0) * G_TILESIZE;
        cameraHalfX = (cameraHalfX || 32) * G_TILESIZE;
        cameraHalfY = (cameraHalfY || 32) * G_TILESIZE;

        const minX = Math.max(0, entity.x - cameraHalfX - extra);
        const minY = Math.max(0, entity.y - cameraHalfY - extra);
        const maxX = Math.min(
            this.map.width * G_TILESIZE,
            entity.x + cameraHalfX + extra
        );
        const maxY = Math.min(
            this.map.height * G_TILESIZE,
            entity.y + cameraHalfY + extra
        );

        return (
            entity2.y >= minY &&
            entity2.y <= maxY &&
            entity2.x >= minX &&
            entity2.x <= maxX
        );
    }

    processPackets() {
        this.broadcaster.processPackets();
    }

    sendToPlayer(player, message) {
        this.broadcaster.sendToPlayer(player, message);
    }

    sendBroadcast(message, ignoredPlayer) {
        this.broadcaster.sendBroadcast(message, ignoredPlayer);
    }

    sendNeighbours(entity, message, ignoredPlayer, areaLength) {
        this.broadcaster.sendNeighbours(
            entity,
            message,
            ignoredPlayer,
            areaLength
        );
    }

    spawnEntities(map) {
        const self = this;

        //setTimeout(function () {
        _.each(self.map.spawnEntities, function (npcData) {
            if (npcData.type == Types.EntityTypes.NPCMOVE) {
                const npc = self.addNpcMove(npcData.id, npcData.x, npcData.y);
                if (npcData.name) npc.name = npcData.name;
                if (npcData.scriptQuests)
                    npc.scriptQuests = npcData.scriptQuests;
            }
            if (npcData.type == Types.EntityTypes.NPCSTATIC) {
                const npc = self.addNpcStatic(npcData.id, npcData.x, npcData.y);
                if (npcData.name) npc.name = npcData.name;
                if (npcData.scriptQuests)
                    npc.scriptQuests = npcData.scriptQuests;
            }
        });
        //},10000);

        console.info(JSON.stringify(self.map.staticEntities));
        _.each(self.map.staticEntities, function (kind, tid) {
            const pos = map.tileIndexToGridPosition(tid);

            console.info('kind:' + kind);
            if (NpcData.isNpc(kind)) {
                console.info('npc:' + kind + ',x:' + pos.x + ',y:' + pos.y);
                self.addNpcStatic(kind, pos.x, pos.y);
            }
        });
    }

    /*spawnEntity: function(kind, x, y, map) {
        var self = this;
        var entity;
        if (NpcData.isNpc(kind)) {
            entity = self.addNpc(kind, x, y, map);
        }
        else if (MobData.isMob(kind)) {
            entity = self.addMob(kind, x, y);
        }
        return entity;
    },*/

    addEntity(entity) {
        this.entities.set(entity.id, entity);
        if (entity instanceof Character) this.characters.set(entity.id, entity);
    }

    addPlayer(player) {
        console.info('addPlayer - player id: ' + player.id);
        this.addEntity(player);
        this.players.set(player.id, player);
        this.broadcaster.registerPlayer(player.id);
    }

    addBlock(block) {
        this.addEntity(block);
        this.blocks.set(block.id, block);
        return block;
    }

    addMob(kind, x, y, area) {
        const mob = new Mob(++this.entityCount, kind, x, y, this.map, area);
        mob.mobAI = this.mobAI;

        this.addEntity(mob);
        this.mobs.set(mob.id, mob);

        this.world.mobCallback.setCallbacks(mob);

        return mob;
    }

    // SIMPLIFY: addNpcStatic/addNpcMove were identical apart from which NPC
    // class to construct and which Map to register the result in.
    // Consolidated into this helper; each public method is now a one-liner.
    _addNpc(NpcClass, targetMap, kind, x, y) {
        const pos = Utils.fixGridPosition(G_TILESIZE, x, y);
        const npc = new NpcClass(
            ++this.entityCount,
            kind,
            pos.x,
            pos.y,
            this.map
        );

        this.addEntity(npc);
        targetMap.set(npc.id, npc);

        return npc;
    }

    addNpcStatic(kind, x, y) {
        return this._addNpc(NpcStatic, this.npcs, kind, x, y);
    }

    addNpcMove(kind, x, y) {
        return this._addNpc(NpcMove, this.npcplayers, kind, x, y);
    }

    addItem(item) {
        this.addEntity(item);
        this.items.set(item.id, item);

        return item;
    }

    addSpatial(entity) {
        this.spatialIndex.add(entity);
    }

    removeSpatial(entity) {
        this.spatialIndex.remove(entity);
    }

    updateSpatial(entity) {
        this.spatialIndex.update(entity);
    }

    removeEntity(entity) {
        // PERF: removeEntity runs on every mob death, item pickup/despawn,
        // and block pickup -- not the absolute hottest path in the game,
        // but frequent enough during active combat/looting that it doesn't
        // belong on the unconditional path. Also mislabeled as an error:
        // this fires on ordinary, expected entity removal, not an anomaly.
        // Gated behind G_DEBUG (and downgraded to info) to match the
        // logging convention used elsewhere in this file/codebase.
        if (G_DEBUG) console.info('removeEntity: ' + entity.id);
        this.removeSpatial(entity);

        if (this.mobs.has(entity.id)) this.mobs.delete(entity.id);

        if (this.items.has(entity.id)) this.items.delete(entity.id);

        if (this.players.has(entity.id)) this.players.delete(entity.id);

        if (this.blocks.has(entity.id)) this.blocks.delete(entity.id);

        if (this.characters.has(entity.id)) this.characters.delete(entity.id);

        if (this.entities.has(entity.id)) this.entities.delete(entity.id);

        entity.destroy();
    }

    removePlayer(player) {
        //try { throw new Error(); } catch (e) { console.error(e.stack); }

        console.info('removePlayer-called');
        const self = this;

        if (player instanceof Player) this.sendBroadcast(player.despawn());

        console.info('deleting player traces..');

        self.removeEntity(player);

        self.broadcaster.unregisterPlayer(player.id);
        //delete player;
        player = null;
    }

    removeNpcPlayer(player) {
        console.info('removePlayer-called');

        this.sendBroadcast(player.despawn(0));
        this.removeEntity(player);

        // FIX: `this.npcplayers` is a Map, not a plain object -- `delete`
        // only removes object properties, so `delete this.npcplayers.get(...)`
        // was a complete no-op (it deleted a property off the *returned
        // value*, then discarded that too). Use Map#delete() to actually
        // remove the entry. (No current callers of removeNpcPlayer exist in
        // the codebase today, so this was latent rather than an active
        // leak -- flagging for whenever NPC-player removal gets wired up.)
        this.npcplayers.delete(player.id);
    }

    createItem(itemRoom, x, y) {
        const id = ++this.entityCount;
        let item = null;

        let type = Types.EntityTypes.ITEM;
        if (!ItemTypes.isEquippable(itemRoom.itemKind))
            type = Types.EntityTypes.ITEMLOOT;
        item = new Item(type, id, itemRoom, x, y, this.map);
        this.addItem(item);

        return item;
    }

    /*createChest: function(x, y, items) {
        var self = this;
        var chest = self.createItem(37, x, y); // CHEST
        chest.map = self.map;
        return chest;
    },*/

    addStaticItem(map, item) {
        const self = this;

        item.isStatic = true;
        item.onRespawn(self.addStaticItem.bind(self, item));

        return self.addItem(item);
    }

    /*addItemFromChest: function(kind, x, y) {
        var item = this.createItem(kind, x, y);
        item.isFromChest = true;
        return this.addItem(item);
    },*/

    /*getNpcByQuestId:function(id) {
      var self = this;
      var npc;
      for (var id in self.npcs) {
        npc = self.npcs[id];
        // DANGER - if questhandler variable changes so should this.
        if (npc.entityQuests.questEntityKind === id)
          return npc;
      }
      return null;
    },*/

    getEntityById(id) {
        return this.entities.get(Number(id));
    }

    getPlayerByName(name) {
        for (const p of this.players.values()) {
            if (p.name === name) return p;
        }
        return null;
    }

    setModifyGoldByName(name, mod) {
        const player = this.getPlayerByName(name);
        // FIX: modifyGold() is defined on PlayerItems (player.items), not on
        // Player itself -- this threw "not a function" whenever gold was
        // credited to an online player by name (e.g. auction payouts).
        if (player) player.items.modifyGold(mod);
        //else
    }

    // NOTE: `entities` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    getEntitiesByPosition(x, y) {
        const entities = [];
        this.forEachEntity(function (e) {
            if (e.x === x && e.y === y) entities.push(e);
        });
        return entities;
    }

    isCharacterAt(x, y) {
        return this.entitygrid[y][x] === 1;
    }

    isMobAt(x, y) {
        let result = false;
        this.forEachMob(function (mob) {
            const pos = mob.getLastPosition();
            if (x === pos[0] && y === pos[1]) result = true;
        });
        return result;
    }

    forEachEntity(callback) {
        for (const entity of this.entities.values()) {
            callback(entity);
        }
    }

    forEachPlayer(callback) {
        for (const entity of this.players.values()) {
            callback(entity);
        }
    }

    forEachMob(callback) {
        for (const entity of this.mobs.values()) {
            callback(entity);
        }
    }

    forEachCharacter(callback) {
        for (const entity of this.entities.values()) {
            if (entity instanceof Character) callback(entity);
        }
    }

    forEachNpcPlayer(callback) {
        for (const entity of this.npcplayers.values()) {
            if (entity instanceof Character) callback(entity);
        }
    }

    // TODO - Minimize function calls so you can pass type to loop through, and the additional condition.
    getEntitySpatialCount(entity, range, conditional) {
        return this.getEntityAroundSpatial(entity, range, conditional).length;
    }

    getEntityAroundSpatial(entity, range, conditional) {
        const r = range || 1;
        const x = entity.x;
        const y = entity.y;
        const gx = ~~(entity.x / G_TILESIZE);
        const gy = ~~(entity.y / G_TILESIZE);

        const entities = [];
        const def_conditional = function (e1, e2) {
            return e1 !== e2;
        };
        conditional = conditional || def_conditional;
        // NOTE: there used to be a `var e2;` here too, ahead of the loop --
        // dead (nothing read it before the `for` loop below redeclared/
        // reinitialized `e2` on its own), and would collide with `const`
        // (redeclaration in the same scope) if kept.
        const group = this.getSpatialEntities([gx - r, gy - r, gx + r, gy + r]);
        for (const e2 of group) {
            if (conditional(entity, e2)) {
                entities.push(e2);
            }
        }
        return entities;
    }

    getEntityCount(group, e1, range, conditional) {
        return this.getEntityAround(group, e1, range, conditional).length;
    }

    getEntityAround(group, e1, range, conditional) {
        range *= G_TILESIZE;
        const entities = [];
        conditional =
            conditional ||
            function (e1, e2) {
                return e1 !== e2;
            };
        const compare = function (e1, e2) {
            return (
                Math.abs(e2.x - e1.x) <= range &&
                Math.abs(e2.y - e1.y) <= range &&
                conditional(e1, e2)
            );
        };
        if (Array.isArray(group)) {
            for (const e2 of group) {
                if (compare(e1, e2)) entities.push(e2);
            }
        } else {
            if (group instanceof Map) {
                for (const e2 of group.values()) {
                    if (compare(e1, e2)) entities.push(e2);
                }
            } else {
                Utils.forEach(group, function (e2) {
                    if (compare(e1, e2)) entities.push(e2);
                });
            }
        }
        return entities;
    }

    // FIX: getEachEntityAround was unused anywhere in the codebase and was
    // also broken -- it converted x/y to grid coordinates (dividing by
    // G_TILESIZE) and then passed that grid-scale {x,y} as e1 into
    // getEntityAround(), which compares against real-world entity
    // coordinates (e2.x/e2.y) using a real-world-scale range. Comparing
    // grid-scale numbers against world-scale numbers meant the distance
    // filter would almost never match. Removed as dead code rather than
    // fixed in place, since getEntitiesAround() below already covers the
    // same "entities around a point" need for every real caller.

    getEntitiesAround(entity, range) {
        const x = ~~(entity.x / G_TILESIZE);
        const y = ~~(entity.y / G_TILESIZE);
        const r = range;
        const entities = this.getSpatialEntities([x - r, y - r, x + r, y + r]);
        return this.getEntityAround(entities, entity, r);
    }

    // FIX: this used to re-run getEntityAround() (a second full distance
    // check) over a list that getEntitiesAround() had already
    // distance-filtered, just to additionally apply the `instanceof
    // Character` check -- doubling the distance math for no reason. Filter
    // directly instead, matching the pattern already used by
    // getMobsAround/getPlayerAround right below.
    getCharactersAround(entity, range) {
        return this.getEntitiesAround(entity, range).filter(
            (e) => e !== entity && e instanceof Character
        );
    }

    // PERF: getMobsAround/getPlayerAround used to call getEntityAround(this.mobs, ...)
    // / getEntityAround(this.players, ...) directly, which linearly scans
    // *every* mob or player on the whole map and distance-checks each one --
    // even though this class already maintains a spatial hash grid
    // (this.spatial / getSpatialEntities) specifically to avoid that. These
    // two are called a lot: getPlayerAround backs sendNeighbours (every
    // move/attack/chat/block-place broadcast) and getMobsAround backs
    // MobAI.Roaming (once per second per player). Routing them through
    // getEntitiesAround first means they only ever look at entities in the
    // nearby spatial cells, then filter that (much smaller) set down to the
    // instance type wanted, instead of walking every mob/player on the map.
    getMobsAround(entity, range) {
        return this.getEntitiesAround(entity, range).filter(
            (e) => e instanceof Mob
        );
    }

    getPlayerAround(entity, range) {
        return this.getEntitiesAround(entity, range).filter(
            (e) => e instanceof Player
        );
    }

    getAroundCount(entities, entity, range) {
        return this.getEntityAround(entities, entity, range).length;
    }

    // FIX: same redundant-double-distance-check issue as getCharactersAround
    // above -- getEntitiesAround() already distance-filters, so re-running
    // getEntityAround() on its result just repeated the same check.
    getEntityAroundCount(entity, range) {
        return this.getEntitiesAround(entity, range).length;
    }

    getPlayerAroundCount(entity, range) {
        return this.getPlayerAround(entity, range).length;
    }

    getPartyAround(entity, range) {
        // entity
        return this.getEntityAround(entity.party.players, entity, range);
    }

    itemDespawn(item) {
        this.sendNeighbours(item, new Messages.Despawn(item));
        this.removeEntity(item);
    }

    // NOTE: chests are now just Node entities (Node.CHEST_KIND) spawned into
    // a regular EntityArea in mapmanager.js, so they respawn/despawn through
    // the same generic Node/EntityArea machinery as ore & tree nodes -- no
    // chest-specific bookkeeping is needed on this class anymore.

    findPath(character, x, y, ignoreList) {
        return this.pathfindingService.findPath(character, x, y, ignoreList);
    }

    spaceEntityRandomApart(dist, callback_func, entities, entity, threshold) {
        // FIX: was `this.entities.values()` -- a one-shot MapIterator, not
        // an Array or a Map. getAroundCount() below routes into
        // getEntityAround(), which only knows how to walk an Array or a
        // real Map (`group instanceof Map`); anything else (including a
        // MapIterator) falls through to Utils.forEach(), which does
        // `for...in` + hasOwnProperty() -- a MapIterator has no enumerable
        // own properties, so that loop always ran zero times. That made
        // getAroundCount() always return 0, so the `while (count > 0 ...)`
        // spacing loop below always exited after exactly one attempt,
        // silently accepting the very first randomly-generated candidate
        // position with no actual overlap check. Every call site that
        // relies on this default (player spawn placement in map.js, NPC
        // placement, node/chest placement in mapmanager.js, block
        // placement in blockarea.js) could end up stacking an entity
        // directly on top of another. Passing the live Map itself (instead
        // of an iterator over it) lets getEntityAround()'s existing
        // `instanceof Map` branch iterate it correctly.
        entities = entities || this.entities;
        threshold = threshold || 100;
        let pos = null;
        let count = 1;
        const param = entity && entity.collision ? entity.collision : null;
        let iter = 0;

        while (count > 0 && iter < threshold) {
            if (callback_func) {
                pos = callback_func(param);
                count = pos ? this.getAroundCount(entities, pos, dist) : 0;
            }
            iter++;
        }
        return pos;
    }

    isGridPositionEmpty(x, y) {
        if (G_DEBUG) console.info('isGridPositionEmpty: x=' + x + ',y=' + y);
        if (this.map.isColliding(x, y)) return false;

        const pos = { x: x, y: y };
        const entities = this.getEntitiesAround(pos, 1);
        if (entities.length === 0) return true;
        // FIX: isOverPosition(x, y) (entity.js) takes two separate numeric
        // coordinates -- it's the "*Position" half of that class's own
        // convention (compare isOverEntity(entity), which unpacks an
        // object; isOverPosition(x, y) does not). Passing the whole `pos`
        // object as the single `x` argument left `y` undefined, so
        // isWithinDist()'s `this.x - x` subtracted an object from a number
        // (NaN) every time, making this overlap check always return false
        // regardless of actual position -- this function would always
        // report a position as empty even when occupied. Only reachable
        // today via TrapArea.isGroupEmptyPositions() (area/traparea.js),
        // which is dead code (TrapArea is never instantiated -- see the
        // NOTE in map/mapmanager.js), so fixed for correctness rather than
        // for any currently-observed symptom.
        for (const entity of entities) {
            if (entity.isOverPosition(pos.x, pos.y)) return false;
        }
        return true;
    }
}

export default MapEntities;
