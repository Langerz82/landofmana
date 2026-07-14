import SkillData from './data/skilldata.js';
import { G_DEBUG } from './main.js';
import Scheduler from './scheduler.js';

// @entity Object reference to the owner of the effect.
// @isTarget false Self, true Target.
// @phase 0 start, 1 end, 2 interval, 3 beforehit, 4 onhit, 5 afterhit.
// @stat
// @modValue Fixed value adjustment per Level, if less than 1 its a % of val2.

/* global SkillData */

class EffectType {
  constructor(isTarget, phase, stat, modValue) {
    this.entity = null;
    this.isTarget = isTarget;
    this.phase = phase;
    this.stat = stat;
    this.modValue = parseFloat(modValue) || 0;
    this.active = false;
  }

  apply(skillEffect, target, phase, damage) {
    if (target.isDead)
      return;

    if (this.phase != phase)
      return;

    let val1 = 0, val2 = 0, statmax = 0;
    let runModDiff = true;
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
        target.modHp(this.diff);
        //target.stats.hp = Utils.clamp(0, target.stats.hpMax, target.stats.hp);
        //if (target instanceof Player)
          //target.sendChangePoints((target.stats.hp-oldhp),0);
        break;
      case "ep":
        target.modEp(this.diff);
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
      // FIX: both branches read `this.modVal`, which is never assigned
      // anywhere on this class -- only `this.modValue` (constructor above)
      // is real. `this.modVal` was always `undefined`: "freeze" always took
      // the else branch (`undefined === 1` is false), silently no-op'ing --
      // or actively un-freezing -- every freeze/stun effect; "slow" did
      // `moveSpeed += undefined`, permanently corrupting that entity's
      // moveSpeed to NaN (serialized straight to the client in
      // message.js's Move/MovePath messages).
      case "freeze":
        if (this.modValue === 1)
          target.freeze = true;
        else {
          target.freeze = false;
        }
        break;
      case "slow":
        target.moveSpeed += this.modValue;
        break;
    }
    return;
  }

  getModDiff(skillEffect, stat, statmod, statmax) {
    let diff = this.modValue * skillEffect.level;
    if (this.modValue < 1)
    {
      if (statmax > 0)
        diff = Math.round(diff * statmax);
      else
        diff = Math.round(diff * stat);
    } else {
      diff = Math.round(diff);
    }

    if (stat === 0)
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
}

class SkillEffect {
    constructor(handler, skillId, skillLevel) {
      this.handler = handler;
      this.source = handler.entity;
      this.skillId = Number(skillId);
      this.data = SkillData.Skills[skillId];
      // PERF: SkillEffect is constructed on every single skill cast (every
      // combat skill use, by every player/mob) -- this console.info ran
      // unconditionally, unlike the equivalent per-cast/per-hit logging
      // elsewhere in the codebase which is already gated behind G_DEBUG.
      if (G_DEBUG)
        console.info("SkillEffect - skillId:"+skillId);
      this.targetType = this.data.targetType;
      this.activeTimer = 0;
      this.duration = ((this.data.durationPL) ? (this.data.durationPL*this.level) : this.data.duration) || 0;
      this.duration = Number(this.duration) * 1000;
      this.countTotal = Number(this.data.countTotal) || 0;
      this.count = 0;
      this.effectTypes = this.data.effectTypes;
      this.level = Number(skillLevel);
      //this.isActive = false;
      // NOTE: used to hold a per-instance setInterval() handle; replaced by
      // a self-rescheduling Scheduler token (see startIntervalTicking()/
      // stopIntervalTicking() below).
      this.intervalToken = null;
      this.targets = [];
    }

    getTargets(target, x, y) {
      switch (this.targetType) {
        case "self":
          return [this.source];
        case "enemy":
          return [target];
        case "ally":
          return [target];
        // NOTE: these two `case` bodies used to both declare `var arr`
        // with no block braces of their own -- harmless under `var`
        // (function-scoped, and only one case ever runs per call since
        // each returns immediately), but `let`/`const` forbid redeclaring
        // in the same block scope, and a bare `switch` body is one shared
        // block across every case. Wrapping each case in its own `{ }`
        // gives each `arr` its own scope.
        case "ally_aoe": {
          const arr = target.map.entities.getPlayerAround(target, this.data.aoe);
          arr.unshift(this.source);
          return arr;
        }
        case "enemy_aoe": {
          const arr = target.map.entities.getMobsAround(target, this.data.aoe);
          arr.unshift(target);
          return arr;
        }
      };
      return [];
    }

    apply(target, targetX, targetY) {
      if (this.duration > 0) {
        this.activeTimer = 0;
        this.startIntervalTicking();
      }

      if (this.countTotal > 0)
        this.count = 0;

      this.targets = this.getTargets(target, targetX, targetY);
      //this.isActive = true;
      this.applyEffects("start",0);

    }

