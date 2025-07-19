/* global Types */

define(['./entity'], function(Entity) {
  var Node = Entity.extend({
      init: function(id, map, kind) {
        this._super(id, Types.EntityTypes.NODE, map, kind);
        this.level = 0;
        this.stats = {};
        this.idleSpeed = 150+Utils.random(150);
      },

      resetHP: function () {
        this.stats.hp = this.stats.hpMax;
      },

      setHP: function (val) {
        val = val || this.stats.hpMax;
        this.stats.hp = val;
      },

      setMaxHP: function(hp) {
          this.stats.hpMax = hp;
          this.stats.hp = hp;
      },

      die: function () {
          //this.isDead = true;
          if (this.death_callback)
            this.death_callback();
      },

      onDeath: function(callback) {
          this.death_callback = callback;
      },

      getAnimationByName: function () {
        if (this.isDying)
          return this._super("death");

        return this._super(this.name);
      },
    });

  return Node;
});
