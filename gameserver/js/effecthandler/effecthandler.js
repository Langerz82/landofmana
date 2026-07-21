// Split (see effecthandler/ folder): this file used to define EffectType,
// SkillEffect, and SkillEffectHandler all in one ~500-line file. Each class
// now lives in its own file under effecthandler/; this file just re-exports
// them under the same names/shape every external caller already expects.
//
// NOTE: the original CommonJS file did `module.exports = EffectType;` then
// `module.exports = SkillEffect;` then `module.exports = SkillEffectHandler;`
// in sequence -- each overwrote the previous, so only SkillEffectHandler was
// ever actually importable (`require('./effecthandler')` === SkillEffectHandler).
// That default-export behavior is preserved below; EffectType/SkillEffect are
// additionally exposed as named exports since they're genuinely useful and
// were previously just unreachable dead exports due to the overwrite bug.
export { EffectType } from './effecttype.js';
export { SkillEffect } from './skilleffect.js';
export { SkillEffectHandler } from './skilleffecthandler.js';
export { SkillEffectHandler as default } from './skilleffecthandler.js';
