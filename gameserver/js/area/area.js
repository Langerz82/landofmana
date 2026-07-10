import Utils from '../utils.js';
import { G_TILESIZE } from '../main.js';

// IMPORTANT - X,Y are center cordinates for elipses only. For default rectangle its top-left.
class Area {
    constructor(map, id, x, y, width, height, elipse, excludeId) {
        this.id = id;
        //var ts = G_TILESIZE;
        this.gx = ~~(x / G_TILESIZE);
        this.gy = ~~(y / G_TILESIZE);

        this.x = x;
        this.y = y;
        // FIX (cleanup, not a behavior change): this `if (elipse)` block was
        // dead code -- both lines are expression statements with no
        // assignment, and even if they had assigned to this.x/this.y,
        // this.width/this.height aren't set until the two lines below, so
        // they'd have read as undefined at this point anyway. Removed rather
        // than "fixed into life", since the class-level comment above already
        // documents the real, current contract: callers must pass an
        // already-centered x/y for ellipse areas. Making this block actually
        // compute a center would silently shift every existing ellipse area
        // caller by width/2,height/2 -- a real behavior change, not a fix.
        this.width = width;
        this.height = height;
        //this.world = world;
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
                const rx = Utils.randomRangeInt(0,~~(dw / 2));
                const ry = Utils.randomRangeInt(0,~~(dh / 2));

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

            if (this.map.isColliding(pos.x, pos.y))
            {
                //console.info("isColliding - true: "+pos.x+","+pos.y);
                //console.info("_getRandomPosition: map colliding.");
                count++;
                continue;
            }
            else {
                break;
            }
            count++;
        }
        if (count >= threshold) {
            console.error("_getRandomPosition exceeded:" + pos.x + "," + pos.y);
            //process.exit(1);
            return null;
        }
        return pos;
    }

    _getRandomPositionForEntity(entity, dist, threshold) {
        //var obj = {x: entity.x, y: entity.y};
        return this._getRandomPosition(entity, {"width": dist, "height": dist}, threshold);
    }

    _getRandomPositionInsideArea(threshold) {
        return this._getRandomPosition(this, this, threshold);
    }

    contains(x, y, iteration) {
        //iteration = iteration;
        if (!this.elipse) {
            return x >= this.x &&
                y >= this.y &&
                x < this.x + this.width &&
                y < this.y + this.height;
        } else {
            const cx = (this.x);
            const cy = (this.y);
            const d = Math.sqrt(
                Math.pow(x - cx, 2) + Math.pow(y - cy, 2)
            );
            //console.log("cx:"+cx+",cy:"+cy);
            //console.log("this.width:"+this.width+",this.height:"+this.height);
            //console.log("this.x:"+this.x+",this.y:"+this.y);
            //console.log("d:"+d);

            const inElipse = (d < this.width / 2);

            //console.log("this.elipseId="+this.elipseId);
            //console.log("inElipse="+inElipse);
            if (iteration === 1 || this.excludeId === -1) {
                return inElipse;
            } else if (iteration === 0) {
                let res = inElipse;

                const prevArea = this.map.mobLiveAreas[this.elipseId];
                if (prevArea)
                    res = res && !prevArea.contains(x, y, 1);

                return res;
            }
            return false;
        }
    }
}

export default Area;
