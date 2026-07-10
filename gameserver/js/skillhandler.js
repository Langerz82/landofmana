import Messages from "./message.js";
import Timer from './timer.js';
import { Types } from './common.js';
import SkillData from './data/skilldata.js';

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
   	return this.skillCooldown.isOver();
   }

   xp(amount)
   {
    if (amount === 0)
      return;

    console.info("amount="+amount);
   	this.skillXP += parseInt(amount, 10);
   	const skillLevel = Types.getSkillLevel(this.skillXP, this.skillLevel);
   	if (skillLevel != this.skillLevel)
   	{
   		this.skillLevel = skillLevel;
      this.player.effectHandler.skillEffects[this.skillIndex].level = skillLevel;
   		this.player.sendPlayer(new Messages.SkillLoad(this.skillIndex, this.skillXP));
   	}
   }
}

export { Skill };
export default SkillHandler;
