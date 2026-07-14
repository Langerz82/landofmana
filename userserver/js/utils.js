import sanitizer from 'sanitizer';

const Utils = {};

// ---------------------------------------------------------------------------
// Utils.* API, alphabetical by name. Kept in this exact order in
// gameserver/js/utils.js, userserver/js/utils.js and client/js/utils.js so
// the three copies line up function-for-function and are easy to diff.
// Native prototype extensions and other non-Utils module-local helpers are
// grouped separately, below this block.
//
// NOTE: unlike gameserver/js/utils.js, this file has no G_TILESIZE constant
// anywhere (userserver is an account/lobby server with no world-grid
// concept), so Utils.fixGridPosition() isn't ported here. Utils.getLockDelay()
// is also gameserver-only -- it's tied to real-time world-tick lag
// compensation, which doesn't apply here either.
// ---------------------------------------------------------------------------

// FIX: was a `Array.prototype.parseInt` monkey-patch (`function(){ return
// this.map(...) }`) with a separate `Utils.ArrayParseInt` that just did
// `this.map(...)` too -- called the normal way, as `Utils.ArrayParseInt(arr)`,
// `this` is `Utils` (which has no `.map`), so it would throw immediately. The
// monkey-patch was the only way this ever actually worked, and had zero call
// sites in this codebase. Replaced with the same fixed, non-mutating-prototype
// version already in use in gameserver/js/utils.js and client/js/utils.js:
// takes the array explicitly instead of relying on `this`.
Utils.ArrayParseInt = function (arr) {
  return arr.map(function (x) {
    return parseInt(x, 10);
  });
}

Utils.arraysEqual = function (a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

Utils.array_values = function (input) {
	const tmp_arr = [];
	let key = '';
	for (key in input) tmp_arr[tmp_arr.length] = input[key];
	return tmp_arr;
}

Utils.Base64ToBinArray = function (base64, limit) {
  const data = base64.toString('binary');
  const arr = data.split(",");
  const uint8array = new Uint8Array(arr.length*32);
  for (let i=0; i < arr.length; ++i)
  {
    const dec = parseInt(arr[i]);
    const bin = dec.toString(2);
    const l = bin.length;
    const index = (i+1)*32-l;
    for (let j=0; j < l; ++j)
      uint8array[index+j] = bin[j];
  }
  return uint8array.slice(0,limit);
}

Utils.BinArrayToBase64 = function (uint8array) {
  const len = Math.ceil(uint8array.length / 32);
  const tarr = [];
  for (let i=0; i < len; i++) {
    const num = uint8array.slice((i*32),(i*32)+32).join('');
    tarr.push(parseInt(num, 2));
  }
  const base64 = tarr.toString('base64');
  return base64;
}

Utils.btoa = function (val) {
  return Buffer.from(val, 'base64').toString('utf8');
}

Utils.ceilGrid = function (val) {
    return ~~(val+0.5);
};
// FIX: Number.prototype.ceilGrid was a built-in monkey-patch duplicating
// Utils.ceilGrid above, with zero call sites in this codebase (same issue
// already fixed in gameserver/js/utils.js) -- removed as dead code.

Utils.ceilTo = function (val, nearest) {
  return Math.ceil(val / nearest) * nearest;
}

Utils.checkInputName = function(name) {
    if(name === null) return false;
    else if(name === '') return false;
    else if(name === ' ') return false;

    for(let i=0; i < name.length; i++) {
        const c = name.charCodeAt(i);

        if(!((0xAC00 <= c && c <= 0xD7A3) || (0x3131 <= c && c <= 0x318E)       // Korean (Unicode blocks "Hangul Syllables" and "Hangul Compatibility Jamo")
            || (0x61 <= c && c <= 0x7A) || (0x41 <= c && c <= 0x5A)             // English (lowercase and uppercase)
            || (0x30 <= c && c <= 0x39)                                         // Numbers
          )) {
            return false;
        }
    }
    return true;
}

Utils.clamp = function(min, max, value) {
    if(value < min) {
        return min;
    } else if(value > max) {
        return max;
    } else {
        return value;
    }
};

Utils.copy2DArray = function (arr) {
  let copy = [];
  for (let i = 0; i < arr.length; i++) {
    copy.push(arr[i].slice()); // .slice() creates a copy of the inner array
  }
  return copy;
};

Utils.distanceTo = function(x, y, x2, y2) {
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);

    return (distX > distY) ? distX : distY;
};

Utils.floorTo = function (val, nearest) {
  return Math.floor(val / nearest) * nearest;
}

Utils.floorToGrid = function (num, nth) {
    return Math.floor(num / nth) * nth;
};

