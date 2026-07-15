/*Function.prototype.bind = function (bind) {
    var self = this;
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return self.apply(bind || null, args);
    };
};*/

const Utils = {};

// ---------------------------------------------------------------------------
// Utils.* API, alphabetical by name. Kept in this exact order in
// gameserver/js/utils.js, userserver/js/utils.js and client/js/utils.js so
// the three copies line up function-for-function and are easy to diff.
// (This file also has some browser-only members -- DOM/animation-frame/URL/
// rendering specific, no server-side equivalent -- interleaved in their
// alphabetical position same as everything else.)
// Native prototype extensions and other non-Utils module-local helpers are
// grouped separately, below this block.
// ---------------------------------------------------------------------------

// FIX: this was written as `function () { return this.map(...) }`, meant to
// be used as an Array.prototype method (Array.prototype.parseInt has since
// been removed from this file). Called as a plain `Utils.ArrayParseInt()`,
// `this` is `Utils` (which has no `.map`), so it would throw immediately.
// Takes the array explicitly now; all former `.parseInt()` call sites across
// client/js have been migrated to `Utils.ArrayParseInt(arr)`. Same fixed
// shape as gameserver/js/utils.js and userserver/js/utils.js.
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
	const tmp_arr = [], key = '';
	for (const key in input) tmp_arr[tmp_arr.length] = input[key];
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

// NOTE: despite the name, this is NOT real base64. `tarr.toString('base64')` below is
// Array.prototype.toString, which ignores its argument and just comma-joins `tarr` - so the
// "base64" here is really a comma-separated string of 32-bit chunk values. It's internally
// consistent (Base64ToBinArray() above decodes this exact comma-joined format, and
// appearancedialog.js relies on that pairing to round-trip player appearance data), so it isn't
// broken - but don't "fix" it into real base64 without updating both ends and re-checking the
// wire format server-side.
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

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
// The `Number.prototype.ceilGrid` monkey-patch that used to live here (down
// in the native-prototype-extensions section) was dead code with zero call
// sites -- same issue already fixed in the other two copies of this file --
// removed in favor of this named function.
Utils.ceilGrid = function (val) {
    return ~~(val+0.5);
};

Utils.ceilTo = function (val, nearest) {
  return Math.ceil(val / nearest) * nearest;
}

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
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

Utils.clamp = (min, max, value) => Math.max(min, Math.min(max, value));

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

// FIX: XSS - no existing HTML-escaping helper was found in the codebase; added to sanitize server-supplied strings before inserting via .html()/.append()
Utils.escapeHtml = function (str) {
  if (str === null || typeof str === 'undefined')
    return str;
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

Utils.fixed = function(value, length) {
    const buffer = '00000000' + value;
    return buffer.substring(buffer.length - length);
}

Utils.fixGridPosition = function (x,y) {
  return {
    x: (Math.floor(x/G_TILESIZE)+0.5)*G_TILESIZE,
    y: (Math.floor(y/G_TILESIZE)+0.5)*G_TILESIZE,
  };
};

Utils.floorTo = function (val, nearest) {
  return Math.floor(val / nearest) * nearest;
}

Utils.floorToGrid = function (num, nth) {
    return Math.floor(num / nth) * nth;
};

// SYNC: brought over from gameserver/js/utils.js.
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

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
Utils.GetGroupCountArray = function (groupArray, field) {
  const group = groupBy(groupArray, field);
  const array = [];
  for (const rec in group)
  {
    array.push([rec, group[rec].length]);
  }
  console.info(JSON.stringify(array));
  array.sort(function (a,b) { return a[1] - b[1]; })
  return array;
}

Utils.getNumShortHand = function (val, fixed) {
  // FIX: an omitted argument is `undefined`, not `null` -- this guard never
  // caught the common "call with no fixed" case (see dialog/craftdialog.js
  // and dialog/storedialog.js price labels), so toFixed(undefined) defaulted
  // to 0 decimal places instead of the evidently-intended 2. Same fix
  // already applied in gameserver/js/utils.js and userserver/js/utils.js.
  if (fixed === null || fixed === undefined)
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

Utils.getOrientationFromPath = function (p1, p2) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];

    if (dy > 0)
      return 1;
    if (dy < 0)
      return 2;
    if (dx > 0)
      return 3;
    if (dx < 0)
      return 4;
    return 0;
}

