import Types from './gametypes.js';
import ItemTypes from './itemtypes.js';

const Utils = {};

// ---------------------------------------------------------------------------
// Utils.* API, alphabetical by name. Kept in this exact order in
// gameserver/js/utils.js, userserver/js/utils.js and client/js/utils.js so
// the three copies line up function-for-function and are easy to diff.
// Native prototype extensions and other non-Utils module-local helpers are
// grouped separately, below this block.
// ---------------------------------------------------------------------------

// FIX: this was written as `function () { return this.map(...) }`, meant to
// be used as an Array.prototype method (Array.prototype.parseInt has since
// been removed from this file). Called as a plain `Utils.ArrayParseInt()`,
// `this` is `Utils` (which has no `.map`), so it would throw immediately.
// Takes the array explicitly now; all former `.parseInt()` call sites across
// gameserver/js have been migrated to `Utils.ArrayParseInt(arr)`.
Utils.ArrayParseInt = function (arr) {
    return arr.map(function (x) {
        return parseInt(x, 10);
    });
};

Utils.arraysEqual = function (a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.length != b.length) return false;

    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

// NOTE: was `const tmp_arr = [], key = '';` -- the outer `key` is unused/dead
// (the `for (const key in input)` loop below declares its own `key`, scoped
// to the loop, which shadows it; nothing ever reads the outer one). Same
// dead-variable pattern already cleaned up elsewhere in this codebase.
Utils.array_values = function (input) {
    const tmp_arr = [];
    for (const key in input) tmp_arr[tmp_arr.length] = input[key];
    return tmp_arr;
};

// REWORK: was a comma-joined string of 32-bit decimal chunk values (see the
// removed NOTE on BinArrayToBase64() below for how mislabeled that format
// was). Every element of the `looks`/`looks2` appearance array is only ever
// 0 or 1 (see userhandler.js, worldhandler.js, appearancedialog.js,
// databaselogic.js's beginner-look defaults), so the old scheme spent up to
// 10 decimal digits + a comma (11 chars) encoding just 32 bits of real
// information. This now reverses BinArrayToBase64() below via the
// base64ToPackedBytes() module-local helper (see below) to unpack real
// base64 back into one bit per array element, roughly halving the
// stored/wire length for the same data.
// Trailing `=` padding is tolerated but not required (see BinArrayToBase64).
// NOTE: this does NOT understand data written by the old format -- use
// Utils.LegacyBase64ToBinArray() below for that (migration only).
Utils.Base64ToBinArray = function (base64, limit) {
    const packed = base64ToPackedBytes(base64);
    const bitLength = limit == null ? packed.length * 8 : limit;
    const uint8array = new Uint8Array(bitLength);
    for (let i = 0; i < bitLength; i++) {
        uint8array[i] = (packed[i >> 3] >> (i & 7)) & 1;
    }
    return uint8array;
};

// REWORK: despite the name, this used to produce something that was NOT real
// base64 -- `tarr.toString('base64')` was actually Array.prototype.toString,
// which ignores its argument and just comma-joins `tarr` into 32-bit decimal
// chunks. Every element of `uint8array` here is only ever 0 or 1 (a boolean
// flag, one per appearance item -- see the FIX note on Base64ToBinArray
// above), so packing 8 flags per byte and base64-encoding the resulting
// bytes (via the module-local packedBytesToBase64() helper below) is both
// real base64 and shorter than the old comma-joined format for the same
// data (roughly 6 bits of payload per output character instead of ~2.9).
// Padding is omitted since Base64ToBinArray() always knows the exact bit
// length to decode back out (the `limit` callers already pass, e.g.
// AppearanceData.Data.length), so trailing `=` characters would only add
// length without adding information.
Utils.BinArrayToBase64 = function (uint8array) {
    const byteLen = Math.ceil(uint8array.length / 8);
    const packed = new Uint8Array(byteLen);
    for (let i = 0; i < uint8array.length; i++) {
        if (uint8array[i]) packed[i >> 3] |= 1 << (i & 7);
    }
    return packedBytesToBase64(packed);
};

