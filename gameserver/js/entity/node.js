/* global module */

var Entity = require('./entity');
var Utils = require('../utils');
var Messages = require('../message');


var Node = Entity.extend({
    init: function (id, kind, x, y, map, level, type) {
        this._super(id, Types.EntityTypes.NODE, kind, x, y, map);
        this.stats = {};
        this.level = level;

        this.setDrops();
        this.spawnDelay = 60000;

        this.spriteName = "nodeset"+kind;
        this.animName = "node"+type;
    },

    getState: function() {
      var arr = this._getBaseState();
      return arr.concat([this.level, this.spriteName, this.animName, this.weaponType]);
    },

    onDeath: function(callback) {
      this.death_callback = callback;
    },

    die: function() {
      this.isDead = true;
      this.map.entities.pushNeighbours(this, new Messages.Despawn(this));

      this.handleRespawn();
      if (this.death_callback) {
        this.death_callback();
      }
    },

    setDrops: function () {
      this.drops = {};

      if (this.kind == 2) {
        if (this.level == 1)
          this.drops[301] = 2000;
        if (this.level == 2)
          this.drops[302] = 2000;
        if (this.level == 3)
          this.drops[303] = 2000;
        else
          this.drops[304] = 2000;
      }
   },

   respawn: function () {
     this.isDead = false;
     this.map.entities.pushNeighbours(this, new Messages.Spawn(this));
   },

   handleRespawn: function () {
       var self = this;

       if (this.area && this.area instanceof Area) {
           // Respawn inside the area if part of a MobArea
           this.area.respawn(this, this.spawnDelay);
       }
       else {
           setTimeout(function () {
               self.respawn();
               if (self.respawnCallback) {
                   self.respawnCallback();
               }
           }, this.spawnDelay);
       }
   },

});

module.exports = Node;
