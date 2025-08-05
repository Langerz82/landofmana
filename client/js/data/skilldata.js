/* global Types */
EffectType = Class.extend({
  init: function (isTarget, phase, stat, modValue) {
    this.entity = null;
    this.isTarget = isTarget;
    this.phase = phase;
    this.stat = stat;
    this.modValue = modValue || 0;
    this.active = false;
  }
});

var getSkillEffects = function (data) {
	var effects = [];
	for (var rec of data) {
		effects.push(new EffectType((rec[0] === "target"), rec[1], rec[2], rec[3]));
	}
	return effects;
};


define(['text!../../shared/data/skills2.json'], function(SkillsJSON) {
	Skill = {};
	Skill.Data = [];
	//Skill.Names = {};
	//Skill.Ordered = [];
	var skillsParse = JSON.parse(SkillsJSON);
	//var i = 0;
	for (var i in skillsParse)
	{
		var value = skillsParse[i];

		//if (value === "undefined") continue;
		console.info(JSON.stringify(value));
		Skill.Data.push({
			name:value.name,
			iconOffset: value.iconOffset,
			detail: value.detail,
	    skillType:value.skillType,
	    targetType: value.targetType ? value.targetType : 0,
	    duration:value.duration ? value.duration : 0,
			durationPL:value.durationPL ? value.durationPL : 0,
	    recharge: value.recharge ? value.recharge*1000 : 0,
	    aoe: value.aoe ? value.aoe : 0,
			countTotal: value.countTotal ? value.countTotal : 0,
			effectTypes: getSkillEffects(value.effects)
		});
		//Skill.Names[value.name] = Skill.Data[i];
		//Skill.Ordered[j++] = Skill.Data[i];
	}

  Skill.jqShowSkill = function (jq, skillId, jqn) {
    var scale = 3;
    var position = Skill.Data[skillId].iconOffset;
    jq.css({
      'background-size': 'auto',
      'background-image': 'url("img/' + scale + '/misc/skillicons.png")',
      'background-position': (-position[0] * 24 * scale) + "px " + (-position[1] * 24 * scale) + "px",
      'background-repeat': 'no-repeat',
      'margin': '2px'
    });
    if (jqn) {
      jqn.html("");
		}
  };

	log.info(JSON.stringify(Skill));
  return Skill;
});
