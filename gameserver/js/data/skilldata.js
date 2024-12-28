var SkillsJSON = require("../../shared/data/skills2.json"),
		EffectHandler = require("../effecthandler");

var Skills = [];
//var SkillNames = {};

var getSkillEffects = function (data) {
	var effects = [];
	for (rec in data) {
		effects.push(new EffectType((rec[0] == 1), rec[1], rec[2], rec[3]));
	}
};

var i = 0;
//console.info(JSON.stringify(SkillsJSON));
for (var index in SkillsJSON)
{
	var value = SkillsJSON[index];
	console.info(index+"="+JSON.stringify(value));

	//if (!value.skillType)
		//continue;

	Skills.push({
			// Client-side only.
			//name:value.name,
			//iconOffset: value.iconOffset,
			//detail: value.detail,

	    skillType: value.skillType,
	    targetType: value.targetType ? value.targetType : 0,
	    duration:value.duration ? value.duration : 0,
			durationPL:value.durationPL ? value.durationPL : 0,
	    recharge: value.recharge ? value.recharge*1000 : 0,
	    aoe: value.aoe ? value.aoe : 0,
			countTotal: value.countTotal ? value.countTotal : 0,
			effectTypes: getSkillEffects(value.effects)
	});
}


console.info("skills: "+JSON.stringify(Skills));

module.exports.Skills = Skills;
