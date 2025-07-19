/* global Types */
define(['text!../../shared/data/mobs.json'], function(MobsJson) {

	var MobData = {};
	MobData.Kinds = {};
	MobData.Properties = {};
	var mobParse = JSON.parse(MobsJson);
	$.each( mobParse, function( key, value ) {
		var mob = {
			key: key.toLowerCase(),
			kind: value.kind,

			attack: (value.attackMod) ? (value.attackMod * 4) : 4,
			defense: (value.defenseMod) ? (value.defenseMod * 3) : 40,
			hp: value.hpMod ? (value.hpMod * 200) : 200,
			xp: value.xpMod ? (value.xpMod * 30) : 30,

			level: value.level ? value.level : 0,
			minLevel: value.minLevel ? value.minLevel : 0,
			maxLevel: value.maxLevel ? value.maxLevel : 0,

			aggroRange: (value.aggroRange) ? value.aggroRange+1 : 4,
			attackRange: (value.attackRange) ? value.attackRange : 1,
			isAggressive: (value.isAggressive == 1) ? true : false,

			attackRate: (value.attackRateMod) ? (value.attackRateMod * 1000) : 1000,
			reactionDelay: (value.reactionMod) ? (value.reactionMod * 768) : 768,
			moveSpeed: (value.moveSpeedMod) ? ~~(300 + (200 * value.moveSpeedMod)) : 500,
			//tick: 1, //(value.moveSpeedMod) ? (value.moveSpeedMod*2) : 2,
			idleSpeed: (value.idleSpeedMod) ? (value.idleSpeedMod * 1000) : 1000,

			respawn: (value.respawnMod) ? (value.respawnMod * 60000) : 60000,
			dropRate: (value.dropRate) ? value.dropRate : 1,
			spawnChance: (value.spawnChance) ? value.spawnChance : 50,

			dropBonus: (value.dropBonus) ? value.dropBonus : 0,
			drops: (value.drops) ? value.drops : null,
			spriteName: value.spriteName
		};
		MobData.Properties[key.toLowerCase()] = mob;
		MobData.Kinds[value.kind] = mob;
	});
    return MobData;
});
