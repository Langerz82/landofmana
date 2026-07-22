// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Entity from './entity/entity.js';

/* global Utils */

export default class Camera {
    constructor(game, renderer) {
        this.game = game;
        this.renderer = renderer;

        this.x = 0;
        this.y = 0;

        this.tilesize = this.renderer.tilesize;

        this.rescale();

        this.entities = {};
        this.outEntities = {};

        this.scrollX = true;
        this.scrollY = true;
    }

    rescale(gridW, gridH) {
        const gs = this.renderer.gameScale;
        const w = this.renderer.innerWidth;
        const h = this.renderer.innerHeight;
        log.debug('camera: w=' + w + ',h=' + h);
        const ts = G_TILESIZE;
        const tsgs = ts * gs;
        this.gridW = Math.ceil(w / tsgs);
        this.gridH = Math.ceil(h / tsgs);
        this.gridW += this.gridW % 2 ? 1 : 0;
        this.gridH += this.gridH % 2 ? 1 : 0;

        this.gridWE = this.gridW + 2;
        this.gridHE = this.gridH + 2;

        this.screenW = w;
        this.screenH = h;

        log.debug(
            'camera: this.screenW=' +
                this.screenW +
                ',this.screenH=' +
                this.screenH
        );

        this.screenX = ~~(this.screenW / gs);
        this.screenY = ~~(this.screenH / gs);
        const tScreenW = this.gridWE * tsgs;
        const tScreenH = this.gridHE * tsgs;

        this.wOffX = ~~((tScreenW - this.screenW) / (2 * gs));
        this.wOffY = ~~((tScreenH - this.screenH) / (2 * gs));
        log.debug(
            'camera: this.wOffX=' + this.wOffX + ',this.wOffY=' + this.wOffY
        );

        log.debug('---------');
        log.debug('W:' + this.gridW + ' H:' + this.gridH);

        const mc = game.mapContainer;
        if (mc) {
            // FIX: gcex/gcey (mapcontainer.js) are derived from gridWE/gridHE/wOffX/wOffY
            // just recomputed above, and everything that keeps entities aligned with the
            // tile buffer - and edge-scrolling smooth instead of jumping - depends on
            // gcex/gcey staying in sync with those values. rescale() runs again after the
            // map's already loaded (window resize, and game.js's unconditional resize call
            // shortly after start), so gcex/gcey must be refreshed here too, not just once
            // at map-load time in mapcontainer.js's _initMap().
            mc._updateScrollBounds();
            mc._initGrids();
            mc.moveGrid(true);
        }

        if (game.client) {
            const arr = [
                ['screenWidth', this.gridWE],
                ['screenHeight', this.gridHE]
            ];
            game.client.sendConfig(arr);
        }
    }

    setRealCoords() {
        const mc = game.mapContainer;
        const fe = this.focusEntity;

        const hgw = ~~(this.screenX / 2);
        const hgh = ~~(this.screenY / 2);

        if (!fe) return;

        const x = fe.x - hgw;
        const y = fe.y - hgh;

        // Whether the map is even big enough to scroll on this axis at all (as
        // opposed to `scrollX`/`scrollY` below, which is a per-frame "currently at
        // the edge of an otherwise-scrollable map" flag). rendererscaling.js's
        // setTilesOffset() needs this distinction: it must keep its near-edge
        // smoothing for a normal large map that's momentarily clamped at an edge,
        // but must skip that smoothing on an axis that never scrolls because the
        // map doesn't fill the screen.
        this.canScrollX = mc.gcex >= mc.gcsx;
        this.canScrollY = mc.gcey >= mc.gcsy;

        // FIX: same inverted-clamp issue as mapcontainer.js's _updateGrid() -
        // mc.gcex/gcey are (map size in px) - (screen size in px), so they go
        // negative when the map is smaller than the screen. Utils.clamp(min, max, ...)
        // with max < min always collapses to that (negative) max, pinning the
        // camera - and therefore every entity positioned relative to it via
        // getEntityOffset()/getCameraView() - against one edge instead of centering
        // it on the (too-small) map. Center the camera on that axis instead when the
        // map doesn't fill the screen grid.
        //
        // FIX (half-tile offset): centering this.x as the midpoint of [gcsx, gcex]
        // (`~~((gcsx+gcex)/2)`) does NOT land on the same pixel as mapcontainer.js's
        // _updateGrid() centers its tile-sample window ox (`~~((width-cgw)/2)`, tile
        // units) - dividing by 2 before vs. after multiplying by tilesize, with wOffX
        // inside vs. outside that division, drifts the two apart by roughly wOffX/2
        // (about half a tile), which is exactly the offset reported. Recompute the
        // SAME ox/oy mapcontainer.js will use, then derive this.x/this.y from it via
        // the exact entity/tile alignment invariant established below for the normal
        // (non-centered) case - this.x == ox*ts + wOffX - so both stay pixel-exact.
        this.x =
            mc.gcex < mc.gcsx
                ? ~~((mc.width - this.gridWE) / 2) * G_TILESIZE + this.wOffX
                : Utils.clamp(mc.gcsx, mc.gcex, x);
        this.y =
            mc.gcey < mc.gcsy
                ? ~~((mc.height - this.gridHE) / 2) * G_TILESIZE + this.wOffY
                : Utils.clamp(mc.gcsy, mc.gcey, y);

        this.rx = x;
        this.ry = y;

        const tMinX = this.wOffX,
            tMaxX = mc.gcex + this.wOffX,
            tMinY = this.wOffY,
            tMaxY = mc.gcey + this.wOffY;

        // FIX (edge jump, take 2): scrollX/scrollY gate whether rendererscaling.js's
        // setGridOffset() zeroes the sub-tile pixel remainder (sox/soy). A previous
        // attempt defined these against [gcsx,gcex]/[gcsy,gcey] (this.x/this.y's own
        // clamp range) uniformly on both ends, reasoning that sox/soy should freeze
        // exactly when this.x/this.y do. That's only half right, and simulating the
        // whole pipeline frame-by-frame (walking a player from mid-map to each edge
        // and comparing where entities land vs. where the tile layer renders) showed
        // why: gcex/gcey (mapcontainer.js) were deliberately adjusted to already
        // include the wOffX/wOffY buffer compensation, so this.x/this.y freezing at
        // gcex/gcey needs sox/soy to freeze at that SAME point too (no gcex/gcey-side
        // shift) - but gcsx/gcsy is still plain 0, unadjusted, and the near-gcsx/gcsy
        // edge still needs the ORIGINAL tMinX/tMinY-based transition window (see the
        // matching rx<sx/ry<sy smoothing kept in rendererscaling.js) to stay in sync
        // with sox/soy zeroing over that same window. Using gcsx/gcsy on that end
        // (like the previous attempt did) made sox/soy zero out immediately rather
        // than over that window, desyncing it from the smoothing ramp and producing a
        // sudden multi-pixel snap right as a player leaves the near edge. Hence the
        // asymmetric thresholds below: tMinX/tMinY (unchanged) on the near side,
        // gcex/gcey (already buffer-adjusted) directly on the far side.
        this.scrollX = x > tMinX && x <= mc.gcex;
        this.scrollY = y > tMinY && y <= mc.gcey;

        this.sx =
            tMaxX < tMinX
                ? ~~((tMinX + tMaxX) / 2)
                : Utils.clamp(tMinX, tMaxX, x);
        this.sy =
            tMaxY < tMinY
                ? ~~((tMinY + tMaxY) / 2)
                : Utils.clamp(tMinY, tMaxY, y);

        this.gx = this.x >> 4;
        this.gy = this.y >> 4;
    }

