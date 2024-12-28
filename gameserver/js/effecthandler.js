
// @entity Object reference to the owner of the effect.
// @isTarget false Self, true Target.
// @phase 0 start, 1 end, 2 timer interval, 3 before hit, 4 after hit.
// @stat HP: 0, EP: 1, ATTACK: 2, DEFENSE: 3, etc. (See SkillEfects.EffectStat).
// @modValue Fixed value adjustment per Level, if less than 1 its a % of val2.

EffectType = cls.Class.extend({
  init: function (isTarget, phase, stat, modValue) {
    this.entity = null;
    this.isTarget = isTarget;
    this.phase = phase;
    this.stat = stat;
    this.modValue = modValue || 0;
    this.active = false;
  },

  apply: function (target, isTarget, phase, damage) {
    if (this.phase != phase)
      return;

    if (isTarget == this.isTarget)
      return;

    var val1 = 0, val2 = 0, vmax = 0;
    switch (this.stat)
    {
      case SkillEffects.EffectStat.HP:
        val1 = target.stats.hp;
        vmax = val2 = target.stats.hpMax;
        break;
      case SkillEffects.EffectStat.EP:
        val1 = target.stats.ep;
        vmax = val2 = target.stats.epMax;
        break;
      case SkillEffects.EffectStat.ATTACK:
        val2 = val1 = target.stats.attack;
        break;
      case SkillEffects.EffectStat.DEFENSE:
        val2 = val1 = target.stats.defense;
        break;
    }
    if (damage > 0) {
      switch (this.stat)
      {
        case SkillEffects.EffectStat.DAMAGE:
          val1 = target.stats.hp;
          val2 = damage;
          vmax = target.stats.hpMax;
          break;
      }
    }

    if (val1 > 0 && val2 > 0)
    {
      this.getModDiff(val1, val2, vmax);
    }

    switch (this.stat)
    {
      case SkillEffects.EffectStat.HP:
        target.stats.hp += this.diff;
        Utils.clamp(0, target.stats.hpMax, target.stats.hp);
        break;
      case SkillEffects.EffectStat.EP:
        target.stats.ep += this.diff;
        Utils.clamp(0, target.stats.epMax, target.stats.ep);
        break;
      case SkillEffects.EffectStat.ATTACK:
        //if (this.diff > target.stats.mod.attack) {
          target.stats.mod.attack = this.diff;
          //this.active = true;
        //}
        break;
      case SkillEffects.EffectStat.DEFENSE:
        //if (this.diff > target.stats.mod.defense) {
          target.stats.mod.defense = this.diff;
          //this.active = true;
        //}
        break;
      case SkillEffects.EffectStat.DAMAGE:
        target.stats.mod.damage = this.diff;
      case SkillEffects.EffectStat.FREEZE:
        if (this.modVal == 1)
          target.freeze = true;
        else {
          target.freeze = false;
        }
        break;
      case SkillEffects.EffectStat.MOVESPEED:
        target.moveSpeed += this.modVal;
        break;
    }
    return;
  },

  getModDiff: function (stat, statmod, vmax) {
    var modVal = this.modValue * this.level;
    if (effectType.modValue < 1)
    {
      modVal = ~~(statmod * this.modValue * this.level);
    }
    var diff = modVal;

    stat += modVal;
    if (vmax > 0) {
      if (stat > vmax)
        diff -= (stat - vmax);
    }
    if (stat < 0) {
      diff = stat;
    }
    this.diff = diff;
    return diff;
  }
});

var SkillEffect = cls.Class.extend({
    init: function (source, skillId, skillLevel) {
      this.source;
      this.skillId = skillId;
      this.data = SkillData.Skills[skillId];
      console.info("SkillEffect - skillId:"+skillId);
      this.targetType = this.data.targetType;
      this.activeTimer = 0;
      this.duration = ((this.data.durationPL) ? (this.data.durationPL*this.level) : this.data.duration) || 0;
      this.duration *= 1000;
      this.countTotal = this.data.total || 0;
      this.count = 0;
      this.effectTypes = this.data.effectTypes;
      this.level = skillLevel;
      this.isActve = false;
      this.interval = null;
      this.targets = [];
    },

    getTargets: function (target, x, y) {
      switch (this.targetType) {
        case SkillEffects.TargetType.SELF:
          return [this.source];
        case SkillEffects.TargetType.ENEMY:
          return [this.source, target];
        case SkillEffects.TargetType.PLAYER_AOE:
          var arr = target.maps.entities.getPlayerAround(target, this.data.aoe);
          arr.unshift(this.source);
          return arr;
        case SkillEffects.TargetType.ENEMY_AOE:
          var arr = target.maps.entities.getMobsAround(target, this.data.aoe);
          arr.unshift(this.source, this.target);
          return arr;
      };
      return [];
    },

    apply: function (target, targetX, targetY) {
      var self = this;
      if (this.duration > 0) {
        this.activeTimer = 0;
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        this.interval = setInterval(function () {
          if (self.activeTimer > self.duration) {
           self.applyEffects(1,0);
           self.isActive = false;
           clearInterval(self.interval);
           self.interval = null;
          }
          else{
            self.applyEffects(2,0);
            self.activeTimer += 1000;
          }
        }, 1000);
      }

      if (this.countTotal > 0)
        this.count = 0;

      this.targets = this.getTargets(target, targetX, targetY);
      this.isActive = true;
      this.applyEffects(0,0);

    },

    applyEffects: function (phase, damage) {
      for (var target of this.targets) {
        for (var effect in this.effectTypes) {
          if (this.isActive)
            effect.apply(target, (this.source != target), phase, damage);
        }
      }
    },

    onInterval: function (phase, damage) {
      if (this.countTotal > 0 && this.count == this.countTotal)
      {
        this.applyEffects(1,0);
        this.isActive = false;
        return;
      }

      this.applyEffects(phase,damage);

      if (this.countTotal > 0 && phase==5)
      {
        this.count++;
      }
    },
});

var SkillEffectHandler = cls.Class.extend({
    init: function (entity) {
      this.entity = entity;
      this.skillEffects = [];

      for (var skill of this.entity.skills) {
        this.skillEffects.push( new SkillEffect(this.entity, skill.skillIndex, skill.skillLevel));
      }
    },

    interval: function(phase, damage) {
      damage = damage || 0;
      for (var effect of this.skillEffects)
        effect.onInterval(phase, damage);
    },

    cast: function (skillId, target, x, y) {
      this.skillEffects[skillId].apply(target, x, y);
    },
});

module.exports = EffectType;
module.exports = SkillEffect;
module.exports = SkillEffectHandler;
