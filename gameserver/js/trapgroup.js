var cls = require("./lib/class"),
  Trap = require("./entity/trap"),
  Timer = require("./timer");

module.exports = TrapGroup = cls.Class.extend({
  init: function(kind, x, y, width, height, map, damage, interval) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.traps = [];
    this.entities = {};
    this.map = map;
    this.damaging = false;
    this.switchTimer = new Timer(interval || 1000);
    this.damage = this.damage || 0;
    this.damageInterval = 1000;

    this.generateTraps();
  },

  generateTraps: function () {
    var width = this.width;
    var height = this.height;

    var startID = this.map.entities.entityCount;

    var id = 0;
    var blockName;
    for (var j=0; j < height; ++j) {
      for (var i=0; i < width; ++i) {
        id = startID+(width*j+i);
        blockName = "trap"+id+"-"+j+"_"+i;

        var trap = new Trap(id, this.kind,
          (this.x+i)*G_TILESIZE, (this.y+j)*G_TILESIZE,
          this.map, this, blockName, i, j);
        this.map.entities.addEntity(trap);
        this.traps.push(trap);
      }
    }

    this.map.entities.entityCount += (width*height);
  },

  isTouching: function (entity) {
      var th = G_TILESIZE >> 1;

      var x1 = (this.x*G_TILESIZE-th);
      var x2 = ((this.x+this.width)*G_TILESIZE+th);
      var y1 = (this.y*G_TILESIZE-th);
      var y2 = ((this.y+this.width)*G_TILESIZE+th);

      return _.inRange(entity.x, x1, x2) && _.inRange(entity.y, y1, y2);
  },

  update: function (entity) {
    var dmg = this.damaging;

    if (this.switchTimer.isOver())
      this.damaging = !this.damaging;

    if (dmg != this.damaging) {
      if (this.damaging) {
        for(var trap of this.traps) {
          trap.on();
        }
      }
      else {
        for(var trap of this.traps) {
          trap.off();
        }
      }
    }

    if (!this.damaging)
      return;

    if (!this.isTouchingEntity(entity))
      return;

    var victim = null;
    for(var trap of this.traps)
    {
      if (trip.isTouchingEntity(entity)) {
        victim = entity;
        break;
      }
    }

    var id = entity.id;

    if (!victim) {
      this.entities[id] = null;
      return;
    }

    if(this.entities.getOwnProperty(id) && this.entities[id]) {
      if (this.entities[id].isOverEntity(player))
        player.onDamage(this, this.damage);
    }
    else {
        player.onDamage(this, this.damage);
        this.entities[id] = new Timer(this.damageInterval);
    }
  },

});
