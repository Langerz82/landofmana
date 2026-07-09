// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Entity from './entity.js';

export default class Chest extends Entity {
    constructor(id, kind) {
        super(id, 37);
    }

    getSpriteName() {
        return "chest";
    }

    isMoving() {
        return false;
    }

    open() {
        if (this.open_callback) {
            this.open_callback();
        }
    }

    onOpen(callback) {
        this.open_callback = callback;
    }
}
