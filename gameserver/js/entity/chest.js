import Entity from './entity.js';
import { Types } from '../common.js';
import Utils from '../utils.js';
import ItemData from '../data/itemdata.js';
import ChestArea from '../area/chestarea.js';

// FIX: this now extends Entity directly (good -- Chest isn't a real item and
// doesn't need Item's itemRoom-shaped state/getState()), but the `Entity`
// import was missing. `extends Entity` with no import throws
// `ReferenceError: Entity is not defined` the instant this module loads --
// and since map/mapentities.js imports chest.js, that broke map loading
// entirely, not just chest spawning. The super() call itself is correct:
// Entity's constructor signature is (id, type, kind, x, y, map), which
// `super(id, Types.EntityTypes.CHEST, id, x, y, map)` matches.
class Chest extends Entity {
    constructor(id, x, y, map, area, minLevel, maxLevel) {
        super(id, Types.EntityTypes.CHEST, id, x, y, map);
        this.map = map;
        this.level = Utils.randomRangeInt(minLevel, maxLevel);
        this.setDrops();
        this.area = area;
        this.spawnDelay = 30000;
    }

    handleRespawn() {
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
