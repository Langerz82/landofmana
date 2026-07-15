// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global JSZipUtils, JSZip, _ */
/* global Utils */
import Area from './area.js';
import Detect from './detect.js';
import Map from './map.js';
import config from './config.js';

export default class MapContainer {
    constructor(game, mapIndex, mapName) {
        const self = this;

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

        const $file = "./maps/" + this.mapName + ".zip?v=" + config.build.version;
        const name = self.mapName + "/" + self.mapName + "_GO.json";

        JSZipUtils.getBinaryContent($file, function(err, data) {
            if (err) {
                const filename = "./maps/" + name + "?v=" + config.build.version;
                $.getJSON(filename, function(data) {
                    self.loadMap(data);
                });
                throw err; // or handle err
            }

            JSZip.loadAsync(data).then(function(zip) {
                self.zip = zip;
                try {
                    const filename = name;
                    // FIX: no .catch on this promise chain meant a rejected async() read
                    // (corrupt/missing zip entry, or bad JSON) left MapContainer permanently
                    // stuck unloaded with no error surfaced - the surrounding try/catch only
                    // catches synchronous setup errors, not this async rejection. Same bug
                    // already fixed in map.js's equivalent load path.
                    zip.file(filename).async("string").then(function(data) {
                        self.loadMap(JSON.parse(data));
                    }).catch(function(err) {
                        console.error("Failed to load map entry from zip:", err);
                    });
                }
                catch (err) {
                    console.error(JSON.stringify(err));
                }
            }).catch(function(err) {
                // FIX: this outer JSZip.loadAsync(data) promise had no .catch at all --
                // unlike the inner zip.file(...).async() chain right above (see its FIX
                // comment), a rejection here was a fully unhandled promise rejection.
                // self.loadMap() (the only thing that calls _initMap()) was never reached,
                // so the MapContainer was left permanently stuck with isLoaded=false,
                // width/height undefined, and collisionGrid/tileGrid never populated --
                // with nothing logged to explain why. This is exactly what happens when a
                // teleport re-requests the same "./maps/<name>.zip?v=..." URL and the
                // browser serves a stale/partial response out of its HTTP cache (e.g. a
                // 304 revalidation) that JSZip can't parse as a valid zip: loadAsync()
                // rejects, and previously nothing ever called loadMap()/_initMap() to
                // recover. Falling back to the direct (non-zip) JSON fetch here -- the
                // same fallback already used for getBinaryContent's own `err` branch above
                // -- means a bad cached zip no longer permanently strands the map load.
                console.error("Failed to load map zip for " + self.mapName + ":", err);
                const filename = "./maps/" + name + "?v=" + config.build.version + "&t=" + Date.now();
                $.getJSON(filename, function(data) {
                    self.loadMap(data);
                });
            });
        });

        //this.mapShifted = false;
        //this.skipGridMove = true;
        //this.loadMap(mapName);
    }

    loadMap(data) {
        //var useWorker = false;
        this.isLoaded = false;
        //this._loadMap(useWorker, mapName);
        this.data = data;
        this._initMap(this.data);
        this.mapLoaded = true;

        // FIX: this is the other side of the race moveGrid()'s `!this.mapLoaded`
        // guard protects against -- the child Map sub-object (this.maps[0]) can
        // finish loading, and flip gridReady, *before* this container's own
        // _initMap()/_initGrids() (just above) has run. When that happens,
        // moveGrid() bailed out early every time it was called while
        // gridReady was true but mapLoaded wasn't, and nothing was left to retry
        // it once mapLoaded finally did flip true here -- so the grid could stay
        // permanently unbuilt instead of just late. If gridReady is already true
        // by the time we get here, the grids are now safe to build (this._initMap()
        // above already ran _initGrids()), so do it immediately rather than
        // hoping a future render-loop dirty-check happens to retrigger it.
        if (this.gridReady) {
            this.moveGrid();
            if (game.renderer)
                game.renderer.forceRedraw = true;
        }

        this._isReady();
    }

    _isReady() {
        const self = this;
        if (self.ready_func) {
            self.ready_func();
        }
    }

    _initGrids() {
        const c = game.camera;
        for (let i = 0; i < c.gridHE; ++i) {
            this.collisionGrid[i] = [];
            this.itemGrid[i] = [];
            this.tileGrid[i] = [];
            for (let j = 0; j < c.gridWE; ++j) {
                this.collisionGrid[i][j] = false;
                this.tileGrid[i][j] = 0;
                this.itemGrid[i][j] = {};
            }
        }
    }

