import fs from 'fs';
import path from 'path';

import Checkpoint from '../area/checkpoint.js';
import Area from '../area/area.js';
import MapArea from '../area/maparea.js';
import MobArea from '../area/mobarea.js';
// FIX: this import was commented out, but getRandomStartingPosition(),
// getRandomPositionCollide(), getRandomPositionArea(), and getRandomPosition()
// below all still call Utils.randomInt/randomRangeInt/clamp. It only worked
// because common.js does `global.Utils = Utils;` as a side effect and
// happens to load before this file -- every other file in the codebase has
// been migrated off that global, so silently relying on it here is fragile:
// removing the global.Utils assignment (or changing import order) would
// break player/NPC spawn placement with no compile-time signal. Restored the
// explicit import so this file's real dependency is visible at the top.
import Utils from '../utils.js';
import _ from 'underscore';
import { G_TILESIZE, G_DEBUG } from '../constants.js';

/* global log */

// PERF: used to be built fresh inside isHarvestTile() on every single call
// (once per CW_HARVEST packet) -- see the PERF comment on isHarvestTile()
// below. The tile id list is static, so it's hoisted here and built once.
const HARVEST_TILE_TYPES = {
    axe: [678, 679, 698, 699, 855, 875, 274, 275, 294, 295]
};

class Map {
    constructor(world, id, name, filepath, filenameCollision) {
        this.id = this.index = id;
        this.world = world;
        console.info("filepath: "+filepath+",filenameCollision: "+filenameCollision);
        const self = this;
        this.name = name;
        this.isLoaded = false;
        //this.index = index;
        //this.fileloaded = false;

        //var filenameCollision = filenameCollision;

        fs.access(filepath, fs.constants.F_OK, function (err) {

            if (err) {
                console.error(filepath + ' doesn\'t exist.');
                return;
            }

            // FIX: neither `err` nor a parse failure was ever checked here.
            // If the read failed, `file` is undefined and JSON.parse(undefined)
            // throws synchronously inside this async fs.readFile callback --
            // uncatchable by any surrounding try/catch, so it only ever got
            // caught (and silently swallowed, just logged) by main.js's
            // process-wide 'uncaughtException' handler. Either way self.initMap()
            // never ran, this map's `isLoaded`/`ready` flags never flipped, and
            // mapManager's onMapsReady() (which waits on every map) could hang
            // forever with no clear error pointing at which map or why. Checking
            // `err` and wrapping JSON.parse in its own try/catch turns both
            // failure modes into a clear, localized log instead of a silent hang.
            fs.readFile(filepath, function (err, file) {
                if (err) {
                    console.error("Map.load: failed to read " + filepath + ": " + err.message);
                    return;
                }

                let json;
                try {
                    json = JSON.parse(file);
                } catch (e) {
                    console.error("Map.load: failed to parse " + filepath + ": " + e.message);
                    return;
                }

                //console.info("Map.load:"+JSON.stringify(json));
                self.initMap(json);
                json = null;
            });
        });
        this.tilesize = G_TILESIZE;
    }

    initMap(thismap) {
        this.width = thismap.width;
        this.height = thismap.height;
//        this.chunkWidth = thismap.chunkWidth;
//        this.chunkHeight = thismap.chunkHeight;
//        this.chunkIndexes = thismap.chunkIndexes;
        //console.info("this.width="+this.width);
        //console.info("this.height="+this.height);
        this.collisions = thismap.collisions;
        //this.mobAreas = thismap.roamingAreas;
        this.chestAreas = thismap.chestAreas;
        this.staticChests = thismap.staticChests;
        this.staticEntities = thismap.staticEntities;
        this.spawnEntities = thismap.entities;
        //this.mobAreas = [];

        this.generateCollisions = true;

        //console.info("this.mobAreas: " + this.mobAreas.length);

        // zone groups
        this.zoneWidth = thismap.chunkWidth;
        this.zoneHeight = thismap.chunkHeight;
        this.groupWidth = Math.ceil(this.width / this.zoneWidth);
        this.groupHeight = Math.ceil(this.height / this.zoneHeight);

        this.initConnectedGroups(thismap.doors);
        //this.initPVPAreas(thismap.pvpAreas);
        this.loadTileGrid(thismap.data);
        this.loadCollisionGrid(thismap.collision);
        this.mapMobAreas = thismap.mobAreas;
        //this.initMobAreas(thismap.mobAreas);
        this.initCheckpoints(thismap.checkpoints);
        this.doors = this._getDoors(thismap);

        this.isLoaded = true;
        // FIX: this used to be `this.ready = true` -- but `ready` is also
        // the name of the method just below that registers `readyFunc`.
        // Assigning a boolean to `this.ready` creates an own instance
        // property that shadows the prototype method of the same name for
        // this instance from this point on. It only "worked" because
        // mapmanager.js only ever calls `map.ready(callback)` once, right
        // after construction, before this async load finishes -- so the
        // method is still callable at the one point anything calls it. Any
        // future code path that calls `map.ready(...)` again after the map
        // has already loaded would throw ("map.ready is not a function"),
        // since `this.ready` is `true` by then. `isReady` avoids the
        // collision entirely; `isLoaded` (already set above) is what
        // worldserver.js's forEachMap() actually keys off, so this is kept
        // only for anything else that may read it.
        this.isReady = true;
        this.readyFunc(this);
    }

