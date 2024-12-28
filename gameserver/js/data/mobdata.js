var _ = require('underscore'),
		Mobs = require("../../shared/data/mobs.json");

var Properties = {};
var Kinds = {};
_.each( Mobs, function( value, key ) {
	Properties[key.toLowerCase()] = {
		key: key.toLowerCase(),
		kind: value.kind,

		attack: (value.attackMod) ? (value.attackMod * 3) : 3,
		defense: (value.defenseMod) ? (value.defenseMod * 3) : 3,
		hp: value.hpMod ? (value.hpMod * 150) : 150,
		xp: value.xpMod ? (value.xpMod * 10) : 10,

		level: value.level ? value.level : 0,
		minLevel: value.minLevel ? value.minLevel : 0,
		maxLevel: value.maxLevel ? value.maxLevel : 0,

		aggroRange: (value.aggroRange) ? value.aggroRange+1 : 4,
		attackRange: (value.attackRange) ? value.attackRange : 1,
		isAggressive: (value.isAggressive == 1) ? true : false,

		attackRate: (value.attackRateMod) ? (value.attackRateMod * 1500) : 1500,
		reactionDelay: (value.reactionMod) ? (value.reactionMod * 256) : 256,
		moveSpeed: (value.moveSpeedMod) ? ~~(300 + (200 * value.moveSpeedMod)) : 500,
		//tick: 1, //(value.moveSpeedMod) ? (value.moveSpeedMod*2) : 2,
		respawn: (value.respawnMod) ? (value.respawnMod * 30000) : 30000,
		dropRate: (value.dropRate) ? value.dropRate : 1,
		spawnChance: (value.spawnChance) ? value.spawnChance : 50,

		dropBonus: (value.dropBonus) ? value.dropBonus : 0,
		drops: (value.drops) ? value.drops : null
	};

	// Create a Kind map for fast retrieval.
	Kinds[value.kind] = Properties[key.toLowerCase()];
});


var isMob = function(kind){
    return Kinds[kind] ? true : false;
};

var forEachMobKind = function(callback) {
    for(var k in MobKinds) {
        callback(MobKinds[k][0], k);
    }
};

var getByLevelRange = function(min, max) {
    levelRange = [];
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


module.exports.Properties = Properties;
module.exports.Kinds = Kinds;
module.exports.isMob = isMob;
module.exports.forEachMobKind = forEachMobKind;
module.exports.getByLevelRange = getByLevelRange;
