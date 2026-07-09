import Item from './item.js';
import { Types } from '../common.js';
import Utils from '../utils.js';
import ItemData from '../data/itemdata.js';
import ChestArea from '../area/chestarea.js';

class Chest extends Item {
    // NOTE: preserved pre-existing bug from the original CommonJS version —
    // Item's constructor signature is (type, id, itemRoom, x, y, map), but the
    // super() call below only ever passed 4 arguments (id, Types.EntityTypes.CHEST,
    // x, y), so itemRoom/the real x,y/map are never set correctly on the Entity
    // base. Left unchanged to avoid altering original runtime behavior.
    constructor(id, x, y, map, area, minLevel, maxLevel) {
        super(id, Types.EntityTypes.CHEST, x, y); // CHEST
        this.map = map;
        this.level = Utils.randomRangeInt(minLevel, maxLevel);
        this.setDrops();
        this.area = area;
        this.spawnDelay = 30000;
    }

    handleRespawn() {
        const self = this;

        this.droppedItem = false;
        if (this.area && this.area instanceof ChestArea) {
            this.area.respawnChest(this, this.spawnDelay);
        }
    }

    setDrops() {
        this.drops = {};

        const dropLevel = Math.ceil(this.level / 10) * 10;
        //console.info("dropLevel="+dropLevel);
        for (const itemId in ItemData.Kinds)
        {
            const item = ItemData.Kinds[itemId];
            if (!item)
                continue;

            if (item.typemod=="attack" || item.typemod=="defense")
            {
                switch (dropLevel)
                {
                case item.modifier+10:
                    this.drops[itemId] = 20;
                    break;
                case item.modifier:
                    this.drops[itemId] = 10;
                    break;
                case item.modifier-10:
                    this.drops[itemId] = 5;
                    break;
                case item.modifier-20:
                    this.drops[itemId] = 2;
                    break;
                }
            }
            if (item.typemod=="craft")
            {
                switch (dropLevel)
                {
                case item.modifier+10:
                    this.drops[itemId] = 400;
                    break;
                case item.modifier:
                    this.drops[itemId] = 200;
                    break;
                case item.modifier-10:
                    this.drops[itemId] = 100;
                    break;
                case item.modifier-20:
                    this.drops[itemId] = 50;
                    break;
                }
            }
        }
        //console.info("drops="+JSON.stringify(this.drops));
    }
}

export default Chest;
