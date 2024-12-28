define(['area', 'detect', 'mapworker', 'map'], function(Area, Detect, worker, Map) {

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

      var $file = "./maps/"+this.mapName+".zip";
      JSZipUtils.getBinaryContent($file, function(err, data) {
          if(err) {
              throw err; // or handle err
          }

          JSZip.loadAsync(data).then(function(zip) {
            self.zip = zip;
            try {
              var name = self.mapName + "_GO.json";
              zip.file(name).async("string").then(function(data) {
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
      //game.renderer.forceRedraw = true;
      /*if (self.isLoaded) {
        clearInterval(checkInterval);
        return;
      }

      log.info("_checkReady");
      var checkInterval = setInterval(function() {

        if (self.isLoaded) {
          clearInterval(checkInterval);
          self.isLoaded = false;
          if (self.ready_func) {
            self.ready_func();
          }
        }
      }, 100);*/
    },

    /*_loadMap: function(useWorker, mapName) {
      var self = this,
        filepath = "./maps/" + mapName + "_GO.json";

      if (useWorker) {
        log.info("Loading map with web worker.");
        var worker = new Worker('js/mapworker.js');
        worker.postMessage("loadMapGO");

        worker.onmessage = function(event) {
          var map = event.data;
          self._initMap(map);
          self.mapLoaded = true;
          self._checkReady();
        };
      } else {
        log.info("Loading map via Ajax.");

        var jqxhr = $.getJSON(filepath, function(data) {
          self.data = data;
          self._initMap(self.data);
          self.mapLoaded = true;
          self._isReady();

        });
      }
    },*/

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
      var ts = game.tilesize;

      this.width = map.width;
      this.height = map.height;
      this.chunkWidth = 128;
      this.chunkHeight = 128;

      this.chunksX = Math.ceil(map.width / map.chunkWidth);
      this.chunksY = Math.ceil(map.height / map.chunkHeight);
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

      this.gridWidth = 128;
      this.gridHeight = 128;

      this.edgeX = this.gridWidth >> 1;
      this.edgeY = this.gridHeight >> 1;

      this.gcsx = 0;
      this.gcsy = 0;
      this.gcex = ((this.width) * ts) - ~~(c.screenW / gs);
      this.gcey = ((this.height) * ts) - ~~(c.screenH / gs);

      this._initGrids();
    },

    _getDoors: function(map) {
      var self = this;

      var doors = [];
      _.each(map.doors, function(door) {
        door.width = (door.width) ? door.width : 1;
        door.height = (door.height) ? door.height : 1;
        var area = new Area(door.x, door.y, door.width, door.height);
        area.minLevel = door.tminLevel,
          area.maxLevel = door.tmaxLevel,
          area.map = door.tmap,
          area.difficulty = door.tdifficulty,
          area.portal = door.p === 1,
          area.quest = door.tq,
          area.admin = door.a;
        switch (door.to) {
          case 'u':
            area.orientation = Types.Orientations.UP;
            break;
          case 'd':
            area.orientation = Types.Orientations.DOWN;
            break;
          case 'l':
            area.orientation = Types.Orientations.LEFT;
            break;
          case 'r':
            area.orientation = Types.Orientations.RIGHT;
            break;
          default:
            area.orientation = Types.Orientations.DOWN;
        }
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
        }) != null);
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

    getSubCoordinate: function (x,y) {
      x = x % (this.chunkWidth * this.tilesize);
      y = y % (this.chunkHeight * this.tilesize);
      return [x,y];
    },

    getSubIndex: function (gx,gy) {
      gx = gx.clamp(0, this.width-1);
      gy = gy.clamp(0, this.height-1);

      var index = ~~(gy / this.chunkHeight)*this.chunksX +
                     ~~(gx / this.chunkWidth);
      if (index < 0 || index > this.indexes)
        return null;

      return index;
    },

    getSubIndexRelative: function (x,y) {
      return this.getSubIndex(x >> 4, y >> 4);
    },

    getSubMapIndexDimensions: function (subIndex)
    {
        var map = this.maps[subIndex];
        var indexY = ~~(subIndex / this.chunksX) * (this.chunkHeight);
        var indexX = (subIndex % this.chunksX) * (this.chunkWidth);

        var dimension = {
          x1: indexX,
          x2: indexX + (this.chunkWidth),
          y1: indexY,
          y2: indexY + (this.chunkHeight)
        };
        return dimension;
    },

    GridPositionToTileIndex: function(x, y) {
      return (y * this.width) + x;
    },

    GetMap: function (index) {
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
      return map;
    },

    LoadMaps: function () {
        var self = this;
        var map;
        var ts = game.tilesize;

        for (var i in this.maps)
        {
          map = this.maps[i];
          map.ready(function () {
            this.gridUpdated = true;
            if ((++self.inc) == self.count) {
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
      var ts = game.tilesize;
      var c = game.camera;
      var fe = c.focusEntity;
      if (!fe)
        return false;

      var gx = fe.gx, gy = fe.gy;

      for (var i=0; i < this.indexes; i++)
      {
        var dim = this.getSubMapIndexDimensions(i);
        var mapPoint = {x: (dim.x1+dim.x2)/2, y: (dim.y1+dim.y2)/2}
        var distX = Math.abs(mapPoint.x-gx);
        var distY = Math.abs(mapPoint.y-gy);
        if ( (distX + distY) < (this.chunkHeight * 2) )
        {
          if (!this.maps[i]) {
            this.GetMap(i);
          }
        }
        else if ( (distX + distY) > (this.chunkHeight * 4))
        {
          if (this.maps.hasOwnProperty(i)) {
            this.maps[i] = null;
          }
        }
      }
      if (init)
        this.LoadMaps();
    },

    moveGrid: function (force)
    {
      var self = this;
      var r = game.renderer;
      var ts = game.tilesize;
      var c = game.camera;
      var fe = c.focusEntity;

      if (!fe || !this.gridReady)
        return false;

      this.reloadMaps();

      for (var i in this.maps)
      {
        map = this.maps[i];
        if (!(map && map.isLoaded))
          continue;

        var dim = this.getSubMapIndexDimensions(i);

        var sr = {x1: c.x, y1: c.y,
                  x2: c.x + (c.gridWE * ts), y2: c.y + (c.gridHE * ts)};
        var mr = {x1: (dim.x1 * ts), y1: (dim.y1 * ts),
                  x2: (dim.x2 * ts), y2: (dim.y2 * ts)};

        var res = RectContains(sr, mr);
        if (res)
        {
          this._updateGrid(map);
        }
      }

      game.renderer.forceRedraw = true;
      return true;
    },

    _updateGrid: function (map)
    {
      //console.warn("_updateGrid - called.")
      var r = game.renderer;
      var c = game.camera;
      var gs = game.renderer.gameScale;
      var ts = G_TILESIZE;

      var cgw = c.gridWE;
      var cgh = c.gridHE;

      var fe = c.focusEntity;
      var dim = map.dimensions;

      var cgw = c.gridWE;
      var cgh = c.gridHE;
      var cgwh = (cgw >> 1);
      var cghh = (cgh >> 1);

      var hgw = ~~(c.screenW / (2*gs*ts));
      var hgh = ~~(c.screenH / (2*gs*ts));

      var cw = this.chunkWidth;
      var ch = this.chunkHeight;

      var gx = fe.x >> 4, gy = fe.y >> 4;

      var sw = this.width;
      var sh = this.height;

      var tx = (gx-cgwh).clamp(0, sw-cgw);
      var ty = (gy-cghh).clamp(0, sh-cgh);

      gx = tx, gy = ty;

      var dim = map.dimensions;


      var sgx = gx % cw,
          sgy = gy % ch;

      var msx = (dim.x1-gx),
          msy = (dim.y1-gy);

      var gsx = Math.max(msx, 0),
          gsy = Math.max(msy, 0),
          gex = Math.min((dim.x2-gx), cgw),
          gey = Math.min((dim.y2-gy), cgh);

      var ox = (msx > 0) ? 0 : sgx;
      var oy = (msy > 0) ? 0 : sgy;

      //console.warn("ox:"+ox+",oy:"+oy);
      for(var i=gsy, k=oy, l=ox; i < gey; ++i, ++k) {
          l = ox;
          for(var j=gsx; j < gex; ++j, ++l) {
            //if (k < 0 || k >= this.chunkHeight || l < 0 || l >= this.chunkWidth)
              //console.error("mc._updateGrid - out of bounds: i j, k l,"+i+" "+j+" "+","+k+" "+l);
            this.collisionGrid[i][j] = map.collision[k][l];
            this.tileGrid[i][j] = map.tile[k][l];
          }
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

    isCollidingGrid: function(gx, gy) {
      var index = this.getSubIndex(gx,gy);
      var map = this.maps[index];
      if (!map)
        return true;

      gx -= map.dimensions.x1;
      gy -= map.dimensions.y1;

      return map.isColliding(gx,gy);
    },

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfBounds: function(x, y) {
      return !isInt(x) || !isInt(y) || (x < 0 || x >= (this.width) || y < 0 || y >= (this.height));
    },

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfCameraBounds: function(x, y) {
      var ts = game.tilesize,
          to = game.tilesize >> 1;
      return !isInt(x) || !isInt(y) || (x < to || x >= (this.width*ts-to) || y < (to) || y >= (this.height*ts-(to)));
    },

    isHarvestTile: function (pos, type) {
      //var gx = pos.x >> 4, gy = pos.y >> 4;
      var tiles = this.getTiles(pos.gx,pos.gy);
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
      //var harvestTiles = [678, 679, 698, 699, 855, 875];
      //var res = types[type].some(function (tile) { return tiles.includes(tile); });
      //return res;
    },

    getTiles: function (gx,gy) {
      var mapIndex = this.getSubIndex(gx, gy);
      var map = this.maps[mapIndex];
      var tx = gx % this.chunkWidth, ty = gy % this.chunkHeight;
      return map.tile[ty][tx];
    },

  });

  return MapContainer;
});
