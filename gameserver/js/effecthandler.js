
// @entity Object reference to the owner of the effect.
// @isTarget false Self, true Target.
// @phase 0 start, 1 end, 2 interval, 3 beforehit, 4 onhit, 5 afterhit.
// @stat
// @modValue Fixed value adjustment per Level, if less than 1 its a % of val2.

EffectType = cls.Class.extend({
  init: function (isTarget, phase, stat, modValue) {
    this.entity = null;
    this.isTarget = isTarget;
    this.phase = phase;
    this.stat = stat;
    this.modValue = parseFloat(modValue) || 0;
    this.active = false;
  },

  apply: function (skillEffect, target, phase, damage) {
    if (target.isDead || target.isDying)
      return;

    if (this.phase != phase)
      return;

    var val1 = 0, val2 = 0, statmax = 0;
    var runModDiff = true;
    switch (this.stat)
    {
      case "hp":
        val1 = target.stats.hp;
        statmax = val2 = target.stats.hpMax;
        break;
      case "ep":
        val1 = target.stats.ep;
        statmax = val2 = target.stats.epMax;
        break;
      case "attack":
        val2 = val1 = target.stats.attack;
        break;
      case "defense":
        val2 = val1 = target.stats.defense;
        break;
      case "damage":
        val1 = 0;
        val2 = damage;
        break;
      default:
        runModDiff = false;
        break;
    }

    if (runModDiff)
      this.diff = this.getModDiff(skillEffect, val1, val2, statmax);

    switch (this.stat)
    {
      case "hp":
        //var oldhp = target.stats.hp;
        //target.stats.hp += this.diff;
        target.modHealthBy(this.diff);
        //target.stats.hp = Utils.clamp(0, target.stats.hpMax, target.stats.hp);
        //if (target instanceof Player)
          //target.sendChangePoints((target.stats.hp-oldhp),0);
        break;
      case "ep":
        target.stats.ep += this.diff;
        target.stats.ep = Utils.clamp(0, target.stats.epMax, target.stats.ep);
        break;
      case "attack":
        //if (this.diff > target.stats.mod.attack) {
          target.stats.mod.attack = this.diff;
          //this.active = true;
        //}
        break;
      case "defense":
        //if (this.diff > target.stats.mod.defense) {
          target.stats.mod.defense = this.diff;
          //this.active = true;
        //}
        break;
      case "damage":
        target.stats.mod.damage = this.diff;
        break;
      case "freeze":
        if (this.modVal == 1)
          target.freeze = true;
        else {
          target.freeze = false;
        }
        break;
      case "slow":
        target.moveSpeed += this.modVal;
        break;
    }
    return;
  },

  getModDiff: function (skillEffect, stat, statmod, statmax) {
    var diff = this.modValue * skillEffect.level;
    if (this.modValue < 1)
    {
      if (statmax > 0)
        diff = Math.round(diff * statmax);
      else
        diff = Math.round(diff * stat);
    } else {
      diff = Math.round(diff);
    }

    if (stat == 0)
      return diff;

    if (diff > 0)
    {
      if (statmax > 0) {
        if ((stat + diff) > statmax)
          diff = statmax - stat;
      }
    }
    else if (diff < 0) {
      if ((stat + diff) < 0)
        diff = -stat;
    }
    return diff;
  }
});

