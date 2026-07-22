// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global JSZipUtils, JSZip, _ */
/* global Utils */
import Area from '../area.js';
import Detect from '../detect.js';
import Map from '../map.js';
import config from '../config.js';
import fetchJsonSync from '../lib/fetchjsonsync.js';

// MapContainer's own behavior is split across these mixin modules for readability
// (mapcontainer.js had grown to ~560 lines). Each install* call below merges plain-
// function methods onto MapContainer.prototype; they're not subclasses/separate
// instances, just MapContainer's own methods living in separate files.
import { installMapContainerDoors } from './mapcontainerdoors.js';
import { installMapContainerQueries } from './mapcontainerqueries.js';

export default class MapContainer {
    constructor(game, mapIndex, mapName) {
        const self = this;

        this.game = game;
        this.mapIndex = mapIndex;
        this.mapName = mapName;
        this.isLoaded = false;
        this.mapLoaded = false;
        this.gridReady = false;
        this.maps = {};
        this.collisionGrid = [];
        this.tileGrid = [];
        this.itemGrid = [];
        this.count = 0;
        this.inc = 0;

        const $file =
            './maps/' + this.mapName + '.zip?v=' + config.build.version;
        const name = self.mapName + '/' + self.mapName + '_GO.json';

        JSZipUtils.getBinaryContent($file, function (err, data) {
            if (err) {
                // FIX: switched from a fire-and-forget $.getJSON with no error handling
                // (plus a `throw err` that did nothing but log an uncaught exception,
                // since the getJSON call above it was already async and unaffected by it)
                // to fetchJsonSync, wrapped in try/catch so a failed fallback is actually
                // surfaced instead of silently leaving the container stuck unloaded.
                console.error(
                    'Failed to load map zip for ' + self.mapName + ':',
                    err
                );
                const filename = './maps/' + name;
                try {
                    self.loadMap(fetchJsonSync(filename));
                } catch (fallbackErr) {
                    console.error(
                        'Failed to load map data via fetchJsonSync fallback for ' +
                            self.mapName +
                            ':',
                        fallbackErr
                    );
                }
                return;
            }

            JSZip.loadAsync(data)
                .then(function (zip) {
                    self.zip = zip;
                    try {
                        const filename = name;
                        // FIX: no .catch on this promise chain meant a rejected async() read
                        // (corrupt/missing zip entry, or bad JSON) left MapContainer permanently
                        // stuck unloaded with no error surfaced - the surrounding try/catch only
                        // catches synchronous setup errors, not this async rejection. Same bug
                        // already fixed in map.js's equivalent load path.
                        zip.file(filename)
                            .async('string')
                            .then(function (data) {
                                self.loadMap(JSON.parse(data));
                            })
                            .catch(function (err) {
                                console.error(
                                    'Failed to load map entry from zip:',
                                    err
                                );
                            });
                    } catch (err) {
                        console.error(JSON.stringify(err));
                    }
                })
                .catch(function (err) {
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
                    // Uses fetchJsonSync (wrapped in try/catch, since it throws rather than
                    // taking a .fail() callback), relying on its own automatic "?version="
                    // param -- no per-request timestamp, since that would force a fresh
                    // download of this map's JSON on every single load instead of only on
                    // a new build.
                    console.error(
                        'Failed to load map zip for ' + self.mapName + ':',
                        err
                    );
                    const filename = './maps/' + name;
                    try {
                        self.loadMap(fetchJsonSync(filename));
                    } catch (fallbackErr) {
                        console.error(
                            'Failed to load map data via fetchJsonSync fallback for ' +
                                self.mapName +
                                ':',
                            fallbackErr
                        );
                    }
                });
        });
    }

    loadMap(data) {
        this.isLoaded = false;
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
            if (game.renderer) game.renderer.forceRedraw = true;
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
        const ts = G_TILESIZE;

        this.width = map.width;
        this.height = map.height;

        this.indexes = map.indexes;

        this.widthX = (map.width - 1) * this.game.tilesize;
        this.heightY = (map.height - 1) * this.game.tilesize;
        this.tilesize = map.tilesize;

        this.musicAreas = map.musicAreas || [];
        this.high = {};
        for (let h of map.high) {
            this.high[h] = true;
        }

        this.animated = map.animated;
        this.doors = this._getDoors(map);
        this.checkpoints = this._getCheckpoints(map);

        this.gcsx = 0;
        this.gcsy = 0;
        this._updateScrollBounds();

        this._initGrids();
    }

