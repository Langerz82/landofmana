// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Detect from './detect.js';
import config from './config.js';

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
            const filename = "./maps/" + name + "?v=" + config.build.version;
            $.getJSON(filename, function(data) {
                self.loadMapData(data);
            });
            console.error(JSON.stringify(err));
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
