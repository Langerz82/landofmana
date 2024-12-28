//var cls = require('./lib/class');
var Area = require('./area'),
    Utils = require('../utils');

var EntityArea = Area.extend({
    init: function(id, x, y, width, height, map, elipse, excludeId) {
        this._super(id, x, y, width, height, map, elipse, excludeId);
        this.entities = [];
        this.hasCompletelyRespawned = true;
    },

    removeFromArea: function(entity) {
      var i = _.indexOf(_.pluck(this.entities, 'id'), entity.id);
      this.entities.splice(i, 1);

      if (this.isEmpty() && this.hasCompletelyRespawned && this.emptyCallback) {
        this.hasCompletelyRespawned = false;
        this.emptyCallback();
      }
    },

    onEmpty: function(callback) {
      this.emptyCallback = callback;
    },

    addToArea: function(entity) {
      if (entity && entity.kind !== null) {
        this.entities.push(entity);
        entity.area = this;
      }

      if (this.isFull()) {
        this.hasCompletelyRespawned = true;
      }
    },

    setNumberOfEntities: function(nb) {
      this.nbEntities = nb;
    },

    isEmpty: function() {
      return !_.any(this.entities, function(entity) {
        return !entity.isDead;
      });
    },

    isFull: function() {
      return !this.isEmpty() && (this.nbEntities === _.size(this.entities));
    },

    respawn: function(entity, delay) {
        var self = this;
        delay = entity.spawnDelay || delay;

        this.removeFromArea(entity);

        setTimeout(function() {
          var	pos = self.map.entities.spaceEntityRandomApart(2, self._getRandomPositionInsideArea.bind(self,20), self.entities);

          var x=pos.x, y=pos.y;
          entity.spawnX = entity.x = x;
          entity.spawnY = entity.y = y;
          entity.respawn();
        }, delay);
    },


});

module.exports = EntityArea;
