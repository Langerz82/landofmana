// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Detect from './detect.js';
import fetchJsonSync from './data/fetchjsonsync.js';

export default class Map {
    constructor(game, mapContainer) {
        const self = this;

        this.game = game;
        this.mapContainer = mapContainer;
        this.isLoaded = false;
        this.tilesetsLoaded = false;
        this.mapLoaded = false;
        this.mapName = mapContainer.mapName;
        this.gridUpdated = false;

        const mc = this.mapContainer;
        const name = mc.mapName + "/" + mc.mapName + ".json";
        try {
            mc.zip.file(name).async("string").then(function(data) {
                self.loadMapData(JSON.parse(data));
            }).catch(function(err) { // FIX (carried over): no .catch meant a rejected promise (corrupt/missing zip entry) silently left the map unloaded
                console.error("Failed to load map data from zip: " + err);
            });
        }
        catch (err) {
            console.error(JSON.stringify(err));
            // FIX: this fallback (taken whenever mc.zip.file(name) throws synchronously --
            // most commonly because mc.zip itself is still undefined, i.e. this child Map
            // got constructed before the parent MapContainer's own zip finished loading,
            // a race that's much more likely to land here on a repeat/same-map teleport)
            // only ever had a success callback. $.getJSON has no error handling, so if this
            // one request doesn't succeed -- e.g. a stale cached response for this exact URL
            // on a map you've already visited, since unlike the container's own zip URL this
            // one carries no cache-busting param -- loadMapData() (the only thing that calls
            // _isReady()) never runs. That silently stalls everything downstream that waits
            // on this Map's .ready() callback: LoadMaps()'s per-map callback never fires,
            // inc never reaches count, OnAllReady() never runs, and game.mapContainer's
            // allReady() callback (registered in clientcallbacks.js's status===2 handler)
            // never gets invoked either -- leaving the player stuck mid-transition. Using
            // fetchJsonSync (same shared helper the data/*.js modules and sprites.js's
            // zip fallback use) gets the ?version= cache-busting param for free -- no
            // per-request timestamp here, since that would force a fresh download of
            // this map's JSON on every single load instead of only on a new build.
            const filename = "./maps/" + name;
            try {
                self.loadMapData(fetchJsonSync(filename));
            }
            catch (fallbackErr) {
                console.error("Failed to load map data via fetchJsonSync fallback for " + self.mapName + ": " + fallbackErr);
            }
        }
    }

    loadMapData(data) {
        this.isLoaded = false;
        this.data = data;
        this._initMap(this.data);
        this._generate();
        this.mapLoaded = true;
        this._isReady();
        this._initTilesets();
    }

    _isReady() {
        const self = this;
        this.isLoaded = true;
        if (this.ready_func) {
            this.ready_func(self);
        }
    }

    _generate() {
        const self = this;

        self._generateCollisionGrid();
        self._generateTileGrid();
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
    }

    // TODO
    _loadTilesets() {
        this.tilesets = game.renderer.tilesets;
        this.tilesetsLoaded = true;
    }

    ready(f) {
        this.ready_func = f;
    }

    tileIndexToGridPosition(tileNum) {
        let x = 0,
            y = 0;

        const getX = function(num, w) {
            if (num === 0) {
                return 0;
            }
            return (num % w === 0) ? w - 1 : (num % w) - 1;
        };

        tileNum -= 1;
        x = getX(tileNum + 1, this.width);
        y = Math.floor((tileNum) / this.width);

        return {
            x: x * TILESIZE,
            y: y * TILESIZE
        };
    }

    GridPositionToTileIndex(x, y) {
        return (y * this.width) + x;
    }

    _generateCollisionGrid() {
        this.collision = new Array(this.height);
        for (let i = 0; i < this.height; i++) {
            this.collision[i] = new Uint8Array(this.collisionData.slice(i * this.width, (i + 1) * this.width));
        }
        delete this.collisionData;
        log.debug("Collision grid generated.");
    }

    _generateTileGrid() {
        this.tile = new Array(this.height);
        for (let i = 0; i < this.height; i++) {
            this.tile[i] = this.tileData.slice(i * this.width, ((i + 1) * this.width));
        }
        delete this.tileData;
        log.debug("tile grid generated.");
    }

    isColliding(gx, gy) {
        return (this.collision[gy][gx] === 1);
    }
}
