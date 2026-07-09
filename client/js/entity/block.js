// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import EntityMoving from './entitymoving.js';
import Timer from '../timer.js';

export default class Block extends EntityMoving {
    constructor(id, type, kind, map, name, x, y) {
        super(id, type, map, kind, x, y);

        this.name = name;
        /*this.ready(function () {
          self.animate("idle", self.idleSpeed);
        })*/
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