    forEachVisibleValidPosition(callback) {
        if (!this.gridWE || !this.gridHE) return;

        const h = this.gridHE;
        const w = this.gridWE;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                callback(x, y);
            }
        }
    }

    isVisible(entity, extra) {
        extra = extra || 0;
        // FIX: null-guard ran after dereferencing entity.mapIndex, so a null/undefined entity threw instead of
        // returning false; check !entity first.
        if (!entity) return false;
        if (entity.mapIndex !== game.mapIndex) return false;
        return this.isVisiblePosition(entity.x, entity.y, extra);
    }

    isVisiblePosition(x, y, extra) {
        extra = extra * this.tilesize || 0;
        const minX = Math.max(0, this.x - extra);
        const minY = Math.max(0, this.y - extra);
        const maxX = Math.min(
            game.mapContainer.widthX,
            this.x + this.screenX + extra
        );
        const maxY = Math.min(
            game.mapContainer.heightY,
            this.y + this.screenY + extra
        );

        return y.between(minY, maxY) && x.between(minX, maxX);
    }

    forEachInScreenArray(entity) {
        const entities = [];
        // FIX (var cleanup): was `var entity = entity || ...`, redeclaring the `entity`
        // parameter with var - let/const can't redeclare a parameter name, so this is just a
        // reassignment.
        entity = entity || this.focusEntity;

        const tsh = G_TILESIZE >> 1;
        const x = (this.gridW - 1) * tsh;
        const y = (this.gridH - 1) * tsh;

        this.forEachInScreen(function (entity2) {
            if (entity2 === entity) return;
            if (
                Math.abs(entity.x - entity2.x) < x &&
                Math.abs(entity.y - entity2.y) < y
            )
                entities.push(entity2);
        });
        return entities;
    }

    forEachInScreen(callback) {
        for (let id in this.entities) {
            const entity = this.entities[id];
            if (entity && entity instanceof Entity) {
                callback(entity, id);
            }
        }
    }

    forEachInOuterScreen(callback) {
        for (let id in this.outEntities) {
            const entity = this.outEntities[id];
            if (entity && entity instanceof Entity) {
                callback(entity, id);
            }
        }
    }

    getEntitiesAround(x, y, dist, exclude = []) {
        const minx = x - dist;
        const miny = y - dist;
        const maxx = x + dist;
        const maxy = y + dist;

        const entities = [];
        for (let id in this.entities) {
            const entity = this.entities[id];
            if (entity && entity instanceof Entity) {
                const ex = entity.x;
                const ey = entity.y;
                if (exclude.indexOf(entity) >= 0) continue;

                if (ex >= minx && ex <= maxx && ey >= miny && ey <= maxy)
                    entities.push(entity);
            }
        }
        return entities;
    }
}
