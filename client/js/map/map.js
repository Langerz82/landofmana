// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import fetchJsonSync from '../lib/fetchjsonsync.js';
import { installMapObjects } from './mapobjects.js';
import { installMapQueries } from './mapqueries.js';
import { installMapCamera } from './mapcamera.js';
/* global log, game */

// Map's own behavior is split across mixin modules for readability - none of these
// are subclasses/separate instances, just Map's own methods living in separate
// files, all merged onto Map.prototype below:
// - installMapObjects (mapobjects.js): doors/checkpoints/camera-area/high-tile/
//   animated-tile lookups, parsed out of this same map<N>.json payload as the
//   tile/collision data below (see loadMapData()).
// - installMapQueries (mapqueries.js): grid/collision/bounds queries, operating
//   directly on this map's own width/height/tile/collision grids.
// - installMapCamera (mapcamera.js): the render-grid/scroll-window/camera-bounds
//   logic formerly on a separate MapCamera class (itself formerly MapContainer,
//   before this file's own directory move). Does no loading of its own - see its
//   own header comment - map<N>.json is fetched once, directly by this class (see
//   _loadMapJson()/loadMapData() below), and mapcamera.js's render-grid setup and
//   its ready() signal are simply called from loadMapData() once that data has
//   parsed.
export default class Map {
    constructor(game, mapIndex, mapName) {
        this.game = game;
        this.mapIndex = mapIndex;
        this.mapName = mapName;

        // "Have I parsed my own map<N>.json yet" - tileDataLoaded (tile/collision
        // grids only, set at the end of _initMap()) and isLoaded (that plus
        // doors/checkpoints/camera-area/high/animated, since they all now come out
        // of that same payload - see loadMapData()/_initMapObjects()). Named
        // tileDataLoaded rather than this class's old plain `mapLoaded` to leave
        // that name free for mapcamera.js's own field below - a different,
        // camera-level "has my render-grid setup (_finishCameraLoading()) run"
        // signal that external code already depends on under that exact name (see
        // mapcamera.js's own header comment for why the two can't just share it
        // now that they're fields of the same merged object).
        this.tileDataLoaded = false;
        this.isLoaded = false;
        this.tilesetsLoaded = false;

        // Safe empty defaults so isDoor/getDoor/isHighTile/isAnimatedTile/
        // getCurrentCheckpoint/getCurrentCameraArea (mapobjects.js) - and
        // mapcamera.js's own _updateScrollBounds()/_updateGrid(), which read
        // currentCameraArea straight off this object - never see `undefined`
        // and throw, even if something reaches in before loadMapData() below has
        // actually resolved.
        this.doors = [];
        this.checkpoints = [];
        this.camera = [];
        this.high = {};
        this.animated = {};
        this.currentCameraArea = null;
        this._prevCameraAreas = [];

        // mapcamera.js's own field defaults (render-grid arrays, mapLoaded/
        // gridReady) - it does no loading of its own anymore, see its own header
        // comment.
        this._initCamera();

        // Kick off the real map<N>.json load. Deferred one microtask (rather than
        // called directly here) so a caller's synchronous `.ready(fn)`
        // registration - gamemovement.js's teleportMaps() calls it on the very
        // next line after `new Map(...)` returns - has a chance to run BEFORE
        // this could possibly fire it: fetchJsonSync (see _loadMapJson() below)
        // is a genuinely blocking XHR call, so calling it straight from this
        // constructor would run loadMapData() - and therefore
        // _finishCameraLoading()'s ready() signal (mapcamera.js) - to completion
        // before `new Map(...)` had even returned, leaving no chance for
        // `.ready(fn)` to ever be registered in time to catch it.
        const self = this;
        Promise.resolve().then(function () {
            self._loadMapJson();
        });
    }

    loadMapData(data) {
        this.data = data;
        this._initMap(this.data);
        this._generate();
        this.tileDataLoaded = true;
        // doors/checkpoints/camera-areas/high/animated-tile data used to come from
        // a separate map<N>_GO.json zip entry, fetched independently (see
        // mapobjects.js's own header comment for why that lived here at all). Those
        // files no longer exist - map<N>.json (this same `data`) now carries that
        // data too, so this reuses the payload already parsed above instead of a
        // second fetch.
        this.loadMapObjectsData(this.data);
        // mapcamera.js's render-grid setup (scroll bounds/grid allocation) and
        // its early ready() signal - see its own header comment for why both
        // trigger from here now, rather than from a separate zip-download
        // completion.
        this._finishCameraLoading();
        this._isDataReady();
        this._initTilesets();
    }

    loadMapObjectsData(data) {
        this._initMapObjects(data);
    }

    // The real map<N>.json fetch. No zip optimization step to try first anymore
    // (mapcamera.js used to pre-download one so this could read its entry out of
    // an already-decompressed zip - see mapcamera.js's own header comment for why
    // that's gone) - just a direct fetch via the same shared fetchJsonSync helper
    // the data/*.js modules and sprites.js's own zip fallback use, which gets the
    // ?version= cache-busting param for free. Kicked off once, from the
    // constructor (see its own comment on why that's deferred one microtask).
    _loadMapJson() {
        const self = this;
        const name = this.mapName + '/' + this.mapName + '.json';
        const filename = './maps/' + name;
        try {
            self.loadMapData(fetchJsonSync(filename));
        } catch (err) {
            // FIX (carried over): loadMapData() (the only thing that calls
            // _isDataReady()) not running here silently stalls everything
            // downstream waiting on this map's data: mapcamera.js's
            // _armAllReady() never fires, and game.currentMap's allReady()
            // callback (registered in clientcallbacksmap.js's status===2 handler)
            // never gets invoked either -- leaving the player stuck mid-transition.
            console.error(
                'Failed to load map data via fetchJsonSync for ' +
                    self.mapName +
                    ': ' +
                    err
            );
        }
    }

