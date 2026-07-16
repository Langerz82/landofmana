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
        // FIX: was `val1 = 0; val2 = damage;`. getModDiff() below only
        // ever reads its `stat` param (this case's val1) and `statmax`
        // (left at 0 here, same as the "attack"/"defense" cases just
        // above) -- `statmod` (val2) is accepted but never actually used
        // anywhere in getModDiff(). So a percentage-based "damage" effect
        // (modValue < 1, meant to scale off the incoming `damage` amount
        // the same way "attack"/"defense" percentage effects scale off
        // the caster's current stat) always multiplied against the
        // hardcoded 0 in getModDiff()'s `diff = Math.round(diff * stat)`
        // branch, and then `if (stat === 0) return diff;` short-circuited
        // to 0 immediately after -- silently no-op'ing the whole effect.
        // Setting val1 (and val2, mirroring the attack/defense pattern)
        // to the real `damage` baseline lets the percentage branch -- and
        // the "nothing to take a % of yet" guard -- work off the actual
        // value instead of an always-0 placeholder. Flat per-level damage
        // effects (modValue >= 1, e.g. the two currently-defined "damage"
        // skills) are unaffected -- that branch never reads `stat` at all.
        val1 = val2 = damage;
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
        // FIX: this used to always call target.modHp(this.diff) directly,
        // for both healing (diff > 0) and damage (diff < 0 -- e.g. a
        // poison/DoT-style skill's "interval" phase). modHp()/_modHp()
        // never checks target.invincible -- that guard lives solely in
        // onDamage() (character.js) -- so a DoT effect already ticking on
        // a target that becomes invincible mid-duration (e.g. a mob's
        // invuln window while returning to spawn, mob.js's
        // returnToSpawn()) kept dealing damage every interval tick
        // regardless of invincibility. Routing negative diffs (actual
        // damage) through onDamage() instead closes that bypass, and as a
        // side effect also makes a killing DoT tick correctly trigger
        // Mob.die()/attacker-tracking the same way a normal hit does
        // (modHp() alone never did either). Healing (diff >= 0) is left on
        // the modHp() path unchanged -- invincible was never meant to
        // block being healed.
        if (this.diff < 0)
          target.onDamage(skillEffect.source, -this.diff, 0, false, 0);
        else
          target.modHp(this.diff);
        //target.stats.hp = Utils.clamp(0, target.stats.hpMax, target.stats.hp);
        //if (target instanceof Player)
          //target.sendChangePoints((target.stats.hp-oldhp),0);
        break;
      case "ep":
        target.modEp(this.diff);
        break;
      // FIX: "attack"/"defense"/"damage" used to do a flat
      // `target.stats.mod.<stat> = this.diff` here -- a straight
      // overwrite, not additive. That's fine for a single skill acting
      // alone (the only case exercised by the current skill roster: one
      // skill per affected stat), but two concurrently active effects on
      // the same stat would stomp on each other -- the second cast's
      // "start" would silently discard the first cast's bonus, and
      // whichever effect's "end" fired first would zero out *both* (every
      // skill's "end" entry uses modValue 0, so the reset was always to a
      // flat 0, not "subtract what I added"). Routed through
      // applyStacking() below instead, which tracks each cast's own
      // contribution separately (keyed on the per-cast SkillEffect
      // instance + target + stat) and adds/removes exactly that amount,
      // so multiple concurrent buffs on the same stat stack correctly and
      // each one's "end" only undoes its own share.
      case "attack":
        this.applyStacking(skillEffect, target, "attack");
        break;
      case "defense":
        this.applyStacking(skillEffect, target, "defense");
        break;
      case "damage":
        this.applyStacking(skillEffect, target, "damage");
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
      // NOTE: no skill in shared/data/skills2.json currently uses a "slow"
      // effect (grepped for it), so this branch is presently dead code --
      // but it looks broken for whenever one is added: unlike "attack"/
      // "defense"/"damage" above (which SET target.stats.mod.<stat> to a
      // freshly-computed diff every phase, including a modValue-of-0 "end"
      // entry that overwrites it back to 0), this ADDS modValue to
      // moveSpeed. A "start" (+X) then "end" (+0, going by the same
      // start/end pairing pattern every other effect in skills2.json uses)
      // would permanently leave moveSpeed slowed, never reversing it. It
      // also writes moveSpeed directly instead of going through
      // setMoveRate() (entitymoving.js), which is what keeps
      // `walkSpeed`/`tick` in sync with it -- `tick` in particular feeds
      // pathfinder.js's isDistanceTooFast() speed-hack check, so a
      // moveSpeed change that skips setMoveRate() could desync that too.
      // Left alone rather than guess-fixed, since the right fix depends on
      // the intended mechanic (e.g. should multiple stacking slows be
      // additive deltas restored on their own "end", or should this go
      // through setMoveRate() with a saved base speed) -- flagging for
      // whoever adds the first "slow" skill.
      case "slow":
        target.moveSpeed += this.modValue;
        break;
    }
    return;
  }

  // Applies this effect's contribution to target.stats.mod[stat]
  // additively instead of overwriting it, so multiple concurrently active
  // effects on the same stat (from different casts, possibly different
  // skills) stack instead of clobbering each other. `skillEffect` is the
  // per-cast SkillEffect instance (unlike `this`, the EffectType, which is
  // a shared singleton reused by every cast of this skill by every
  // player/mob -- see SkillData.Skills' construction in skilldata.js), so
  // it's the right place to remember exactly how much *this* cast added
  // for *this* target/stat: on "end" (or any removal), we subtract that
  // remembered amount instead of trusting the freshly-computed diff (which
  // is always 0 for an "end" phase, since every skill's "end" entry uses
  // modValue 0 -- see the FIX comment on the "slow" case below) to mean
  // "reset to zero" for the whole shared stat.
  applyStacking(skillEffect, target, stat) {
    skillEffect.appliedMods = skillEffect.appliedMods || {};
    const key = target.id + ":" + stat;
    const prevApplied = skillEffect.appliedMods[key] || 0;
    const newApplied = (this.phase === "end") ? 0 : this.diff;

    target.stats.mod[stat] = (target.stats.mod[stat] || 0) - prevApplied + newApplied;
    skillEffect.appliedMods[key] = newApplied;
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

    // FIX: this applies the "end" phase directly via effect.apply(), which
    // is what applyEffects("end", ...) above also does -- but unlike
    // applyEffects(), this never followed up with stopIntervalTicking() or
    // handler.removeSkillEffect(self) for the SkillEffect (`self`) being
    // ended. This is the path Character.die()/Mob.destroy() reach (via
    // Character.endEffects() -> skilleffect.endEffects()) when an entity
    // dies or is removed while effects are active on it -- without this
    // cleanup, each such SkillEffect's Scheduler-driven _tickInterval()
    // (effecthandler.js's startIntervalTicking()) kept firing every 2s for
    // up to its remaining duration, re-applying "interval"/"end" phases
    // against `this.targets` (which can include entities other than the
    // one that died/was removed, e.g. an AOE buff), and the dead
    // SkillEffect lingered in handler.skillEffects until it finally expired
    // on its own.
    endEffects() {
      for (const target of this.targets) {
        for (const self of target.activeEffects)
        {
          for (const effect of self.effectTypes)
            effect.apply(self, target, "end", 0);
          self.stopIntervalTicking();
          self.handler.removeSkillEffect(self);
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
