/*Function.prototype.bind = function (bind) {
    var self = this;
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return self.apply(bind || null, args);
    };
};*/

const Utils = {};

Utils.isInt = function(n) {
    return (n % 1) === 0;
};

const TRANSITIONEND = 'transitionend webkitTransitionEnd oTransitionEnd';

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          window.oRequestAnimationFrame      ||
          window.msRequestAnimationFrame
          //|| function(/* function */ callback, /* DOMElement */ element){
            //window.setTimeout(callback, 16);
          //};
})();

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

Utils.distanceTo = function(x, y, x2, y2) {
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);

    return (distX > distY) ? distX : distY;
};

Utils.random = function(range) {
    return Math.floor(Math.random() * range);
};
Utils.randomRange = function(min, max) {
    return min + (Math.random() * (max - min));
};

Utils.randomInt = (max) => Math.floor(Math.random() * (max + 1));
Utils.randomRangeInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

Utils.fixed = function(value, length) {
    const buffer = '00000000' + value;
    return buffer.substring(buffer.length - length);
}

// FIX: String.prototype.format was defined twice in this file (here and again below, near
// Number.prototype.between); the second definition silently overwrote this one, leaving this
// implementation dead while `.f` (aliased to this dead copy in the same statement) kept
// pointing at it - so `.format()` and `.f()` were no longer equivalent despite looking like
// aliases. Removed this duplicate; `.f` is now aliased to the surviving implementation below.

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

Utils._arrayBufferToBase64 = function(buffer) {
    let binary = '';
    const bytes = new Uint8Array( buffer );
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}

Utils.removeDoubleQuotes = function (val) {
	return val.toString().replace(/^"(.+(?="$))"$/,'$1');
}

Utils.rgb2hex = function (rgb){
 rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
 return (rgb && rgb.length === 4) ?
  ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
  ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
  ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
}

Utils.manhattenDistance = function (pos1, pos2) {
	return Math.abs(pos1.x-pos2.x) + Math.abs(pos1.y-pos2.y);
};

Utils.realDistanceXY = function (e1, e2) {
  return Utils.realDistance([e1.x,e1.y],[e2.x,e2.y]);
}

Utils.realDistance = function (p1, p2) {
	return ~~(Math.pow( Math.pow(p2[0]-p1[0],2) + Math.pow(p2[1]-p1[1],2), 0.5) );
};

if (!Number.prototype.ceilGrid) {
  Number.prototype.ceilGrid = function () {
    return ~~(this+0.5);
  }
}

Utils.clamp = (min, max, value) => Math.max(min, Math.min(max, value));

Number.prototype.mod = function(n) {
    return ((this%n)+n)%n;
};

Utils.remainder = function (a, b)
{
    return a - (a / b) * b;
};

