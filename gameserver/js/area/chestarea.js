var EntityArea = require('./entityarea'),
    _ = require('underscore'),
    Messages = require('../message');

module.exports = ChestArea = EntityArea.extend({
    init: function(id, elipse, nb, minLevel, maxLevel, x, y, width, height, map) {
        this._super(id, x, y, width, height, map);
        this.nb = nb;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        this.respawns = [];
        this.map = map;

        this.setNumberOfEntities(this.nb);

        this.chests = [37];
    },
    spawnChests: function() {

        for(var i = 0; i < this.nb; i += 1) {
            this.addToArea(this._createRandomChestInsideArea());
        }
    },

    _createRandomChestInsideArea: function() {
        return this._createChest();
    },

    _createChest: function() {
	    var self = this;
	    var	pos = self.map.entities.spaceEntityRandomApart(2,self._getRandomPositionInsideArea.bind(self,20));

        var Chest = require('./chest');
        var chest = new Chest(20000 + (++self.map.entities.entityCount), pos.x, pos.y,  self.map, self, self.minLevel, self.maxLevel);

        self.map.entities.addChest(chest);
        self.addToArea(chest);

        return chest;

    },

    respawnChest: function(chest, delay) {
        var self = this;
        delay = chest.spawnDelay || delay;

        this.removeFromArea(chest);

        setTimeout(function() {
            var	pos = self.map.entities.spaceEntityRandomApart(2, self._getRandomPositionInsideArea.bind(self,20));

	    chest.x = pos.x;
            chest.y = pos.y;

            self.addToArea(chest);
            self.map.entities.addChest(chest);
            self.map.entities.pushBroadcast(new Messages.Spawn(chest));
        }, delay);
    }
});

module.exports = ChestArea;