Utils.forEach = function (obj, fn) {
  const prop = null;
  for (const key in obj) {
    if (obj.hasOwnProperty(key))
    {
      if (obj[key] && fn && fn(obj[key], key))
        return true;
    }
  }
  return false;
}

Utils.getGridPosition = function (x, y) {
  return {gx: x >> 4, gy: y >> 4};
}

Utils.GetGroupCountArray = function (groupArray, field) {
  const group = groupBy(groupArray, field);
  const array = [];
  for (let rec in group)
  {
    array.push([rec, group[rec].length]);
  }
  console.info(JSON.stringify(array));
  array.sort(function (a,b) { return a[1] - b[1]; })
  return array;
}

// SYNC: brought over from gameserver/js/utils.js (already fixed there).
// `fixed == null` catches both an omitted argument (undefined) and an
// explicit null, so the intended default of 2 decimal places actually
// applies when a caller just omits the argument.
Utils.getNumShortHand = function (val, fixed) {
  if (fixed == null)
    fixed = 2;

  if (val <= 1000)
    return val;
  if (val <= 1000000)
    return (val/1000).toFixed(fixed)+"K";
  if (val <= 1000000000)
    return (val/1000000).toFixed(fixed)+"M";
  if (val <= 1000000000000)
    return (val/1000000000).toFixed(fixed)+"B";
  else
    return (val/1000000000000).toFixed(fixed)+"T";
}

// FIX: was comparing against hardcoded numbers (1/2/3/4) that don't match
// Types.Orientations' actual UP/DOWN/LEFT/RIGHT values -- Utils.randomOrientation()
// below (and the already-fixed version of this same function in
// gameserver/js/utils.js) compares against the real enum members instead of
// guessing their numeric values. Brought in line with the fixed gameserver
// version.
Utils.getOrientationString = function(r) {
    let o = "NONE";

    if(r === Types.Orientations.UP)
        o = "UP";
    else if(r === Types.Orientations.DOWN)
        o = "DOWN";
    else if(r === Types.Orientations.LEFT)
        o = "LEFT";
    else if(r === Types.Orientations.RIGHT)
        o = "RIGHT";

    //console.info("orientation: " + o);
    return o;
};

Utils.getPositionFromGrid = function (gx, gy) {
  return {x: gx << 4, y: gy << 4};
}

/**
 * Resolves a dot-notation string path to a value within an object.
 * @param {Object} obj - The source object.
 * @param {string} path - The dot-separated string (e.g., 'a.b.c').
 * @returns {*} - The value found at the path, or undefined if not found.
 */
