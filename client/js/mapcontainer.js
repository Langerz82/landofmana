define(['area', 'detect', 'map', 'config'], function(Area, Detect, Map, config) {

  var MapContainer = Class.extend({
    init: function(game, mapIndex, mapName) {
      var self = this;

      this.game = game;
      this.mapIndex = mapIndex;
      this.mapName = mapName;
      //this.data = [];
      this.isLoaded = false;
      this.mapLoaded = false;
      this.gridReady = false;
      this.maps = {};
      this.collisionGrid = [];
      this.tileGrid = [];
      this.itemGrid = [];
      this.count = 0;
      this.inc = 0;

      var $file = "./maps/"+this.mapName+".zip?v=" + config.build.version;
      var name = self.mapName+"/"+self.mapName + "_GO.json";

      JSZipUtils.getBinaryContent($file, function(err, data) {
          if(err) {
              var filename = "./maps/"+name+"?v="+config.build.version;
              $.getJSON(filename, function( data ) {
                self.loadMap(data);
              });
              throw err; // or handle err
          }

          JSZip.loadAsync(data).then(function(zip) {
            self.zip = zip;
            try {
              var filename = name;
              zip.file(filename).async("string").then(function(data) {
                self.loadMap(JSON.parse(data));
              });
            }
            catch (err) {
              console.error(JSON.stringify(err));
            }
          });
      });

      //this.mapShifted = false;
      //this.skipGridMove = true;
      //this.loadMap(mapName);

    },

    loadMap: function(data) {
      //var useWorker = false;
      this.isLoaded = false;
      //this._loadMap(useWorker, mapName);
      this.data = data;
      this._initMap(this.data);
      this.mapLoaded = true;
      this._isReady();
    },

    _isReady: function() {
      var self = this;
      if (self.ready_func) {
        self.ready_func();
      }
    },

    _initGrids: function() {
      var c = game.camera;
      for(var i=0; i < c.gridHE; ++i) {
          this.collisionGrid[i] = [];
          this.itemGrid[i] = [];
          this.tileGrid[i] = [];
          for(var j=0; j < c.gridWE; ++j) {
              this.collisionGrid[i][j] = false;
              this.tileGrid[i][j] = 0;
              this.itemGrid[i][j] = {};
          }
      }
    },

    _initMap: function(map) {
      var c = game.camera;
      var gs = game.renderer.gameScale;
      var ts = G_TILESIZE;

      this.width = map.width;
      this.height = map.height;

      this.indexes = map.indexes;

      this.widthX = (map.width-1)*this.game.tilesize;
      this.heightY = (map.height-1)*this.game.tilesize;
      this.tilesize = map.tilesize;

      this.musicAreas = map.musicAreas || [];
      this.high = map.high || [];
      this.high = {};
      for (var h of map.high) {
        this.high[h] = true;
      }

      this.animated = map.animated;
      this.doors = this._getDoors(map);
      this.checkpoints = this._getCheckpoints(map);

      //this.gridWidth = c.gridWE;
      //this.gridHeight = c.gridHE;

      this.gcsx = 0;
      this.gcsy = 0;
      this.gcex = ((this.width) * ts) - ~~(c.screenW / gs);
      this.gcey = ((this.height) * ts) - ~~(c.screenH / gs);

      this._initGrids();
    },

    _getDoors: function(map) {
      var self = this;

      var doors = [];
      var count = 0;
      _.each(map.doors, function(door) {
        door.width = (door.width) ? door.width : 1;
        door.height = (door.height) ? door.height : 1;
        var area = new Area(door.x, door.y, door.width, door.height);
        area.minLevel = door.tminLevel || 0;
        area.maxLevel = door.tmaxLevel || 200;
        area.tmap = (door.tmap >= 0) ? door.tmap : self.mapIndex;
        area.tx = door.tx || -1;
        area.ty = door.ty || -1;
        area.orientation = door.to || 2;

        area.id = count++;
        doors.push(area);
      });
      return doors;
    },

    ready: function(f) {
      this.ready_func = f;
    },

    OnAllReady: function () {
      this.all_ready_func();
      this.gridReady = true;
    },

    allReady: function(f) {
      this.all_ready_func = f;
    },

    /**
     * Returns true if the given tile id is "high", i.e. above all entities.
     * Used by the renderer to know which tiles to draw after all the entities
     * have been drawn.
     *
     * @param {Number} id The tile id in the tileset
     * @see Renderer.drawHighTiles
     */
    isHighTile: function(id) {
      //return this.high.hasOwnProperty(id);
      return this.high[(id)];
      //return _.indexOf(this.high, id + 1) >= 0;
    },

    /**
     * Returns true if the tile is animated. Used by the renderer.
     * @param {Number} id The tile id in the tileset
     */
    isAnimatedTile: function(id) {
      return id + 1 in this.animated;
    },

    /**
     *
     */
    getTileAnimationLength: function(id) {
      return this.animated[id + 1].l;
    },

    /**
     *
     */
    getTileAnimationDelay: function(id) {
      var animProperties = this.animated[id + 1];
      if (animProperties.d) {
        return animProperties.d;
      } else {
        return 100;
      }
    },

    isDoor: function(x, y) {
      return _.detect(this.doors, function(door) {
        return (door.contains({
          gx: x,
          gy: y
        }) !== null);
      });
    },


    getDoor: function(entity) {
      return _.detect(this.doors, function(door) {
        return door.contains(entity);
      });
    },

    _getCheckpoints: function(map) {
      var checkpoints = [];
      _.each(map.checkpoints, function(cp) {
        var area = new Area(cp.x, cp.y, cp.w, cp.h);
        area.id = cp.id;
        checkpoints.push(area);
      });
      return checkpoints;
    },

    getCurrentCheckpoint: function(entity) {
      return _.detect(this.checkpoints, function(checkpoint) {
        return checkpoint.contains(entity);
      });
    },

    GridPositionToTileIndex: function(x, y) {
      return (y * this.width) + x;
    },

    getMap: function (index) {
      var self = this;
      var map;
      if (!this.maps[index]) {
        map = new Map(this.game, this, index);
        //map.ready(this.MapReady);
        map.ready(function () {
          //self._updateMapOffsets(map);
          //self._updateGrid(map);
          map.gridUpdated = true;
          //map.refreshMap = true;
          game.renderer.forceRedraw = true;
        });

        this.maps[index] = map;
        this.count++;
      } else {
        map = this.maps[index];
      }
      if (map && !map.isLoaded)
        return null;

      return map;
    },

    LoadMaps: function () {
        var self = this;
        var map;

        for (var i in this.maps)
        {
          map = this.maps[i];
          map.ready(function () {
            this.gridUpdated = true;
            if ((++self.inc) === self.count) {
              self.OnAllReady();
              self.inc = 0;
              self.moveGrid(true);
              game.renderer.forceRedraw = true;
              self.gridReady = true;
            }
          });
        //  map.loadMap();
        }
    },

    reloadMaps: function (init)
    {
      var ts = G_TILESIZE;
      var c = game.camera;
      var fe = c.focusEntity;
      if (!fe)
        return false;

      var gx = fe.gx, gy = fe.gy;

      if (!this.maps[0]) {
        this.getMap(0);
      }
      if (init)
        this.LoadMaps();
    },

    moveGrid: function (force)
    {
      var self = this;
      var r = game.renderer;
      var ts = G_TILESIZE;
      var c = game.camera;
      var fe = c.focusEntity;

      if (!fe || !this.gridReady)
        return false;

      this.reloadMaps();

      var map = this.maps[0];
      this._updateGrid(map);

      return true;
    },

    _updateGrid: function (map)
    {
      //console.warn("_updateGrid - called.")
      var c = game.camera;
      var fe = c.focusEntity;
      var dim = map.dimensions;

      var cgw = c.gridWE;
      var cgh = c.gridHE;
      var cgwh = (cgw >> 1);
      var cghh = (cgh >> 1);

      var gx = fe.x >> 4, gy = fe.y >> 4;

      gx = (gx-cgwh).clamp(0, this.width-cgw),
      gy = (gy-cghh).clamp(0, this.height-cgh);

      var ox = gx;
      var oy = gy;

      for(var i=0, k=oy, l=ox; i < cgh; ++i, ++k) {
          l = ox;
          for(var j=0; j < cgw; ++j, ++l) {
            this.collisionGrid[i][j] = this.getCollision(l,k);
            this.tileGrid[i][j] = this.getTiles(l,k);
          }
      }
    },

    isCollidingPoint: function(x, y)
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
    },

    isColliding: function(x, y)
    {
      var gx = (x / G_TILESIZE),
          gy = (y / G_TILESIZE),
          d = 0.49, // A little less than 0.5.
          x1 = Math.floor(gx-d),
          y1 = Math.floor(gy-d),
          x2 = Math.floor(gx+d),
          y2 = Math.floor(gy+d);

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
    },

    isCollidingGrid: function(gx, gy) {
      var index = 0;
      var map = this.maps[index];
      if (!map)
        return true;

      return map.isColliding(gx,gy);
    },

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfBounds: function(x, y) {
      return !Utils.isInt(x) || !Utils.isInt(y) || (x < 0 || x >= (this.width) || y < 0 || y >= (this.height));
    },

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfCameraBounds: function(x, y) {
      var ts = G_TILESIZE,
          to = G_TILESIZE >> 1;
      return !isInt(x) || !isInt(y) || (x < to || x >= (this.width*ts-to) || y < (to) || y >= (this.height*ts-(to)));
    },

    isHarvestTile: function (pos, type) {
      //var gx = pos.x >> 4, gy = pos.y >> 4;
      var tiles = this.getTiles(pos.gx,pos.gy);
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
    },

    getTiles: function (gx,gy) {
      var map = this.getMap(0);
      return map.tile[gy][gx];
    },

    getCollision: function (gx,gy) {
      var map = this.getMap(0);
      return map.collision[gy][gx];
    },
  });

  return MapContainer;
});
