
define(['./entitymoving', '../timer'], function(EntityMoving, Timer) {

    var Block = EntityMoving.extend({
      init: function(id, type, kind, map, name, x, y) {
        var self = this;

        this._super(id, type, map, kind, x, y);

        this.name = name;
        /*this.ready(function () {
          self.animate("idle", self.idleSpeed);
        })*/
      },

      pickup: function (entity) {
          entity.holdingBlock = this;
          game.client.sendBlock(0, this.id, this.x, this.y);
      },

      place: function (entity) {
        var ts = G_TILESIZE;
        var pos = entity.nextTile();
        pos[0] = pos[0].roundTo(ts);
        pos[1] = pos[1].roundTo(ts);
        if (game.mapContainer.isColliding(pos[0], pos[1]))
          return;

        this.setPosition(pos[0], pos[1]);
        entity.holdingBlock = null;
        game.client.sendBlock(1, this.id, this.x, this.y);
      },

      // FIX: removed dead commented-out block (isColliding/isActivated/onActivated/move) referencing undefined vars (bss, i); would error if re-enabled

    });

    return Block;
});
