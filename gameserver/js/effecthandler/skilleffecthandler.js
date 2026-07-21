// Extracted from effecthandler.js: SkillEffectHandler, one instance per
// entity (see entity/player.js's `this.skills` wiring), tracking that
// entity's active SkillEffect casts. Behavior unchanged.
import { SkillEffect } from './skilleffect.js';

export class SkillEffectHandler {
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
