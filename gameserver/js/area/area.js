var cls = require('../lib/class');
var Utils = require('../utils');

// IMPORTANT - X,Y are center cordinates for elipses only. For default rectangle its top-left.

module.exports = Area = cls.Class.extend({
  init: function(id, x, y, width, height, map, elipse, excludeId) {
    this.id = id;
    var ts = G_TILESIZE;
    this.gx = x;
    this.gy = y;
    this.x = x*ts;
    this.y = y*ts;
    if (elipse)
    {
      this.x + this.width / 2;
      this.y + this.height / 2;
    }
    this.width = width*ts;
    this.height = height*ts;
    //this.world = world;
    this.map = map;


    this.elipse = elipse || false;
    //this.elipseId = elipseId || -1;
    this.excludeId = excludeId || -1;
    //console.info("this.elipse="+this.elipse+",this.excludeId="+this.excludeId);
  },

  _getRandomPosition: function(xandy, dist, threshold) {
    threshold = threshold || 30;
    //console.info("_getRandomPositionInsideArea - threshold="+threshold);
    var pos = {};
    var valid = false;

    //console.info("pos.x: "+this.x+",pos.y:"+this.y);
    var count = 0;
    //console.info("threshold = "+threshold);

    var d = Math.min(dist.height, dist.width);
    while (count < threshold) {
      if (!this.elipse) {
        pos.x = xandy.x + Utils.randomInt(dist.width);
        pos.y = xandy.y + Utils.randomInt(dist.height);
      } else {
        var a = Math.random() * 2 * Math.PI;
        var r = Utils.randomRangeInt(0,~~(d / 2));
        //console.info("a="+a+",r="+r);

        pos.x = Math.round(xandy.x + (r * Math.cos(a)));
        pos.y = Math.round(xandy.y + (r * Math.sin(a)));
      }
      //console.info("pos.x: "+pos.x+",pos.y:"+pos.y);
      //console.info("count="+count);
      if (!this.contains(pos.x, pos.y, 0)) {
        //console.info("_getRandomPosition: contains - false "+pos.x+","+pos.y);
        //console.info("_getRandomPosition: contains "+this.x+","+this.y+","+this.width+","+this.height);
        //try { throw new Error(); } catch(err) { console.info(err.stack); }
        //process.exit(1);
        count++;
        continue;
      }

      if (this.map.isColliding(pos.x, pos.y))
      {
        //console.info("isColliding - true: "+pos.x+","+pos.y);
        //console.info("_getRandomPosition: map colliding.");
        count++;
        continue;
      }
      else {
        break;
      }
      count++;
    }
    if (count >= threshold) {
      //console.warn("_getRandomPosition exceeded:" + pos.x + "," + pos.y);
      //process.exit(1);
      return null;
    }
    return pos;
  },

  _getRandomPositionForEntity: function(entity, dist, threshold) {
    //var obj = {x: entity.x, y: entity.y};
    return this._getRandomPosition(entity, {"width": dist, "height": dist}, threshold);
  },

  _getRandomPositionInsideArea: function(threshold) {
    return this._getRandomPosition(this, this, threshold);
  },

  contains: function(x, y, iteration) {
    //iteration = iteration;
    if (!this.elipse) {
      return x >= this.x &&
        y >= this.y &&
        x < this.x + this.width &&
        y < this.y + this.height;
    } else {
      var cx = (this.x);
      var cy = (this.y);
      var d = Math.sqrt(
        Math.pow(x - cx, 2) + Math.pow(y - cy, 2)
      );
      //console.log("cx:"+cx+",cy:"+cy);
      //console.log("this.width:"+this.width+",this.height:"+this.height);
      //console.log("this.x:"+this.x+",this.y:"+this.y);
      //console.log("d:"+d);

      var inElipse = (d < this.width / 2);

      //console.log("this.elipseId="+this.elipseId);
      //console.log("inElipse="+inElipse);
      if (iteration == 1 || this.excludeId == -1) {
        return inElipse;
      } else if (iteration == 0) {
        var res = inElipse;

        var prevArea = this.map.mobLiveAreas[this.elipseId];
        if (prevArea)
          res = res && !prevArea.contains(x, y, 1);

        return res;
      }
      return false;
    }
  },


});

module.exports = Area;