// MIGRATION-ONLY: these two are the original (pre-rework) implementations
// of Base64ToBinArray()/BinArrayToBase64() above, kept under new names
// purely so existing values already sitting in Redis under the old u:<username>
// "looks2" field -- written with the old comma-joined-32-bit-decimal-chunk
// format -- can be read back correctly and re-saved through the new packed
// codec, under the new "looks_b64" field. See
// userserver/js/database/redis/migration.js's migrateLooksToBase64(), the
// one caller of these two. Nothing else in live game code should call
// them. Deliberately placed here (next to the codec they're a legacy
// counterpart to) rather than in alphabetical order, and safe to delete
// once migrateLooksToBase64() has run against every environment's Redis
// (it's idempotent and safe to leave in indefinitely -- see its own
// comment -- so there's no rush).
Utils.LegacyBase64ToBinArray = function (base64, limit) {
    const data = base64.toString('binary');
    const arr = data.split(',');
    const uint8array = new Uint8Array(arr.length * 32);
    for (let i = 0; i < arr.length; ++i) {
        const dec = parseInt(arr[i]);
        const bin = dec.toString(2);
        const l = bin.length;
        const index = (i + 1) * 32 - l;
        for (let j = 0; j < l; ++j) uint8array[index + j] = bin[j];
    }
    return uint8array.slice(0, limit);
};

Utils.LegacyBinArrayToBase64 = function (uint8array) {
    const len = Math.ceil(uint8array.length / 32);
    const tarr = [];
    for (let i = 0; i < len; i++) {
        const num = uint8array.slice(i * 32, i * 32 + 32).join('');
        tarr.push(parseInt(num, 2));
    }
    return tarr.toString();
};

Utils.btoa = function (val) {
    return Buffer.from(val, 'base64').toString('utf8');
};

Utils.ceilGrid = function (val) {
    return ~~(val + 0.5);
};
// FIX: Number.prototype.ceilGrid was another built-in monkey-patch, and had
// zero call sites anywhere in the codebase (Utils.ceilGrid above is the only
// one actually used) -- removed as dead code.

Utils.ceilTo = function (val, nearest) {
    return Math.ceil(val / nearest) * nearest;
};

Utils.checkInputName = function (name) {
    if (name === null) return false;
    else if (name === '') return false;
    else if (name === ' ') return false;

    for (let i = 0; i < name.length; i++) {
        const c = name.charCodeAt(i);

        if (!(
            (0xac00 <= c && c <= 0xd7a3) ||
            (0x3131 <= c && c <= 0x318e) || // Korean (Unicode blocks "Hangul Syllables" and "Hangul Compatibility Jamo")
            (0x61 <= c && c <= 0x7a) ||
            (0x41 <= c && c <= 0x5a) || // English (lowercase and uppercase)
            (0x30 <= c && c <= 0x39) // Numbers
            //|| (c === 0x20) || (c === 0x5f)                                       // Space and underscore
            //|| (c === 0x28) || (c === 0x29)                                       // Parentheses
            //|| (c === 0x5e)
        )) {
            // Caret
            return false;
        }
    }
    return true;
};

Utils.clamp = function (min, max, value) {
    return Math.max(min, Math.min(max, value));
};

Utils.copy2DArray = function (arr) {
    let copy = [];
    for (let i = 0; i < arr.length; i++) {
        copy.push(arr[i].slice()); // .slice() creates a copy of the inner array
    }
    return copy;
};

Utils.distanceTo = function (x, y, x2, y2) {
    //console.info("x="+x+",y="+y+",x2="+x2+",y2="+y2);
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);

    return distX > distY ? distX : distY;
};

Utils.fixGridPosition = function (gridSize, x, y) {
    return {
        x: (Math.floor(x / gridSize) + 0.5) * gridSize,
        y: (Math.floor(y / gridSize) + 0.5) * gridSize
    };
};

Utils.floorTo = function (val, nearest) {
    return Math.floor(val / nearest) * nearest;
};

Utils.floorToGrid = function (num, nth) {
    return Math.floor(num / nth) * nth;
};

// NOTE: was `const prop = null;` here, unused -- dead (same pattern already
// cleaned up in several other files across this codebase). Also worth
// knowing: `if (obj[key] && fn && ...)` skips any entry whose *value* is
// falsy (0, "", false, null, undefined) without ever calling `fn` for it --
// every current call site in gameserver/js happens to iterate objects/maps
// of always-truthy values (Map/Player/entity instances, etc.), so this
// hasn't been an observed problem, but it's a real footgun for a generic
// "for each key/value" helper if it's ever used to iterate something that
// can legitimately hold e.g. a 0. Left as-is since changing it is a
// behavior change with call sites outside gameserver/js (userserver,
// client) this review didn't have visibility into.
Utils.forEach = function (obj, fn) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (obj[key] && fn && fn(obj[key], key)) return true;
        }
    }
    return false;
};

