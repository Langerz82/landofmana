import Utils from './utils.js';
import { ATTACK_INTERVAL, ATTACK_MAX } from './main.js';
import Mob from './entity/mob.js';
import Player from './entity/player.js';

/* global Types */

const Formulas = {};

Formulas.crit = function(attacker, defender) {
	const chance = (Utils.randomRangeInt(0,200) <= Utils.clamp(5, 195, ~~(25 + attacker.combat.baseCrit() - defender.combat.baseCritDef())));
	return chance;
}

/*Formulas.hit = function(attacker, defender) {
// TODO
  return true;

  console.info("attacker.baseHit(): "+ attacker.baseHit());
  console.info("defender.baseHitDef(): "+ defender.baseHitDef());

  var chance = (Utils.randomRangeInt(0,200) <= Utils.clamp(5, 195, ~~(120 + attacker.baseHit() - defender.baseHitDef())));
	return chance;
}*/

Formulas.getAttackPower = function (attacker) {
	let attackPower = 1;
	if (attacker.attackTimer) {
		const delay = (Date.now() - attacker.attackTimer)
		attackPower = ~~(Utils.clamp(ATTACK_INTERVAL, ATTACK_MAX, delay + 100) / ATTACK_INTERVAL);
	}
	return attackPower;
}

Formulas.dmgAOE = function(attacker) {
    const attackPower = Formulas.getAttackPower(attacker);

    //console.warn("attackPower="+attackPower);
		const attacker_damage = ~~(attacker.combat.baseDamage() / 2);
    console.info("attacker baseDamage="+attacker_damage);
    const dmg = ~~(attacker_damage * attackPower);

    if (attacker instanceof Player && dmg > 0)
    	attacker.incAttackExp(dmg);

    return ~~(dmg);
};

Formulas.dmg = function(attacker, defender) {
		const attackPower = Formulas.getAttackPower(attacker);

    //console.warn("attackPower="+attackPower);
		const attacker_damage = attacker.combat.baseDamage(defender);
		const defender_defense = defender.combat.baseDamageDef(attacker);
    console.info("attacker baseDamage="+attacker_damage);
    console.info("defender baseDamageDef="+defender_defense);
    let dmg = ~~(attacker_damage * attackPower);
		const defensePower = attackPower;
		//var defensePower = (2/3)*Math.pow(1.5,attackPower);
		const def = ~~(defender_defense * defensePower);
		dmg = ~~(dmg - def);

		if (attacker instanceof Mob)
			dmg = ~~(Math.pow(dmg, 0.9));

    dmg = Utils.clamp(1,5000, dmg);

    if (attacker instanceof Player && dmg > 0)
    	attacker.incAttackExp(dmg);

    if (defender instanceof Player && dmg > 0)
    	defender.incDefenseExp(dmg);

    return ~~(dmg);
    //return 1;
};

Formulas.pickPocket = function (source, target, chance)
{
    if ( target.level - source.level + ~~(Utils.randomRange(0,100)) <= chance)
	    return true;
    return false
}

Formulas.mindControl = function (source, target)
{
    if (target.level <= source.level && ~~(Utils.randomRange(0,~~(target.level * 50 /source.level))) === 0)
	    return true;
    return false
}

Formulas.hp = function(entityLevel) {
    return 100 + (entityLevel * 40);
};

Formulas.energy = function(entityLevel) {
    //Do not check kind yet, will be implemented later on.
    return 100 + (entityLevel * 30);
    //This requires more work, look around "kind".
};

Formulas.getExpArray = function() {

    //just return the EXP Array here.
};

export default Formulas;
