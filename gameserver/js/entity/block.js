import EntityMoving from './entitymoving.js';
import { Types } from '../common.js';

class Block extends EntityMoving {
    // NOTE: the original set `this.type`/`this.parent`/`this.ix`/`this.iy` on `this`
    // BEFORE calling `_super()`, which was legal under the old prototype-based
    // Class.extend pattern (the instance already existed). Native ES6 classes
    // forbid touching `this` before `super()` runs, so `type` is computed into a
    // local first, passed to `super()`, and the rest are assigned right after —
    // none of these fields are read inside the parent constructor chain, so this
    // reordering has no observable effect on behavior.
    constructor(id, kind, x, y, map, parent, name, ix, iy) {
        const type = Types.EntityTypes.BLOCK;
        super(id, type, kind, x, y, map);
        this.type = type;
        this.parent = parent;
        this.ix = ix;
        this.iy = iy;
        this.name = name;
        this.playerName = null;
    }

    isCompleted(player) {
        if (this.parent.isCompleted())
            this.parent.onComplete();
    }

    getState() {
        return this._getBaseState().concat([
            parseInt(this.ix),
            parseInt(this.iy)
        ]);
    }

    update(player) {
        this.playerName = player.name;
        this.parent.update();
    }
}

export default Block;
