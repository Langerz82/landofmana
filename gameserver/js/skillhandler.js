import Messages from "./message.js";
import Timer from './timer.js';
import { Types } from './common.js';
import SkillData from './data/skilldata.js';
import { G_DEBUG } from './main.js';

/* global SkillData */

class SkillHandler {
    constructor(player) {
        player.skills = [];
        this.player = player;
        this.skills = this.player.skills;
    }
    clear() {
    }

    setSkills(player, skills)
    {
      for (let i = 0; i < skills.length; ++i)
      {
        const skill = new Skill(player, i, skills[i]);
        player.skills[i] = skill;
      }
    }

    // FIX: referenced a bare `player` identifier -- never defined anywhere in
    // this class (the constructor parameter is captured on `this.player`).
    // This export isn't currently called anywhere in the codebase, so it
    // never actually fired in practice, but fixed since it's public API.
    setSkill(index, exp) {
      const skill = this.player.skills[index];
      skill.skillXP = exp;
      skill.skillLevel = Types.getSkillLevel(exp);
    }

    setXPs()
    {
      const skillXPs = [];
      for(let i=0; i < this.skills.length; ++i) {
        const skill = this.skills[i];
        const xp = parseInt(skill.tempXP, 10);
        if (xp > 0)
        {
          skill.xp(xp);
          skillXPs.push(i,skill.skillXP)
          skill.tempXP = 0;
        }
      }
      if (skillXPs.length > 0)
        this.player.sendPlayer(new Messages.SkillXP(skillXPs));
    }
}


class Skill {
   constructor(player, skillIndex, skillXP)
   {
   	this.player = player;
    console.info("skillIndex:"+skillIndex);
   	this.skillData = SkillData.Skills[skillIndex];
   	this.skillIndex = skillIndex;
   	this.skillLevel = Types.getSkillLevel(skillXP);
   	this.skillXP = parseInt(skillXP, 10);
    this.tempXP = 0;

   	if (this.skillData.recharge > 0)
    {
   		this.skillCooldown = new Timer(this.skillData.recharge);
      this.skillCooldown.lastTime = 0;
    }
   }

   getSkill()
   {
	    return this.skillData;
   }

   isReady()
   {
   	// FIX: skillCooldown is only constructed when skillData.recharge > 0
   	// (see constructor above); any skill defined with recharge 0 has no
   	// skillCooldown, so calling .isOver() on it threw a TypeError every
   	// time a client tried to use that skill (packethandler.js gates
   	// CW_SKILL on isReady()). A skill with no cooldown is always ready.
   	return !this.skillCooldown || this.skillCooldown.isOver();
   }

   xp(amount)
   {
    if (amount === 0)
      return;

    // PERF: xp() runs on every combat skill use/XP gain for every
    // player -- this console.info ran unconditionally, unlike comparable
    // per-hit/per-cast logging elsewhere which is already gated behind
    // G_DEBUG.
    if (G_DEBUG)
      console.info("amount="+amount);
   	this.skillXP += parseInt(amount, 10);
   	const skillLevel = Types.getSkillLevel(this.skillXP, this.skillLevel);
   	if (skillLevel != this.skillLevel)
   	{
   		this.skillLevel = skillLevel;
      // FIX: `skillEffects` (effecthandler.js's SkillEffectHandler) is a
      // flat list of currently-*active* SkillEffect instances, pushed on
      // cast() and spliced out again once their "end" phase fires -- it is
      // NOT a fixed array with one stable slot per skill index (that would
      // have needed the commented-out pre-population loop in
      // SkillEffectHandler's constructor, which was never actually enabled).
      // Indexing it by `this.skillIndex` here assumed the old, unused
      // design: any time XP flushed in from setXPs() (every mob kill --
      // see callbacks/mobcallback.js's onKilled) pushed a skill to a new
      // level while `skillEffects` had fewer than skillIndex+1 entries --
      // i.e. essentially always, since active effects are transient --
      // this threw "Cannot set properties of undefined (setting 'level')"
      // and skipped the SkillLoad notify below entirely, silently failing
      // to tell the client about the level-up. Search for the (0 or more)
      // currently-active SkillEffect(s) that actually belong to this skill
      // instead, so an in-progress buff/DOT picks up the new level without
      // guessing at array position, and so leveling up with no active
      // effect (the common case) is simply a no-op here rather than a crash.
      for (const skillEffect of this.player.effectHandler.skillEffects) {
        if (skillEffect.skillId === this.skillIndex)
          skillEffect.level = skillLevel;
      }
   		this.player.sendPlayer(new Messages.SkillLoad(this.skillIndex, this.skillXP));
   	}
   }
}

export { Skill };
export default SkillHandler;
