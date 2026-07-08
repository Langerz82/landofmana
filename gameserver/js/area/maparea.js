class MapArea {
    constructor(map, elipse, x, y, width, height) {
        this.map = map;
        this.elipse = elipse;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // NOTE: preserved pre-existing bug from the original — `contains` reads a bare
    // `elipse` identifier below instead of `this.elipse` (the constructor parameter
    // is only captured on `this.elipse`). This would throw a ReferenceError at
    // runtime in the original CommonJS version too, since sloppy mode only creates
    // implicit globals on bare *assignment*, not on read of an undeclared name.
    contains(entity) {
        if (!elipse)
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
        if (elipse)
        {
            if(entity) {
                var cx = (this.x);
                var cy = (this.y);
                var d = Math.sqrt(
                    Math.pow(entity.x - cx,2) + Math.pow(entity.y - cy,2)
                );
                var inElipse = (d < this.width/2 && d < this.height/2);

                console.log("this.elipseId="+this.elipseId);
                return inElipse;
            } else {
                return false;
            }
        }

    }
}

export default MapArea;
