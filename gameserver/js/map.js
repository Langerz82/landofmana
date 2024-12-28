var cls = require('./lib/class');
_ = require('underscore');
var fs = require('fs');
var file = require('../shared/js/file');
var path = require('path');
var Utils = require('./utils');
var Checkpoint = require('./area/checkpoint');
var Area = require('./area/area');
var MapArea = require('./area/maparea');

var Map = cls.Class.extend({


    init: function (id, name, filepath, filenameCollision) {
    	this.id = this.index = id;
    	console.info("filepath: "+filepath+",filenameCollision: "+filenameCollision);
        var self = this;
        this.name = name;
        this.isLoaded = false;
        //this.index = index;
        //this.fileloaded = false;

        var filenameCollision = filenameCollision;

        file.exists(filepath, function (exists) {

            if (!exists) {
                console.error(filepath + ' doesn\'t exist.');
                return;
            }

            fs.readFile(filepath, function (err, file) {
                //console.info("file="+file.toString());
                //if (!self.fileloaded)
                //{
                  var json = JSON.parse(file);
                  self.initMap(json,filenameCollision);
                //}
                //self.fileloaded = true;
            });
        });
        this.tilesize = G_TILESIZE;
    },

    initMap: function (thismap,filenameCollision) {
        this.width = thismap.width;
        this.height = thismap.height;
        this.chunkWidth = thismap.chunkWidth;
        this.chunkHeight = thismap.chunkHeight;
        this.chunkIndexes = thismap.chunkIndexes;
        //console.info("this.width="+this.width);
        //console.info("this.height="+this.height);
        this.collisions = thismap.collisions;
        this.mobAreas = thismap.roamingAreas;
        this.chestAreas = thismap.chestAreas;
        this.staticChests = thismap.staticChests;
        this.staticEntities = thismap.staticEntities;
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
        this.initCheckpoints(thismap.checkpoints);
        this.doors = this._getDoors(thismap);

        this.isLoaded = true;
        this.ready = true;
        this.readyFunc(this);
    },

    ready: function(f) {
        this.readyFunc = f;
    },

    tileIndexToGridPosition: function (tileNum) {
        var x = 0;
        var y = 0;

        x = tileNum % this.width;
        y = Math.floor(tileNum / this.width);

        return { x: x * G_TILESIZE, y: y * G_TILESIZE};
    },

    GridPositionToTileIndex: function (x, y) {
        return (y * this.width) + x + 1;
    },

    loadTileGrid: function(tiles) {
        this.tile = new Array(this.height);
        for(var i = 0; i < this.height; ++i) {
            var arr = tiles.slice(i * this.width, ((i+1) * this.width) );
            this.tile[i] = arr;
        }
        delete tiles;
    },

    loadCollisionGrid: function(collisions) {
        this.grid = new Array(this.height);
        for(var i = 0; i < this.height; ++i) {
            var arr = collisions.slice(i * this.width, ((i+1) * this.width) );
            this.grid[i] = arr;
        }
        delete collisions;
    },

    GroupIdToGroupPosition: function (id) {
        var posArray = id.split('-');

        return pos(parseInt(posArray[0], 10), parseInt(posArray[1], 10));
    },

    forEachGroup: function (callback) {
        var width = this.groupWidth;
        var height = this.groupHeight;

        for (var x = 0; x < width; x += 1) {
            for(var y = 0; y < height; y += 1) {
                callback(x+'-'+y);
            }
        }
    },

    getGroupIdFromPosition: function (x, y) {
        var w = this.zoneWidth;
        var h = this.zoneHeight;
        var gx = Math.floor((x) / w);
        var gy = Math.floor((y) / h);

        return gx + '-' + gy;
    },

    getAdjacentGroupPositions: function (id) {
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
    },

    forEachAdjacentGroup: function(groupId, callback) {
        if(groupId) {
            _.each(this.getAdjacentGroupPositions(groupId), function(pos) {
                callback(pos.x+'-'+pos.y);
            });
        }
    },

    initConnectedGroups: function (doors) {
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
    },

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

    initCheckpoints: function (cpList) {
        var self = this;

        this.checkpoints = {};
        this.startingAreas = [];

        _.each(cpList, function (cp) {
            var checkpoint = new Checkpoint(cp.id, cp.x, cp.y, cp.w, cp.h, self);
            self.checkpoints[checkpoint.id] = checkpoint;
            if (cp.s === 1) {
                self.startingAreas.push(checkpoint);
            }
        });
    },

    getCheckpoint: function (id) {
        return this.checkpoints[id];
    },

    getRandomStartingPosition: function (area) {
    	var nbAreas = _.size(this.startingAreas);
      var i = Utils.randomInt(nbAreas-1);
      if (!area) area = this.startingAreas[i];

      //console.info("getRandomStartingPosition - none");

      if (this.index == 1) {
        var area = new Area(0, 512, 512, 30, 30, this, true, -1);
        //var pos = {x: (1024-45)*16, y: (1024-45)*16};
        //var pos = {x: (45)*16, y: (45)*16};
        var	pos = this.entities.spaceEntityRandomApart(2,area._getRandomPositionInsideArea.bind(area,100));
        console.info("getRandomStartingPosition - x:"+pos.x+",y:"+pos.y);
        return pos;
      }

      if (area) {
        return this.entities.spaceEntityRandomApart(2,area._getRandomPositionInsideArea.bind(area,100));
      	//return area.getRandomPosition();
      } else {
      	return null;
      }
    },

    isColliding: function(x, y)
    {
      var x1 = ~~(x >> 4),
          y1 = ~~(y >> 4),
          x2 = ~~(x1 + 0.5),
          y2 = ~~(y1 + 0.5);

      var arr = [[x1,y1], [x1,y2], [x2,y1], [x2,y2]];

      var c = arr[0];
      if (this.isOutOfBounds(c[0], c[1])) {
          return true;
      }
      c = arr[3];
      if (this.isOutOfBounds(c[0], c[1])) {
          return true;
      }

      c = null;
      for (c of arr) {
        if (this.isCollidingGrid(c[0], c[1])) {
            return true;
        }
      }
      return false;
    },

    isCollidingGrid: function (x, y) {
      return this.grid[y][x] === 1;
    },

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfBounds: function(x, y) {
      return !_.isNumber(x) || !_.isNumber(y) || (x < 0 || x >= (this.width) || y < 0 || y >= (this.height));
    },

    isValidPosition: function(x, y) {
        return _.isNumber(x) && _.isNumber(y) && !this.isOutOfBounds(x, y) && !this.isColliding(x, y);
    },

    getRandomPositionCollide: function (collide) {
        collide = collide || [0,0,0,0];
        var self = this;
    	  var pos = {};

        pos.x = Utils.randomRangeInt(0-collide[0], self.width - 1-collide[2]);
        pos.y = Utils.randomRangeInt(0-collide[1], self.height - 1-collide[3]);
        var tries = 0;

        while(tries < 25 && !self.isValidPosition(pos.x+collide[0], pos.y+collide[1], pos.x+collide[2], pos.y+collide[3]))
        {
        	++tries;
        	pos.x = Utils.randomRangeInt(0-collide[0], self.width - 1-collide[2]);
        	pos.y = Utils.randomRangeInt(0-collide[1], self.height - 1-collide[3]);
        }
        if (tries >= 25)
        {
        	pos.x = -1;
        	pos.y = -1;
        	console.log("getRandomPosition()-tries="+tries);
        }
        return pos;
    },

    getRandomPositionArea: function (x1, x2, y1, y2) {
    	  var pos = {};
        var ts = this.tilesize;

        x1 = Utils.clamp(0, this.width*ts, x1);
        x2 = Utils.clamp(0, this.width*ts, x2);
        y1 = Utils.clamp(0, this.height*ts, y1);
        y2 = Utils.clamp(0, this.height*ts, y2);

        pos.x = Utils.randomRangeInt(x1, x2);
        pos.y = Utils.randomRangeInt(y1, y2);
        var tries = 0;

        while(tries < 20)
        {
          if (!this.isColliding(pos.x, pos.y))
            break;

        	++tries;
          pos.x = Utils.randomRangeInt(x1, x2);
          pos.y = Utils.randomRangeInt(y1, y2);
        }
        if (tries >= 20)
        {
        	pos.x = -1;
        	pos.y = -1;
        	console.log("getRandomPosition()-tries="+tries);
        }
        return pos;
    },

    getRandomPosition: function () {
        var self = this;
    	  var pos = {};

        pos.x = Utils.randomRangeInt(0, self.width*self.tilesize);
        pos.y = Utils.randomRangeInt(0, self.height*self.tilesize);
        var tries = 0;

        while(tries < 20 && !self.isColliding(pos.x, pos.y))
        {
        	++tries;
        	pos.x = Utils.randomRangeInt(0, self.width*self.tilesize);
        	pos.y = Utils.randomRangeInt(0, self.height*self.tilesize);
        }
        if (tries >= 20)
        {
        	pos.x = -1;
        	pos.y = -1;
        	console.log("getRandomPosition()-tries="+tries);
        }
        return pos;
    },

        _getDoors: function(map) {
            var self = this;
            console.info(JSON.stringify(map.doors));
            var doors = [];
            _.each(map.doors, function(door) {
            	door.width = (door.width) ? door.width : 1;
            	door.height = (door.height) ? door.height : 1;
            	console.info("door.tmap="+door.tmap);
                var area = new MapArea(map, false, door.x, door.y, door.width, door.height, -1);
                    area.minLevel = door.tminLevel || 0,
                    area.maxLevel = door.tmaxLevel || 200,
                    area.map = door.tmap ? door.tmap : 1,
                    area.portal = door.p === 1,
                    area.quest = door.tq,
                    area.admin = door.a;
			switch(door.to) {
				case 'u': area.orientation = Types.Orientations.UP;
					break;
				case 'd': area.orientation = Types.Orientations.DOWN;
					break;
				case 'l': area.orientation = Types.Orientations.LEFT;
					break;
				case 'r': area.orientation = Types.Orientations.RIGHT;
					break;
				default : area.orientation = Types.Orientations.DOWN;
			}
                doors.push(area);
            });
            console.info("return doors");
            return doors;
        },

        isDoor: function(x,y) {
            return _.detect(this.doors, function(door) {
                return (door.contains({x: x, y: y}) != null);
            });
        },


        getDoor: function(entity) {
            return _.detect(this.doors, function(door) {
            	//console.info("door.x="+door.x+",door.y="+door.y);
            	//console.info("door.width="+door.width+",door.height="+door.height);
                return door.contains(entity);
            });
        },

        getSubCoordinate: function (x,y) {
          x = x % (this.chunkWidth * this.tilesize);
          y = y % (this.chunkHeight * this.tilesize);
          return [x,y];
        },

        getSubIndex: function (x,y) {
          return ~~((y / (this.chunkHeight * this.tilesize) * this.chunkHeight) +
                     x / (this.chunkWidth * this.tilesize));
        },

        isHarvestTile: function (pos, type) {
          console.info("isHarvestTile");
          //var gx = pos.x >> 4, gy = pos.y >> 4;
          if (this.isOutOfBounds(pos.gx,pos.gy))
            return false;

          var tiles = this.getTiles(pos.gx,pos.gy);
          console.info("tiles: "+JSON.stringify(tiles));
          if (!tiles || tiles.length == 0)
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
        },

        getTiles: function (gx,gy) {
          return this.tile[gy][gx];
        },
});

var pos = function (x, y) {
    return { x: x, y: y };
};

var equalPositions = function (pos1, pos2) {
    return pos1.x === pos2.x && pos2.y === pos2.y;
};

module.exports = Map;
