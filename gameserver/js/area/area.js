// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import Utils from '../utils.js';
import { G_TILESIZE } from '../constants.js';

// Is (x, y) inside the ellipse centred on (cx, cy) with diameters w and h?
export function insideEllipse(x, y, cx, cy, w, h) {
    const rx = w / 2;
    const ry = h / 2;
    if (!(rx > 0 && ry > 0)) return false;
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy < 1;
}

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
        // Optional {x, y, w, h} (pixels): the only part of the area that may be
        // used. Set on an ellipse that crosses the edge of a split map's part
        // (map/mapgroup.js localizeArea()): the ellipse keeps its whole shape,
        // and spawns and roaming stay inside both it and this rectangle.
        this.clip = null;
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
        // a cut ellipse picking a spot anywhere in itself: sample the part of
        // it that is left (its bounding box cut to the clip rectangle), so a
        // small piece of a big ellipse doesn't use up the tries on the rest
        const box = this.clip && this.elipse && xandy === this ? this._clippedBox() : null;
        while (count < threshold) {
            if (box) {
                pos.x = box.x + Utils.randomInt(Math.max(1, box.w));
                pos.y = box.y + Utils.randomInt(Math.max(1, box.h));
            } else if (this.elipse) {
                // An even spread over the ellipse: a random angle, and a
                // distance of sqrt(random) of the way out. (A plain random
                // distance bunched about half the spots into the middle
                // quarter of the area, since there is far less room near the
                // centre than near the edge.) dw/dh are the ellipse's
                // diameters, or twice the roaming distance around a mob.
                const a = Math.random() * 2 * Math.PI;
                const t = Math.sqrt(Math.random());
                pos.x = Math.round(xandy.x + (dw / 2) * t * Math.cos(a));
                pos.y = Math.round(xandy.y + (dh / 2) * t * Math.sin(a));
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

    // The ellipse's bounding box cut to the clip rectangle (pixels).
    _clippedBox() {
        const x0 = Math.max(this.x - this.width / 2, this.clip.x);
        const y0 = Math.max(this.y - this.height / 2, this.clip.y);
        const x1 = Math.min(this.x + this.width / 2, this.clip.x + this.clip.w);
        const y1 = Math.min(this.y + this.height / 2, this.clip.y + this.clip.h);
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }

    // Does a path (pixel waypoints, as findPath() returns) stay inside this
    // area the whole way? Every tile each leg passes over is checked, not just
    // the waypoints. The tile the path starts on is skipped, so a mob that is
    // already standing just outside can still walk back in.
    containsPath(path) {
        if (!path || path.length === 0) return true;
        const ts = G_TILESIZE;
        const half = ts >> 1;
        const sx = Math.floor(path[0][0] / ts);
        const sy = Math.floor(path[0][1] / ts);
        for (let i = 1; i < path.length; ++i) {
            const ax = path[i - 1][0];
            const ay = path[i - 1][1];
            const bx = path[i][0];
            const by = path[i][1];
            const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / ts) * 2);
            for (let k = 0; k <= steps; ++k) {
                const tx = Math.floor((ax + ((bx - ax) * k) / steps) / ts);
                const ty = Math.floor((ay + ((by - ay) * k) / steps) / ts);
                if (tx === sx && ty === sy) continue;
                if (!this.contains(tx * ts + half, ty * ts + half, 0)) return false;
            }
        }
        return true;
    }

    contains(x, y, iteration) {
        //iteration = iteration;
        if (
            this.clip &&
            (x < this.clip.x ||
                y < this.clip.y ||
                x >= this.clip.x + this.clip.w ||
                y >= this.clip.y + this.clip.h)
        )
            return false;
        if (!this.elipse) {
            return (
                x >= this.x &&
                y >= this.y &&
                x < this.x + this.width &&
                y < this.y + this.height
            );
        } else {
            // A true ellipse: (dx/rx)^2 + (dy/ry)^2 < 1, with rx/ry half the
            // width/height. (It used to check the distance from the centre
            // against BOTH half-diameters, which is really a circle of half
            // the smaller one -- a 40x20-tile ellipse only ever used a
            // 10-tile-radius circle in its middle. For a circle, w === h,
            // both tests are the same.) Same test as MapArea.contains()
            // (area/maparea.js).
            return insideEllipse(x, y, this.x, this.y, this.width, this.height);
        }
    }
}

export default Area;
