import _ from 'underscore';
import Mobs from "../../shared/data/mobs.json" with { type: 'json' };

var Properties = {};
var Kinds = {};
_.each( Mobs, function( value, key ) {
	var mob = Properties[key.toLowerCase()] = {
		key: key.toLowerCase(),
		kind: value.kind,

		attackMod: (value.attackMod) ? value.attackMod : 1,
		defenseMod: (value.defenseMod) ? value.defenseMod : 1,
		attackRateMod: (value.attackRateMod) ? 1/value.attackRateMod : 1,
		hpMod: (value.hpMod) ? value.hpMod : 1,

		attack: (value.attackMod) ? (value.attackMod * 3) : 3,

		defense: (value.defenseMod) ? (value.defenseMod * 3) : 3,

		hp: (value.hpMod) ? (value.hpMod * 150) : 150,
		ep: (value.epMod) ? (value.epMod * 50) : 0,
		xp: (value.xpMod) ? (value.xpMod * 10) : 10,

		//level: (value.level) ? value.level : 0,
		minLevel: (value.minLevel) ? value.minLevel : 1,
		maxLevel: (value.maxLevel) ? value.maxLevel : 99,

		aggroRange: (value.aggroRange) ? value.aggroRange+1 : 4,
		attackRange: (value.attackRange) ? value.attackRange : 1,
		isAggressive: (value.isAggressive === 1) ? true : false,

		attackRate: (value.attackRateMod) ? (value.attackRateMod * 1500) : 1500,

		reactionDelay: (value.reactionMod) ? (value.reactionMod * 256) : 256,
		moveSpeed: (value.moveSpeedMod) ? ~~(300 + (200 * value.moveSpeedMod)) : 500,
		//tick: 1, //(value.moveSpeedMod) ? (value.moveSpeedMod*2) : 2,
		respawn: (value.respawnMod) ? (value.respawnMod * 30000) : 30000,
		dropRate: (value.dropRate) ? value.dropRate : 1,
		spawnChance: (value.spawnChance) ? value.spawnChance : 50,

		dropBonus: (value.dropBonus) ? value.dropBonus : 0,
		drops: (value.drops) ? value.drops : null,
		modDamage: {"hammer": 1.0, "axe": 1.0, "sword": 1.0, "bow": 0.9}
	};

	if (value.modDamage)
	Object.assign(mob.modDamage, value.modDamage);

	// Create a Kind map for fast retrieval.
	Kinds[value.kind] = mob;
});


var isMob = function(kind){
    return Kinds[kind] ? true : false;
};

// NOTE: `MobKinds` is referenced here but never declared/imported anywhere
// in the original source -- a pre-existing bug, left as-is.
var forEachMobKind = function(callback) {
    for(var k in MobKinds) {
        callback(MobKinds[k][0], k);
    }
};

var getByLevelRange = function(min, max) {
    let levelRange = [];
    for (var k in Kinds) {
			 var mobKind = Kinds[k];
    	 if (mobKind.level > 0 && mobKind.level >= min && mobKind.level <= max)
    	     levelRange.push(mobKind);
     	 else if ((mobKind.minLevel > 0 && mobKind.maxLevel > 0) &&
			 	(	(min >= mobKind.minLevel && min <= mobKind.maxLevel) || //&&
     	 		(max >= mobKind.minLevel && max <= mobKind.maxLevel)))

     	     levelRange.push(mobKind);
    }
    return levelRange;
    //console.info("levelRange.length: " + levelRange.length);
}

export { Properties, Kinds, isMob, forEachMobKind, getByLevelRange };
export default { Properties, Kinds, isMob, forEachMobKind, getByLevelRange };