    // PERF: was registering with a dedicated per-file setInterval (a second,
    // separate 2000ms Node timer alongside every other one-shot timer in the
    // codebase). Now self-reschedules through the shared Scheduler
    // (gameserver/js/scheduler.js) -- same 2000ms cadence as before, but
    // sharing that one codebase-wide 50ms tick instead of running its own.
    // Scheduler.cancel() is a safe no-op for an already-fired/never-set
    // token, so there's no need for the old "clear any existing interval
    // first" guard either.
    startIntervalTicking() {
      this.intervalToken = Scheduler.schedule(() => this._tickInterval(), 2000);
    }

    stopIntervalTicking() {
      Scheduler.cancel(this.intervalToken);
      this.intervalToken = null;
    }

    // Invoked ~2000ms after the last startIntervalTicking()/_tickInterval()
    // call, for as long as this effect keeps rescheduling itself. Identical
    // body/cadence to the old per-instance setInterval callback -- the only
    // difference is _tickInterval() now has to explicitly reschedule the
    // next tick itself (startIntervalTicking() again) instead of an interval
    // firing forever on its own; ending (the `if` branch) simply stops
    // rescheduling.
    _tickInterval() {
      if (this.activeTimer >= this.duration) {
        this.applyEffects("end", 0);
      } else {
        this.applyEffects("interval", 0);
        this.activeTimer += 2000;
        this.startIntervalTicking();
      }
    }

    applyEffect(effect, target, phase, damage)
    {
        let index = target.activeEffects.indexOf(this);
        if (phase==="start" && index < 0) {
          target.activeEffects.push(this);
          index = target.activeEffects.indexOf(this);
        }

        effect.apply(this, target, phase, damage);

        //var index2 = target.activeEffects.indexOf(this);
        if (phase==="end" && index >= 0) {
          target.activeEffects.splice(index, 1);
        }
    }

    applyEffects(phase, damage) {
      for (const effect of this.effectTypes) {
        if (effect.phase === phase) {
            if (effect.isTarget) {
              for (const target of this.targets) {
                this.applyEffect(effect, target, phase, damage);
              }
            }
            else {
              this.applyEffect(effect, this.source, phase, damage);
            }
        }
      }

      if (phase === "end") {
        this.count = 0;
        this.activeTimer = 0;
        // PERF: cancel any pending reschedule now that this effect is done
        // -- a harmless no-op if none is pending (e.g. a duration===0
        // effect never had one, or _tickInterval() itself is what got us
        // here and already didn't reschedule).
        this.stopIntervalTicking();
        this.handler.removeSkillEffect(this);
      }
    }

    endEffects() {
      for (const target of this.targets) {
        for (const self of target.activeEffects)
        {
          for (const effect of self.effectTypes)
            effect.apply(self, target, "end", 0);
        }
        target.activeEffects = [];
      }
    }

    onInterval(phase, damage) {
      if (this.duration != 0)
        return;

      this.applyEffects(phase,damage);

      if (phase==="afterhit" && this.countTotal > 0
        && this.count === this.countTotal)
      {
        this.applyEffects("end",0);
        //this.isActive = false;
        this.count = 0;
        return;
      }

      if (phase==="onhit" && this.countTotal > 0)
      {
        this.count++;
      }
    }
}

class SkillEffectHandler {
    constructor(entity) {
      this.entity = entity;
      this.skills = entity.skills;
      this.skillEffects = [];

      /*for (var skill of this.skills) {
        this.skillEffects.push( new SkillEffect(this, skill.skillIndex, skill.skillLevel));
      }*/
    }

    interval(phase, damage) {
      damage = damage || 0;
      for (const skillEffect of this.entity.activeEffects)
        skillEffect.onInterval(phase, damage);
    }

    cast(skillId, target, x, y) {
      //var skillEffect = this.skillEffects[skillId];
      const skill = this.skills[skillId];
      const skillLevel = skill.skillLevel;
      const skillEffect = new SkillEffect(this, skillId, skillLevel);
      this.skillEffects.push(skillEffect);
      //var skill = this.skills[skillId];
      skill.xp(1);
      skillEffect.level = skill.skillLevel;
      skillEffect.apply(target, x, y);
    }

    removeSkillEffect(skillEffect) {
      const index = this.skillEffects.indexOf(skillEffect);
      if (index >= 0)
        this.skillEffects.splice(index, 1);
    }
}

// NOTE: the original CommonJS file did `module.exports = EffectType;` then
// `module.exports = SkillEffect;` then `module.exports = SkillEffectHandler;`
// in sequence -- each overwrote the previous, so only SkillEffectHandler was
// ever actually importable (`require('./effecthandler')` === SkillEffectHandler).
// That default-export behavior is preserved below; EffectType/SkillEffect are
// additionally exposed as named exports since they're genuinely useful and
// were previously just unreachable dead exports due to the overwrite bug.
export { EffectType, SkillEffect };
export default SkillEffectHandler;
