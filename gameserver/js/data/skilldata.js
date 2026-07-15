import SkillsJSON from "../../shared/data/skills2.json" with { type: 'json' };
import { EffectType } from "../effecthandler.js";

const Skills = [];
//var SkillNames = {};

const getSkillEffects = function (data) {
	const effects = [];
	for (const rec of data) {
		effects.push(new EffectType((rec[0] === "target"), rec[1], rec[2], rec[3]));
	}
	return effects;
};

// NOTE: was `const i = 0;` here, unused -- dead even under the old `var i=0;`
// this was ported from (nothing in the loop below ever read it; same pattern
// already cleaned up in a couple of other files in this codebase).
//console.info(JSON.stringify(SkillsJSON));
for (const index in SkillsJSON)
{
	const value = SkillsJSON[index];
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

export { Skills };
export default { Skills };
