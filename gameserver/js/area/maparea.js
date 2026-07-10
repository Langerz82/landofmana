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
        if (!this.elipse)
        {
            if(entity) {
                return entity.x >= this.x
                    && entity.y >= this.y
                    && entity.x < this.x + this.width
                    && entity.y < this.y + this.height;
            } else {
                return false;
            }
        }
        if (this.elipse)
        {
            if(entity) {
                const cx = (this.x);
                const cy = (this.y);
                const d = Math.sqrt(
                    Math.pow(entity.x - cx,2) + Math.pow(entity.y - cy,2)
                );
                const inElipse = (d < this.width/2 && d < this.height/2);

                console.log("this.elipseId="+this.elipseId);
                return inElipse;
            } else {
                return false;
            }
        }

    }
}

export default MapArea;
