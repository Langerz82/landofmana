// Extracted from entitymoving.js: the "Orientation Functions" section
// (facing direction math, look-at helpers, reach/facing checks). Installed
// directly onto EntityMoving.prototype -- see entitymovingpath.js's
// header comment for why a mixin rather than a composed sub-object.
/* global Types, Utils, G_TILESIZE */

export function installEntityMovingOrientation(proto) {
    /*******************************************************************************
     * BEGIN - Orientation Functions.
     ******************************************************************************/

    proto.getOrientation = function (p1, p2) {
        const x = Math.abs(p1[0] - p2[0]);
        const y = Math.abs(p1[1] - p2[1]);
        if (x > y) {
            if (p1[0] > p2[0])
                return 3; // W
            else return 4; // E
        } else if (y > x) {
            if (p1[1] > p2[1])
                return 1; // N
            else return 2; // S
        }
        return 0;
    };

    // NOTE: Types.Orientations.NONE is 0, so `if (orientation)` is also the
    // "was an explicit direction actually passed" check -- calling this with
    // NONE/0 (or omitting the argument) is a deliberate no-op that leaves the
    // entity facing whatever direction it already was, not a bug. (The old
    // trailing `orientation || 0` was dead code either way: inside this `if`,
    // orientation is already known truthy, so it can never take the `|| 0`
    // fallback.) If a future caller ever needs to force-reset orientation to
    // NONE specifically, it'll need a different entry point than this one.
    proto.setOrientation = function (orientation) {
        if (orientation) {
            this.orientation = orientation;
        }
    };

    proto.getOrientationTo = function (arr) {
        return this.getOrientation([this.x, this.y], arr);
    };

    /**
     * Changes the character's orientation so that it is facing its target.
     */
    proto.lookAt = function (x, y) {
        this.setOrientation(this.getOrientationTo([x, y]));

        if (!(
            typeof this.hasAnimation === 'function' &&
            !this.hasAnimation('idle')
        )) {
            this.idle(this.orientation);
        }

        return this.orientation;
    };

    // Orientation Code.
    proto.lookAtEntity = function (entity) {
        this._lookAtEntity(entity);
    };

    proto._lookAtEntity = function (entity) {
        if (entity) {
            this.lookAt(entity.x, entity.y);
        }
        return this.orientation;
    };

    proto.lookAtTile = function (x, y) {
        const tsh = G_TILESIZE >> 1;
        let pos = Utils.getGridPosition(x, y);
        pos = Utils.getPositionFromGrid(pos.gx, pos.gy);
        this.lookAt(pos.x + tsh, pos.y + tsh);
    };

    proto.isInReach = function (x, y, o, r, rs) {
        // NOTE: these three were `var o = o || ...`/`var rs = rs || ...`/
        // `var r = r || ...` -- redeclaring a parameter with `var` just
        // reassigns the existing binding (legal); doing the same with
        // `let`/`const` throws ("already been declared"). All three are
        // already parameters, so these are just plain reassignments.
        o = o || this.orientation;
        const ts = G_TILESIZE;
        rs = rs || ts >> 1;
        r = r || ts + rs;

        let a = rs,
            b = rs;
        switch (o) {
            case Types.Orientations.UP:
            case Types.Orientations.DOWN:
                b = r;
                break;
            case Types.Orientations.LEFT:
            case Types.Orientations.RIGHT:
                a = r;
                break;
            case Types.Orientations.NONE:
                return false;
        }
        return Math.abs(this.x - x) <= a && Math.abs(this.y - y) <= b;
    };

    proto.isFacing = function (x, y) {
        // NOTE: getOrientation() returns NONE(0) when dx===dy (the target is on
        // a perfect diagonal), since neither axis "wins" the tie. Comparing
        // this.orientation straight against getOrientationTo() would then
        // reject every diagonal target regardless of which way the entity is
        // actually facing - but 8-directional melee range (isNextTooEntity)
        // explicitly allows diagonal adjacency, so diagonal attacks need to be
        // facing-checkable too. On a tie, accept either of the two cardinal
        // directions that point toward the target (e.g. a target to the
        // northeast is "faced" by either UP or RIGHT).
        const dx = x - this.x;
        const dy = y - this.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX === 0 && absY === 0) {
            return true;
        }
        if (absX === absY) {
            const horiz =
                dx > 0 ? Types.Orientations.RIGHT : Types.Orientations.LEFT;
            const vert =
                dy > 0 ? Types.Orientations.DOWN : Types.Orientations.UP;
            return this.orientation === horiz || this.orientation === vert;
        }
        return this.orientation === this.getOrientationTo([x, y]);
    };

    proto.isFacingEntity = function (entity) {
        return this.isFacing(entity.x, entity.y);
    };

    /*******************************************************************************
     * END - Orientation Functions.
     ******************************************************************************/
}
