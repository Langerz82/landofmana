/*Function.prototype.bind = function (bind) {
    var self = this;
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return self.apply(bind || null, args);
    };
};*/

var Utils = {};

Utils.isInt = function(n) {
    return (n % 1) === 0;
};

var TRANSITIONEND = 'transitionend webkitTransitionEnd oTransitionEnd';

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          window.oRequestAnimationFrame      ||
          window.msRequestAnimationFrame     ||
          function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 16);
          };
})();

Utils.getUrlVars = function() {
	//from http://snipplr.com/view/19838/get-url-parameters/
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

Utils.distanceTo = function(x, y, x2, y2) {
    var distX = Math.abs(x - x2);
    var distY = Math.abs(y - y2);

    return (distX > distY) ? distX : distY;
};

Utils.random = function(range) {
    return Math.floor(Math.random() * range);
};
Utils.randomRange = function(min, max) {
    return min + (Math.random() * (max - min));
};

Utils.randomRangeInt = function(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
};

Utils.fixed = function(value, length) {
    var buffer = '00000000' + value;
    return buffer.substring(buffer.length - length);
}

String.prototype.format = String.prototype.f = function() {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

Utils._base64ToArrayBuffer = function(base64) {
	var bin_string = window.atob(base64);
	var l = bin_string.length;
	var bytes = new Uint8Array(l);
	for (var i=0; i < l; ++i)
	{
		bytes[i] = bin_string.charCodeAt(i);
	}
	return bytes.buffer;
}

Utils._arrayBufferToBase64 = function(buffer) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
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

var clamp = function (val, min, max) {
  return Math.min(Math.max(val, min), max);
};

Number.prototype.clamp = function (min, max) {
  var out = clamp(this, min, max);
  //this = out;
  return out;
};

Utils.clamp = function(min, max, value) {
  return value.clamp(min,max);
}

Number.prototype.mod = function(n) {
    return ((this%n)+n)%n;
};

Utils.remainder = function (a, b)
{
    return a - (a / b) * b;
};

Utils.getNumShortHand = function (val, fixed) {
  fixed = fixed || 2;
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

Utils.padding = function (val, size) {
    var s = val+"";
    while (s.length < size) s = "0" + s;
    return s;
}

/*var setLocalTime = function () {
    LOCALTIME = Date.now();
};*/

var WORLDTIME = null;
var LOCALTIME = null;
Utils.setWorldTime = function (localTime, remoteTime) {
  //WORLDTIME = new Date();
  //console.warn("localTime: "+localTime);
  //console.warn("remoteTime: "+remoteTime);
  //console.warn("Date.now(): "+Date.now());
  var diff = ~~((Date.now()-localTime)/2);
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

var getX = function(id, w) {
    if(id === 0) {
        return 0;
    }
    return (id % w === 0) ? w - 1 : (id % w) - 1;
};

if (!Array.prototype.parseInt) {
  Object.defineProperty(Array.prototype, 'parseInt', {
      value: function(){ return this.map(function (x) { return parseInt(x, 10); }); }
  });
}

if (!Array.prototype.In) {
  Object.defineProperty(Array.prototype, 'In', {
      value: function(index) { return (index >= 0 && index < this.length); }
  });
}

/*ArrayParseInt = function() {
  var l = this.length;
  for (var i=0; i < l; ++i)
    this[i] = parseInt(this[i]);
  return this;
}

ArrayIn = function(index) {
  if (index >= 0 && index < this.length)
    return true;
  return false;
}*/

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

var msleep = function (ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}

Number.prototype.between = function(a, b) {
  var min = Math.min(a, b),
    max = Math.max(a, b);

  return this >= min && this <= max;
};

String.prototype.format = function (args) {
  // Storing arguments into an array
  var tmp = Array.isArray(args) ? args : arguments;
  // Using replace for iterating over the string
  // Select the match and check whether related arguments are present.
  // If yes, then replace the match with the argument.

  return this.replace(/{([0-9]+)}/g, function (match, index) {
    // checking whether the argument is present
    return typeof tmp[index] == 'undefined' ? match : tmp[index];
  });
};

Utils.BinArrayToBase64 = function (uint8array) {
  var len = Math.ceil(uint8array.length / 32);
  var tarr = [];
  for (var i=0; i < len; i++) {
    var num = uint8array.slice((i*32),(i*32)+32).join('');
    //console.info("num:"+num);
    //console.info("num2:"+parseInt(num, 2));
    tarr.push(parseInt(num, 2));
  }
  var base64 = tarr.toString('base64');
  return base64;
}

Utils.Base64ToBinArray = function (base64, limit) {
  var data = base64.toString('binary');
  var arr = data.split(",");
  //console.info(JSON.stringify(arr));
  var uint8array = new Uint8Array(arr.length*32);
  for (var i=0; i < arr.length; ++i)
  {
    var dec = parseInt(arr[i]);
    var bin = dec.toString(2);
    var l = bin.length;
    var index = (i+1)*32-l;
    for (var j=0; j < l; ++j)
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