    _initMap(map) {
        const c = game.camera;
        const gs = game.renderer.gameScale;
        const ts = G_TILESIZE;

        this.width = map.width;
        this.height = map.height;

        this.indexes = map.indexes;

        this.widthX = (map.width - 1) * this.game.tilesize;
        this.heightY = (map.height - 1) * this.game.tilesize;
        this.tilesize = map.tilesize;

        this.musicAreas = map.musicAreas || [];
        this.high = map.high || [];
        this.high = {};
        for (let h of map.high) {
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
    }

    _getDoors(map) {
        const self = this;

        const doors = [];
        let count = 0;
        _.each(map.doors, function(door) {
            door.width = (door.width) ? door.width : 1;
            door.height = (door.height) ? door.height : 1;
            const area = new Area(door.x, door.y, door.width, door.height);
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
    }

    ready(f) {
        this.ready_func = f;
    }

    OnAllReady() {
        this.all_ready_func();
        this.gridReady = true;
    }

    allReady(f) {
        this.all_ready_func = f;
    }

    /**
     * Returns true if the given tile id is "high", i.e. above all entities.
     * Used by the renderer to know which tiles to draw after all the entities
     * have been drawn.
     *
     * @param {Number} id The tile id in the tileset
     * @see Renderer.drawHighTiles
     */
    isHighTile(id) {
        //return this.high.hasOwnProperty(id);
        return this.high[(id)];
        //return _.indexOf(this.high, id + 1) >= 0;
    }

    /**
     * Returns true if the tile is animated. Used by the renderer.
     * @param {Number} id The tile id in the tileset
     */
    isAnimatedTile(id) {
        return id + 1 in this.animated;
    }

    /**
     *
     */
    getTileAnimationLength(id) {
        return this.animated[id + 1].l;
    }

    /**
     *
     */
    getTileAnimationDelay(id) {
        const animProperties = this.animated[id + 1];
        if (animProperties.d) {
            return animProperties.d;
        } else {
            return 100;
        }
    }

    isDoor(x, y) {
        // FIX: Area.contains() reads entity.x/entity.y (see getDoor() below), not gx/gy, and
        // it only ever returns true/false (never null), so the old `{gx,gy}` shape combined
        // with `!== null` meant this ignored position entirely and just matched the first
        // door in the list (or undefined if none). Pass the correct {x, y} shape instead.
        return _.detect(this.doors, function(door) {
            return door.contains({ x: x, y: y });
        });
    }


    getDoor(entity) {
        return _.detect(this.doors, function(door) {
            return door.contains(entity);
        });
    }

    _getCheckpoints(map) {
        const checkpoints = [];
        _.each(map.checkpoints, function(cp) {
            const area = new Area(cp.x, cp.y, cp.w, cp.h);
            area.id = cp.id;
            checkpoints.push(area);
        });
        return checkpoints;
    }

    getCurrentCheckpoint(entity) {
        return _.detect(this.checkpoints, function(checkpoint) {
            return checkpoint.contains(entity);
        });
    }

    GridPositionToTileIndex(x, y) {
        return (y * this.width) + x;
    }

    getMap(index) {
        const self = this;
        let map;
        if (!this.maps[index]) {
            map = new Map(this.game, this, index);
            //map.ready(this.MapReady);
            map.ready(function() {
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
    }

    LoadMaps() {
        let self = this;
        let map;

        for (let i in this.maps) {
            map = this.maps[i];
            // `map` is closed over from this loop (same pattern getMap()'s equivalent
            // callback just above uses), so this always refers to the right Map instance
            // regardless of how the callback ends up getting invoked below.
            const onMapReady = function() {
                map.gridUpdated = true;
                if ((++self.inc) === self.count) {
                    self.OnAllReady();
                    self.inc = 0;
                    self.moveGrid(true);
                    game.renderer.forceRedraw = true;
                    self.gridReady = true;
                }
            };

            // FIX: teleportMaps() (game.js) reuses this same MapContainer -- and
            // therefore this same already-loaded Map instance -- for a same-map
            // teleport, instead of constructing a fresh MapContainer/Map pair like
            // every other teleport. map.ready(fn) just overwrites map.js's single
            // ready_func slot, and _isReady() (which invokes it) only ever runs once,
            // at the end of that Map's original loadMapData() call. Registering a new
            // callback here via map.ready(onMapReady) on a Map that already finished
            // loading in a previous cycle meant onMapReady would never run again --
            // self.inc never incremented, OnAllReady() never fired, and
            // game.mapContainer.allReady()'s callback (clientcallbacks.js's fnReady,
            // which is what finally clears p.freeze) silently stalled forever,
            // leaving the player stuck frozen after every same-map teleport. When the
            // map is already loaded, run onMapReady via a resolved-promise microtask
            // instead of waiting on a .ready() callback that will never fire --
            // deferred (not synchronous) so it still lands *after* the synchronous
            // game.initGrid() -> ... -> game.mapContainer.allReady(...) sequence in
            // clientcallbacks.js has finished registering *this* cycle's callback,
            // same ordering guarantee a real async load would have provided.
            if (map.isLoaded) {
                Promise.resolve().then(onMapReady);
            } else {
                map.ready(onMapReady);
            }
            //  map.loadMap();
        }
    }

    reloadMaps(init) {
        const ts = G_TILESIZE;
        const c = game.camera;
        const fe = c.focusEntity;
        if (!fe)
            return false;

        const gx = fe.gx, gy = fe.gy;

        if (!this.maps[0]) {
            this.getMap(0);
        }
        if (init)
            this.LoadMaps();
    }

    moveGrid(force) {
        const self = this;
        const r = game.renderer;
        const ts = G_TILESIZE;
        const c = game.camera;
        const fe = c.focusEntity;

        // FIX: was only gated on `this.gridReady`, which is flipped by the child
        // `Map` sub-object (this.maps[0], map.js) finishing its own load -- a load
        // that doesn't actually depend on this MapContainer being ready. map.js's
        // constructor reads from `mc.zip`, but if this container's own _GO.json
        // zip entry (JSZip.loadAsync in this class's constructor) hasn't resolved
        // yet, `mc.zip` is still undefined, so `mc.zip.file(...)` throws
        // synchronously there, gets caught, and Map falls back to a plain
        // (uncompressed) JSON fetch -- which can easily finish, and flip
        // gridReady, before this container's own zip download+decompress+
        // _initMap()/_initGrids() has run. _initGrids() is what actually
        // allocates this.collisionGrid[i]/this.tileGrid[i] as arrays; running
        // _updateGrid() before it has means writing into rows that don't exist
        // yet (throws, or leaves the grid built wrong/incomplete). `mapLoaded` is
        // set at the end of loadMap(), right after _initMap()/_initGrids() runs,
        // so requiring it here as well guarantees the grids are actually
        // allocated before _updateGrid() ever touches them.
        if (!fe || !this.gridReady || !this.mapLoaded)
            return false;

        this.reloadMaps();

        const map = this.maps[0];
        this._updateGrid(map);

        return true;
    }

    _updateGrid(map) {
        //console.warn("_updateGrid - called.")
        const c = game.camera;
        const fe = c.focusEntity;

        const cgw = c.gridWE;
        const cgh = c.gridHE;
        const cgwh = (cgw >> 1);
        const cghh = (cgh >> 1);

        let gx = fe.x >> 4, gy = fe.y >> 4;

        gx = Utils.clamp(0, (this.width - cgw), (gx - cgwh)),
        gy = Utils.clamp(0, (this.height - cgh), (gy - cghh));

        const ox = gx;
        const oy = gy;

        for (let i = 0, k = oy, l = ox; i < cgh; ++i, ++k) {
            l = ox;
            for (let j = 0; j < cgw; ++j, ++l) {
                this.collisionGrid[i][j] = this.getCollision(l, k);
                this.tileGrid[i][j] = this.getTiles(l, k);
            }
        }
    }

    isCollidingPoint(x, y) {
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
        const map = this.getMap(0);
        if (!map)
          return;

        const gx = (x / G_TILESIZE),
            gy = (y / G_TILESIZE),
            d = 0.49, // A little less than 0.5.
            x1 = ~~(gx-d),
            y1 = ~~(gy-d),
            x2 = ~~(gx+d),
            y2 = ~~(gy+d);

        if (x1 < 0 || y1 < 0 || x2 >= this.width || y2 >= this.height) return true;

        const grid = map.collision,
            row1 = grid[y1],
            row2 = grid[y2];

        return row1[x1] === 1 || row1[x2] === 1 || row2[x1] === 1 || row2[x2] === 1;
    }

    isCollidingGrid(gx, gy) {
        const map = this.getMap(0);
        if (!map)
            return true;

        return map.isColliding(gx, gy);
    }

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfBounds(x, y) {
        return !Utils.isInt(x) || !Utils.isInt(y) || (x < 0 || x >= (this.width) || y < 0 || y >= (this.height));
    }

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfCameraBounds(x, y) {
        const ts = G_TILESIZE,
            to = G_TILESIZE >> 1;
        // FIX: called bare `isInt(...)` (no such global) instead of `Utils.isInt(...)`
        // (see isOutOfBounds() just above for the correct form); would throw
        // ReferenceError the moment this method is called.
        return !Utils.isInt(x) || !Utils.isInt(y) || (x < to || x >= (this.width * ts - to) || y < (to) || y >= (this.height * ts - (to)));
    }

    isHarvestTile(pos, type) {
        //var gx = pos.x >> 4, gy = pos.y >> 4;
        const tiles = this.getTiles(pos.gx, pos.gy);
        if (!tiles || tiles.length === 0)
            return false;

        log.info("tiles=" + JSON.stringify(tiles));
        const types = {}
        types.axe = [678, 679, 698, 699, 855, 875, 274, 275, 294, 295];
        if (!types.hasOwnProperty(type))
            return false;

        let res = false;
        if (Array.isArray(tiles)) {
            res = types[type].some(function(tile) { return tiles.includes(tile); });
        } else {
            res = types[type].includes(tiles);
        }
        return res;
    }

    getTiles(gx, gy) {
        const map = this.getMap(0);
        if (!map)
          return;

        if (gy < 0 || gy >= map.tile.length)
          return 0;
        if (gx < 0 || gx >= map.tile[0].length)
          return 0;

        return map.tile[gy][gx];
    }

    getCollision(gx, gy) {
        const map = this.getMap(0);
        if (!map)
          return;

        if (gy < 0 || gy >= map.tile.length)
          return 0;
        if (gx < 0 || gx >= map.tile[0].length)
          return 0;

        return map.collision[gy][gx];
    }
}