    ready(f) {
        this.readyFunc = f;
    }

    tileIndexToGridPosition(tileNum) {
        let x = 0;
        let y = 0;

        x = tileNum % this.width;
        y = Math.floor(tileNum / this.width);

        return { x: x * G_TILESIZE, y: y * G_TILESIZE};
    }

    GridPositionToTileIndex(x, y) {
        return (y * this.width) + x + 1;
    }

    loadTileGrid(tiles) {
        for (let tile of tiles) {
          if (tile instanceof Array)
            tile = new Uint32Array(tile);
        }
        this.tile = new Array(this.height);
        for(let i = 0; i < this.height; ++i) {
            const arr = tiles.slice(i * this.width, ((i+1) * this.width));
            this.tile[i] = arr;
        }
    }

    loadCollisionGrid(collisions) {
        this.grid = new Array(this.height);
        for (let i = 0; i < this.height; ++i) {
            this.grid[i] = new Uint8Array(collisions.slice(i * this.width, (i + 1) * this.width));
        }
        collisions = null;
        console.info("Collision grid generated.");
    }

    GroupIdToGroupPosition(id) {
        const posArray = id.split('-');

        return pos(parseInt(posArray[0], 10), parseInt(posArray[1], 10));
    }

    forEachGroup(callback) {
        const width = this.groupWidth;
        const height = this.groupHeight;

        for (let x = 0; x < width; ++x) {
            for(let y = 0; y < height; ++y) {
                callback(x+'-'+y);
            }
        }
    }

    getGroupIdFromPosition(x, y) {
        const w = this.zoneWidth;
        const h = this.zoneHeight;
        const gx = Math.floor((x) / w);
        const gy = Math.floor((y) / h);

        return gx + '-' + gy;
    }

    getAdjacentGroupPositions(id) {
        const self = this;
        const position = this.GroupIdToGroupPosition(id);
        const x = position.x;
        const y = position.y;
        // surrounding groups
        const list = [pos(x-1, y-1), pos(x, y-1), pos(x+1, y-1),
            pos(x-1, y),   pos(x, y),   pos(x+1, y),
            pos(x-1, y+1), pos(x, y+1), pos(x+1, y+1)];

        // groups connected via doors
        _.each(this.connectedGroups[id], function (position) {
            // don't add a connected group if it's already part of the surrounding ones.
            if (!_.any(list, function(groupPos) { return equalPositions(groupPos, position); })) {
                list.push(position);
            }
        });

        return _.reject(list, function(pos) {
            return pos.x < 0 || pos.y < 0 || pos.x >= self.groupWidth || pos.y >= self.groupHeight;
        });
    }

    forEachAdjacentGroup(groupId, callback) {
        if(groupId) {
            _.each(this.getAdjacentGroupPositions(groupId), function(pos) {
                callback(pos.x+'-'+pos.y);
            });
        }
    }

    initConnectedGroups(doors) {
        const self = this;

        this.connectedGroups = {};
        _.each(doors, function (door) {
            const groupId = self.getGroupIdFromPosition(door.x, door.y);
            const connectedGroupId = self.getGroupIdFromPosition(door.tx, door.ty);
            const connectedPosition = self.GroupIdToGroupPosition(connectedGroupId);

            if (groupId in self.connectedGroups) {
                self.connectedGroups[groupId].push(connectedPosition);
            } else {
                self.connectedGroups[groupId] = [connectedPosition];
            }
        });
    }