// SYNC: brought over from gameserver/js/utils.js (already fixed there --
// compares against the real Types.Orientations.* enum members instead of
// guessing their numeric values, same fix already applied to
// userserver/js/utils.js). Uses the bare `Types` global the same way the
// rest of client/js already does -- js/globaltypes.js puts
// Types/ItemTypes/Utils on `window` before anything that calls this runs.
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

    return o;
};

Utils.getPositionFromGrid = function (gx, gy) {
  return {x: gx << 4, y: gy << 4};
}

Utils.getTime = function () {
  return Date.now();
}

// FIX: was using String.replace() purely for its side effect - the callback populated `vars`
// as a side effect while the actual return value of replace() (`parts`) was thrown away. That
// works, but it's a fragile way to "iterate" matches (easy to break under refactor, and the
// unused `parts`/discarded-return-value shape reads like a bug at a glance). Rewritten with
// matchAll() to make the iteration explicit; same signature and return shape as before.
Utils.getUrlVars = function() {
	//from http://snipplr.com/view/19838/get-url-parameters/
    const vars = {};
    for (const match of window.location.href.matchAll(/[?&]+([^=&]+)=([^&]*)/gi)) {
        vars[match[1]] = match[2];
    }
    return vars;
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

Utils.getWorldTime = function () {
  return WORLDTIME + (Date.now()-LOCALTIME);
};

Utils.isBetween = function (num, a, b) {
    return num >= Math.min(a, b) && num <= Math.max(a, b);
};

Utils.isInt = function(n) {
    return (n % 1) === 0;
};

Utils.manhattenDistance = function (pos1, pos2) {
	return Math.abs(pos1.x-pos2.x) + Math.abs(pos1.y-pos2.y);
};

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
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

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
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

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
Utils.NaN2Zero = function(num){
    if(isNaN(num*1)){
        return 0;
    } else{
        return num*1;
    }
};

Utils.objectToArray = function (object) {
  const arr = [];
  for (let key in object) {
    const obj = object[key];
    if (obj)
      arr.push(obj);
  }
  return arr;
}

Utils.padding = function (val, size) {
    let s = val+"";
    while (s.length < size) s = "0" + s;
    return s;
}

// FIX: same `=== null` vs `== null` issue as getNumShortHand() above -- an
// omitted `fixed` argument is `undefined`, which `=== null` doesn't catch.
// It happened to still render correctly here (toFixed(undefined) defaults to
// 0 digits, same as the intended default), but that's a coincidence of the
// default being 0 -- brought in line with the same `== null` guard used by
// gameserver/js/utils.js and userserver/js/utils.js so it doesn't silently
// break if the default ever changes.
Utils.Percent = function (val, fixed) {
  if (fixed == null)
    fixed = 0;

  return Number(val * 100).toFixed(fixed) + "%";
}

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
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

Utils.randomInt = (max) => Math.floor(Math.random() * (max + 1));

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
// Uses the bare `Types` global (see note on getOrientationString above).
Utils.randomOrientation = function() {
    let o, r = Utils.random(4);

    if(r === 0)
        o = Types.Orientations.LEFT;
    if(r === 1)
        o = Types.Orientations.RIGHT;
    if(r === 2)
        o = Types.Orientations.UP;
    if(r === 3)
        o = Types.Orientations.DOWN;
    return o;
};

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
Utils.randomPositionNextTo = function (entity) {
    let a = entity.x, b = entity.y, r = Utils.random(4);

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

Utils.randomRangeInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
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

Utils.realDistanceXY = function (e1, e2) {
  return Utils.realDistance([e1.x,e1.y],[e2.x,e2.y]);
}

Utils.RectContains = function (a, b) {
  // no horizontal overlap
	if (a.x1 >= b.x2 || b.x1 >= a.x2) return false;

	// no vertical overlap
	if (a.y1 >= b.y2 || b.y1 >= a.y2) return false;

	return true;
}

Utils.remainder = function (a, b)
{
    return a - (a / b) * b;
};

Utils.removeDoubleQuotes = function (val) {
	return val.toString().replace(/^"(.+(?="$))"$/,'$1');
}

// SYNC: brought over from gameserver/js/utils.js (already fixed there) and
// userserver/js/utils.js -- non-mutating-prototype, no-op-when-absent
// version of the "remove one matching element" pattern.
Utils.removeFromArray = function (arr, element) {
    const index = arr.indexOf(element);
    if (index >= 0)
      arr.splice(index, 1);
}

Utils.rgb2hex = function (rgb){
 rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
 return (rgb && rgb.length === 4) ?
  ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
  ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
  ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
}

Utils.rotateNum = function (num, mod, length) {
  return (num + mod + length) % length;
};

Utils.roundTo = function (val, nearest) {
  return Math.round(val / nearest) * nearest;
}

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
// Uses the bare `ItemTypes` global (see note on getOrientationString above).
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

  const lastObj = keys.reduce((acc, key) => {
    if (!acc[key] || typeof acc[key] !== 'object') {
      acc[key] = {};
    }
    return acc[key];
  }, obj);

  lastObj[lastKey] = value;
  return obj;
}

