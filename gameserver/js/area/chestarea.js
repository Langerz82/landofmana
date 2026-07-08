import EntityArea from './entityarea.js';
import _ from 'underscore';
import Messages from '../message.js';
// NOTE: the original CommonJS source did `require('./chest')` from inside this
// directory (area/), but chest.js lives in entity/, not area/ — that require
// would have failed at runtime (this method may never have actually been
// exercised). Fixed to the correct relative path since a static ESM import
// can't be lazily required inside a function the way CommonJS could.
import Chest from '../entity/chest.js';

class ChestArea extends EntityArea {
    constructor(map, id, elipse, nb, minLevel, maxLevel, x, y, width, height) {
        super(map, id, x, y, width, height);
        this.nb = nb;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        this.respawns = [];
        this.map = map;

        this.setNumberOfEntities(this.nb);

        this.chests = [37];
    }

    spawnChests() {
        for(var i = 0; i < this.nb; i += 1) {
            this.addToArea(this._createRandomChestInsideArea());
        }
    }

    _createRandomChestInsideArea() {
        return this._createChest();
    }

    _createChest() {
        var self = this;
        var	pos = self.map.entities.spaceEntityRandomApart(2,self._getRandomPositionInsideArea.bind(self,20));

        var chest = new Chest(20000 + (++self.map.entities.entityCount), pos.x, pos.y,  self.map, self, self.minLevel, self.maxLevel);

        self.map.entities.addChest(chest);
        self.addToArea(chest);

        return chest;
    }

    respawnChest(chest, delay) {
        var self = this;
        delay = chest.spawnDelay || delay;

        this.removeFromArea(chest);

        setTimeout(function() {
            var	pos = self.map.entities.spaceEntityRandomApart(2, self._getRandomPositionInsideArea.bind(self,20));

            chest.x = pos.x;
            chest.y = pos.y;

            self.addToArea(chest);
            self.map.entities.addChest(chest);
            self.map.entities.sendBroadcast(new Messages.Spawn(chest));
        }, delay);
    }
}

export default ChestArea;