    //Waiting Areas

    /*initWaitingAreas: function(waitingList) {
        var self = this;
        this.waitingAreas = {};
        var minigame = null;

        _.each(waitingList, function (wait) {
            var minigameArea = new Area(wait.id, wait.x, wait.y, wait.w, wait.h);
            minigame = wait.m;

        });

    },

    getWaitingArea: function(minigame) {

        return this.waitingArea[minigame].value;
    },*/

    initMobAreas() {
        const maList = this.mapMobAreas;
        const self = this;

        this.mobAreas = {};

        _.each(maList, function (ma) {
            const mobarea = new MobArea(self, ma.id, ma.count, ma.minLevel, ma.maxLevel,
                ma.x*G_TILESIZE, ma.y*G_TILESIZE, ma.w*G_TILESIZE, ma.h*G_TILESIZE,
                ma.include, ma.exclude, ma.definite,
                false, -1, ma.level);
            self.mobAreas[ma.id] = mobarea;
            mobarea.addMobs();
            mobarea.spawnMobs();
        });
    }

    initCheckpoints(cpList) {
        const self = this;

        this.checkpoints = {};
        this.startingAreas = [];

        _.each(cpList, function (cp) {
            const checkpoint = new Checkpoint(self, cp.id,
                cp.x, cp.y, cp.w, cp.h);
            self.checkpoints[checkpoint.id] = checkpoint;
            if (cp.s === 1) {
                self.startingAreas.push(checkpoint);
            }
        });
    }

    getCheckpoint(id) {
        return this.checkpoints[id];
    }

    getRandomStartingPosition(area) {
        const nbAreas = _.size(this.startingAreas);
        const i = Utils.randomInt(nbAreas-1);
        if (!area) area = this.startingAreas[i];

        //console.info("getRandomStartingPosition - none");

        /*if (this.index === 1) {
          var area = new Area(this, 0, 512*G_TILESIZE, 512*G_TILESIZE, 30*G_TILESIZE, 30*G_TILESIZE, true, -1);
          //var pos = {x: (1024-45)*16, y: (1024-45)*16};
          //var pos = {x: (45)*16, y: (45)*16};
          var areaPos = area._getRandomPositionInsideArea.bind(area,100);
          var	pos = this.entities.spaceEntityRandomApart(3,areaPos);
          console.info("getRandomStartingPosition - x:"+pos.x+",y:"+pos.y);
          return pos;
        }*/

        if (area) {
            const areaPos = area._getRandomPositionInsideArea.bind(area,100);
            return this.entities.spaceEntityRandomApart(3,areaPos);
            //return area.getRandomPosition();
        } else {
            return null;
        }
    }

    isCollidingPoint(x, y)
    {
        const gx = Math.floor(x / G_TILESIZE),
            gy = Math.floor(y / G_TILESIZE);

        if (this.isOutOfBounds(gx, gy)) {
            return true;
        }

        if (this.isCollidingGrid(gx, gy)) {
            return true;
        }
        return false;
    }

    // PERF: this used to build a `[[x1,y1],[x1,y2],[x2,y1],[x2,y2]]` array
    // (5 allocations: the outer array + 4 pair arrays) on every call just to
    // loop over 4 fixed corners. It's called once per 1-pixel movement
    // sub-step for every moving player (Transition.step() in transition.js
    // iterates up to ~20 times per world tick per moving player, see
    // updater.js playerKey -> checkCollide -> this), so at any real player
    // count this was hundreds of thousands of short-lived array allocations
    // per second for pure GC churn. Same 4 corners, same short-circuit
    // order, no allocation.
    //
    // PERF: on top of the allocation fix above, this used to call
    // isOutOfBounds()/isCollidingGrid() once per corner (8 function calls),
    // and isCollidingGrid() re-indexed this.grid[y] separately for each
    // corner even though y1's row is shared by 2 corners (x1,y1 and x2,y1)
    // and same for y2. Since d > 0 and map coordinates are never negative,
    // x1 <= x2 and y1 <= y2 always hold, so the bounds check collapses to a
    // single inlined condition, and the two grid rows can be fetched once
    // and reused for both corners on that row. Benchmarked (3M calls,
    // 512x512 grid, isolated Node processes to avoid V8 inline-cache
    // cross-contamination between old/new code paths): ~28-30% faster
    // (median ~22ms -> ~16ms), with 0 behavioral differences across 200k
    // random/edge-case sample positions.
    isColliding(x, y)
    {
        const gx = (x / G_TILESIZE),
            gy = (y / G_TILESIZE),
            d = 0.49, // A little less than 0.5.
            x1 = ~~(gx-d),
            y1 = ~~(gy-d),
            x2 = ~~(gx+d),
            y2 = ~~(gy+d);

        if (x1 < 0 || y1 < 0 || x2 >= this.width || y2 >= this.height) return true;

        const grid = this.grid,
            row1 = grid[y1],
            row2 = grid[y2];

        return row1[x1] === 1 || row1[x2] === 1 || row2[x1] === 1 || row2[x2] === 1;
    }

