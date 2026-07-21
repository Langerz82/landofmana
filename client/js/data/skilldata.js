// Converted from AMD (define) + Class.extend + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
//
// FIX (strict-mode compatibility): `EffectType = Class.extend({...})` and `Skill = {}` were bare
// global assignments (no var/let/const) in the original AMD file. ES modules always run in strict
// mode, where assigning to an undeclared identifier throws a ReferenceError instead of silently
// creating a global. Both are declared with `var` here. Verified nothing outside this file
// references either as a bare global - both were always accessed through the AMD module return
// value (e.g. `define(['data/skilldata'], function(SkillData) {...})`), so scoping them to this
// module only is safe.
/* global Types */
import fetchJsonSync from '../lib/fetchjsonsync.js';

class EffectType {
    constructor(isTarget, phase, stat, modValue) {
        this.entity = null;
        this.isTarget = isTarget;
        this.phase = phase;
        this.stat = stat;
        this.modValue = modValue || 0;
        this.active = false;
    }
}

const getSkillEffects = function (data) {
    const effects = [];
    for (let rec of data) {
        effects.push(
            new EffectType(rec[0] === 'target', rec[1], rec[2], rec[3])
        );
    }
    return effects;
};

const Skill = {};
Skill.Data = [];
const skillsParse = fetchJsonSync('shared/data/skills2.json');
for (const value of skillsParse) {
    Skill.Data.push({
        name: value.name,
        iconOffset: value.iconOffset,
        detail: value.detail,
        skillType: value.skillType,
        targetType: value.targetType || 0,
        duration: value.duration || 0,
        durationPL: value.durationPL || 0,
        recharge: value.recharge ? value.recharge * 1000 : 0,
        aoe: value.aoe || 0,
        countTotal: value.countTotal || 0,
        effectTypes: getSkillEffects(value.effects)
    });
}

Skill.jqShowSkill = function (jq, skillId, jqn, size) {
    const scale = 3;
    size = size || 1;
    size = size * 0.66;
    const position = Skill.Data[skillId].iconOffset;
    jq.css({
        'background-image': 'url("img/' + scale + '/misc/skillicons.png")',
        'background-position':
            -position[0] * 24 * scale * size +
            'px ' +
            -position[1] * 24 * scale * size +
            'px',
        'background-repeat': 'no-repeat',
        'background-size': 1080 * size + 'px ' + 1008 * size + 'px '
    });
    if (jqn) {
        jqn.html('');
    }
};

export default Skill;
