// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types */
import fetchJsonSync from '../lib/fetchjsonsync.js';

const MobData = {};
MobData.Kinds = {};
MobData.Properties = {};
const mobParse = fetchJsonSync('shared/data/mobs.json');
for (const [key, value] of Object.entries(mobParse)) {
    const mob = {
        key: key.toLowerCase(),
        kind: value.kind,

        attack: value.attackMod ? value.attackMod * 4 : 4,
        defense: value.defenseMod ? value.defenseMod * 3 : 40,
        hp: value.hpMod ? value.hpMod * 200 : 200,
        xp: value.xpMod ? value.xpMod * 30 : 30,

        level: value.level || 0,
        minLevel: value.minLevel || 0,
        maxLevel: value.maxLevel || 0,

        aggroRange: value.aggroRange ? value.aggroRange + 1 : 4,
        attackRange: value.attackRange || 1,
        isAggressive: value.isAggressive === 1,

        attackRate: value.attackRateMod ? value.attackRateMod * 1000 : 1000,
        reactionDelay: value.reactionMod ? value.reactionMod * 768 : 768,
        moveSpeed: value.moveSpeedMod
            ? ~~(300 + 200 * value.moveSpeedMod)
            : 500,
        idleSpeed: value.idleSpeedMod ? value.idleSpeedMod * 1000 : 1000,

        respawn: value.respawnMod ? value.respawnMod * 60000 : 60000,
        dropRate: value.dropRate || 1,
        spawnChance: value.spawnChance || 50,

        dropBonus: value.dropBonus || 0,
        drops: value.drops || null,
        spriteName: value.spriteName
    };
    MobData.Properties[key.toLowerCase()] = mob;
    MobData.Kinds[value.kind] = mob;
}

export default MobData;
