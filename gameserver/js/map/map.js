import fs from 'fs';
import path from 'path';

import Checkpoint from '../area/checkpoint.js';
import Area from '../area/area.js';
import MapArea from '../area/maparea.js';
import MobArea from '../area/mobarea.js';
//import Utils from '../utils.js';
import _ from 'underscore';
import { G_TILESIZE } from '../main.js';

/* global log */

class Map {
    constructor(world, id, name, filepath, filenameCollision) {
        this.id = this.index = id;
        this.world = world;
        console.info("filepath: "+filepath+",filenameCollision: "+filenameCollision);
        var self = this;
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

            fs.readFile(filepath, function (err, file) {
                var json = JSON.parse(file);
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
        this.ready = true;
        this.readyFunc(this);
    }

    ready(f) {
        this.readyFunc = f;
    }

    tileIndexToGridPosition(tileNum) {
        var x = 0;
        var y = 0;

        x = tileNum % this.width;
        y = Math.floor(tileNum / this.width);

        return { x: x * G_TILESIZE, y: y * G_TILESIZE};
    }

    GridPositionToTileIndex(x, y) {
        return (y * this.width) + x + 1;
    }

    loadTileGrid(tiles) {
        this.tile = new Array(this.height);
        for(var i = 0; i < this.height; ++i) {
            var arr = tiles.slice(i * this.width, ((i+1) * this.width) );
            this.tile[i] = arr;
        }
        //delete tiles;
    }

    loadCollisionGrid(collisions) {
        this.grid = new Array(this.height);
        for (var i = 0; i < this.height; i++) {
            this.grid[i] = new Uint8Array(collisions.slice(i * this.width, (i + 1) * this.width));
        }
        collisions = null;
        console.info("Collision grid generated.");
    }

    GroupIdToGroupPosition(id) {
        var posArray = id.split('-');

        return pos(parseInt(posArray[0], 10), parseInt(posArray[1], 10));
    }

    forEachGroup(callback) {
        var width = this.groupWidth;
        var height = this.groupHeight;

        for (var x = 0; x < width; x += 1) {
            for(var y = 0; y < height; y += 1) {
                callback(x+'-'+y);
            }
        }
    }

    getGroupIdFromPosition(x, y) {
        var w = this.zoneWidth;
        var h = this.zoneHeight;
        var gx = Math.floor((x) / w);
        var gy = Math.floor((y) / h);

        return gx + '-' + gy;
    }

    getAdjacentGroupPositions(id) {
        var self = this;
        var position = this.GroupIdToGroupPosition(id);
        var x = position.x;
        var y = position.y;
        // surrounding groups
        var list = [pos(x-1, y-1), pos(x, y-1), pos(x+1, y-1),
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
        var self = this;

        this.connectedGroups = {};
        _.each(doors, function (door) {
            var groupId = self.getGroupIdFromPosition(door.x, door.y);
            var connectedGroupId = self.getGroupIdFromPosition(door.tx, door.ty);
            var connectedPosition = self.GroupIdToGroupPosition(connectedGroupId);

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
        var maList = this.mapMobAreas;
        var self = this;

        this.mobAreas = {};

        _.each(maList, function (ma) {
            var mobarea = new MobArea(self, ma.id, ma.count, ma.minLevel, ma.maxLevel,
                ma.x*G_TILESIZE, ma.y*G_TILESIZE, ma.w*G_TILESIZE, ma.h*G_TILESIZE,
                ma.include, ma.exclude, ma.definite,
                false, -1, ma.level);
            self.mobAreas[ma.id] = mobarea;
            mobarea.addMobs();
            mobarea.spawnMobs();
        });
    }

    initCheckpoints(cpList) {
        var self = this;

        this.checkpoints = {};
        this.startingAreas = [];

        _.each(cpList, function (cp) {
            var checkpoint = new Checkpoint(self, cp.id,
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
        var nbAreas = _.size(this.startingAreas);
        var i = Utils.randomInt(nbAreas-1);
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
            var areaPos = area._getRandomPositionInsideArea.bind(area,100);
            return this.entities.spaceEntityRandomApart(3,areaPos);
            //return area.getRandomPosition();
        } else {
            return null;
        }
    }

    isCollidingPoint(x, y)
    {
        var gx = Math.floor(x / G_TILESIZE),
            gy = Math.floor(y / G_TILESIZE);

        if (this.isOutOfBounds(gx, gy)) {
            return true;
        }

        if (this.isCollidingGrid(gx, gy)) {
            return true;
        }
        return false;
    }

    isColliding(x, y)
    {
        var gx = (x / G_TILESIZE),
            gy = (y / G_TILESIZE),
            d = 0.49, // A little less than 0.5.
            x1 = ~~(gx-d),
            y1 = ~~(gy-d),
            x2 = ~~(gx+d),
            y2 = ~~(gy+d);

        var arr = [[x1,y1], [x1,y2], [x2,y1], [x2,y2]];

        for (var c of arr) {
            if (this.isOutOfBounds(c[0], c[1])) {
                return true;
            }

            if (this.isCollidingGrid(c[0], c[1])) {
                return true;
            }
        }
        return false;
    }

    isCollidingGrid(x, y) {
        return this.grid[y][x] === 1;
    }

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfBounds(x, y) {
        return !_.isNumber(x) || !_.isNumber(y) || (x < 0 || x >= (this.width) || y < 0 || y >= (this.height));
    }

    isValidPosition(x, y) {
        return _.isNumber(x) && _.isNumber(y) && !this.isOutOfBounds(x, y) && !this.isColliding(x, y);
    }

    getRandomPositionCollide(collide) {
        collide = collide || [0,0,0,0];
        var self = this;
        var pos = {};

        var tries = 0;
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
        var pos = {};
        var ts = G_TILESIZE;

        x1 = Utils.clamp(0, this.width*ts, x1);
        x2 = Utils.clamp(0, this.width*ts, x2);
        y1 = Utils.clamp(0, this.height*ts, y1);
        y2 = Utils.clamp(0, this.height*ts, y2);

        var tries = 0;
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
        var self = this;
        var pos = {};

        var tries = 0;
        do
        {
            pos.x = Utils.randomRangeInt(0, self.width*G_TILESIZE);
            pos.y = Utils.randomRangeInt(0, self.height*G_TILESIZE);
            if (self.isColliding(pos.x, pos.y))
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
        var self = this;
        console.info(JSON.stringify(map.doors));
        var doors = [];
        _.each(map.doors, function(door) {
            door.width = (door.width) ? door.width : 1;
            door.height = (door.height) ? door.height : 1;
            //console.info("door.tmap="+door.tmap);
            var area = new MapArea(map, false, door.x, door.y, door.width, door.height, -1);
            area.tmap = door.map ? door.map : self.id;
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

    isHarvestTile(pos, type) {
        console.info("isHarvestTile");
        //var gx = pos.x >> 4, gy = pos.y >> 4;
        if (this.isOutOfBounds(pos.gx,pos.gy))
            return false;

        var tiles = this.getTiles(pos.gx,pos.gy);
        console.info("tiles: "+JSON.stringify(tiles));
        if (!tiles || tiles.length === 0)
            return false;

        log.info("tiles="+JSON.stringify(tiles));
        var types = {}
        types.axe = [678, 679, 698, 699, 855, 875, 274, 275, 294, 295];

        if (!types.hasOwnProperty(type))
            return false;

        var res = false;
        if (Array.isArray(tiles)) {
            res = types[type].some(function (tile) { return tiles.includes(tile); });
        } else {
            res = types[type].includes(tiles);
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
    return pos1.x === pos2.x && pos2.y === pos2.y;
}

export default Map;
