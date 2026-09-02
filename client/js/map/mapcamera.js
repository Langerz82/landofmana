// Formerly a standalone class (MapContainer, then MapCamera) wrapping one or more
// child Map instances via getMap(index)/this.maps{} - see this file's own git
// history for that shape. Confirmed via a repo-wide search that nothing ever
// constructed more than one child map (index was always 0), so that wrapping
// container/child-map split was pure indirection with no multi-map use to justify
// it. Merged directly onto Map.prototype instead, like mapobjects.js/mapqueries.js -
// not a subclass/separate instance, just Map's own render-grid/scroll-window/
// camera-bounds methods living in this separate file. Everything below operates on
// `this` directly now - no more this.maps[0]/getMap(0) indirection, and no more
// thin same-named wrapper methods (isColliding() and friends) delegating to a
// child map's mapqueries.js methods - those are already directly on this same
// prototype (installMapQueries, in map.js), so external callers
// (game.currentMap.isColliding(x,y) and the like, all over entity/game/updater
// code) already reach them with no indirection needed.
//
// This file does no loading of its own - no zip, no map<N>.json fetch, no network
// calls of any kind. map.js owns the one real map<N>.json load (its own
// _loadMapJson()/loadMapData()), and calls into this file's _finishCameraLoading()
// once that data has actually parsed, so the render-grid setup below
// (_updateScrollBounds()/_initGrids()) always has real width/height/tile/collision
// data to work with by the time it runs.
//
// This USED TO also download a `.zip` of its own here, early - right at
// construction, well before the client-server teleport handshake below even
// started - purely as an optimization, so map.js's own map<N>.json fetch could
// read its entry out of an already-decompressed zip instead of falling back to a
// plain fetch. That's been removed entirely: this file should not be loading any
// external files of its own. map.js's own _loadMapJson() just fetches its data
// directly now (see its own comment for why that fetch is kicked off - deferred
// one microtask - right at construction instead of waiting for reloadMaps() to
// trigger it later; that's what lets ready() below still fire early enough for
// gamemovement.js's teleportMaps() to send the teleport request without waiting
// on the full render-grid build).
//
// Two signals, still genuinely two different points in time even though both now
// chain off the same single map<N>.json load instead of two separate network
// operations:
//   ready()/_isReady(): fires once map.js's real map<N>.json data has parsed (see
//   _finishCameraLoading() below, called from map.js's own loadMapData()) -
//   gamemovement.js's teleportMaps() uses this to know when it's safe to send the
//   server the teleport request.
//   allReady(): fires later still, once the render grid itself has actually been
//   built (reloadMaps()/_armAllReady() below, triggered externally from game.js's
//   initGrid() once the server has confirmed the teleport) - see
//   clientcallbacksmap.js.
/* global Utils, G_TILESIZE, game */

