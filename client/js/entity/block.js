// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import EntityMoving from './entitymoving.js';
import Timer from '../timer.js';

export default class Block extends EntityMoving {
    // FIX: param order didn't match the call site in entityfactory.js
    // (`new Block(id, type, mapIndex, kind, name)`), so `mapIndex` was landing in this
    // constructor's `kind` slot and vice versa, and that swapped pair was then forwarded
    // to Entity via super(). Camera.isVisible() gates rendering on entity.mapIndex, so
    // blocks effectively never rendered/became interactive. Reordered to match the caller.
    constructor(id, type, mapIndex, kind, name, x, y) {
        super(id, type, mapIndex, kind, x, y);

        this.name = name;
    }

    pickup(entity) {
        entity.holdingBlock = this;
        game.client.sendBlock(0, this.id, this.x, this.y);
    }

    place(entity) {
        const ts = G_TILESIZE;
        const pos = entity.nextTile();
        pos[0] = pos[0].roundTo(ts);
        pos[1] = pos[1].roundTo(ts);
        if (game.mapContainer.isColliding(pos[0], pos[1]))
            return;

        this.setPosition(pos[0], pos[1]);
        entity.holdingBlock = null;
        game.client.sendBlock(1, this.id, this.x, this.y);
    }

    // FIX (carried over from earlier bug-fix pass): removed dead commented-out block (isColliding/isActivated/onActivated/move) referencing undefined vars (bss, i); would error if re-enabled
}
