import EntityMoving from './entitymoving.js';
import Messages from '../message.js';
import { Types } from '../common.js';

// NOTE: the original CommonJS source named this exported class/identifier "Block"
// (a copy-paste artifact from block.js) even though the file is trap.js and
// trapgroup.js imports it as "Trap". Renamed to Trap here since it's only the
// internal identifier behind the default export — behavior is unchanged.
class Trap extends EntityMoving {
    // See block.js note: `type` is computed into a local before super() since
    // `this` cannot be touched beforehand under native ES6 class rules.
    constructor(id, kind, x, y, map, parent, name, ix, iy) {
        const type = Types.EntityTypes.TRAP;
        super(id, type, kind, x, y, map);
        this.type = type;
        this.parent = parent;
        this.ix = ix;
        this.iy = iy;
        this.name = name;
        this.active = true;
    }

    getState() {
        return this._getBaseState().concat([
            parseInt(this.ix),
            parseInt(this.iy),
            parseInt(this.active ? 1 : 0)
        ]);
    }

    // NOTE: Messages.SwapSprite is commented out in message.js in the original
    // source, so this call would throw at runtime — pre-existing bug, left as-is.
    on() {
        this.active = true;
        this.map.entities.sendNeighbours(this, new Messages.SwapSprite(this.id, 1));
    }

    off() {
        this.active = false;
        this.map.entities.sendNeighbours(this, new Messages.SwapSprite(this.id, 0));
    }
}

export default Trap;