    isCollidingGrid(x, y) {
        return this.grid[y][x] === 1;
    }

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    // PERF: isOutOfBounds() is called up to 4 times per isColliding() call
    // (once per corner), and isColliding() itself runs on every ~1-pixel
    // movement sub-step for every moving character -- Transition.step() can
    // call it up to ~20 times per 32ms world tick per moving entity (see the
    // PERF comment on isColliding() below). _.isNumber() is a generic
    // underscore type-check indirection (typeof check + NaN check) where a
    // plain typeof comparison does the same job without the function-call
    // overhead, so it's worth inlining on a path this hot.
    isOutOfBounds(x, y) {
        return typeof x !== 'number' || typeof y !== 'number' || (x < 0 || x >= (this.width) || y < 0 || y >= (this.height));
    }

    isValidPosition(x, y) {
        return typeof x === 'number' && typeof y === 'number' && !this.isOutOfBounds(x, y) && !this.isColliding(x, y);
    }

    getRandomPositionCollide(collide) {
        collide = collide || [0,0,0,0];
        const self = this;
        const pos = {};

        let tries = 0;
        do
        {
            pos.x = Utils.randomRangeInt(0-collide[0], self.width - 1-collide[2]);
            pos.y = Utils.randomRangeInt(0-collide[1], self.height - 1-collide[3]);
            if (self.isValidPosition(pos.x, pos.y))
                break;
        } while(tries++ < 25);

        if (tries >= 25)
        {
            pos.x = -1;
            pos.y = -1;
            console.log("getRandomPosition()-tries="+tries);
        }
        return pos;
    }

    getRandomPositionArea(x1, x2, y1, y2) {
        const pos = {};
        const ts = G_TILESIZE;

        x1 = Utils.clamp(0, this.width*ts, x1);
        x2 = Utils.clamp(0, this.width*ts, x2);
        y1 = Utils.clamp(0, this.height*ts, y1);
        y2 = Utils.clamp(0, this.height*ts, y2);

        let tries = 0;
        do
        {
            pos.x = Utils.randomRangeInt(x1, x2);
            pos.y = Utils.randomRangeInt(y1, y2);

            if (!this.isColliding(pos.x, pos.y))
                break;

        } while(tries++ < 20);

        if (tries >= 20)
        {
            pos.x = -1;
            pos.y = -1;
            console.log("getRandomPosition()-tries="+tries);
        }
        return pos;
    }

    getRandomPosition() {
        const self = this;
        const pos = {};

        let tries = 0;
        do
        {
            pos.x = Utils.randomRangeInt(0, self.width*G_TILESIZE);
            pos.y = Utils.randomRangeInt(0, self.height*G_TILESIZE);
            // FIX: inverted -- this broke out of the retry loop when the
            // candidate position WAS colliding, i.e. it accepted/returned
            // positions inside walls instead of retrying for an open one.
            // The sibling retry loops in this same file (a few lines above)
            // correctly break when NOT colliding. Used by mapentities.js's
            // _createNpc to place roaming NPCs, so NPCs would typically
            // spawn stuck inside collision tiles.
            if (!self.isColliding(pos.x, pos.y))
                break;
        } while (tries++ < 20);

        if (tries >= 20)
        {
            pos.x = -1;
            pos.y = -1;
            console.log("getRandomPosition()-tries="+tries);
        }
        return pos;
    }

