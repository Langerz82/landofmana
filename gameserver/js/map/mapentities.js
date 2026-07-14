import NpcStatic from '../entity/npcstatic.js';
import NpcMove from '../entity/npcmove.js';
import Messages from '../message.js';
import MobAI from '../mobai.js';
import _ from 'underscore';
import Utils from '../utils.js';
import { ItemTypes } from '../common.js';
import Pathfinder from '../pathfinder.js';
import Character from '../entity/character.js';
import Mob from '../entity/mob.js';
import Item from '../entity/item.js';
import Player from '../entity/player.js';
import { Types } from '../common.js';
import NpcData from '../data/npcdata.js';
import { G_TILESIZE, G_SPATIAL_SIZE, G_DEBUG } from '../main.js';

class MapEntities {
    constructor(id, server, map) {
        this.id = id;
        this.map = map;
        this.server = server;
        this.world = server;
//    	this.database = database;

        this.entities = new Map();
        this.players = new Map();
        this.characters = new Map();
        this.npcplayers = new Map();
        this.mobs = new Map();
//      this.attackers = {};
        this.items = new Map();
        this.npcs = new Map();
//      this.pets = {};
        this.blocks = new Map();

        // PERF: was a plain object keyed by player id, iterated everywhere
        // (sendBroadcast/sendNeighbours/processPackets -- i.e. on every chat
        // message, attack, spawn/despawn, and every 16ms flush tick) via
        // Utils.forEach's `for...in` + `hasOwnProperty` loop. A Map avoids
        // the hasOwnProperty check per entry and iterates faster than
        // for...in over an object.
        this.packets = new Map();

        this.mobAreas = [];
        this.groups = {};

        this.pathfinder = null;
        this.pathingGrid = null;

        this.zoneGroupsReady = false;

        this.maxPackets = 10;

        this.entityCount = 0;

        this.mobAI = null;

        this.cellsize = G_TILESIZE;

        this.harvest = {};

        this.initSpatialEntities(G_SPATIAL_SIZE);
    }

    initSpatialEntities(size) {
        this.spatial = [];
        this.spatialSize = size;
        const spatialWidth = Math.ceil(this.map.width / size);
        const spatialHeight = Math.ceil(this.map.height / size);
        for(let i=0, j=0; i < spatialHeight; i++) {
            this.spatial[i] = [];
            for(j=0; j < spatialWidth; j++) {
                this.spatial[i][j] = [];
            }
        }
    }

    getSpatialEntities(arr)
    {
        const x1 = ~~(Math.max(arr[0],0) / this.spatialSize);
        const y1 = ~~(Math.max(arr[1],0) / this.spatialSize);
        const x2 = ~~(Math.min(arr[2],this.map.width-1) / this.spatialSize);
        const y2 = ~~(Math.min(arr[3],this.map.height-1) / this.spatialSize);

        //console.info("getSpatialEntities - x1:"+x1+",y1:"+y1+",x2:"+x2+",y2:"+y2);
        const res = [];
        const l1 = this.spatial.length;
        let l2 = 0;
        for(let j = y1, i=0; j <= y2; ++j)
        {
            l2 = this.spatial[j].length;
            for(i = x1; i <= x2; ++i) {
                /*if (j < 0 || j >= l1)
                  continue;
                if (i < 0 || i >= l2)
                  continue;*/
                for (const entity of this.spatial[j][i]) {
                    if (!entity) continue;
                    //console.info("id:"+id);
                    //console.info("entity.id:"+entity.id);
                    res.push(entity);
                }
            }
        }
        return res;
    }

    mapready() {
        this.initPathFinder();
        this.initPathingGrid();
        //this.initZoneGroups();

        this.mobAI = new MobAI(this.server, this.map);
    }

    initPathFinder() {
        this.pathfinder = new Pathfinder(this.map.width, this.map.height);
    }

    spawnNpcs(count) {
        let npc;
        //console.info("SPAWN NPCS");
        //if (this.map === this.server.maps[0]) // World Map
        //{
        for(let i = 0; i < count; ++i)
        {
            npc = this._createNpc("Npc"+i);
        }
        //  }
    }

