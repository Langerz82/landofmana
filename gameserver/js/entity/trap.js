var EntityMoving = require("./entitymoving");

module.exports = Block = EntityMoving.extend({
  init: function(id, kind, x, y, map, parent, name, ix, iy) {
    var type = this.type = Types.EntityTypes.TRAP;
    this.parent = parent;
    this.ix = ix;
    this.iy = iy;
    this._super(id, type, kind, x, y, map);
    this.name = name;
    this.active = true;
  },

  getState: function() {
    return this._getBaseState().concat([
      parseInt(this.ix),
      parseInt(this.iy),
      parseInt(this.active ? 1 : 0)
    ]);
  },

  on: function() {
    this.active = true;
    this.map.entities.pushNeighbours(this, new Messages.SwapSprite(this.id, 1));
  },

  off: function () {
    this.active = false;
    this.map.entities.pushNeighbours(this, new Messages.SwapSprite(this.id, 0));
  },
});