export function installMapCamera(proto) {
    proto._initCamera = function () {
        // Whether the render-grid setup below (_updateScrollBounds()/
        // _initGrids()) has run - set at the end of _finishCameraLoading(),
        // once map.js's real map<N>.json data has actually parsed (see this
        // file's own header comment - there's no separate "camera" load step
        // left to gate this on). Read externally by gameentityqueries.js's
        // getEntityAt() and gameclient.js's receiveSpawn().
        this.mapLoaded = false;
        // Whether the render grid (collisionGrid/tileGrid below) has actually
        // been filled with real per-tile data via moveGrid()/_updateGrid() - as
        // opposed to just allocated (mapLoaded above). Read externally by
        // gamecursor.js, gamemovement.js's findPath(), renderer.js, and
        // gameentityqueries.js's forEachVisibleTile().
        this.gridReady = false;
        this.collisionGrid = [];
        this.tileGrid = [];
        this.itemGrid = [];
    };

    // Called from map.js's own loadMapData(), once this map's real map<N>.json
    // data has actually parsed - see this file's own header comment for why this
    // no longer runs off a separate zip-download completion.
    proto._finishCameraLoading = function () {
        this._updateScrollBounds();
        this._initGrids();
        this.mapLoaded = true;

        // This method now always runs synchronously as part of this same
        // instance's one and only loadMapData() call - i.e. strictly before
        // this.isLoaded (map.js) can flip true, which is itself a prerequisite
        // for gridReady (above) ever becoming true (see _armAllReady() below) -
        // so, unlike when this ran off a separately-timed zip download,
        // gridReady can never already be true by the time this runs. (It used to
        // be possible for the child map's own load to race ahead of this
        // container's zip-triggered setup and flip gridReady first - see this
        // file's old git history if that race ever needs revisiting.)
        this._isReady();
    };

    // Fires the early ready() signal (gamemovement.js's teleportMaps() uses it to
    // know when it's safe to send the server the teleport request) - distinct
    // from map.js's own _isDataReady()/isLoaded, which fires right alongside this
    // (both are now called from the same loadMapData() completion - see this
    // file's header comment), and from allReady() below, which fires later still,
    // once the render grid has actually been built.
    proto._isReady = function () {
        if (this.ready_func) {
            this.ready_func();
        }
    };

    proto.ready = function (f) {
        this.ready_func = f;
    };

    proto._initGrids = function () {
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
    };

    // widthX/heightY used to be plain fields, populated once from this class's
    // own map<N>_GO.json/map<N>.json load (see this file's header comment for
    // that history) - now computed on demand straight off this same object's own
    // width/height/tilesize (map.js's _initMap() sets those). Getters rather than
    // fields so they can't go stale relative to whichever map data is actually
    // current (a same-map teleport reuses this same already-loaded instance -
    // see gamemovement.js's teleportMaps() - and a real map change constructs a
    // fresh one outright), and nothing has to remember to recompute them at some
    // particular point in the load sequence. Gated on tileDataLoaded (map.js),
    // not mapLoaded above - these depend on the map's own tile/collision data
    // having parsed, not merely on this object's render-grid setup having run -
    // each returns undefined (matching the old fields' pre-load state) until
    // that's actually happened.
    //
    // (No tilesize getter here - unlike widthX/heightY, this.tilesize is already
    // a plain field, set at the same point by map.js's own _initMap(), so a
    // getter here would just collide with it for no benefit; external readers
    // (e.g. rendererdrawhud.js) already read it directly.)
    //
    // (No musicAreas getter here either - map<N>_GO.json's `musicAreas` field was
    // never read anywhere in the codebase, so it's simply dropped rather than
    // carried forward to nowhere.)
    Object.defineProperty(proto, 'widthX', {
        configurable: true,
        get: function () {
            return this.tileDataLoaded
                ? (this.width - 1) * this.game.tilesize
                : undefined;
        }
    });

    Object.defineProperty(proto, 'heightY', {
        configurable: true,
        get: function () {
            return this.tileDataLoaded
                ? (this.height - 1) * this.game.tilesize
                : undefined;
        }
    });

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
    // FIX (cameraArea room-lock sync): oxMax/oyMax/gcsx/gcex/gcsy/gcey used to
    // always describe the FULL MAP's scrollable range. _updateGrid() (below)
    // separately re-clamped its own tile-window gx/gy to an active
    // cameraArea's edges, but camera.js's setRealCoords() - which clamps the
    // continuous, pixel-precise this.x/this.y entities are drawn relative to
    // - kept clamping against these same full-map gcsx/gcex/gcsy/gcey. That
    // breaks the `this.x == ox*ts + wOffX` alignment invariant documented
    // above the instant the tile window freezes at an area edge but the
    // pixel camera doesn't: the tile buffer and every entity on screen drift
    // apart, which is what showed up as stutter/desync right at a
    // cameraArea's edge. Fixed by making this method itself area-aware (via
    // this same object's own `currentCameraArea`, set by _updateGrid() below
    // before calling this - see mapobjects.js's own header comment for that
    // field) so every consumer - this method's own
    // oxMax/oyMax/gcsx/gcex/gcsy/gcey, _updateGrid()'s gx/gy clamp, and
    // camera.js's clamp/centering - reads the SAME active range and freezes at
    // the SAME world pixel. Reduces to exactly the prior full-map-only behavior
    // whenever no cameraArea is active (gx0/gy0 are 0, gx1/gy1 are
    // width-1/height-1, same as before).
    proto._updateScrollBounds = function () {
        const c = game.camera;
        const ts = G_TILESIZE;

        // width/height/currentCameraArea now come from this same object's own
        // map.js fields. No map data parsed yet (tileDataLoaded, map.js) -
        // nothing to compute bounds against yet. Replaces the old
        // `!mapForBounds || !mapForBounds.mapLoaded` guard, back when this
        // reached into a separate child Map for that state.
        if (!this.tileDataLoaded) return;

        const area = this.currentCameraArea;
        let gx0, gy0, gx1, gy1;
        if (area) {
            const b = this.getCameraAreaGridBounds(area);
            gx0 = b.gx0;
            gy0 = b.gy0;
            gx1 = b.gx1;
            gy1 = b.gy1;
        } else {
            gx0 = 0;
            gy0 = 0;
            gx1 = this.width - 1;
            gy1 = this.height - 1;
        }

        // The current scroll range, in tile-grid columns/rows - either the
        // whole map (no active cameraArea) or the area's own footprint.
        // _updateGrid() reuses these directly for its gx/gy clamp and its
        // "which cells to blank" check.
        this.scrollGx0 = gx0;
        this.scrollGy0 = gy0;
        this.scrollGx1 = gx1;
        this.scrollGy1 = gy1;

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
        //    map/mapqueries.js) lets an entity's pixel-center get within `d=0.49`
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

        // gx1/gy1 (the last in-range column/row - either the map's or the
        // active area's) stands in for the old hardcoded `this.width - 1` /
        // `this.height - 1`; identical to those when no area is active.
        this.oxMax = gx1 - lx;
        this.oyMax = gy1 - ly;

        // gcsx/gcsy (the near scroll bound) used to always be the map's own
        // origin (0), set once per map load. It's now the active range's
        // own origin in world pixels - still 0 whenever that range is the
        // whole map (gx0/gy0 above are 0 in that case), but an active
        // cameraArea's own left/top edge otherwise, so camera.js's clamp has
        // a near bound that matches this method's far bound (gcex/gcey).
        this.gcsx = gx0 * ts;
        this.gcsy = gy0 * ts;

        this.gcex = this.oxMax * ts + c.wOffX;
        this.gcey = this.oyMax * ts + c.wOffY;
    };

    proto.allReady = function (f) {
        this.all_ready_func = f;
    };

    // Arms the wiring that fires allReady() once this map's render grid has been
    // built - called externally from game.js's initGrid(), once the server has
    // confirmed the teleport. The real map<N>.json data load itself doesn't need
    // triggering here anymore - map.js's own constructor already kicked it off
    // (see this file's own header comment) - so all that's left is arming
    // allReady() itself.
    proto.reloadMaps = function (init) {
        if (init) this._armAllReady();
    };

    // FIX (carried over): teleportMaps() (gamemovement.js) reuses this same
    // already-loaded object for a same-map teleport instead of constructing a
    // fresh one like every other teleport. map.js's _onDataReady(f) just
    // overwrites its single _dataReadyCallback slot, and _isDataReady() (which
    // invokes it) only ever runs once, at the end of that map's original
    // loadMapData() call. Registering a new callback here via
    // this._onDataReady(onDataReady) on a map that already finished loading -
    // true for a same-map teleport reuse, and now also the common case even for
    // a fresh map, since its map<N>.json fetch is kicked off right at
    // construction (see map.js's own comment) rather than waiting for this
    // method to trigger it, so it usually finishes well before the server round
    // trip does - would mean onDataReady never runs again -- allReady()'s
    // callback (clientcallbacksmap.js's fnReady, which is what finally clears
    // p.freeze) would silently stall forever, leaving the player stuck frozen.
    // When the data is already loaded, run onDataReady via a resolved-promise
    // microtask instead of waiting on an _onDataReady() callback that will never
    // fire -- deferred (not synchronous) so it still lands *after* the
    // synchronous game.initGrid() -> ... -> game.currentMap.allReady(...)
    // sequence in clientcallbacksmap.js has finished registering *this* cycle's
    // callback, same ordering guarantee a real async load would have provided.
    proto._armAllReady = function () {
        const self = this;

        const onDataReady = function () {
            self.gridUpdated = true;
            if (self.all_ready_func) {
                self.all_ready_func();
            }
            self.gridReady = true;
            self.moveGrid(true);
            game.renderer.forceRedraw = true;
        };

        if (this.isLoaded) {
            Promise.resolve().then(onDataReady);
        } else {
            this._onDataReady(onDataReady);
        }
    };

    proto.moveGrid = function () {
        const fe = game.camera.focusEntity;

        // Guards against _updateGrid() running before _initGrids() (above) has
        // allocated this.collisionGrid[i]/this.tileGrid[i] as arrays - protects
        // external callers (camera.js, renderer.js) that can call moveGrid() at
        // any time, independent of this map's own load state, not just this
        // file's own internal call from _armAllReady()'s onDataReady above
        // (which only ever runs once mapLoaded is already guaranteed true - see
        // _finishCameraLoading()'s own comment).
        if (!fe || !this.gridReady || !this.mapLoaded) return false;

        this._updateGrid();

        return true;
    };

    proto._updateGrid = function () {
        const c = game.camera;
        const fe = c.focusEntity;

        const cgw = c.gridWE;
        const cgh = c.gridHE;
        const cgwh = cgw >> 1;
        const cghh = cgh >> 1;

        let gx = fe.x >> 4,
            gy = fe.y >> 4;

        // Refresh which cameraArea (if any) the player is currently standing
        // in, then recompute oxMax/oyMax/gcsx/gcex/gcsy/gcey to match (see
        // _updateScrollBounds()'s own comment) BEFORE using them below - this
        // is what keeps this tile window and camera.js's pixel-precise
        // entity camera (which reads those same gcsx/gcex/gcsy/gcey in
        // setRealCoords()) frozen at the exact same world pixel at a
        // cameraArea's edge, instead of drifting apart.
        // currentCameraArea/getCurrentCameraArea live on this same object
        // (map/mapobjects.js) - this method only ever runs from moveGrid(),
        // gated on `this.gridReady`, which is only ever set once this object's
        // own data has finished loading (see moveGrid()'s own comment), so
        // this.width/this.height/etc. below are guaranteed populated.
        this.currentCameraArea = this.getCurrentCameraArea(fe) || null;
        this._updateScrollBounds();

        const cols = this.scrollGx1 - this.scrollGx0 + 1;
        const rows = this.scrollGy1 - this.scrollGy0 + 1;

        // FIX: Utils.clamp(gx0, gx0 + width - cgw, ...) assumes the scroll range is
        // at least as big as the visible screen grid. When it's smaller than
        // gridWE/gridHE, the clamp's max is below its min - clamp() always collapses
        // that to the (negative-relative-to-min) max, pinning the range against one
        // edge instead of scrolling with the player, with all the out-of-bounds
        // padding stuck on the opposite side ("clipped" look). Center on that axis
        // instead when the range doesn't fill the screen grid - this applies equally
        // to the whole map (the original case this was written for) and to an active
        // cameraArea smaller than the viewport.
        //
        // FIX (far edge never visible): the upper clamp bound used to just be
        // "the range's last column/row lands in the buffered array's very last
        // column/row". That's wrong in general - see _updateScrollBounds()'s
        // oxMax/oyMax for the full derivation of why, and why oxMax/oyMax (computed
        // there, and kept in sync with gcex/gcey) is the correct bound instead.
        gx =
            cols < cgw
                ? this.scrollGx0 + ~~((cols - cgw) / 2)
                : Utils.clamp(this.scrollGx0, this.oxMax, gx - cgwh);
        gy =
            rows < cgh
                ? this.scrollGy0 + ~~((rows - cgh) / 2)
                : Utils.clamp(this.scrollGy0, this.oyMax, gy - cghh);

        const ox = gx;
        const oy = gy;

        for (let i = 0, k = oy, l = ox; i < cgh; ++i, ++k) {
            l = ox;
            for (let j = 0; j < cgw; ++j, ++l) {
                // Outside the active scroll range (the whole map when no
                // cameraArea is active, in which case this is always false -
                // getTiles()/getCollision() already return 0 for any l/k out
                // of the map's own bounds; an active cameraArea's own
                // footprint otherwise) - leave the cell blank instead of
                // loading the map's tile there.
                if (
                    l < this.scrollGx0 ||
                    l > this.scrollGx1 ||
                    k < this.scrollGy0 ||
                    k > this.scrollGy1
                ) {
                    this.collisionGrid[i][j] = false;
                    this.tileGrid[i][j] = 0;
                    continue;
                }
                this.collisionGrid[i][j] = this.getCollision(l, k);
                this.tileGrid[i][j] = this.getTiles(l, k);
            }
        }
    };
}