    _createNpc(name) {
        const self = this;

        // NOTE: `pos` was a bare (undeclared) assignment in the original CommonJS
        // source, which created an implicit global there; declared with `var`
        // here since ES modules are always strict mode and forbid implicit
        // globals.
        const pos = this.spaceEntityRandomApart(2, function () { return self.map.getRandomPosition(); });

        const npc = new NpcMove(++this.entityCount, 0, pos.x * G_TILESIZE, pos.y * G_TILESIZE, self.map);

        self.addNpcMove(npc);
        //self.sendBroadcast(npc.spawn());
        return npc;
    }

    initPathingGrid() {
        const map = this.map,
            self = this;
        console.info("pathinggrid height:"+map.height+", width:"+map.width);

        const grid = new Array(map.height);
        for(let i=0; i < map.height; ++i) {
            grid[i] = new Uint8Array(map.width);
            for(let j=0; j < map.width; ++j) {
                if (map.grid[i][j])
                    grid[i][j] = 1;
                else
                    grid[i][j] = 0;
            }
        }
        self.entitygrid = grid.slice(0);
        //self.pathingGrid = grid.slice(0);

        console.info("Initialized the pathing grid with static colliding cells.");
    }

    /*pushSpawnsToPlayer: function(player, ids) {
        this.processWho(this.player);
    },*/

    processWho(player, dist) {
        const width = player.config.screenWidth;
        const height = player.config.screenHeight;
        const self = this;
        //console.info("processWho - called.");
        const screens = [];
        //var ids = [];
        //var knowns = [];

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

        const pgx = ~~(player.x/G_TILESIZE);
        const pgy = ~~(player.y/G_TILESIZE);

        //console.info("x1:"+x1+",y1:"+y1+",x2:"+x2+",y2:"+y2);
        const arr = [pgx - width, pgy - height, pgx + width, pgy + height];
        const entities = this.getSpatialEntities(arr);

        //console.info("self.entities.length: "+Object.keys(self.entities).length);
        for (const entity of entities) {
            if (entity && !(entity === player) && self.isOffset(player, entity))
                screens.push(entity.id);
        }
        //console.info("screens:"+JSON.stringify(screens));
        //console.info("ids:"+JSON.stringify(ids));

        const screenIds = (ids && ids.length > 0) ? _.difference(screens, ids) : screens;

        //console.info(JSON.stringify(screenIds));

        _.each(screenIds, function(id) {
            const entity = self.getEntityById(id);
            if(entity && !(entity === player))
            {
                player.knownIds.push(entity.id);
                self.sendToPlayer(player, entity.spawn());
                if (entity.path) {
                    const msg = new Messages.MovePath(entity, entity.path);
                    self.sendToPlayer(player, msg);
                }
            }
        });
    }

    isOffset(entity, entity2, extra, cameraHalfX, cameraHalfY) {
        extra = (extra || 0) * G_TILESIZE;
        cameraHalfX = (cameraHalfX || 32) * G_TILESIZE;
        cameraHalfY = (cameraHalfY || 32) * G_TILESIZE;

        const minX = Math.max(0,entity.x-cameraHalfX-extra);
        const minY = Math.max(0,entity.y-cameraHalfY-extra);
        const maxX = Math.min(this.map.width * G_TILESIZE, entity.x+cameraHalfX+extra);
        const maxY = Math.min(this.map.height * G_TILESIZE, entity.y+cameraHalfY+extra);

        //console.info("entity.x: "+entity.x+" entity.y:"+entity.y);
        //console.info("entity2.x: "+entity2.x+" entity2.y:"+entity2.y);
        //console.info("minX:"+minX+",maxX:"+maxX+",minY:"+minY+",maxY:"+maxY);
        return (entity2.y >= minY && entity2.y <= maxY && entity2.x >= minX && entity2.x <= maxX);
    }

    processPackets() {
        const self = this;

        // NOTE: the old `self.packets.length > 0` check was dead code even
        // before `packets` became a Map -- it was a plain object, which has
        // no `.length`, so this always compared `undefined > 0` (always
        // false) and the JSON.stringify of the *entire* packet queue never
        // actually ran. Dropped rather than "fixed": wiring it up for real
        // would mean unconditionally paying that stringify cost on this
        // 16ms flush tick for every map with players.

        // PERF: iterate the Map directly with for...of instead of
        // Utils.forEach's `for...in` + `hasOwnProperty` loop -- this runs
        // once every 16ms for every map that has players connected.
        for (const [id, packet] of this.packets) {
            const len = packet.length;
            if (len > 0)
            {
                const player = self.getEntityById(id);
                let conn = self.server.socket.getConnection(id);
                if (player && player.map && player.mapStatus >= 2 && conn !== null && typeof conn !== 'undefined')
                {
                    const packets = [];
                    for (let i =0; i < self.maxPackets; ++i)
                    {
                        if (packet.length === 0)
                            break;
                        packets.push(packet.shift());
                    }
                    conn.send(packets);
                } else {
                    conn = null;
                    //delete conn;
                }
            }
        }
    }

