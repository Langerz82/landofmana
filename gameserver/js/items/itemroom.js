import BaseItem from './baseitem.js';

class ItemRoom extends BaseItem {
    // NOTE: the original set `this.slot = -1` BEFORE calling `_super(arr)`, which
    // was legal under the old prototype-based Class.extend pattern (the instance
    // already existed at that point). Native ES6 classes forbid touching `this`
    // before `super()` runs, so the super call is made first and `this.slot` is
    // set right after — BaseItem's constructor never reads `this.slot`, so this
    // reordering has no observable effect on behavior.
    constructor(arr) {
        super(arr);
        this.slot = -1;
    }

    toRedis() {
        return this.toArray().join(",");
    }

    toArray() {
        const cols = [parseInt(this.slot)].concat(super.toArray());
        return cols;
    }

    toArrayNoSlot() {
        const arr = this.toArray();
        arr.shift();
        return arr;
    }
}

export default ItemRoom;