    // Fires once this map's own tile/collision + doors/checkpoints/camera-area/
    // high/animated data has all finished loading. Purely internal plumbing -
    // nothing outside this class registers a callback here. mapcamera.js's
    // reloadMaps()/_armAllReady() use it to know when it's safe to build the
    // render grid and fire the externally-visible allReady() signal. Named
    // distinctly from mapcamera.js's own ready()/_isReady() (a different,
    // earlier signal - see that file's own header comment) now that both live on
    // the same merged object.
    _isDataReady() {
        this.isLoaded = true;
        if (this._dataReadyCallback) {
            this._dataReadyCallback(this);
        }
    }

    _onDataReady(f) {
        this._dataReadyCallback = f;
    }

    _generate() {
        this._generateCollisionGrid();
        this._generateTileGrid();
    }

    _initTilesets() {
        this.tilesetCount = 1;
        this._loadTilesets();
    }

    _initMap(map) {
        this.width = map.width;
        this.height = map.height;
        this.tileData = map.data;
        this.collisionData = map.collision;
        // mapcamera.js no longer loads any map JSON itself (see its own header
        // comment) - its widthX/heightY getters read this.tilesize straight off
        // this same object instead, so it's captured here alongside width/height
        // even though nothing in this class itself uses the raw tile pixel size.
        this.tilesize = map.tilesize;
    }

    // doors/checkpoints/camera-areas/high/animated-tile flags - formerly
    // MapCamera._initMap()'s job (see mapcamera.js's own comment on the
    // fields it kept). _getDoors/_getCheckpoints/_getCameraArea are mapobjects.js
    // mixin methods (installed onto Map.prototype below).
    _initMapObjects(map) {
        this.high = {};
        for (let h of map.high) {
            this.high[h] = true;
        }

        this.animated = map.animated;
        this.doors = this._getDoors(map);
        this.checkpoints = this._getCheckpoints(map);
        this.camera = this._getCameraArea(map);

        // Reset rather than carry over from whatever map was loaded before - a new
        // Map instance is only ever constructed for a genuine map change (a
        // same-map teleport reuses this same already-loaded instance, see
        // gamemovement.js's teleportMaps() comment), so this only ever resets on
        // an actual map change, matching the old MapContainer._initMap() behavior.
        this.currentCameraArea = null;
        // Paired with currentCameraArea above - getCurrentCameraArea()
        // (mapobjects.js) uses this to tell a freshly-entered cameraArea apart
        // from one the player was already standing in, so it must not carry Area
        // references from the previous map's (rebuilt) `this.camera` array into
        // this one.
        this._prevCameraAreas = [];
    }

    // TODO
    _loadTilesets() {
        this.tilesets = game.renderer.tilesets;
        this.tilesetsLoaded = true;
    }

    tileIndexToGridPosition(tileNum) {
        let x = 0,
            y = 0;

        const getX = function (num, w) {
            if (num === 0) {
                return 0;
            }
            return num % w === 0 ? w - 1 : (num % w) - 1;
        };

        tileNum -= 1;
        x = getX(tileNum + 1, this.width);
        y = Math.floor(tileNum / this.width);

        return {
            x: x * TILESIZE,
            y: y * TILESIZE
        };
    }

    GridPositionToTileIndex(x, y) {
        return y * this.width + x;
    }

    _generateCollisionGrid() {
        this.collision = new Array(this.height);
        for (let i = 0; i < this.height; ++i) {
            this.collision[i] = new Uint8Array(
                this.collisionData.slice(i * this.width, (i + 1) * this.width)
            );
        }
        delete this.collisionData;
        log.debug('Collision grid generated.');
    }

    _generateTileGrid() {
        this.tile = new Array(this.height);
        for (let i = 0; i < this.height; ++i) {
            const arr = this.tileData.slice(
                i * this.width,
                (i + 1) * this.width
            );
            this.tile[i] = arr;
        }
        delete this.tileData;
        log.debug('tile grid generated.');
    }

    // Single-cell, grid-coordinate collision check. Named isCollidingCell (not
    // isColliding) so it doesn't collide with mapqueries.js's isColliding(x, y) below -
    // that one is Map's public, pixel-coordinate, multi-corner collision API (the shape
    // every external caller - game.currentMap.isColliding(x,y) and friends - and even
    // the isomorphic entity-movement code's `this.map.isColliding(x,y)` on the server
    // side already expect), and it's installed onto this same prototype. Used
    // internally by mapqueries.js's isCollidingGrid(gx, gy).
    isCollidingCell(gx, gy) {
        return this.collision[gy][gx] === 1;
    }
}

installMapObjects(Map.prototype);
installMapQueries(Map.prototype);
installMapCamera(Map.prototype);