Utils.setWorldTime = function (localTime, remoteTime) {
  const diff = ~~((Date.now()-localTime)/2);
  console.warn("Date.diff: "+diff);
  WORLDTIME = parseInt(remoteTime);
  LOCALTIME = parseInt(localTime+diff);
  console.warn("LOCALTIME: "+LOCALTIME);
  console.warn("WORLDTIME: "+WORLDTIME);
};

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
Utils.Sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
Utils.SwapElements = function (arr, i1, i2) {
  [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
}

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
Utils.trueFalse = function(bool){
    return bool === "true" ? true : false;
}

// SYNC: brought over from gameserver/js/utils.js and userserver/js/utils.js.
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

Utils._arrayBufferToBase64 = function(buffer) {
    let binary = '';
    const bytes = new Uint8Array( buffer );
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}

Utils._base64ToArrayBuffer = function(base64) {
	const bin_string = window.atob(base64);
	const l = bin_string.length;
	const bytes = new Uint8Array(l);
	for (let i=0; i < l; ++i)
	{
		bytes[i] = bin_string.charCodeAt(i);
	}
	return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Native prototype extensions and other module-local helpers (not part of
// the Utils.* namespace, so not part of the alphabetical ordering above).
// ---------------------------------------------------------------------------

const TRANSITIONEND = 'transitionend webkitTransitionEnd oTransitionEnd';

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          window.oRequestAnimationFrame      ||
          window.msRequestAnimationFrame
})();

// FIX: String.prototype.format was defined twice in this file (once near the top, again down
// here); the second definition silently overwrote the first, leaving that copy dead while `.f`
// (aliased to the dead copy in the same statement) kept pointing at it - so `.format()` and
// `.f()` were no longer equivalent despite looking like aliases. The duplicate near the top has
// been removed; `.f` is aliased to this surviving implementation below.

let WORLDTIME = null;
let LOCALTIME = null;

if (!Array.prototype.last) {
  Object.defineProperty(Array.prototype, 'last', {
      value: function(){ return this[this.length - 1]; }
  });
}

if (!Array.prototype.In) {
  Object.defineProperty(Array.prototype, 'In', {
      value: function(index) { return (index >= 0 && index < this.length); }
  });
}

if (!String.prototype.reverse) {
  String.prototype.reverse = function () {
    return this.split("").reverse().join("");
  }
}

Number.prototype.mod = function(n) {
    return ((this%n)+n)%n;
};

Number.prototype.roundupsign = function () {
    return (this >= 0 || -1) * Math.ceil(Math.abs(this));
}

Number.prototype.roundUpTo = function (num)
{
    return Math.ceil(this/num)*num;
}

Number.prototype.roundTo = function (num)
{
    return Math.round(this/num)*num;
}

Number.prototype.between = function(a, b) {
  const min = Math.min(a, b),
    max = Math.max(a, b);

  return this >= min && this <= max;
};

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

String.prototype.format = function (args) {
  // Storing arguments into an array
  const tmp = Array.isArray(args) ? args : arguments;
  // Using replace for iterating over the string
  // Select the match and check whether related arguments are present.
  // If yes, then replace the match with the argument.

  return this.replace(/{([0-9]+)}/g, function (match, index) {
    // checking whether the argument is present
    return typeof tmp[index] === 'undefined' ? match : tmp[index];
  });
};
String.prototype.f = String.prototype.format;

const getX = function(id, w) {
    if(id === 0) {
        return 0;
    }
    return (id % w === 0) ? w - 1  : (id % w) - 1;
};

const msleep = function (ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}

export default Utils;
