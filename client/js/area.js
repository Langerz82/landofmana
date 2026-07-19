// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class Area {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    contains(entity) {
        return !!entity
            && entity.x >= this.x
            && entity.y >= this.y
            && entity.x < this.x + this.width
            && entity.y < this.y + this.height;
    }
}
