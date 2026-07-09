import Entity from './entity.js';
import { Types } from '../common.js';
import ItemData from '../data/itemdata.js';

// TODO Make Item inherit from ItemRoom.
class Item extends Entity {
    constructor(type, id, itemRoom, x, y, map) {
        const kind = itemRoom.itemKind;
        super(id, type, kind, x, y, map);
        this.isStatic = false;
        this.isFromChest = false;
        this.orientation = Types.Orientations.DOWN;
        this.experience = 0;
        this.data = ItemData.Kinds[kind];
        this.room = itemRoom;
    }

    handleDespawn(params) {
        let self = this;

        this.blinkTimeout = setTimeout(function () {
            params.blinkCallback();
            self.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
            self = null;
        }, params.beforeBlinkDelay);
    }

    destroy() {
        if (this.blinkTimeout) {
            clearTimeout(this.blinkTimeout);
        }
        if (this.despawnTimeout) {
            clearTimeout(this.despawnTimeout);
        }

        if (this.isStatic) {
            this.scheduleRespawn(30000);
        }
    }

    scheduleRespawn(delay) {
        let self = this;
        setTimeout(function () {
            if (self.respawnCallback) {
                self.respawnCallback();
            }
            self = null;
        }, delay);
    }

    onRespawn(callback) {
        this.respawnCallback = callback;
    }

    getState() {
        return [
            parseInt(this.id, 10),
            parseInt(this.type),
            parseInt(this.room.itemKind),
            (this.data && this.data.hasOwnProperty('name')) ? this.data.name : '' ,
            parseInt(this.map.index),
            parseInt(this.x),
            parseInt(this.y),
            parseInt(this.orientation),
            parseInt(this.room.itemNumber)
        ];
    }

    getName() {
        return this.data.name;
    }

    toString(){
        return this.room.itemKind + " "
             + this.room.itemNumber + " "
             + this.room.itemDurability + " "
             + this.room.itemDurabilityMax + " "
             + this.room.itemExperience + " "
             + this.x + " "
             + this.y;
    }
}

export default Item;
