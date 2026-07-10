// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Entity from './entity.js';

export default class Chest extends Entity {
    // FIX: constructor never accepted/forwarded mapIndex, so every Chest had
    // this.mapIndex === undefined. Camera.isVisible() treats that as "wrong map"
    // (entity.mapIndex !== game.mapIndex is always true when undefined), so chests
    // were never added to camera.entities and never rendered. Now forwards both
    // mapIndex and kind to Entity like every other entity type does.
    constructor(id, mapIndex, kind) {
        super(id, 37, mapIndex, kind);
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
