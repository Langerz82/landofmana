// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */

export default class Achievement {
    constructor(arr) {
       this.update(arr);
    }

    update(arr) {
      // FIX: parseInt() was an Array.prototype monkey-patch that has been
      // removed from utils.js; migrated to Utils.ArrayParseInt().
      // FIX (var cleanup): this was `var arr = ...`, re-declaring the `arr` parameter with var
      // (legal, since var redeclaration is a no-op reassignment) - converting it to `let`/`const`
      // instead would throw a SyntaxError (redeclaring a parameter with let/const is illegal).
      // Since `arr` is already in scope as the parameter, this is just a reassignment.
      arr = Utils.ArrayParseInt(arr);

      this.index = arr[0];
      this.type = arr[1];
      this.rank = arr[2] || 0;
      this.objectType = arr[3] || 0;
      this.objectKind = arr[4] || 0;
      this.count = arr[5] || 0;
      this.objectCount = arr[6] || 0;
      const objectCount = Utils.getNumShortHand(this.objectCount, 0);
      this.summary = lang.data["ACHIEVEMENTS_"+this.index].format(objectCount);
    }
}