    // FIX (perf): sendToPlayer/sendBroadcast/sendNeighbours each used to call
    // this.processPackets() immediately after queuing, on top of the
    // setInterval(processPackets, 16) flush already running for every map
    // with players (worldserver.js). processPackets() iterates every queued
    // player's packet list on the map, so every single event -- one chat
    // message, one attack, one item pickup -- paid a full
    // O(players-on-map) cost immediately, in addition to being flushed again
    // a few milliseconds later by the interval. Queuing here and letting the
    // 16ms interval be the sole flush point removes that redundant work;
    // worst case this delays delivery by <16ms, which is already the
    // effective batching granularity the interval assumes.
    sendToPlayer(player, message) {
        if (!message)
            return;

        if (player) {
            const queue = this.packets.get(player.id);
            if (queue)
                queue.push(message.serialize());
        }
    }

    sendBroadcast(message, ignoredPlayer)  {
        if (!message)
            return;

        // PERF: message.serialize() (message.js) is a pure function of the
        // message's own fields -- it doesn't vary per recipient -- so it
        // only needs to be computed once per broadcast call instead of once
        // per connected player. This used to re-serialize the same message
        // from scratch for every single player on the map on every chat
        // message, spawn, despawn, and attack broadcast. The resulting array
        // is only ever read (never mutated) by the packet-flush/send path in
        // processPackets()/ws.js, so sharing one reference across every
        // player's queue is safe.
        const serialized = message.serialize();
        for (const [id, packet] of this.packets) {
            if (id !== ignoredPlayer)
                packet.push(serialized);
        }
    }

    sendNeighbours(entity, message, ignoredPlayer, areaLength)  {
        //console.info("sendNeighbours");
        const self = this;
        areaLength = areaLength || 64;
        const players = self.getPlayerAround(entity, areaLength);
        players.push(entity);

        // PERF: serialize once and share the reference across recipients --
        // see sendBroadcast above for why that's safe.
        const serialized = message.serialize();

        for (const player of players) {
            // NOTE: previously `packets.hasOwnProperty(player.id) && !ignoredPlayer ||
            // (ignoredPlayer && player !== ignoredPlayer)` -- because && binds tighter
            // than ||, the ignoredPlayer branch bypassed the hasOwnProperty check
            // entirely, so a player around who isn't the ignored one but somehow has
            // no packets entry would throw on push() below instead of being skipped.
            const queue = self.packets.get(player.id);
            if (queue && (!ignoredPlayer || player !== ignoredPlayer))
            {
                queue.push(serialized);
            }
        }
    }

    spawnEntities(map) {
        const self = this;

        //setTimeout(function () {
        _.each(self.map.spawnEntities, function(npcData) {
            if (npcData.type == Types.EntityTypes.NPCMOVE) {
                const npc = self.addNpcMove(npcData.id, npcData.x, npcData.y);
                if (npcData.name)
                    npc.name = npcData.name;
                if (npcData.scriptQuests)
                    npc.scriptQuests = npcData.scriptQuests;
            }
            if (npcData.type == Types.EntityTypes.NPCSTATIC) {
                const npc = self.addNpcStatic(npcData.id, npcData.x, npcData.y);
                if (npcData.name)
                    npc.name = npcData.name;
                if (npcData.scriptQuests)
                    npc.scriptQuests = npcData.scriptQuests;
            }

        });
        //},10000);

        console.info(JSON.stringify(self.map.staticEntities));
        _.each(self.map.staticEntities, function(kind, tid) {

            const pos = map.tileIndexToGridPosition(tid);

            console.info("kind:"+kind);
            if (NpcData.isNpc(kind)) {
                console.info("npc:" + kind + ",x:"+pos.x+",y:"+pos.y);
                self.addNpcStatic(kind, pos.x, pos.y);
            }
        });
    }

