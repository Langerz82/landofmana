/* global Types */

var Formulas = {};

Formulas.crit = function(attacker, defender) {
	var chance = (Utils.randomRangeInt(0,200) <= Utils.clamp(5, 195, ~~(25 + attacker.baseCrit() - defender.baseCritDef())));
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

Formulas.dmg = function(attacker, defender, time) {

    var attackPower = 1;
    if (attacker.attackTimer)
     attackPower = Utils.clamp(ATTACK_INTERVAL, ATTACK_MAX, (time - attacker.attackTimer)) / ATTACK_INTERVAL;
    //attackPower *= 1.25;

    //console.warn("attackPower="+attackPower);
    console.info("attacker baseDamage="+attacker.baseDamage());
    console.info("defender baseDamageDef="+defender.baseDamageDef());
    var dmg = ~~(attacker.baseDamage() * attackPower);
    dmg = Utils.clamp(1,5000, ~~(dmg - defender.baseDamageDef()));

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

if(!(typeof exports === 'undefined')) {
    module.exports = Formulas;
}
