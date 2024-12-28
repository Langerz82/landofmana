var Messages = require("./message.js");

module.exports = SkillHandler = cls.Class.extend({
    init: function(player) {
        player.skills = [];
        this.player = player;
        this.skills = this.player.skills;
    },
    clear: function() {
    },

    setSkills: function (player, skills)
    {
      for (var i = 0; i < skills.length; ++i)
      {
        var skill = new Skill(player, i, skills[i]);
        player.skills[i] = skill;
      }
    },

    setSkill: function (index, exp) {
      var skill = player.skills[index];
      skill.skillXP = exp;
      skill.skillLevel = Types.getSkillLevel(exp);
    },

    setXPs: function ()
    {
      var skillXPs = [];
      for(var i=0; i < this.skills.length; ++i) {
        var skill = this.skills[i];
        var xp = parseInt(skill.tempXP);
        if (xp > 0)
        {
          skill.xp(xp);
          skillXPs.push(i,skill.skillXP)
          skill.tempXP = 0;
        }
      }
      if (skillXPs.length > 0)
        this.player.map.entities.pushToPlayer(this.player, new Messages.SkillXP(skillXPs));
    }
});


Skill = cls.Class.extend({
   init: function (player, skillIndex, skillXP)
   {
   	this.player = player;
    console.info("skillIndex:"+skillIndex);
   	this.skillData = SkillData.Skills[skillIndex];
   	this.skillIndex = skillIndex;
   	this.skillLevel = Types.getSkillLevel(skillXP);
   	this.skillXP = skillXP;
    this.tempXP = 0;

   	if (this.skillData.recharge > 0)
    {
   		this.skillCooldown = new Timer(this.skillData.recharge);
      this.skillCooldown.lastTime = 0;
    }
   },

   getSkill: function ()
   {
	    return this.skillData;
   },

   isReady: function ()
   {
   	return this.skillCooldown.isOver();
   },

   xp: function (amount)
   {
    if (amount == 0)
      return;

    console.info("amount="+amount);
   	this.skillXP += amount;
   	var skillLevel = Types.getSkillLevel(this.skillXP, this.skillLevel);
   	if (skillLevel != this.skillLevel)
   	{
   		this.skillLevel = skillLevel;
   		this.player.map.entities.pushToPlayer(this.player, new Messages.SkillLoad(this.skillIndex, this.skillXP));
   	}
   }
});