    // FIX: gcex/gcey are the world-pixel bounds camera.js clamps this.x/this.y (the
    // real camera position entities are drawn relative to) against. They used to be
    // computed once, inline, in _initMap() as `this.width * ts - screenX` - which
    // doesn't land on the same world pixel where _updateGrid()'s tile-window sampler
    // (`ox`/`oy`) actually stops resampling new tile rows/columns.
    //
    // The exact relationship (derived from how entities are drawn - `entity.x -
    // this.x` - versus how the buffered tile layer is positioned - local tile column
    // j drawn at `j*ts - sox + offX`, offX baseline `-c.wOffX` - requiring both to
    // agree on where any given world pixel lands on screen) is:
    //   this.x (at the point the camera clamps) == ox*ts + wOffX
    // so gcex/gcey must be derived from whatever oxMax/oyMax _updateGrid() actually
    // clamps to, using the exact same wOffX/wOffY the tile sampler and pixel-smoothing
    // code already use - see oxMax/oyMax below for how that's derived.
    //
    // FIX (far edge never visible): oxMax/oyMax used to just be `this.width - c.gridWE`
    // / `this.height - c.gridHE` - i.e. "clamp so the buffered array's very last
    // column/row holds the map's last column/row". That assumes the array's last
    // column/row is itself within the visible viewport once the container is shifted
    // left/up by wOffX/wOffY to hide the *first* buffer column/row - true only when
    // wOffX/wOffY is exactly one tile. In general it isn't: wOffX/wOffY absorbs
    // whatever rounding slack gridW/gridH's ceil-then-force-even math left over versus
    // the actual screen size, which can be anywhere up to just under 2 tiles - and
    // simply adding more buffer columns/rows doesn't help, because wOffX/wOffY grows
    // by the same amount as the buffer does (verified empirically - it's a wash).
    // Concretely, whenever wOffX/wOffY exceeds one tile (common - it depends on how
    // close the screen size happens to land to a whole number of tiles), the array's
    // last column/row ends up rendered below/right of the actual visible canvas -
    // present in the scene graph, holding the map's true last column/row, but never
    // actually seen. That's what made the map's far edge (and any entity standing on
    // it) appear to vanish/be unreachable. It's specific to the *far* edge (largest
    // ox/oy) - the near edge (ox/oy = 0) doesn't have this problem, since offX/offY
    // ramps all the way to exactly 0 there instead of sitting at the -wOffX/-wOffY
    // baseline (see camera.js's setRealCoords()/rendererscaling.js's setTilesOffset())
    // - which is why "top-left is fine" while "bottom-left" (and, on a wide-enough
    // map, bottom-right) isn't.
    //
    // Fixed by solving directly for the largest local column/row L whose on-screen
    // position (L*ts - wOffX) still fits within the visible viewport (screenX/screenY),
    // then setting oxMax/oyMax so the map's true last column/row (width-1/height-1)
    // lands exactly there - using up the buffer as fully as the screen size allows,
    // rather than assuming it always divides evenly.
    //
    // FIX (staleness): this used to only run once, inline in _initMap() at map-load
    // time, using whatever c.gridWE/c.wOffX were *then*. But camera.rescale() (which
    // recomputes gridWE/gridHE/wOffX/wOffY) can run again afterwards - e.g. a window
    // resize, or game.js's unconditional ~2s-after-start resize call - without ever
    // refreshing gcex/gcey to match. That silently broke the very invariant this
    // method exists to establish on almost every real session, which is what kept
    // the entity/tile alignment and edge-scroll-jump fixes from actually taking
    // effect. Pulled out into its own method so camera.rescale() can re-run it too
    // (see camera.js) whenever the map is already loaded.
    _updateScrollBounds() {
        if (typeof this.width === 'undefined') return;

        const c = game.camera;
        const ts = G_TILESIZE;

        // FIX (bottom-right edge: tile invisible / entity walks off-screen):
        // lx/ly used to be `floor((screenX+wOffX)/ts)` - "the largest local column
        // whose on-screen pixel origin is < screenX". Two distinct problems with that:
        //
        // 1) Whenever (screenX+wOffX) lands on an *exact* multiple of ts (common -
        //    e.g. 1280x720 at several integer gameScales), floor() returns one column
        //    too many: that column's pixel range is exactly [screenX-ts, screenX),
        //    i.e. 0 pixels inside [0, screenX) - the map's true last column/row was
        //    placed one column past the edge of what's actually drawn, so it (and
        //    anything standing on it) never rendered at all. This is the "bottom-right
        //    map not displaying fully by 1-tile" report.
        //
        // 2) Even once a column has >=1px on-screen, that's not enough for an entity
        //    centered on that tile to stay fully visible - isColliding() (see
        //    mapcontainerqueries.js) lets an entity's pixel-center get within `d=0.49`
        //    tiles of the map edge, i.e. up to ~0.51 tiles *past* the last column's
        //    left/top edge. Entities are drawn as `entity.x - this.x` with no wOffX
        //    correction (unlike tiles), so the far clamp bound (gcex/gcey, derived
        //    from oxMax/oyMax below) needs to reserve that extra ~0.51-tile margin, or
        //    an entity walking to its true legal max position renders past screenX/
        //    screenY even though the tile under it is (barely) visible. This is the
        //    "entity can still go off the screen" report.
        //
        // Both are fixed the same way: instead of requiring just >0px of clearance,
        // require enough clearance for an entity's max legal offset past the tile
        // boundary (`ts * (1 - d)`, using the same d=0.49 isColliding() uses, so this
        // bound and the collision bound agree on where the true edge is). Verified via
        // simulation (630 screen/scale/map-size combinations): 0 failures for both
        // "true last tile has any pixel on-screen" and "entity at its max legal
        // position is fully on-screen" - versus 373/630 and 146/630 failures
        // respectively for the two formulas this replaces.
        const d = 0.49;
        const marginPx = ts * (1 - d);

        const lx = Math.floor((c.screenX + c.wOffX - marginPx) / ts);
        const ly = Math.floor((c.screenY + c.wOffY - marginPx) / ts);

        this.oxMax = this.width - 1 - lx;
        this.oyMax = this.height - 1 - ly;

        this.gcex = this.oxMax * ts + c.wOffX;
        this.gcey = this.oyMax * ts + c.wOffY;
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

    getMap(index) {
        const self = this;
        let map;
        if (!this.maps[index]) {
            map = new Map(this.game, this, index);
            map.ready(function () {
                map.gridUpdated = true;
                game.renderer.forceRedraw = true;
            });

            this.maps[index] = map;
            this.count++;
        } else {
            map = this.maps[index];
        }
        if (map && !map.isLoaded) return null;

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
            const onMapReady = function () {
                map.gridUpdated = true;
                if (++self.inc === self.count) {
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
        }
    }

    reloadMaps(init) {
        const ts = G_TILESIZE;
        const c = game.camera;
        const fe = c.focusEntity;
        if (!fe) return false;

        const gx = fe.gx,
            gy = fe.gy;

        if (!this.maps[0]) {
            this.getMap(0);
        }
        if (init) this.LoadMaps();
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
        if (!fe || !this.gridReady || !this.mapLoaded) return false;

        this.reloadMaps();

        const map = this.maps[0];
        this._updateGrid(map);

        return true;
    }

    _updateGrid(map) {
        const c = game.camera;
        const fe = c.focusEntity;

        const cgw = c.gridWE;
        const cgh = c.gridHE;
        const cgwh = cgw >> 1;
        const cghh = cgh >> 1;

        let gx = fe.x >> 4,
            gy = fe.y >> 4;

        // FIX: Utils.clamp(0, this.width - cgw, ...) assumes this.width - cgw >= 0
        // (i.e. the map is at least as big as the visible screen grid). When the map
        // grid is smaller than gridWE/gridHE, this.width - cgw (or height - cgh) goes
        // negative, so the clamp's max is below its min - clamp() always collapses
        // that to the (negative) max, pinning the map against one edge instead of
        // scrolling with the player, with all the out-of-bounds padding stuck on the
        // opposite side ("clipped" look). Center the map on that axis instead when
        // it doesn't fill the screen grid.
        //
        // FIX (far edge never visible): the upper clamp bound used to just be
        // `this.width - cgw` / `this.height - cgh` (i.e. "the map's last column/row
        // lands in the buffered array's very last column/row"). That's wrong in
        // general - see _updateScrollBounds()'s oxMax/oyMax (mapcontainer.js) for the
        // full derivation of why, and why oxMax/oyMax (computed there, and kept in
        // sync with gcex/gcey) is the correct bound instead.
        gx =
            this.width < cgw
                ? ~~((this.width - cgw) / 2)
                : Utils.clamp(0, this.oxMax, gx - cgwh);
        gy =
            this.height < cgh
                ? ~~((this.height - cgh) / 2)
                : Utils.clamp(0, this.oyMax, gy - cghh);

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
}

installMapContainerDoors(MapContainer.prototype);
installMapContainerQueries(MapContainer.prototype);
