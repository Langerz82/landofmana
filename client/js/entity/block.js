
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

      /*isColliding: function (entity) {
        var x = this.x;
        var y = this.y;
        var pos = {
          "1": [x, y+G_TILESIZE],
          "2": [x, y-G_TILESIZE],
          "3": [x+G_TILESIZE, y],
          "4": [x-G_TILESIZE, y]
        }
        var dir;

        bss = G_TILESIZE >> 1;
        for (var i=1; i < 5; ++i)
        {
          var p = pos[i];
          if (entity.orientation === i && (
              (p[0] === entity.x && Math.abs(p[1]-entity.y) <= bss) ||
              (p[1] === entity.y && Math.abs(p[0]-entity.x) <= bss)))
          {
              return true;
          }
        }
        return false;
      },

      isActivated: function (callback) {
        return callback(this);
      },

      onActivated: function (callback) {
        callback(this);
      },

      move: function (entity) {
          var x = this.x;
          var y = this.y;
          var posMove = {
            "1": [x, y-G_TILESIZE],
            "2": [x, y+G_TILESIZE],
            "3": [x-G_TILESIZE, y],
            "4": [x+G_TILESIZE, y]
          }

          bss = G_TILESIZE >> 1;
          if (this.isColliding(entity))
          {
            var p = posMove[i];
            this.setMoveRate(entity.moveSpeed);
            this.go(p[0], p[1]);
          }
      },*/

    });

    return Block;
});