Utils.getValueByPath = function (obj, path) {
  if (path.indexOf('.') < 0)
    return obj[path];
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

Utils.isBetween = function (num, a, b) {
    return num >= Math.min(a, b) && num <= Math.max(a, b);
};

Utils.manhattenDistance = function (pos1, pos2) {
	return Math.abs(pos1.x-pos2.x) + Math.abs(pos1.y-pos2.y);
};

Utils.max = function (array, colIndex) {
	return Math.max.apply(Math, array.map(function (v) { return v[colIndex]; }));
}

Utils.maxProp = function (arr, prop) {
  return arr.reduce(function(prev, curr) {
    return prev[prop] > curr[prop] ? prev : curr;
  });
}

Utils.min = function (array, colIndex) {
	return Math.min.apply(Math, array.map(function (v) { return v[colIndex]; }));
}

Utils.minProp = function (arr, prop) {
  return arr.reduce(function(prev, curr) {
    return prev[prop] < curr[prop] ? prev : curr;
  });
}

Utils.Mixin = function(target, source) {
    if (source) {
        for (let key, keys = Object.keys(source), l = keys.length; l--; ) {
            key = keys[l];

            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
};

Utils.NaN2Zero = function(num){
    if(isNaN(num*1)){
        return 0;
    } else{
        return num*1;
    }
};

// SYNC: brought over from gameserver/js/utils.js.
Utils.objectToArray = function (object) {
  const arr = [];
  for (const key in object) {
    const obj = object[key];
    if (obj)
      arr.push(obj);
  }
  return arr;
}

Utils.pad = function (val, size) {
    let s = val+"";
    while (s.length < size) s = "0" + s;
    return s;
}

// SYNC: brought over from gameserver/js/utils.js (already fixed there) --
// same `== null` vs `=== null` reasoning as getNumShortHand() above.
Utils.Percent = function (val, fixed) {
  if (fixed == null)
    fixed = 0;

  return Number(val * 100).toFixed(fixed) + "%";
}

Utils.percentToBool = function(percent){
    if(Math.random() < percent*0.01){
        return true;
    } else{
        return false;
    }
};

Utils.random = function(range) {
    return Math.floor(Math.random() * range);
};

Utils.randomInt = function(val) {
    return Math.floor(Math.random() * (val+1));
};

Utils.randomOrientation = function() {
    let o;
    const r = Utils.random(4);

    if(r === 0)
        o = Types.Orientations.LEFT;
    if(r === 1)
        o = Types.Orientations.RIGHT;
    if(r === 2)
        o = Types.Orientations.UP;
    if(r === 3)
        o = Types.Orientations.DOWN;
    //console.info("orientation: " + o);
    return o;
};

Utils.randomPositionNextTo = function (entity) {
    let a = entity.x, b = entity.y;
    const r = Utils.random(4);

    if(r === 0)
        --a;
    if(r === 1)
        ++a;
    if(r === 2)
        --b;
    if(r === 3)
        ++b;

    return {"x": a, "y": b};
}

Utils.randomRange = function(min, max) {
    return min + (Math.random() * (max - min));
};

Utils.randomRangeInt = function(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
};

Utils.ratioToBool = function(ratio){
    if(Math.random() < ratio){
        return true;
    } else{
        return false;
    }
};

Utils.realDistance = function (p1, p2) {
	return ~~(Math.pow( Math.pow(p2[0]-p1[0],2) + Math.pow(p2[1]-p1[1],2), 0.5) );
};

// SYNC: brought over from client/js/utils.js -- convenience wrapper around
// realDistance() for the common case of two entity-like objects with x/y
// properties, instead of every caller building [x,y] pairs by hand.
Utils.realDistanceXY = function (e1, e2) {
  return Utils.realDistance([e1.x, e1.y], [e2.x, e2.y]);
}

Utils.removeDoubleQuotes = function (val) {
	return val.toString().replace(/^"(.+(?="$))"$/,'$1');
}

// SYNC/FIX: the old `Array.prototype.removeVal` monkey-patch here did
// `this.splice(this.indexOf(val), 1)` unconditionally. When `val` isn't in
// the array, indexOf returns -1, and splice(-1, 1) doesn't no-op -- it
// removes the LAST element of the array (same bug already fixed in
// gameserver/js/utils.js, where it had real callers). This file had zero
// call sites for `.removeVal()`, so the buggy prototype patch is removed
// outright and replaced with the same fixed, named helper used in
// gameserver/js/utils.js.
Utils.removeFromArray = function (arr, element) {
    const index = arr.indexOf(element);
    if (index >= 0)
      arr.splice(index, 1);
}

// SYNC: brought over from client/js/utils.js -- generic wrap-around index
// helper (e.g. cycling through a list of N items).
Utils.rotateNum = function (num, mod, length) {
  return (num + mod + length) % length;
};

Utils.roundTo = function (val, nearest) {
  return Math.round(val / nearest) * nearest;
}

Utils.sanitize = function(string) {
    // Strip unsafe tags, then escape as html entities.
    return sanitizer.escape(sanitizer.sanitize(string));
};

Utils.setEquipmentBonus = function(kind) {
	if (ItemTypes.isWeapon(kind) || ItemTypes.isArcherWeapon(kind) ||
	    ItemTypes.isArmor(kind))
	{
	    const probability = Utils.random(1024);
	    let bonus = 0;
	    for (let i = 1; i <= 1024; i *= 2)
	    {
		if (probability < i)
		{
		    return Math.max(10 - bonus, 1);
		}
		++bonus;
	    }
	}
	return 1;
}

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
}

Utils.Sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// SYNC: brought over from gameserver/js/utils.js.
Utils.SwapElements = function (arr, i1, i2) {
  [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
}

Utils.trueFalse = function(bool){
    return bool === "true" ? true : false;
}

Utils.utilSleep = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

Utils.validateIndex = function(index, max) {
  const idx = parseInt(index, 10);
  return Number.isInteger(idx) && idx >= 0 && idx < max;
};

Utils.validatePositiveNumber = function(num) {
  const n = parseInt(num, 10);
  return Number.isInteger(n) && n > 0;
};

// ---------------------------------------------------------------------------
// Native prototype extensions and module-local helpers (not part of the
// Utils.* namespace, so not part of the alphabetical ordering above).
// ---------------------------------------------------------------------------

if (!Array.prototype.last) {
  Object.defineProperty(Array.prototype, 'last', {
      value: function(){ return this[this.length - 1]; }
  });
}

if (!String.prototype.reverse) {
  String.prototype.reverse = function () {
    return this.split("").reverse().join("");
  }
}

const groupBy = function(xs, key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

export default Utils;
