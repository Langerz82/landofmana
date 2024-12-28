var EntityMoving = require("./entitymoving");

module.exports = Block = EntityMoving.extend({
  init: function(id, kind, x, y, map, parent, name, ix, iy) {
    var type = this.type = Types.EntityTypes.BLOCK;
    this.parent = parent;
    this.ix = ix;
    this.iy = iy;
    this._super(id, type, kind, x, y, map);
    this.name = name;
    this.playerName = null;
  },

  isCompleted: function (player) {
    if (this.parent.isCompleted())
      this.parent.onComplete();
  },

  getState: function() {
    return this._getBaseState().concat([
      parseInt(this.ix),
      parseInt(this.iy)
    ]);
  },

  update: function (player) {
    this.playerName = player.name;
    this.parent.update();
  }

});
