module.exports = MobCombat = cls.Class.extend({
  init: function(entity) {
    this.entity = entity;
  },

  baseCrit: function() {
    var entity = this.entity;

    var modDiff = 0;
    var statDiff = (entity.stats.attack+entity.stats.mod.attack);
    var chance = ~~(Utils.clamp(5, 500, ~~(statDiff + modDiff)));
    //console.info("player - baseCrit: "+chance);
    return chance;
  },

  baseCritDef: function() {
    var entity = this.entity;

    var modDiff = 0;
    var statDiff = (entity.stats.defense+entity.stats.mod.defense);
    var chance = ~~(Utils.clamp(5, 500, ~~(statDiff + modDiff)));
    //console.info("player - baseCritDef: "+chance);
    return chance;
  },

  baseDamage: function() {
    var entity = this.entity;

    var dealt, absorbed, dmg;

    dealt = ~~(entity.level * 12);
    dealt += (entity.stats.attack+entity.stats.mod.attack) * (6-Math.min(3, (entity.level * 0.1)));

    dmg = ~~(dealt);

    //console.info("player - baseDamage: "+dmg);
    return dmg;
  },

  baseDamageDef: function() {
    var entity = this.entity;

    var dealt, absorbed, dmg;

    dealt = ~~(entity.level * 2);
    dealt += ((entity.stats.defense+entity.stats.mod.defense) * 2);

    dmg = ~~(dealt);
    //console.info("player - baseDamageDef: "+dmg);
    return dmg;
  },

});
