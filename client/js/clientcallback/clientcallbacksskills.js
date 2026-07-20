// Mixin extracted from clientcallbacks.js: Skill load/XP/effects callbacks.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
/* global game */

export function installClientCallbacksSkills(proto) {

      proto.onSkillLoad = function(datas) {
            const skillIndex = Number(datas[0]);
            const skillExp = Number(datas[1]);

            // FIX: missing var - was an implicit global
            const skillLevel = Types.getSkillLevel(skillExp);
            game.player.skillHandler.setSkill(skillIndex, skillExp);
            game.skillsDialog.page.setSkill(skillIndex, skillLevel);
      };


      proto.onSkillXP = function(data) {
            const skillCount = Number(data.shift());

            if (skillCount === 0)
              return;

            for (let i = 0; i < skillCount; ++i)
            {
              game.player.skillHandler.setSkill(
                Number(data[i*2]),
                Number(data[i*2+1]));
            }
      };


      proto.onSkillEffects = function(data){
          // stub for now.
      };

}
