// Extracted from effecthandler.js: SkillEffect, the per-cast instance of an
// EffectType's owning skill (one created per cast, see
// SkillEffectHandler.cast() in skilleffecthandler.js). Behavior unchanged.
import SkillData from '../data/skilldata.js';
import { G_DEBUG } from '../constants.js';
import Scheduler from '../scheduler.js';

/* global SkillData */

export class SkillEffect {
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