var SkillEffect = cls.Class.extend({
    init: function (handler, skillId, skillLevel) {
      this.handler = handler;
      this.source = handler.entity;
      this.skillId = skillId;
      this.data = SkillData.Skills[skillId];
      console.info("SkillEffect - skillId:"+skillId);
      this.targetType = this.data.targetType;
      this.activeTimer = 0;
      this.duration = ((this.data.durationPL) ? (this.data.durationPL*this.level) : this.data.duration) || 0;
      this.duration *= 1000;
      this.countTotal = this.data.countTotal || 0;
      this.count = 0;
      this.effectTypes = this.data.effectTypes;
      this.level = skillLevel;
      //this.isActive = false;
      this.interval = null;
      this.targets = [];
    },

    getTargets: function (target, x, y) {
      switch (this.targetType) {
        case "self":
          return [this.source];
        case "enemy":
          return [target];
        case "ally":
          return [target];
        case "ally_aoe":
          var arr = target.map.entities.getPlayerAround(target, this.data.aoe);
          arr.unshift(this.source);
          return arr;
        case "enemy_aoe":
          var arr = target.map.entities.getMobsAround(target, this.data.aoe);
          arr.unshift(target);
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
           self.applyEffects("end",0);
           //self.isActive = false;
           clearInterval(self.interval);
           self.interval = null;
          }
          else{
            self.applyEffects("interval",0);
            self.activeTimer += 2000;
          }
        }, 2000);
      }

      if (this.countTotal > 0)
        this.count = 0;

      this.targets = this.getTargets(target, targetX, targetY);
      //this.isActive = true;
      this.applyEffects("start",0);

    },

    applyEffect: function (effect, target, phase, damage)
    {
        var index = target.activeEffects.indexOf(this);
        if (index < 0) {
          target.activeEffects.push(this);
        }

        effect.apply(this, target, phase, damage);

        //var index2 = target.activeEffects.indexOf(this);
        if (index >= 0 && phase == "end") {
          target.activeEffects.splice(index, 1);
        }
    },

    applyEffects: function (phase, damage) {
      for (var effect of this.effectTypes) {
        if (effect.phase == phase) {
            if (effect.isTarget) {
              for (var target of this.targets) {
                this.applyEffect(effect, target, phase, damage);
              }
            }
            else {
              this.applyEffect(effect, this.source, phase, damage);
            }
        }
      }
      if (phase == "end") {
        this.count = 0;
        this.activeTimer = 0;
        this.handler.removeSkillEffect(this);
      }
    },

    endEffects: function () {
      for (var target of this.targets) {
        for (var self of target.activeEffects)
        {
          for (var effect of self.effectTypes)
            effect.apply(self, target, "end", 0);
        }
        target.activeEffects = [];
      }
    },

    onInterval: function (phase, damage) {
      if (this.duration != 0)
        return;

      this.applyEffects(phase,damage);

      if (phase=="afterhit" && this.countTotal > 0
        && this.count == this.countTotal)
      {
        this.applyEffects("end",0);
        //this.isActive = false;
        this.count = 0;
        return;
      }

      if (phase=="onhit" && this.countTotal > 0)
      {
        this.count++;
      }
    },
});

var SkillEffectHandler = cls.Class.extend({
    init: function (entity) {
      this.entity = entity;
      this.skills = entity.skills;
      this.skillEffects = [];

      /*for (var skill of this.skills) {
        this.skillEffects.push( new SkillEffect(this, skill.skillIndex, skill.skillLevel));
      }*/
    },

    interval: function(phase, damage) {
      damage = damage || 0;
      for (var skillEffect of this.entity.activeEffects)
        skillEffect.onInterval(phase, damage);
    },

    cast: function (skillId, target, x, y) {
      //var skillEffect = this.skillEffects[skillId];
      var skill = this.skills[skillId];
      var skillLevel = skill.skillLevel;
      var skillEffect = new SkillEffect(this, skillId, skillLevel);
      this.skillEffects.push(skillEffect);
      //var skill = this.skills[skillId];
      skill.xp(1);
      skillEffect.level = skill.skillLevel;
      skillEffect.apply(target, x, y);
    },

    removeSkillEffect: function (skillEffect) {
      var index = this.skillEffects.indexOf(skillEffect);
      if (index >= 0)
        this.skillEffects.splice(index, 1);
    },
});

module.exports = EffectType;
module.exports = SkillEffect;
module.exports = SkillEffectHandler;
