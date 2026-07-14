import sanitizer from 'sanitizer';

const Utils = {};


Utils.sanitize = function(string) {
    // Strip unsafe tags, then escape as html entities.
    return sanitizer.escape(sanitizer.sanitize(string));
};
Utils.random = function(range) {
    return Math.floor(Math.random() * range);
};
Utils.randomRange = function(min, max) {
    return min + (Math.random() * (max - min));
};

Utils.randomInt = function(val) {
    return Math.floor(Math.random() * (val+1));
};
Utils.randomRangeInt = function(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
};

Utils.percentToBool = function(percent){
    if(Math.random() < percent*0.01){
        return true;
    } else{
        return false;
    }
};
Utils.ratioToBool = function(ratio){
    if(Math.random() < ratio){
        return true;
    } else{
        return false;
    }
};

Utils.clamp = function(min, max, value) {
    if(value < min) {
        return min;
    } else if(value > max) {
        return max;
    } else {
        return value;
    }
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

Utils.getOrientationString = function(r) {
    let o = "NONE";

    if(r === 1)
        o = "UP";
    else if(r === 2)
        o = "DOWN";
    else if(r === 3)
        o = "LEFT";
    else if(r === 4)
        o = "RIGHT";

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
Utils.distanceTo = function(x, y, x2, y2) {
    //console.info("x="+x+",y="+y+",x2="+x2+",y2="+y2);
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);

    return (distX > distY) ? distX : distY;
};

Utils.manhattenDistance = function (pos1, pos2) {
	return Math.abs(pos1.x-pos2.x) + Math.abs(pos1.y-pos2.y);
},

Utils.realDistance = function (p1, p2) {
	return ~~(Math.pow( Math.pow(p2[0]-p1[0],2) + Math.pow(p2[1]-p1[1],2), 0.5) );
},

Utils.NaN2Zero = function(num){
    if(isNaN(num*1)){
        return 0;
    } else{
        return num*1;
    }
};
Utils.trueFalse = function(bool){
    return bool === "true" ? true : false;
}

Utils.utilSleep = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

Utils.removeDoubleQuotes = function (val) {
	return val.toString().replace(/^"(.+(?="$))"$/,'$1');
}

Utils.max = function (array, colIndex) {
	return Math.max.apply(Math, array.map(function (v) { return v[colIndex]; }));
}

Utils.min = function (array, colIndex) {
	return Math.min.apply(Math, array.map(function (v) { return v[colIndex]; }));
}

Utils.array_values = function (input) {
	const tmp_arr = [];
	let key = '';
	for (key in input) tmp_arr[tmp_arr.length] = input[key];
	return tmp_arr;
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

Utils.pad = function (val, size) {
    let s = val+"";
    while (s.length < size) s = "0" + s;
    return s;
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
            //|| (c === 0x20) || (c === 0x5f)                                       // Space and underscore
            //|| (c === 0x28) || (c === 0x29)                                       // Parentheses
            //|| (c === 0x5e)
          )) {                                                  // Caret
            return false;
        }
    }
    return true;
}

//if (!ArrayLast){
//ArrayLast = function(){
//    return this[this.length - 1];
//};
//}
if (!Array.prototype.last) {
  Object.defineProperty(Array.prototype, 'last', {
      value: function(){ return this[this.length - 1]; }
  });
}

if (!Array.prototype.parseInt) {
  Object.defineProperty(Array.prototype, 'parseInt', {
      value: function(){ return this.map(function (x) { return parseInt(x, 10); }); }
  });
}

/*if (!Object.prototype.isEmpty) {
  Object.defineProperty(Object.prototype, 'isEmpty', {
      value: function() {
        return (Object.keys(this).length === 0);
      }
  });
}*/


Utils.ArrayParseInt = function () {
  return this.map(function (x) {
    return parseInt(x, 10);
  });
}

if (!String.prototype.reverse) {
  String.prototype.reverse = function () {
    return this.split("").reverse().join("");
  }
}

Utils.ceilGrid = function (val) {
    return ~~(val+0.5);
};

if (!Number.prototype.ceilGrid) {
  Number.prototype.ceilGrid = function () {
    return ~~(this+0.5);
  }
}

Utils.minProp = function (arr, prop) {
  return arr.reduce(function(prev, curr) {
    return prev[prop] < curr[prop] ? prev : curr;
  });
}

Utils.maxProp = function (arr, prop) {
  return arr.reduce(function(prev, curr) {
    return prev[prop] > curr[prop] ? prev : curr;
  });
}


Utils.Sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const groupBy = function(xs, key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

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

Utils.roundTo = function (val, nearest) {
  return Math.round(val / nearest) * nearest;
}
Utils.floorTo = function (val, nearest) {
  return Math.floor(val / nearest) * nearest;
}
Utils.ceilTo = function (val, nearest) {
  return Math.ceil(val / nearest) * nearest;
}

Utils.btoa = function (val) {
  return Buffer.from(val, 'base64').toString('utf8');
}

Utils.getGridPosition = function (x, y) {
  return {gx: x >> 4, gy: y >> 4};
}

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

if (!Array.prototype.removeVal) {
  Object.defineProperty(Array.prototype, 'removeVal', {
      // NOTE: previously did `this.splice(this.indexOf(val), 1)` unconditionally.
      // When `val` isn't in the array, indexOf returns -1, and splice(-1, 1)
      // doesn't no-op -- it removes the LAST element of the array. Every caller
      // (worldserver.js self.players.removeVal, packethandler.js
      // player.knownIds.removeVal, playergroup.js, playerquests.js) expects a
      // harmless no-op when the value isn't present, not silent removal of an
      // unrelated entry.
      value: function(val){
        const idx = this.indexOf(val);
        if (idx < 0) return [];
        return this.splice(idx, 1);
      }
  });
}

/*
module.exports = removeEmpty = function (obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v !== null)
      .map(([k, v]) => [k, v === Object(v) ? removeEmpty(v) : v])
  );
}
*/
//module.exports = Utils;

export default Utils;
