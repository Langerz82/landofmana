var EntityArea = require("./entityarea"),
  Timer = require("../timer"),
  TrapGroup = require("../entity/trapgroup");

module.exports = TrapArea = EntityArea.extend({
  init: function(map, id, x, y, width, height, damage, switchInterval) {
    this._super(map, id, x, y, width, height);
    this.groups = [];
    this.checkTimer = new Timer(500);

    this.damage = damage || 0;
    this.switchInterval = switchInterval || 1000;
  },

  addGroup: function (group) {
    this.groups.push(group);
  },

  addRandomGroup: function (kind, width, height, threshold) {
      var pos = null;
      var threshold = threshold || 50;

      var t = 0;
      while(t++ < threshold) {
        pos = [this.gx + Utils.randomInt((this.width/G_TILESIZE) - width),
               this.gy + Utils.randomInt((this.height/G_TILESIZE) - height)];

        if (this.isGroupEmptyPositions(pos, width, height))
          break;

        pos = null;
      }

      if (!pos) {
        console.error("TrapArea - addRandomGroup - failed, threshold reached.")
        return;
      }

      var group = new TrapGroup(kind, pos[0], pos[1], width, height, this.map,
        this.damage, this.switchInterval);

      this.addGroup(group);
  },

  isGroupEmptyPositions: function (pos, width, height) {
    console.info("isGroupEmptyPositions: pos=["+pos[0]+","+pos[1]+"],w="+width+",h="+height);
    for (var i=0; i < width; ++i) {
      for (var j=0; j < height; ++j) {
        var x = (pos[0]+i);
        var y = (pos[1]+j);
        if (!this.map.entities.isGridPositionEmpty(x,y))
        {
          return false;
        }
      }
    }
    return true;
  },

  isTouching: function (entity) {
    const ts = G_TILESIZE;
    const half = ts >> 1;
    const left   = this.x * ts - half;
    const right  = (this.x + this.width) * ts + half;
    const top    = this.y * ts - half;
    const bottom = (this.y + this.height) * ts + half;

    return entity.x >= left && entity.x <= right &&
           entity.y >= top && entity.y <= bottom;
  },

  update: function (entity) {
    if (!this.checkTimer.isOver())
      return;

    if (!this.isTouchingEntity(entity))
      return;

    for (var group of this.groups) {
      group.update(entity);
    }

  }
});
