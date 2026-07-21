import EntityMoving from './entitymoving/entitymoving.js';
import Messages from '../message.js';
import { Types } from '../common.js';

// FIX/DEAD CODE: this file, entity/trapgroup.js, and area/traparea.js make up
// the trap-damage subsystem, and none of the three is ever instantiated
// anywhere in the codebase (map/mapmanager.js -- the only place that would
// wire one up -- explicitly imports neither TrapArea nor TrapGroup; see the
// NOTE there). On top of being unwired, on()/off() below construct
// `new Messages.SwapSprite(...)`, which is commented out in message.js and
// does not exist as a real export -- so even if something did instantiate a
// Trap and call on()/off(), it would throw immediately. Guarded below so
// that failure mode is a clear console warning instead of a crash, but this
// whole subsystem should be treated as not-implemented until: (1) something
// actually wires TrapArea into mapmanager.js, and (2) Messages.SwapSprite is
// implemented for real.
//
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

    // FIX: Messages.SwapSprite is commented out in message.js (it's not a
    // real export), so `new Messages.SwapSprite(...)` used to throw
    // "Messages.SwapSprite is not a constructor" at runtime unconditionally.
    // Guarded so an accidental call (this subsystem is currently unwired,
    // see the file-level NOTE above) fails safely with a clear warning
    // instead of an opaque crash.
    on() {
        this.active = true;
        if (typeof Messages.SwapSprite !== 'function') {
            console.warn(
                'Trap.on() - Messages.SwapSprite is not implemented; skipping sendNeighbours.'
            );
            return;
        }
        this.map.entities.sendNeighbours(
            this,
            new Messages.SwapSprite(this.id, 1)
        );
    }

    off() {
        this.active = false;
        if (typeof Messages.SwapSprite !== 'function') {
            console.warn(
                'Trap.off() - Messages.SwapSprite is not implemented; skipping sendNeighbours.'
            );
            return;
        }
        this.map.entities.sendNeighbours(
            this,
            new Messages.SwapSprite(this.id, 0)
        );
    }
}

export default Trap;