    /*spawnEntity: function(kind, x, y, map) {
        var self = this;
        var entity;
        //console.info("kind="+kind);
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
        if (entity instanceof Character)
            this.characters.set(entity.id, entity);
    }

    addPlayer(player) {
        console.info("addPlayer - player id: "+player.id);
        this.addEntity(player);
        this.players.set(player.id, player);
        this.packets.set(player.id, []);
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

    addNpcStatic(kind, x, y) {
        const pos = Utils.fixGridPosition(x, y);
        const npc = new NpcStatic(++this.entityCount, kind, pos.x, pos.y, this.map);

        this.addEntity(npc);
        this.npcs.set(npc.id, npc);

        return npc;
    }

    addNpcMove(kind, x, y) {
        const pos = Utils.fixGridPosition(x, y);
        const npc = new NpcMove(++this.entityCount, kind, pos.x, pos.y, this.map);

        this.addEntity(npc);
        this.npcplayers.set(npc.id, npc);

        return npc;
    }

    addItem(item) {
        this.addEntity(item);
        this.items.set(item.id, item);

        return item;
    }

    addSpatial(entity) {
        // FIX: `!entity.x || !entity.y` treats a legitimate coordinate of
        // exactly 0 as "missing", silently skipping spatial-grid
        // registration for any entity sitting at x===0 or y===0 (the map
        // edge) -- making it invisible to proximity-based queries (combat
        // targeting, processWho, etc). Use null/undefined checks instead of
        // truthiness so 0 is treated as a valid coordinate.
        if (!entity || entity.x == null || entity.y == null) return;

        const ts = G_TILESIZE;
        const gx = ~~(entity.x / ts);
        const gy = ~~(entity.y / ts);

        const spx = ~~(gx / this.spatialSize);
        const spy = ~~(gy / this.spatialSize);

        // bounds check
        if (spy < 0 || spy >= this.spatial.length ||
            spx < 0 || spx >= this.spatial[spy].length) {
            return;
        }

        entity.spx = spx;
        entity.spy = spy;
        entity.spatialMap = true;

        this.spatial[spy][spx].push(entity);
    }

    // FIX: this used to recompute the entity's spatial cell from
    // entity.x/entity.y at call time instead of using the cell it was
    // actually stored under (entity.spx/entity.spy, set by addSpatial
    // below). By the time removeSpatial runs, entity.x/entity.y already
    // hold the *new* position -- Entity._setPosition() assigns this.x/this.y
    // before calling removeSpatial() -- so recomputing here found the
    // entity's *new* cell, not the old one it was actually sitting in.
    // Whenever an entity crossed a spatial-cell boundary (which every
    // moving mob and player does constantly), that meant this removal was a
    // silent no-op: Utils.removeFromArray() does an indexOf lookup and just
    // finds nothing in the wrong cell's array, and addSpatial() then pushed
    // a second, live reference into the new cell -- leaving a permanent
    // "ghost" entry behind in the old cell forever. Since this repeats on
    // every boundary crossing for the lifetime of the server, the spatial
    // arrays grew without bound, and every proximity query built on top of
    // them (getSpatialEntities -> getPlayerAround/getMobsAround/processWho/
    // combat targeting/pathfinding ignore-include lists) returned an
    // ever-growing set of stale duplicate entities that had long since
    // moved elsewhere. Using the entity's own stored spx/spy -- exactly the
    // cell it was last added to -- removes it from the right place.
    removeSpatial(entity) {
        if (entity.spatialMap) {
            const spx = entity.spx;
            const spy = entity.spy;

            // bounds check
            if (spy < 0 || spy >= this.spatial.length ||
                spx < 0 || spx >= this.spatial[spy].length) {
                return;
            }

            const spatial = this.spatial[spy][spx];
            Utils.removeFromArray(spatial, entity);
            entity.spatialMap = false;
        }
    }

    // PERF: setPosition() runs on every pixel-step of every moving entity's
    // movement -- Transition.step() (transition.js) can call it up to ~20
    // times per single 32ms world tick for one moving character (see the
    // PERF comment on Map.isColliding in map/map.js for the same loop) --
    // but the entity's spatial-grid cell (a coarser bucket of G_SPATIAL_SIZE
    // tiles, not a single tile) only actually changes on a small fraction of
    // those steps. Previously every single step paid a full
    // removeSpatial()+addSpatial() pair -- an indexOf+splice out of one
    // array followed by a push into another -- regardless of whether the
    // cell changed at all. Skipping the remove/add entirely when the
    // newly-computed cell matches the entity's current one avoids that
    // wasted work on the overwhelming majority of movement steps.
    updateSpatial(entity) {
        if (!entity || entity.x == null || entity.y == null) return;

        const ts = G_TILESIZE;
        const gx = ~~(entity.x / ts);
        const gy = ~~(entity.y / ts);

        const spx = ~~(gx / this.spatialSize);
        const spy = ~~(gy / this.spatialSize);

        if (entity.spatialMap && entity.spx === spx && entity.spy === spy)
            return;

        this.removeSpatial(entity);
        this.addSpatial(entity);
    }

    removeEntity(entity) {
        console.error("removeEntity: "+entity.id);
        this.removeSpatial(entity);

        if (this.mobs.has(entity.id))
            this.mobs.delete(entity.id);

        if (this.items.has(entity.id))
            this.items.delete(entity.id);

        if (this.players.has(entity.id))
            this.players.delete(entity.id);

        if (this.blocks.has(entity.id))
            this.blocks.delete(entity.id);

        if (this.characters.has(entity.id))
            this.characters.delete(entity.id);

        if (this.entities.has(entity.id))
            this.entities.delete(entity.id);

        entity.destroy();
    }

    removePlayer(player) {
        //try { throw new Error(); } catch (e) { console.error(e.stack); }

        console.info("removePlayer-called");
        const self = this;

        if (player instanceof Player)
            this.sendBroadcast(player.despawn());

        console.info("deleting player traces..");

        self.removeEntity(player);

        self.packets.delete(player.id);
        //delete player;
        player = null;
    }

    removeNpcPlayer(player) {
        console.info("removePlayer-called");

        this.sendBroadcast(player.despawn(0));
        this.removeEntity(player);

        delete this.npcplayers.get(player.id);
    }

    createItem(itemRoom, x, y) {
        const id = (++this.entityCount);
        let item = null;

        let type = Types.EntityTypes.ITEM;
        if(!ItemTypes.isEquippable(itemRoom.itemKind))
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

    getPlayerByName(name)
    {
        for (const p of this.players.values()) {
            if (p.name === name)
                return p;
        }
        return null;
    }

    setModifyGoldByName(name, mod) {
        const player = this.getPlayerByName(name);
        // FIX: modifyGold() is defined on PlayerItems (player.items), not on
        // Player itself -- this threw "not a function" whenever gold was
        // credited to an online player by name (e.g. auction payouts).
        if (player)
            player.items.modifyGold(mod);
        //else
        //this.database.modifyGold(name, mod);
    }

    // NOTE: `entities` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    getEntitiesByPosition(x,y) {
        const entities = [];
        this.forEachEntity(function(e) {
            if (e.x === x && e.y === y)
                entities.push(e);
        });
        return entities;
    }

    isCharacterAt(x,y) {
        return this.entitygrid[y][x] === 1;
    }

    isMobAt(x,y) {
        let result = false;
        this.forEachMob(function (mob) {
            const pos = mob.getLastPosition();
            if (x === pos[0] && y === pos[1])
                result = true;
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
            if (entity instanceof Character)
                callback(entity);
        }
    }

    forEachNpcPlayer(callback) {
        for (const entity of this.npcplayers.values()) {
            if (entity instanceof Character)
                callback(entity);
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
        const def_conditional = function (e1,e2) { return e1 !== e2; };
        conditional = conditional || def_conditional;
        //console.info("getEntityAround, range: "+range+",x:"+x+",y:"+y);
        // NOTE: there used to be a `var e2;` here too, ahead of the loop --
        // dead (nothing read it before the `for` loop below redeclared/
        // reinitialized `e2` on its own), and would collide with `const`
        // (redeclaration in the same scope) if kept.
        const group = this.getSpatialEntities([gx-r,gy-r,gx+r,gy+r]);
        for (const e2 of group) {
            if (conditional(entity,e2))
            {
                //console.info("getEntityAround, pushed:"+e2.id);
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
        conditional = conditional || function (e1, e2) { return e1 !== e2; };
        const compare = function (e1, e2) {
            return (Math.abs(e2.x-e1.x) <= range && Math.abs(e2.y-e1.y) <= range &&
                conditional(e1,e2))
        };
        if (Array.isArray(group)) {
            for (const e2 of group) {
                if (compare(e1,e2))
                    entities.push(e2);
            }
        } else {
            if (group instanceof Map) {
                for (const e2 of group.values()) {
                    if (compare(e1,e2))
                        entities.push(e2);
                }
            }
            else {
                Utils.forEach(group, function (e2) {
                    if (compare(e1,e2))
                        entities.push(e2);
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
        const x = ~~(entity.x/G_TILESIZE);
        const y = ~~(entity.y/G_TILESIZE);
        const r = range;
        const entities = this.getSpatialEntities([x-r,y-r,x+r,y+r]);
        return this.getEntityAround(entities, entity, r);
    }

    // FIX: this used to re-run getEntityAround() (a second full distance
    // check) over a list that getEntitiesAround() had already
    // distance-filtered, just to additionally apply the `instanceof
    // Character` check -- doubling the distance math for no reason. Filter
    // directly instead, matching the pattern already used by
    // getMobsAround/getPlayerAround right below.
    getCharactersAround(entity, range) {
        return this.getEntitiesAround(entity, range).filter(e => e !== entity && e instanceof Character);
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
        return this.getEntitiesAround(entity, range).filter(e => e instanceof Mob);
    }

    getPlayerAround(entity, range) {
        return this.getEntitiesAround(entity, range).filter(e => e instanceof Player);
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

    getPartyAround(entity, range) { // entity
        return this.getEntityAround(entity.party.players, entity, range);
    }

    itemDespawn(item)
    {
        this.sendNeighbours(item, new Messages.Despawn(item));
        this.removeEntity(item);
    }

    // NOTE: chests are now just Node entities (Node.CHEST_KIND) spawned into
    // a regular EntityArea in mapmanager.js, so they respawn/despawn through
    // the same generic Node/EntityArea machinery as ore & tree nodes -- no
    // chest-specific bookkeeping is needed on this class anymore.

    findPath(character, x, y, ignoreList) {
        // NOTE: `path` used to be initialized twice -- `var path = [];` up
        // here (dead: nothing ever reads it before the block below
        // overwrites it, and the no-pathfinder/no-character early-out just
        // below returns `null` directly without ever touching `path`) and
        // then `var path = null;` again inside the `if`. Harmless
        // redeclaration under `var`; a SyntaxError under `let`. Consolidated
        // to the one live declaration, scoped to where it's actually used.
        const self = this;

        //console.info("PATHFINDER CODE");

        if(this.pathfinder && character)
        {
            const grid = self.map.grid;
            let path = null;
            const pS =[character.x, character.y];
            const ts = G_TILESIZE;

            if (this.map.isColliding(character.x, character.y))
            {
                //console.warn("findPath - isColliding start.");
                return null;
            }

            const pE = [x,y];
            if (this.map.isColliding(x, y))
            {
                //console.warn("findPath - isColliding end.");
                return null;
            }

            if (pS[0] === pE[0] && pS[1] === pE[1]) {
                try { throw new Error(); } catch(err) { console.info(err.stack); }
                //console.warn("findPath - path coordinates are the same.")
                return null;
            }

            const fgpS = [~~(pS[0]/ts), ~~(pS[1]/ts)];
            const fgpE = [~~(pE[0]/ts), ~~(pE[1]/ts)];
            const shortGrid = this.pathfinder.getShortGrid(grid, fgpS, fgpE, 3);
            const sgrid = shortGrid.crop;
            const spS = shortGrid.substart;
            const spE = shortGrid.subend;
            let subpath = null;

            // PERF: findPath runs for every mob chase/roam/player click-path
            // request -- these JSON.stringify calls used to run
            // unconditionally on every single call, so they're gated behind
            // G_DEBUG like the rest of the pathfinding trace logging.
            if (G_DEBUG) {
                console.info("findDirectPath - spS:"+JSON.stringify(spS));
                console.info("findDirectPath - spE:"+JSON.stringify(spE));
            }
            subpath = this.pathfinder.findDirectPath(sgrid, spS, spE);

            if (subpath)
            {
                subpath = this.pathfinder.makeNodesMidPoints(subpath);
                subpath = this.pathfinder.dropUneededNodes(subpath);
                if (G_DEBUG)
                    console.info("findDirectPath - subpath:"+JSON.stringify(subpath));
                if (!this.pathfinder.isValidGridPath(sgrid, subpath)) {
                    //console.error("subpath: "+JSON.stringify(subpath));
                    try { throw new Error(); } catch (e) { console.error(e.stack); }
                    return null;
                }
                const res = this.pathfinder.getFullFromShortPath(subpath, shortGrid.minX, shortGrid.minY);
                if (G_DEBUG)
                    console.info("findDirectPath - res:"+JSON.stringify(res));
                if (!this.pathfinder.isValidGridPath(this.map.grid, res, true)) {
                    try { throw new Error(); } catch (e) { console.error(e.stack); }
                    return null;
                }
                return res;
            }

            if (!path) {
                //console.warn("findPath - shortPath: attempting.");
                //console.info("grid:"+JSON.stringify(grid));
                //console.info(JSON.stringify(shortGrid));
                subpath = this.pathfinder.findShortPath(sgrid,
                    shortGrid.minX, shortGrid.minY, spS, spE);
                if (subpath)
                    path = this.pathfinder.getFullFromShortPath(subpath, shortGrid.minX, shortGrid.minY);
                if (G_DEBUG)
                    console.info("findPath - shortPath:"+JSON.stringify(path));
            }

            if (!path) {
                console.warn("findPath - DANGER - findPath LONGGG");
                // PERF/FIX: this fallback's padding was 10 tiles. Benchmarked
                // getShortGrid+findShortPath (the actual crop+A* pipeline)
                // across synthetic sparse/medium/dense terrain at several
                // start->end distances: in dense/maze-like obstacle areas
                // (the exact case this fallback exists for -- it only runs
                // after the primary e=3 short-grid attempt already failed),
                // e=10 still left a meaningful chunk of searches failing
                // outright (returning no path at all): 8.3% at 20 tiles,
                // 5% at 40 tiles, 3.3% at 70 tiles. The failure-rate curve
                // flattens out around e=15-16 (going bigger than that pays
                // for a larger crop without meaningfully reducing failures
                // further -- the remaining few percent are genuinely
                // disconnected/blocked regions no amount of padding fixes).
                // 16 trades a somewhat larger crop on this already-rare
                // "DANGER" path for meaningfully fewer total pathfinding
                // failures in dense terrain.
                const longGrid = this.pathfinder.getShortGrid(grid, fgpS, fgpE, 16);
                const lpS = longGrid.substart;
                const lpE = longGrid.subend;
                path = this.pathfinder.findShortPath(longGrid.crop,
                    longGrid.minX, longGrid.minY, lpS, lpE);
                if (path) {
                    path = this.pathfinder.dropUneededNodes(path);
                    path = this.pathfinder.getFullFromShortPath(path, longGrid.minX, longGrid.minY);
                }
                if (G_DEBUG)
                    console.info("findPath - longPath:"+JSON.stringify(path));
            }

            if (!path) {
                console.error("findPath - Error while finding the path to "+x+", "+y+" for "+character.id);
                return null;
            }
            if (!this.pathfinder.isValidGridPath(this.map.grid, path, true)) {
                try { throw new Error(); } catch (e) { console.error(e.stack); }
                return null;
            }
            if (!(path[0][0] === character.x && path[0][1] === character.y)) {
                try { throw new Error(); } catch (e) { console.error(e.stack); }
                return null;
            }
            return path;
        }
        return null;
    }

    spaceEntityRandomApart(dist, callback_func, entities, entity, threshold) {
        entities = entities || this.entities.values();
        threshold = threshold || 100;
        let pos = null;
        let count = 1;
        const param = (entity && entity.collision) ? entity.collision : null;
        let iter = 0;

        while (count > 0 && iter < threshold)
        {
            if (callback_func)
            {
                pos = callback_func(param);
                count = pos ? this.getAroundCount(entities, pos, dist) : 0;
            }
            iter++;
        }
        return pos;
    }

    isGridPositionEmpty(x, y) {
        if (G_DEBUG)
            console.info("isGridPositionEmpty: x="+x+",y="+y);
        if (this.map.isColliding(x, y))
            return false;

        const pos = {x: x, y: y};
        const entities = this.getEntitiesAround(pos, 1);
        if (entities.length === 0)
            return true;
        for (const entity of entities) {
            if (entity.isOverPosition(pos))
                return false;
        }
        return true;
    }
}

export default MapEntities;