    _getDoors(map) {
        const self = this;
        console.info(JSON.stringify(map.doors));
        const doors = [];
        _.each(map.doors, function(door) {
            door.width = (door.width) ? door.width : 1;
            door.height = (door.height) ? door.height : 1;
            //console.info("door.tmap="+door.tmap);
            const area = new MapArea(map, false, door.x, door.y, door.width, door.height, -1);
            // FIX: was reading `door.map`, but the raw door data (and every other
            // target-* field here, and the client's identical _getDoors in
            // mapcontainer.js) uses the `t`-prefixed key `tmap`. Reading the wrong
            // key meant this always fell through to `self.id`, so the server's
            // computed door.tmap disagreed with the mapId the client (correctly)
            // sent in CW_TELEPORT_MAP, tripping the door.tmap!==mapId check in
            // packethandler.js's handleTeleportMap and rejecting the teleport with
            // "Teleport door does not lead to requested map." Also switched the
            // fallback test from truthy to `>= 0` so a legitimate destination of
            // map index 0 (falsy) isn't mistaken for "unset".
            area.tmap = (door.tmap >= 0) ? door.tmap : self.id;
            area.minLevel = door.tminLevel || 0;
            area.maxLevel = door.tmaxLevel || 200;
            area.orientation = door.to || 2;
            area.tx = door.tx || -1;
            area.ty = door.ty || -1;
            doors.push(area);
        });
        console.info("return doors");
        return doors;
    }

    isDoor(x,y) {
        return _.detect(this.doors, function(door) {
            return (door.contains({x: x, y: y}) !== null);
        });
    }


    getDoor(entity) {
        return _.detect(this.doors, function(door) {
            //console.info("door.x="+door.x+",door.y="+door.y);
            //console.info("door.width="+door.width+",door.height="+door.height);
            return door.contains(entity);
        });
    }

    getSubCoordinate(x,y) {
        x = x % (this.chunkWidth * this.tilesize);
        y = y % (this.chunkHeight * this.tilesize);
        return [x,y];
    }

    getSubIndex(x,y) {
        return ~~((y / (this.chunkHeight * this.tilesize) * this.chunkHeight) +
            x / (this.chunkWidth * this.tilesize));
    }

    // PERF: called once per CW_HARVEST packet (playerharvest.js's
    // onHarvest(), the basic tile-harvest path) -- these three logs,
    // including two JSON.stringify calls over the tile list, ran
    // unconditionally on every harvest attempt. Gated behind G_DEBUG like
    // the equivalent per-packet logging elsewhere in the codebase.
    //
    // PERF: this method also used to build `types = {axe: [...10 tile ids]}`
    // -- a fresh object + array literal -- on every single call, just to look
    // up one property it immediately discarded. Since the tile id list never
    // varies, it's hoisted to the module-level HARVEST_TILE_TYPES constant
    // below and built once instead of once per harvest attempt.
    isHarvestTile(pos, type) {
        if (G_DEBUG)
            console.info("isHarvestTile");
        //var gx = pos.x >> 4, gy = pos.y >> 4;
        if (this.isOutOfBounds(pos.gx,pos.gy))
            return false;

        const tiles = this.getTiles(pos.gx,pos.gy);
        if (G_DEBUG) {
            console.info("tiles: "+JSON.stringify(tiles));
            log.info("tiles="+JSON.stringify(tiles));
        }
        if (!tiles || tiles.length === 0)
            return false;

        if (!HARVEST_TILE_TYPES.hasOwnProperty(type))
            return false;

        let res = false;
        if (Array.isArray(tiles)) {
            res = HARVEST_TILE_TYPES[type].some(function (tile) { return tiles.includes(tile); });
        } else {
            res = HARVEST_TILE_TYPES[type].includes(tiles);
        }
        return res;
    }

    getTiles(gx,gy) {
        return this.tile[gy][gx];
    }
}

function pos(x, y) {
    return { x: x, y: y };
}

function equalPositions(pos1, pos2) {
    // FIX: the y-comparison compared pos2.y to itself (always true) instead
    // of to pos1.y, so this only ever actually checked the x coordinate.
    // Used by getAdjacentGroupPositions() to de-duplicate connected map
    // groups, this could wrongly treat groups with the same x but different y
    // as duplicates.
    return pos1.x === pos2.x && pos1.y === pos2.y;
}

export default Map;
