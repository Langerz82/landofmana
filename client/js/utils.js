import Utils from '../shared/js/utils.js';

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

Utils.getWorldTime = function () {
  return WORLDTIME + (Date.now()-LOCALTIME);
};

Utils.isInt = function(n) {
    return (n % 1) === 0;
};

Utils.padding = function (val, size) {
    let s = val+"";
    while (s.length < size) s = "0" + s;
    return s;
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

Utils.rgb2hex = function (rgb){
 rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
 return (rgb && rgb.length === 4) ?
  ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
  ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
  ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
}

Utils.setWorldTime = function (localTime, remoteTime) {
  const diff = ~~((Date.now()-localTime)/2);
  console.warn("Date.diff: "+diff);
  WORLDTIME = parseInt(remoteTime);
  LOCALTIME = parseInt(localTime+diff);
  console.warn("LOCALTIME: "+LOCALTIME);
  console.warn("WORLDTIME: "+WORLDTIME);
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

if (!Array.prototype.In) {
  Object.defineProperty(Array.prototype, 'In', {
      value: function(index) { return (index >= 0 && index < this.length); }
  });
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
