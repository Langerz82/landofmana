/* global Types, module */

var Entity = require('./entity');

// TODO Make Item inherit from ItemRoom.

module.exports = Item = Entity.extend({
    init: function (type, id, itemRoom, x, y, map) {
				var kind = itemRoom.itemKind;
        this._super(id, type, kind, x, y, map);
        this.isStatic = false;
        this.isFromChest = false;
				this.orientation = Types.Orientations.DOWN;
        this.experience = 0;
        this.data = ItemData.Kinds[kind];
				this.room = itemRoom;
    },

    handleDespawn: function (params) {
        var self = this;

        this.blinkTimeout = setTimeout(function () {
            params.blinkCallback();
            self.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
        }, params.beforeBlinkDelay);
    },

    destroy: function () {
        if (this.blinkTimeout) {
            clearTimeout(this.blinkTimeout);
        }
        if (this.despawnTimeout) {
            clearTimeout(this.despawnTimeout);
        }

        if (this.isStatic) {
            this.scheduleRespawn(30000);
        }
    },

    scheduleRespawn: function (delay) {
        var self = this;
        setTimeout(function () {
            if (self.respawnCallback) {
                self.respawnCallback();
            }
        }, delay);
    },

    onRespawn: function (callback) {
        this.respawnCallback = callback;
    },
    getState: function() {
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
    },

    getName: function() {
    	return this.data.name;
    },

    toString: function(){
    return this.room.itemKind + " "
         + this.room.itemNumber + " "
         + this.room.itemDurability + " "
         + this.room.itemDurabilityMax + " "
         + this.room.itemExperience + " "
         + this.x + " "
         + this.y;
  }
});
