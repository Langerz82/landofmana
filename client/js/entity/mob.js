// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */
import Character from './character/character.js';
import MobData from '../data/mobdata.js';

export default class Mob extends Character {
    constructor(id, type, map, kind, name, level) {
        super(id, type, map, kind);

        this.data = MobData.Kinds[this.kind];

        this.idleSpeed = Utils.randomRangeInt(
            ~~((this.data.idleSpeed * 2) / 3),
            ~~((this.data.idleSpeed * 4) / 3)
        );

        this.level = level || this.data.level;

        this.title = this.data.name;

        this.stats.attack = this.data.attack * this.level;
        this.stats.defense = this.data.defense * this.level;
        this.stats.hp = this.data.hp * this.level;
        this.stats.hpMax = this.data.hp * this.level;
        this.stats.xp = this.data.xp * this.level;

        this.hatelist = [];
        this.hateCount = 0;
        this.tankerlist = [];

        this.respawnTimeout = null;
        this.returnTimeout = null;
        this.isDead = false;

        this.aggroRange = this.data.aggroRange;
        this.attackRange = this.data.attackRange;
        this.isAggressive = this.data.isAggressive;

        this.moveSpeed = this.data.moveSpeed;
        this.setMoveRate(this.moveSpeed);

        this.setAttackRate(this.data.attackRate);
    }

    getSpriteName() {
        return MobData.Kinds[this.kind].spriteName;
    }
}
