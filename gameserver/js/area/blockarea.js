var EntityArea = require("./entityarea.js"),
  Block = require("../entity/block.js");

module.exports = BlockArea = EntityArea.extend({
  init: function(id, x, y, width, height, map, elipse) {
    this._super(id, x, y, width, height, map, elipse);
    this.blocks = [];
    this.players = {};
  },

  initArea: function (kind, width, height) {
    var startID = this.map.entities.entityCount;

    var id = 0;
    var blockName;
    for (var j=0; j < height; ++j) {
      for (var i=0; i < width; ++i) {
        id = startID+(width*j+i);
        blockName = "block"+kind+"-"+j+"_"+i;
        var block = new Block(id, kind,
          this.x+(i*G_TILESIZE), this.y+(j*G_TILESIZE),
          this.map, this, blockName, i, j);
        this.map.entities.addBlock(block);
        this.blocks.push(block);
      }
    }
    this.map.entities.entityCount += (width*height);
  },

  randomizeBlocks: function (distApart) {
    var self = this;
    for (var i in this.blocks) {
      var block = this.blocks[i];
      var	pos = this.map.entities.spaceEntityRandomApart(distApart, self._getRandomPositionInsideArea.bind(self,30));
      if (pos) {
        block.setPosition(~~(Utils.floorTo(pos.x, G_TILESIZE)), ~~(Utils.floorTo(pos.y, G_TILESIZE)));
      }
      else {
        console.error("BlockArea - randomizeBlocks: failed.");
      }
    }
  },

// TODO - FIX
  isCompleted: function () {
    var b1 = this.blocks[0], b2 = null;
    var b3 = b1;
    var x = 0;

    for(var i in this.blocks) {
      b1 = this.blocks[i];
      x = (i % this.numX);
      if (b2) {
        if (x === 0) {
          if (!((b1.y - b3.y) === G_TILESIZE || (b1.x - b3.x) === 0))
            return false;
          b3 = b1;
        }
        else {
          if (!((b2.x - b1.x) === G_TILESIZE || (b2.y - b1.y) === 0))
            return false;
        }
      }
      b2 = b1;
    }
    return true;
  },

  Completed: function () {
    console.warn("BLOCKAREA - COMPLETED.");
    for (var i in this.blocks) {
      var block = this.blocks[i];
      if (!block.playerName)
        continue;

      if (this.players.hasOwnProperty(block.playerName))
        this.players[block.playerName]++;
      else {
        this.players[block.playerName] = 1;
      }
    }
  },

  onComplete: function (callback) {
    this.complete_callback = callback;
  },

  update: function () {
    if (this.isCompleted())
    {
      this.Completed();
      if (this.complete_callback && Object.keys(this.players).length > 0)
        this.complete_callback(this);
      for (var i in this.blocks) {
        var block = this.blocks[i];
        this.map.entities.removeEntity(block);
        this.map.entities.pushBroadcast(block.despawn());
      }
      delete this;
    }
  }
});