Utils.getGridPosition = function (x, y) {
    return { gx: x >> 4, gy: y >> 4 };
};

Utils.GetGroupCountArray = function (groupArray, field) {
    const group = groupBy(groupArray, field);
    const array = [];
    for (const rec in group) {
        array.push([rec, group[rec].length]);
    }
    // FIX: unconditional console.info of the built array, on gameserver's
    // only call site (entityquests.js's getMobObject(), a per-NPC-dialogue
    // dynamic-quest lookup already gated behind G_DEBUG at the call site --
    // this internal log wasn't, so it kept firing regardless). This file is
    // shared across gameserver/userserver/client, none of which guarantee a
    // G_DEBUG global is available here, and the log has no effect on the
    // returned value -- pure debug residue. Removed rather than gated.
    array.sort(function (a, b) {
        return a[1] - b[1];
    });
    return array;
};

Utils.getLockDelay = function (time) {
    //var delay=(G_LATENCY)-Math.max((Date.now()-time),0);
    //return Utils.clamp(0,G_LATENCY,delay);
    return 0;
};

// FIX: was `fixed === null` -- omitting the second argument entirely (the
// normal way to ask for the default) passes `undefined`, not `null`, so the
// intended default of 2 decimal places never actually applied unless a
// caller explicitly passed `null`. toFixed(undefined) still "works" (it
// defaults to 0 digits per spec), so this silently rounded to whole numbers
// instead of 2 decimals for any caller that just omitted the argument.
// `== null` catches both null and undefined.
Utils.getNumShortHand = function (val, fixed) {
    if (fixed == null) fixed = 2;

    if (val <= 1000) return val;
    if (val <= 1000000) return (val / 1000).toFixed(fixed) + 'K';
    if (val <= 1000000000) return (val / 1000000).toFixed(fixed) + 'M';
    if (val <= 1000000000000) return (val / 1000000000).toFixed(fixed) + 'B';
    else return (val / 1000000000000).toFixed(fixed) + 'T';
};

// FIX: this used hardcoded numbers (1/2/3/4) that don't match
// Types.Orientations' actual UP/DOWN/LEFT/RIGHT values -- Utils.randomOrientation()
// below (and everywhere else that reads Types.Orientations.*, e.g.
// entitymoving.js/updater.js) compares against the real enum members
// instead of guessing their numeric values. The only caller of this function
// is a debug console.info in callbacks/playercallback.js, so this only ever
// printed the wrong direction name in a log line -- but comparing against
// Types.Orientations.* directly makes it correct regardless of what those
// values actually are, instead of silently drifting out of sync again.
Utils.getOrientationString = function (r) {
    let o = 'NONE';

    if (r === Types.Orientations.UP) o = 'UP';
    else if (r === Types.Orientations.DOWN) o = 'DOWN';
    else if (r === Types.Orientations.LEFT) o = 'LEFT';
    else if (r === Types.Orientations.RIGHT) o = 'RIGHT';

    //console.info("orientation: " + o);
    return o;
};

Utils.getPositionFromGrid = function (gx, gy) {
    return { x: gx << 4, y: gy << 4 };
};

/**
 * Resolves a dot-notation string path to a value within an object.
 * @param {Object} obj - The source object.
 * @param {string} path - The dot-separated string (e.g., 'a.b.c').
 * @returns {*} - The value found at the path, or undefined if not found.
 */
