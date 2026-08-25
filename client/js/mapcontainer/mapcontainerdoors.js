// Mixin extracted from mapcontainer.js: Doors/checkpoints/tile-animation lookups: _getDoors/isDoor/getDoor, _getCheckpoints/getCurrentCheckpoint, isHighTile/isAnimatedTile/getTileAnimation*.
// Applied onto MapContainer.prototype via install*(...) call in mapcontainer.js; not a standalone class.
import Area from '../area.js';
/* global _, G_TILESIZE */

export function installMapContainerDoors(proto) {
    proto._getDoors = function (map) {
        const self = this;

        const doors = [];
        let count = 0;
        _.each(map.doors, function (door) {
            door.width = door.width ? door.width : 1;
            door.height = door.height ? door.height : 1;
            const area = new Area(door.x, door.y, door.width, door.height);
            area.minLevel = door.tminLevel || 0;
            area.maxLevel = door.tmaxLevel || 200;
            area.tmap = door.tmap >= 0 ? door.tmap : self.mapIndex;
            area.tx = door.tx || -1;
            area.ty = door.ty || -1;
            area.orientation = door.to || 2;

            area.id = count++;
            doors.push(area);
        });
        return doors;
    };

    /**
     * Returns true if the given tile id is "high", i.e. above all entities.
     * Used by the renderer to know which tiles to draw after all the entities
     * have been drawn.
     *
     * @param {Number} id The tile id in the tileset
     * @see Renderer.drawHighTiles
     */
    proto.isHighTile = function (id) {
        return this.high[id];
    };

    /**
     * Returns true if the tile is animated. Used by the renderer.
     * @param {Number} id The tile id in the tileset
     */
    proto.isAnimatedTile = function (id) {
        return id + 1 in this.animated;
    };

    /**
     *
     */
    proto.getTileAnimationLength = function (id) {
        return this.animated[id + 1].l;
    };

    /**
     *
     */
    proto.getTileAnimationDelay = function (id) {
        const animProperties = this.animated[id + 1];
        if (animProperties.d) {
            return animProperties.d;
        } else {
            return 100;
        }
    };

    proto.isDoor = function (x, y) {
        // FIX: Area.contains() reads entity.x/entity.y (see getDoor() below), not gx/gy, and
        // it only ever returns true/false (never null), so the old `{gx,gy}` shape combined
        // with `!== null` meant this ignored position entirely and just matched the first
        // door in the list (or undefined if none). Pass the correct {x, y} shape instead.
        return _.detect(this.doors, function (door) {
            return door.contains({ x: x, y: y });
        });
    };

    proto.getDoor = function (entity) {
        return _.detect(this.doors, function (door) {
            return door.contains(entity);
        });
    };

    proto._getCheckpoints = function (map) {
        const checkpoints = [];
        _.each(map.checkpoints, function (cp) {
            const area = new Area(cp.x, cp.y, cp.w, cp.h);
            area.id = cp.id;
            checkpoints.push(area);
        });
        return checkpoints;
    };

    proto.getCurrentCheckpoint = function (entity) {
        return _.detect(this.checkpoints, function (checkpoint) {
            return checkpoint.contains(entity);
        });
    };

    proto._getCameraArea = function (map) {
        const areas = [];
        _.each(map.camera, function (ca) {
            const area = new Area(ca.x, ca.y, ca.w, ca.h);
            area.id = ca.id;
            areas.push(area);
        });
        return areas;
    };

    // FIX (camera bounds switch on overlap): `_.detect` (first-match-wins,
    // in map data array order) meant that whenever two cameraArea's
    // overlapped - or simply shared a boundary tile after
    // getCameraAreaGridBounds()'s floor/ceil tile-grid conversion - a player
    // standing on that shared tile could never actually switch bounds: as
    // long as the OLD (already-active) area still contained the entity too,
    // it kept winning purely because it happened to sit earlier in
    // `this.camera`, even though the player had just walked onto a tile
    // that's also within a different camera bounds. That's the exact
    // "within a camera bounds and encounters another camera bounds on the
    // same tile" case - the new bounds should take over.
    //
    // FIX (flicker): a first attempt at the above fix compared each area
    // only against `this.currentCameraArea` (the still-previous value at
    // call time). That switches correctly the FIRST time the player steps
    // onto an overlap tile (A -> B), but is symmetric: the very next
    // re-check (another tile step deeper into the still-overlapping band,
    // or just a spurious re-run of moveGrid() from some unrelated
    // forceRedraw while standing still - _updateGrid() is only tile-change
    // gated, not frame-gated) now has `current === B`, and since A still
    // also contains the entity, the same logic "prefers the other match"
    // and switches straight back to A - then back to B next time, and so on,
    // flickering for as long as the player remains on any tile both areas
    // cover. Fixed by remembering the *set* of areas that contained the
    // entity on the previous check (`this._prevCameraAreas`) and only ever
    // switching to an area that is contains-now-but-didn't-before (a truly
    // FRESH entry) - an area the player was already standing in alongside
    // the current one no longer counts as "encountered", so the switch away
    // from it fires exactly once and subsequent checks that still see both
    // areas simply keep the current one. Reduces to the old first-match
    // behavior whenever at most one area contains the entity, or there's no
    // previously active area yet (e.g. right after spawn).
    proto.getCurrentCameraArea = function (entity) {
        if (!entity) {
            this._prevCameraAreas = [];
            return undefined;
        }

        const current = this.currentCameraArea;
        const prevContaining = this._prevCameraAreas || [];

        const containing = [];
        let currentStillContains = false;
        let freshlyEntered;

        for (let i = 0; i < this.camera.length; ++i) {
            const area = this.camera[i];
            if (!area.contains(entity)) continue;

            containing.push(area);

            if (area === current) {
                currentStillContains = true;
            } else if (!freshlyEntered && prevContaining.indexOf(area) === -1) {
                freshlyEntered = area;
            }
        }

        this._prevCameraAreas = containing;

        if (freshlyEntered) return freshlyEntered;
        if (currentStillContains) return current;
        if (containing.length) return containing[0];

        return undefined;
    };

    // Converts a cameraArea's pixel-space Area (x/y/width/height, straight
    // from the Tiled map data - see _getCameraArea() above) into inclusive
    // tile-grid column/row bounds, in the same (l, k)/(gx, gy) coordinate
    // space MapContainer's tileGrid/collisionGrid and getTiles()/
    // getCollision() use. Used by _updateGrid() (mapcontainer.js) to
    // restrict tile loading and camera scrolling to the area's own footprint
    // while the player is standing inside it.
    proto.getCameraAreaGridBounds = function (area) {
        const ts = G_TILESIZE;
        return {
            gx0: Math.floor(area.x / ts),
            gy0: Math.floor(area.y / ts),
            gx1: Math.ceil((area.x + area.width) / ts) - 1,
            gy1: Math.ceil((area.y + area.height) / ts) - 1
        };
    };
}
