class MapArea {
    constructor(map, elipse, x, y, width, height) {
        this.map = map;
        this.elipse = elipse;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // FIX: `contains` was reading the bare `elipse` identifier instead of the
    // constructor parameter captured on `this.elipse`. That threw a
    // ReferenceError on every call, breaking door/portal detection entirely
    // (map.js's isDoor/getDoor call into this). Using `this.elipse` below.
    contains(entity) {
        if (!this.elipse) {
            if (entity) {
                return (
                    entity.x >= this.x &&
                    entity.y >= this.y &&
                    entity.x < this.x + this.width &&
                    entity.y < this.y + this.height
                );
            } else {
                return false;
            }
        }
        if (this.elipse) {
            if (entity) {
                const cx = this.x;
                const cy = this.y;
                const d = Math.sqrt(
                    Math.pow(entity.x - cx, 2) + Math.pow(entity.y - cy, 2)
                );
                const inElipse = d < this.width / 2 && d < this.height / 2;

                // FIX/PERF: was `console.log("this.elipseId="+this.elipseId);`
                // here, unconditionally, on every call -- this.elipseId is never
                // assigned anywhere on MapArea (same dead-property issue already
                // fixed in area.js's own elipseId reference), so this always
                // logged "undefined" and did nothing useful. contains() is the
                // hot path map.js's isDoor()/getDoor() call on every relevant
                // player move, so this was unconditional log spam on a per-move
                // check. Removed rather than gated behind G_DEBUG, since there's
                // no real elipseId value here to ever report.
                return inElipse;
            } else {
                return false;
            }
        }
    }
}

export default MapArea;