Utils.getNumShortHand = function (val, fixed) {
  // FIX: an omitted argument is `undefined`, not `null` -- this guard never
  // caught the common "call with no fixed" case (see dialog/craftdialog.js
  // and dialog/storedialog.js price labels), so toFixed(undefined) defaulted
  // to 0 decimal places instead of the evidently-intended 2.
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

Utils.Percent = function (val, fixed) {
  if (fixed === null)
    fixed = 0;

  return Number(val * 100).toFixed(fixed) + "%";
}

Utils.padding = function (val, size) {
    let s = val+"";
    while (s.length < size) s = "0" + s;
    return s;
}

/*var setLocalTime = function () {
    LOCALTIME = Date.now();
};*/

let WORLDTIME = null;
let LOCALTIME = null;
Utils.setWorldTime = function (localTime, remoteTime) {
  //WORLDTIME = new Date();
  //console.warn("localTime: "+localTime);
  //console.warn("remoteTime: "+remoteTime);
  //console.warn("Date.now(): "+Date.now());
  const diff = ~~((Date.now()-localTime)/2);
  console.warn("Date.diff: "+diff);
  WORLDTIME = parseInt(remoteTime);
  LOCALTIME = parseInt(localTime+diff);
  console.warn("LOCALTIME: "+LOCALTIME);
  console.warn("WORLDTIME: "+WORLDTIME);
  //console.warn("Date.diff: "+(LOCALTIME - WORLDTIME));
};

Utils.getWorldTime = function () {
  return WORLDTIME + (Date.now()-LOCALTIME);
  //return Date.now();
};

Utils.getTime = function () {
  return Date.now();
}

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

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

const getX = function(id, w) {
    if(id === 0) {
        return 0;
    }
    return (id % w === 0) ? w - 1  : (id % w) - 1;
};

if (!Array.prototype.In) {
  Object.defineProperty(Array.prototype, 'In', {
      value: function(index) { return (index >= 0 && index < this.length); }
  });
}

// FIX: this was written as `function () { return this.map(...) }`, meant to
// be used as an Array.prototype method (Array.prototype.parseInt has since
// been removed from this file). Called as a plain `Utils.ArrayParseInt()`,
// `this` is `Utils` (which has no `.map`), so it would throw immediately.
// Takes the array explicitly now; all former `.parseInt()` call sites across
// client/js have been migrated to `Utils.ArrayParseInt(arr)`.
Utils.ArrayParseInt = function (arr) {
  return arr.map(function (x) {
    return parseInt(x, 10);
  });
}

if (!String.prototype.reverse) {
  String.prototype.reverse = function () {
    return this.split("").reverse().join("");
  }
}

Utils.RectContains = function (a, b) {
  // no horizontal overlap
	if (a.x1 >= b.x2 || b.x1 >= a.x2) return false;

	// no vertical overlap
	if (a.y1 >= b.y2 || b.y1 >= a.y2) return false;

	return true;
}

const msleep = function (ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}

Number.prototype.between = function(a, b) {
  const min = Math.min(a, b),
    max = Math.max(a, b);

  return this >= min && this <= max;
};

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
// FIX: re-point the `.f` shorthand (previously aliased to a dead duplicate near the top of
// this file) at the actual implementation that was in effect
String.prototype.f = String.prototype.format;

// NOTE: despite the name, this is NOT real base64. `tarr.toString('base64')` below is
// Array.prototype.toString, which ignores its argument and just comma-joins `tarr` - so the
// "base64" here is really a comma-separated string of 32-bit chunk values. It's internally
// consistent (Base64ToBinArray() below decodes this exact comma-joined format, and
// appearancedialog.js relies on that pairing to round-trip player appearance data), so it isn't
// broken - but don't "fix" it into real base64 without updating both ends and re-checking the
// wire format server-side.
Utils.BinArrayToBase64 = function (uint8array) {
  const len = Math.ceil(uint8array.length / 32);
  const tarr = [];
  for (let i=0; i < len; i++) {
    const num = uint8array.slice((i*32),(i*32)+32).join('');
    //console.info("num:"+num);
    //console.info("num2:"+parseInt(num, 2));
    tarr.push(parseInt(num, 2));
  }
  const base64 = tarr.toString('base64');
  return base64;
}

Utils.Base64ToBinArray = function (base64, limit) {
  const data = base64.toString('binary');
  const arr = data.split(",");
  //console.info(JSON.stringify(arr));
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

Utils.getGridPosition = function (x, y) {
  return {gx: x >> 4, gy: y >> 4};
}

Utils.getPositionFromGrid = function (gx, gy) {
  return {x: gx << 4, y: gy << 4};
}

Utils.objectToArray = function (object) {
  const arr = [];
  for (let key in object) {
    const obj = object[key];
    if (obj)
      arr.push(obj);
  }
  return arr;
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

Utils.isBetween = function (num, a, b) {
    return num >= Math.min(a, b) && num <= Math.max(a, b);
};

Utils.floorToGrid = function (num, nth) {
    return Math.floor(num / nth) * nth;
};

Utils.copy2DArray = function (arr) {
  let copy = [];
  for (let i = 0; i < arr.length; i++) {
    copy.push(arr[i].slice()); // .slice() creates a copy of the inner array
  }
  return copy;
};

Utils.fixGridPosition = function (x,y) {
  return {
    x: (Math.floor(x/G_TILESIZE)+0.5)*G_TILESIZE,
    y: (Math.floor(y/G_TILESIZE)+0.5)*G_TILESIZE,
  };
};

Utils.validateIndex = function(index, max) {
  const idx = parseInt(index, 10);
  return Number.isInteger(idx) && idx >= 0 && idx < max;
};

Utils.validatePositiveNumber = function(num) {
  const n = parseInt(num, 10);
  return Number.isInteger(n) && n > 0;
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

Utils.rotateNum = function (num, mod, length) {
  return (num + mod + length) % length;
};

export default Utils;
