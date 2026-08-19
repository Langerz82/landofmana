import Utils from '../utils.js';
import { G_TILESIZE } from '../constants.js';

// IMPORTANT - X,Y are center cordinates for elipses only. For default rectangle its top-left.
class Area {
    constructor(map, id, x, y, width, height, elipse, excludeId) {
        this.id = id;
        this.gx = ~~(x / G_TILESIZE);
        this.gy = ~~(y / G_TILESIZE);

        this.x = x;
        this.y = y;

        this.width = width;
        this.height = height;

        this.map = map;

        this.elipse = elipse || false;
        //this.elipseId = elipseId || -1;
        this.excludeId = excludeId || -1;
        //console.info("this.elipse="+this.elipse+",this.excludeId="+this.excludeId);
    }

    _getRandomPosition(xandy, dist, threshold) {
        threshold = threshold || 100;
        //console.info("_getRandomPositionInsideArea - threshold="+threshold);
        const pos = {};
        const valid = false;

        //console.info("pos.x: "+this.x+",pos.y:"+this.y);
        let count = 0;
        //console.info("threshold = "+threshold);

        const dw = dist.width;
        const dh = dist.height;
        while (count < threshold) {
            if (this.elipse) {
                const a = Math.random() * 2 * Math.PI;
                const rx = Utils.randomRangeInt(0, ~~(dw / 2));
                const ry = Utils.randomRangeInt(0, ~~(dh / 2));

                pos.x = Math.round(xandy.x + ~~(rx * Math.cos(a)));
                pos.y = Math.round(xandy.y + ~~(ry * Math.sin(a)));
            } else {
                pos.x = xandy.x + Utils.randomInt(dw << 1) - dw;
                pos.y = xandy.y + Utils.randomInt(dh << 1) - dh;
            }

            pos.x = Utils.floorToGrid(pos.x, G_TILESIZE) + (G_TILESIZE >> 1);
            pos.y = Utils.floorToGrid(pos.y, G_TILESIZE) + (G_TILESIZE >> 1);

            //if (pos.x % 16 !== 0 || pos.y % 16 !== 0)
            //console.error("not multiple of 16");

            //console.warn("pos.x: "+pos.x+",pos.y:"+pos.y);
            //console.info("count="+count);
            if (!this.contains(pos.x, pos.y, 0)) {
                //console.info("_getRandomPosition: contains - false "+pos.x+","+pos.y);
                //console.info("_getRandomPosition: contains "+this.x+","+this.y+","+this.width+","+this.height);
                //try { throw new Error(); } catch(err) { console.info(err.stack); }
                //process.exit(1);
                count++;
                continue;
            }

            if (this.map.isColliding(pos.x, pos.y)) {
                //console.info("isColliding - true: "+pos.x+","+pos.y);
                //console.info("_getRandomPosition: map colliding.");
                count++;
                continue;
            }
            // NOTE: there used to be a trailing `count++;` here, after this
            // if/else -- both branches above either `continue` or `break`,
            // so it could never actually execute. Removed as dead code; it
            // wasn't causing a double-increment (or anything else), just
            // never ran.
            break;
        }
        if (count >= threshold) {
            console.error('_getRandomPosition exceeded:' + pos.x + ',' + pos.y);
            //process.exit(1);
            return null;
        }
        return pos;
    }

    _getRandomPositionForEntity(entity, dist, threshold) {
        //var obj = {x: entity.x, y: entity.y};
        return this._getRandomPosition(
            entity,
            { width: dist, height: dist },
            threshold
        );
    }

    _getRandomPositionInsideArea(threshold) {
        return this._getRandomPosition(this, this, threshold);
    }

    // PERF: map/mapentities.js's spaceEntityRandomApart() defaults its
    // `entities` argument to the WHOLE map's entity list whenever a caller
    // omits it -- and its retry loop dist-checks that list up to 100 times
    // per call (see the PERF comment there). BlockArea.randomizeBlocks()
    // and MobArea._createMob() (used for both initial spawn and respawn,
    // the latter via entity/mob/mobrespawn.js) both used to omit it, so
    // every block placement and every mob spawn/respawn paid up to 100 x
    // O(every entity on the map) just to find a spot -- on a server sized
    // for ~875 mobs across 51 areas (see G_SPATIAL_SIZE in constants.js),
    // that's real, continuous cost during active combat/farming, unlike
    // mobai.js's Roaming(), which was already deliberately narrowed to a
    // spatially-filtered nearby-mob list for exactly this reason.
    //
    // Returns a spatially-prefiltered entity list, wide enough to safely
    // replace the full map-entities default for any candidate position this
    // area could ever generate: every candidate spaceEntityRandomApart() is
    // asked to dist-check is already filtered through contains() first (see
    // _getRandomPosition() above), so it's always within this area's own
    // true bounds -- only the `distTiles` search radius itself can reach
    // entities just outside them, which the radius computed below accounts
    // for.
    getNearbyEntities(distTiles) {
        let centerX, centerY, halfDiagonalTiles;
        if (this.elipse) {
            // Area.x/y ARE the center for an ellipse (see the class comment
            // at the top of this file); valid positions stay within
            // width/2 and height/2 of it (see contains() above).
            centerX = this.x;
            centerY = this.y;
            halfDiagonalTiles =
                Math.max(this.width, this.height) / 2 / G_TILESIZE;
        } else {
            // Area.x/y is the top-left corner for a rectangle; valid
            // positions stay within [x, x+width) x [y, y+height).
            centerX = this.x + this.width / 2;
            centerY = this.y + this.height / 2;
            halfDiagonalTiles =
                Math.sqrt(
                    Math.pow(this.width / 2, 2) + Math.pow(this.height / 2, 2)
                ) / G_TILESIZE;
        }
        // +1 tile of slack on top of the exact geometric bound, for rounding.
        const radiusTiles = Math.ceil(halfDiagonalTiles + distTiles) + 1;
        return this.map.entities.getEntitiesAround(
            { x: centerX, y: centerY },
            radiusTiles
        );
    }

    contains(x, y, iteration) {
        //iteration = iteration;
        if (!this.elipse) {
            return (
                x >= this.x &&
                y >= this.y &&
                x < this.x + this.width &&
                y < this.y + this.height
            );
        } else {
            const cx = this.x;
            const cy = this.y;
            const d = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
            //console.log("cx:"+cx+",cy:"+cy);
            //console.log("this.width:"+this.width+",this.height:"+this.height);
            //console.log("this.x:"+this.x+",this.y:"+this.y);
            //console.log("d:"+d);

            // FIX: only checked `d < this.width / 2`, ignoring `this.height`
            // entirely -- the sibling MapArea.contains() (map/maparea.js)
            // correctly checks both `d < this.width / 2 && d < this.height /
            // 2`. For any elliptical area configured with `width !==
            // height`, this disagreed with _getRandomPosition() above (whose
            // ellipse-branch candidate generation already samples using both
            // dw and dh independently) and with the real non-circular shape
            // the area was meant to describe -- biasing/rejecting valid
            // positions along whichever axis was left unchecked. Matching
            // MapArea's check here so both ellipse implementations in this
            // codebase agree.
            const inElipse = d < this.width / 2 && d < this.height / 2;
            return inElipse;
            // FIX: removed an unreachable `return false;` that followed the
            // real return statement above -- dead code, no behavior change.
        }
    }
}

export default Area;
