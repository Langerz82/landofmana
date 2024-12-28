var EntityArea = require("./entityarea"),
  Timer = require("../timer"),
  TrapGroup = require("../trapgroup");

module.exports = TrapArea = EntityArea.extend({
  init: function(id, x, y, width, height, map, damage, switchInterval) {
    this._super(id, x, y, width, height, map);
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
        if (!this.map.entities.isGridPositionEmpty(
          (pos[0]+i)*G_TILESIZE,
          (pos[1]+j)*G_TILESIZE))
        {
          return false;
        }
      }
    }
    return true;
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
    if (!this.checkTimer.isOver())
      return;

    if (!this.isTouchingEntity(entity))
      return;

    for (var group of this.groups) {
      group.update(entity);
    }

  }
});
