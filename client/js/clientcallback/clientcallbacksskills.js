// Mixin extracted from clientcallbacks.js: Skill load/XP/effects callbacks.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
/* global game */

export function installClientCallbacksSkills(proto) {
    proto.onSkillLoad = function (datas) {
        const skillIndex = Number(datas[0]);
        const skillExp = Number(datas[1]);

        // FIX: missing var - was an implicit global
        const skillLevel = Types.getSkillLevel(skillExp);
        game.player.skillHandler.setSkill(skillIndex, skillExp);
        // FIX: `game.skillsDialog` does not exist (game.js only sets up `game.skillDialog`,
        // see clientcallbacksplayerstate.js's onPlayer using `game.skillDialog.page.setSkills`)
        // -- this threw "Cannot read properties of undefined" on every WC_SKILLLOAD packet.
        game.skillDialog.page.setSkill(skillIndex, skillLevel);
    };

    proto.onSkillXP = function (data) {
        const skillCount = Number(data.shift());

        if (skillCount === 0) return;

        for (let i = 0; i < skillCount; ++i) {
            game.player.skillHandler.setSkill(
                Number(data[i * 2]),
                Number(data[i * 2 + 1])
            );
        }
    };

    proto.onSkillEffects = function (data) {
        // stub for now.
    };
}