Utils.getValueByPath = function (obj, path) {
    if (path.indexOf('.') < 0) return obj[path];
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

Utils.isBetween = function (num, a, b) {
    return num >= Math.min(a, b) && num <= Math.max(a, b);
};

Utils.manhattenDistance = function (pos1, pos2) {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
};

Utils.max = function (array, colIndex) {
    return Math.max.apply(
        Math,
        array.map(function (v) {
            return v[colIndex];
        })
    );
};

Utils.maxProp = function (arr, prop) {
    return arr.reduce(function (prev, curr) {
        return prev[prop] > curr[prop] ? prev : curr;
    });
};

Utils.min = function (array, colIndex) {
    return Math.min.apply(
        Math,
        array.map(function (v) {
            return v[colIndex];
        })
    );
};

Utils.minProp = function (arr, prop) {
    return arr.reduce(function (prev, curr) {
        return prev[prop] < curr[prop] ? prev : curr;
    });
};

Utils.Mixin = function (target, source) {
    if (source) {
        for (let key, keys = Object.keys(source), l = keys.length; l--;) {
            key = keys[l];

            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
};

Utils.NaN2Zero = function (num) {
    if (isNaN(num * 1)) {
        return 0;
    } else {
        return num * 1;
    }
};

// FIX: was `if (obj) arr.push(obj);` -- the same "skips falsy values"
// footgun documented on Utils.forEach() above. That silently dropped any
// entry whose *value* was falsy (0, "", false, null), not just missing
// keys, so e.g. an object with a legitimately-0 value lost that entry
// entirely instead of getting a 0 in the result. Now includes every own
// enumerable value regardless of truthiness.
Utils.objectToArray = function (object) {
    const arr = [];
    for (const key in object) {
        if (object.hasOwnProperty(key)) arr.push(object[key]);
    }
    return arr;
};

Utils.pad = function (val, size) {
    let s = val + '';
    while (s.length < size) s = '0' + s;
    return s;
};

// FIX: same `=== null` vs `== null` issue as getNumShortHand() above --
// omitting `fixed` passes `undefined`, which `=== null` doesn't catch, so
// the intended default silently never applied for a caller that just
// omitted the argument.
Utils.Percent = function (val, fixed) {
    if (fixed == null) fixed = 0;

    return Number(val * 100).toFixed(fixed) + '%';
};

// FIX: simplified the `if (...) return true; else return false;` shape to
// a direct boolean return -- same pattern as trueFalse() above, no
// behavior change.
Utils.percentToBool = function (percent) {
    return Math.random() < percent * 0.01;
};

Utils.random = function (range) {
    return Math.floor(Math.random() * range);
};

Utils.randomInt = (max) => Math.floor(Math.random() * (max + 1));

Utils.randomOrientation = function () {
    let o,
        r = Utils.random(4);

    if (r === 0) o = Types.Orientations.LEFT;
    if (r === 1) o = Types.Orientations.RIGHT;
    if (r === 2) o = Types.Orientations.UP;
    if (r === 3) o = Types.Orientations.DOWN;
    //console.info("orientation: " + o);
    return o;
};

Utils.randomPositionNextTo = function (entity) {
    let a = entity.x,
        b = entity.y,
        r = Utils.random(4);

    if (r === 0) --a;
    if (r === 1) ++a;
    if (r === 2) --b;
    if (r === 3) ++b;

    return { x: a, y: b };
};

Utils.randomRange = function (min, max) {
    return min + Math.random() * (max - min);
};

Utils.randomRangeInt = (min, max) =>
    min + Math.floor(Math.random() * (max - min + 1));

Utils.ratioToBool = function (ratio) {
    return Math.random() < ratio;
};

Utils.realDistance = function (p1, p2) {
    return ~~Math.pow(
        Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2),
        0.5
    );
};

// SYNC: brought over from client/js/utils.js -- convenience wrapper around
// realDistance() for the common case of two entity-like objects with x/y
// properties, instead of every caller building [x,y] pairs by hand.
Utils.realDistanceXY = function (e1, e2) {
    return Utils.realDistance([e1.x, e1.y], [e2.x, e2.y]);
};

Utils.removeDoubleQuotes = function (val) {
    return val.toString().replace(/^"(.+(?="$))"$/, '$1');
};

// FIX: Array.prototype.removeVal was a built-in monkey-patch (same fragility
// concern as ArrayParseInt above). This named, non-mutating-prototype
// equivalent has the same indexOf-guarded no-op-when-absent semantics, and
// every caller in the codebase (worldserver.js, packethandler.js,
// playergroup.js, partymanager.js, playerquests.js) has been migrated to it;
// the prototype patch has been removed.
Utils.removeFromArray = function (arr, element) {
    const index = arr.indexOf(element);
    if (index >= 0) arr.splice(index, 1);
};

// SYNC: brought over from client/js/utils.js -- generic wrap-around index
// helper (e.g. cycling through a list of N items).
Utils.rotateNum = function (num, mod, length) {
    return (num + mod + length) % length;
};

Utils.roundTo = function (val, nearest) {
    return Math.round(val / nearest) * nearest;
};

Utils.setEquipmentBonus = function (kind) {
    if (
        ItemTypes.isWeapon(kind) ||
        ItemTypes.isArcherWeapon(kind) ||
        ItemTypes.isArmor(kind)
    ) {
        const probability = Utils.random(1024);
        let bonus = 0;
        for (let i = 1; i <= 1024; i *= 2) {
            if (probability < i) {
                return Math.max(10 - bonus, 1);
            }
            ++bonus;
        }
    }
    return 1;
};

/**
 * Sets a value inside an object at the specified dot-notated path.
 * @param {Object} obj - The target object.
 * @param {string} path - The dot-separated string path.
 * @param {*} value - The value to set.
 * @returns {Object} - The modified object.
 */
Utils.setValueByPath = function (obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();

    // Traverse to the second-to-last object
    const lastObj = keys.reduce((acc, key) => {
        // If the next level doesn't exist, create an empty object
        if (!acc[key] || typeof acc[key] !== 'object') {
            acc[key] = {};
        }
        return acc[key];
    }, obj);

    // Set the final value
    lastObj[lastKey] = value;
    return obj;
};

Utils.Sleep = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

Utils.SwapElements = function (arr, i1, i2) {
    [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
};

// FIX: simplified `return bool === 'true' ? true : false;` to the
// equivalent `return bool === 'true';` -- the ternary was redundant, no
// behavior change.
Utils.trueFalse = function (bool) {
    return bool === 'true';
};

Utils.utilSleep = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

Utils.validateIndex = function (index, max) {
    const idx = parseInt(index, 10);
    return Number.isInteger(idx) && idx >= 0 && idx < max;
};

Utils.validatePositiveNumber = function (num) {
    const n = parseInt(num, 10);
    return Number.isInteger(n) && n > 0;
};

// ---------------------------------------------------------------------------
// Native prototype extensions and module-local helpers (not part of the
// Utils.* namespace, so not part of the alphabetical ordering above).
// ---------------------------------------------------------------------------

if (!Array.prototype.last) {
    Object.defineProperty(Array.prototype, 'last', {
        value: function () {
            return this[this.length - 1];
        }
    });
}

if (!String.prototype.reverse) {
    String.prototype.reverse = function () {
        return this.split('').reverse().join('');
    };
}

const groupBy = function (xs, key) {
    return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
};

// Plain-ASCII, dependency-free base64 alphabet/codec used by
// Utils.BinArrayToBase64()/Utils.Base64ToBinArray() above. Written by hand
// instead of relying on Buffer (Node-only) or the newer
// Uint8Array.prototype.toBase64()/fromBase64() methods, since this file is
// shared verbatim across gameserver/userserver (Node) and client (an older
// bundled NW.js/Chromium runtime) -- this keeps identical behavior
// everywhere without depending on a specific engine's base64 support.
const BASE64_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = (function () {
    const lookup = {};
    for (let i = 0; i < BASE64_CHARS.length; i++) lookup[BASE64_CHARS[i]] = i;
    return lookup;
})();

// Encodes a byte array as an unpadded base64 string (standard alphabet, no
// trailing `=`), 3 bytes -> 4 chars at a time.
const packedBytesToBase64 = function (bytes) {
    let base64 = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

        base64 += BASE64_CHARS[b0 >> 2];
        base64 +=
            BASE64_CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
        base64 +=
            b1 === undefined
                ? ''
                : BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
        base64 += b2 === undefined ? '' : BASE64_CHARS[b2 & 0x3f];
    }
    return base64;
};

// Reverses packedBytesToBase64() above -- decodes a base64 string (padded or
// not; any trailing `=` is stripped and ignored) back into a byte array.
// Any leftover < 8 bits at the end (padding bits from the final base64
// character) are discarded, same as they were never written.
const base64ToPackedBytes = function (base64) {
    const chars = base64.replace(/=+$/, '');
    const byteLen = Math.floor((chars.length * 6) / 8);
    const bytes = new Uint8Array(byteLen);

    let bitBuffer = 0,
        bitCount = 0,
        byteIndex = 0;
    for (let i = 0; i < chars.length; i++) {
        const val = BASE64_LOOKUP[chars[i]];
        if (val === undefined) continue; // ignore stray/invalid characters
        bitBuffer = (bitBuffer << 6) | val;
        bitCount += 6;
        if (bitCount >= 8) {
            bitCount -= 8;
            bytes[byteIndex++] = (bitBuffer >> bitCount) & 0xff;
        }
    }
    return bytes;
};

export default Utils;
