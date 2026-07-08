import Chest from '../entity/chest.js';
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
import { G_TILESIZE, G_SPATIAL_SIZE } from '../main.js';

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
        this.chests = new Map();
        this.blocks = new Map();

        this.packets = {};

        this.mobAreas = [];
//      this.chestAreas = [];
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
        var spatialWidth = Math.ceil(this.map.width / size);
        var spatialHeight = Math.ceil(this.map.height / size);
        for(var i=0, j=0; i < spatialHeight; i++) {
            this.spatial[i] = [];
            for(j=0; j < spatialWidth; j++) {
                this.spatial[i][j] = [];
            }
        }
    }

    getSpatialEntities(arr)
    {
        var x1 = ~~(Math.max(arr[0],0) / this.spatialSize);
        var y1 = ~~(Math.max(arr[1],0) / this.spatialSize);
        var x2 = ~~(Math.min(arr[2],this.map.width-1) / this.spatialSize);
        var y2 = ~~(Math.min(arr[3],this.map.height-1) / this.spatialSize);

        //console.info("getSpatialEntities - x1:"+x1+",y1:"+y1+",x2:"+x2+",y2:"+y2);
        var res = [];
        var l1 = this.spatial.length;
        var l2 = 0;
        for(var j = y1, i=0; j <= y2; ++j)
        {
            l2 = this.spatial[j].length;
            for(i = x1; i <= x2; ++i) {
                /*if (j < 0 || j >= l1)
                  continue;
                if (i < 0 || i >= l2)
                  continue;*/
                for (var entity of this.spatial[j][i]) {
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
        var npc;
        //console.info("SPAWN NPCS");
        //if (this.map === this.server.maps[0]) // World Map
        //{
        for(var i = 0; i < count; ++i)
        {
            npc = this._createNpc("Npc"+i);
        }
        //  }
    }

    _createNpc(name) {
        var self = this;

        // NOTE: `pos` was a bare (undeclared) assignment in the original CommonJS
        // source, which created an implicit global there; declared with `var`
        // here since ES modules are always strict mode and forbid implicit
        // globals.
        var pos = this.spaceEntityRandomApart(2, function () { return self.map.getRandomPosition(); });

        var npc = new NpcMove(++this.entityCount, 0, pos.x * G_TILESIZE, pos.y * G_TILESIZE, self.map);

        self.addNpcMove(npc);
        //self.sendBroadcast(npc.spawn());
        return npc;
    }

    initPathingGrid() {
        var map = this.map,
            self = this;
        console.info("pathinggrid height:"+map.height+", width:"+map.width);

        var grid = new Array(map.height);
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
        dist = dist || 64;
        var self = this;
        //console.info("processWho - called.");
        var screens = [];
        //var ids = [];
        //var knowns = [];

        var ids = player.knownIds;
        ids = ids.parseInt();
        //console.info("knownIds: "+JSON.stringify(ids));

        var pgx = ~~(player.x/G_TILESIZE);
        var pgy = ~~(player.y/G_TILESIZE);

        //console.info("x1:"+x1+",y1:"+y1+",x2:"+x2+",y2:"+y2);
        var entities = this.getSpatialEntities([pgx - dist, pgy - dist,pgx + dist, pgy + dist]);

        //console.info("self.entities.length: "+Object.keys(self.entities).length);
        for (var entity of entities) {
            if (entity && !(entity === player) && self.isOffset(player, entity))
                screens.push(entity.id);
        }
        //console.info("screens:"+JSON.stringify(screens));
        //console.info("ids:"+JSON.stringify(ids));

        var screenIds = (ids && ids.length > 0) ? _.difference(screens, ids) : screens;

        //console.info(JSON.stringify(screenIds));

        _.each(screenIds, function(id) {
            var entity = self.getEntityById(id);
            if(entity && !(entity === player))
            {
                player.knownIds.push(entity.id);
                self.sendToPlayer(player, entity.spawn());
                if (entity.path) {
                    var msg = new Messages.MovePath(entity, entity.path);
                    self.sendToPlayer(player, msg);
                }
            }
        });
    }

    isOffset(entity, entity2, extra, cameraHalfX, cameraHalfY) {
        extra = (extra || 0) * G_TILESIZE;
        cameraHalfX = (cameraHalfX || 32) * G_TILESIZE;
        cameraHalfY = (cameraHalfY || 18) * G_TILESIZE;
        var minX = Math.max(0,entity.x-cameraHalfX-extra);
        var minY = Math.max(0,entity.y-cameraHalfX-extra);
        var maxX = Math.min(this.map.width * G_TILESIZE, entity.x+cameraHalfX+extra);
        var maxY = Math.min(this.map.height * G_TILESIZE, entity.y+cameraHalfX+extra);

        //console.info("entity.x: "+entity.x+" entity.y:"+entity.y);
        //console.info("entity2.x: "+entity2.x+" entity2.y:"+entity2.y);
        //console.info("minX:"+minX+",maxX:"+maxX+",minY:"+minY+",maxY:"+maxY);
        return (entity2.y >= minY && entity2.y <= maxY && entity2.x >= minX && entity2.x <= maxX);
    }

    processPackets() {
        var self = this;

        if (self.packets.length > 0)
            console.info(JSON.stringify(self.packets));

        // NOTE: `len` was a bare (undeclared) assignment in the original
        // CommonJS source, which created an implicit global there; declared
        // with `let` here since ES modules are always strict mode and forbid
        // implicit globals.
        Utils.forEach(this.packets, (packet, id) => {
            let len = packet.length;
            if (len > 0 && typeof packet !== 'undefined' && packet !== null)
            {
                var player = self.getEntityById(id);
                var conn = self.server.socket.getConnection(id);
                if (player && player.map && player.mapStatus >= 2 && conn !== null && typeof conn !== 'undefined')
                {
                    var packets = [];
                    for (var i =0; i < self.maxPackets; ++i)
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
        });
    }

    sendToPlayer(player, message) {
        if (!message)
            return;

        var self = this;
        //console.info("sent_raw: "+message;
        if (player && player.id in self.packets)
        {
            self.packets[player.id].push(message.serialize());
        }
        this.processPackets();
    }

    sendBroadcast(message, ignoredPlayer)  {
        if (!message)
            return;

        Utils.forEach(this.packets, function (packet, id) {
            if (id !== ignoredPlayer)
            {
                packet.push(message.serialize());
            }
        });
        this.processPackets();
    }

    sendNeighbours(entity, message, ignoredPlayer, areaLength)  {
        //console.info("sendNeighbours");
        var self = this;
        //console.info(JSON.stringify(message.serialize()));
        areaLength = areaLength || 64;
        var players = self.getPlayerAround(entity, areaLength);
        players.push(entity);

        //console.info(entities.length);
        for (var player of players) {
            // NOTE: previously `packets.hasOwnProperty(player.id) && !ignoredPlayer ||
            // (ignoredPlayer && player !== ignoredPlayer)` -- because && binds tighter
            // than ||, the ignoredPlayer branch bypassed the hasOwnProperty check
            // entirely, so a player around who isn't the ignored one but somehow has
            // no packets entry would throw on push() below instead of being skipped.
            if (self.packets.hasOwnProperty(player.id) && (!ignoredPlayer || player !== ignoredPlayer))
            {
                //console.info("neighbour.id:"+neighbour.id);
                self.packets[player.id].push(message.serialize());
            }
        }
        this.processPackets();
    }

    spawnEntities(map) {
        var self = this;

        //setTimeout(function () {
        _.each(self.map.spawnEntities, function(npcData) {
            if (npcData.type == Types.EntityTypes.NPCMOVE) {
                var npc = self.addNpcMove(npcData.id, npcData.x, npcData.y);
                if (npcData.name)
                    npc.name = npcData.name;
                if (npcData.scriptQuests)
                    npc.scriptQuests = npcData.scriptQuests;
            }
            if (npcData.type == Types.EntityTypes.NPCSTATIC) {
                var npc = self.addNpcStatic(npcData.id, npcData.x, npcData.y);
                if (npcData.name)
                    npc.name = npcData.name;
                if (npcData.scriptQuests)
                    npc.scriptQuests = npcData.scriptQuests;
            }

        });
        //},10000);

        console.info(JSON.stringify(self.map.staticEntities));
        _.each(self.map.staticEntities, function(kind, tid) {

            var pos = map.tileIndexToGridPosition(tid);

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
        this.packets[player.id] = [];
    }

    addChest(chest) {
        this.addEntity(chest);
        this.chests.set(chest.id, chest);
    }

    addBlock(block) {
        this.addEntity(block);
        this.blocks.set(block.id, block);
        return block;
    }

    addMob(kind, x, y, area) {
        var mob = new Mob(++this.entityCount, kind, x, y, this.map, area);
        mob.mobAI = this.mobAI;

        this.addEntity(mob);
        this.mobs.set(mob.id, mob);

        this.world.mobCallback.setCallbacks(mob);

        return mob;
    }

    addNpcStatic(kind, x, y) {
        var npc = new NpcStatic(++this.entityCount, kind, x, y, this.map);

        this.addEntity(npc);
        this.npcs.set(npc.id, npc);

        return npc;
    }

    addNpcMove(kind, x, y) {
        var npc = new NpcMove(++this.entityCount, kind, x, y, this.map);

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
        if (!entity || !entity.x || !entity.y) return;

        var ts = G_TILESIZE;
        var gx = ~~(entity.x / ts);
        var gy = ~~(entity.y / ts);

        var spx = ~~(gx / this.spatialSize);
        var spy = ~~(gy / this.spatialSize);

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

    removeSpatial(entity) {
        if (entity.spatialMap) {
            if (!entity || !entity.x || !entity.y) return;

            var ts = G_TILESIZE;
            var gx = ~~(entity.x / ts);
            var gy = ~~(entity.y / ts);

            var spx = ~~(gx / this.spatialSize);
            var spy = ~~(gy / this.spatialSize);

            // bounds check
            if (spy < 0 || spy >= this.spatial.length ||
                spx < 0 || spx >= this.spatial[spy].length) {
                return;
            }

            var spatial = this.spatial[spy][spx];
            Utils.removeFromArray(spatial, entity);
        }
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

        if (this.chests.has(entity.id))
            this.chests.delete(entity.id);

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
        var self = this;

        if (player instanceof Player)
            this.sendBroadcast(player.despawn());

        console.info("deleting player traces..");

        self.removeEntity(player);

        delete self.packets[player.id];
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
        var id = (++this.entityCount);
        var item = null;

        var type = Types.EntityTypes.ITEM;
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
        var self = this;

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
        var player = this.getPlayerByName(name);
        if (player)
            player.modifyGold(mod);
        //else
        //this.database.modifyGold(name, mod);
    }

    // NOTE: `entities` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    getEntitiesByPosition(x,y) {
        var entities = [];
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
        var result = false;
        this.forEachMob(function (mob) {
            var pos = mob.getLastPosition();
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
        var r = range || 1;
        var x = entity.x;
        var y = entity.y;
        var gx = ~~(entity.x / G_TILESIZE);
        var gy = ~~(entity.y / G_TILESIZE);

        var entities = [];
        var def_conditional = function (e1,e2) { return e1 !== e2; };
        conditional = conditional || def_conditional;
        //console.info("getEntityAround, range: "+range+",x:"+x+",y:"+y);
        var e2;
        var group = this.getSpatialEntities([gx-r,gy-r,gx+r,gy+r]);
        for (var e2 of group) {
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
        var entities = [];
        conditional = conditional || function (e1, e2) { return e1 !== e2; };
        var compare = function (e1, e2) {
            return (Math.abs(e2.x-e1.x) <= range && Math.abs(e2.y-e1.y) <= range &&
                conditional(e1,e2))
        };
        if (Array.isArray(group)) {
            for (var e2 of group) {
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

    getEachEntityAround(x, y, range) {
        var x = ~~(x/G_TILESIZE);
        var y = ~~(y/G_TILESIZE);
        var r = range;
        var entities = this.getSpatialEntities([x-r,y-r,x+r,y+r]);
        return this.getEntityAround(entities, {x: x, y: y}, r);
    }

    getEntitiesAround(entity, range) {
        var x = ~~(entity.x/G_TILESIZE);
        var y = ~~(entity.y/G_TILESIZE);
        var r = range;
        var entities = this.getSpatialEntities([x-r,y-r,x+r,y+r]);
        return this.getEntityAround(entities, entity, r);
    }

    getCharactersAround(entity, range) {
        return this.getEntityAround(this.getEntitiesAround(entity, range), entity, range,
            function(e1,e2) { return (e1 !== e2 && e2 instanceof Character); });
    }

    getMobsAround(entity, range) {
        return this.getEntityAround(this.mobs, entity, range);
    }

    getPlayerAround(entity, range) {
        return this.getEntityAround(this.players, entity, range);
    }

    getAroundCount(entities, entity, range) {
        return this.getEntityAround(entities, entity, range).length;
    }

    getEntityAroundCount(entity, range) {
        var entities = this.getEntitiesAround(entity, range);
        return this.getEntityAround(entities, entity, range).length;
    }

    getPlayerAroundCount(entity, range) {
        return this.getEntityAround(this.players, entity, range).length;
    }

    getPartyAround(entity, range) { // entity
        return this.getEntityAround(entity.party.players, entity, range);
    }

    itemDespawn(item)
    {
        this.sendNeighbours(item, new Messages.Despawn(item));
        this.removeEntity(item);
    }

    // NOTE: `handleEmptyChestArea` was removed here. It referenced a `chest`
    // variable that was never defined (its creation line was commented out),
    // called `self.handleItemDespawn(...)` which isn't a method on this class
    // (that method lives on world/lootmanager.js, reached via
    // `player.world.loot.handleItemDespawn`), and called a `self.createChest`
    // that doesn't exist anywhere in this class either -- chest spawning and
    // respawning is fully implemented instead on ChestArea
    // (area/chestarea.js: spawnChests/_createChest/respawnChest). This method
    // wasn't called from anywhere in the codebase, so nothing depended on it;
    // reconstructing working chest-despawn logic here would mean guessing at
    // intended behavior rather than fixing a typo, so it's been dropped
    // rather than patched. If empty-chest-area handling turns out to still be
    // needed, ChestArea.respawnChest looks like the right place to hook it in.

    tryAddingMobToChestArea(mob) {
        var self = this;
        _.each(self.chestAreas, function(area) {
            if (area.contains(mob))
                area.addToArea(mob);
        });
    }

    findPath(character, x, y, ignoreList) {
        var self = this,
            path = [];

        //console.info("PATHFINDER CODE");

        if(this.pathfinder && character)
        {
            var grid = self.map.grid;
            var path = null;
            var pS =[character.x, character.y];
            var ts = G_TILESIZE;

            if (this.map.isColliding(character.x, character.y))
            {
                //console.warn("findPath - isColliding start.");
                return null;
            }

            var pE = [x,y];
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

            var fgpS = [~~(pS[0]/ts), ~~(pS[1]/ts)];
            var fgpE = [~~(pE[0]/ts), ~~(pE[1]/ts)];
            var shortGrid = this.pathfinder.getShortGrid(grid, fgpS, fgpE, 3);
            var sgrid = shortGrid.crop;
            var spS = shortGrid.substart;
            var spE = shortGrid.subend;
            var subpath = null;

            console.info("findDirectPath - spS:"+JSON.stringify(spS));
            console.info("findDirectPath - spE:"+JSON.stringify(spE));
            subpath = this.pathfinder.findDirectPath(sgrid, spS, spE);

            if (subpath)
            {
                subpath = this.pathfinder.makeNodesMidPoints(subpath);
                subpath = this.pathfinder.dropUneededNodes(subpath);
                console.info("findDirectPath - subpath:"+JSON.stringify(subpath));
                if (!this.pathfinder.isValidGridPath(sgrid, subpath)) {
                    //console.error("subpath: "+JSON.stringify(subpath));
                    try { throw new Error(); } catch (e) { console.error(e.stack); }
                    return null;
                }
                var res = this.pathfinder.getFullFromShortPath(subpath, shortGrid.minX, shortGrid.minY);
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
                console.info("findPath - shortPath:"+JSON.stringify(path));
            }

            if (!path) {
                console.warn("findPath - DANGER - findPath LONGGG");
                var longGrid = this.pathfinder.getShortGrid(grid, fgpS, fgpE, 10);
                var lpS = longGrid.substart;
                var lpE = longGrid.subend;
                path = this.pathfinder.findShortPath(longGrid.crop,
                    longGrid.minX, longGrid.minY, lpS, lpE);
                if (path) {
                    path = this.pathfinder.dropUneededNodes(path);
                    path = this.pathfinder.getFullFromShortPath(path, longGrid.minX, longGrid.minY);
                }
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
        var pos = null;
        var count = 1;
        var param = (entity && entity.collision) ? entity.collision : null;
        var iter = 0;

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
        console.info("isGridPositionEmpty: x="+x+",y="+y);
        if (this.map.isColliding(x, y))
            return false;

        var pos = {x: x, y: y};
        var entities = this.getEntitiesAround(pos, 1);
        if (entities.length === 0)
            return true;
        for (var entity of entities) {
            if (entity.isOverPosition(pos))
                return false;
        }
        return true;
    }
}

export default MapEntities;
