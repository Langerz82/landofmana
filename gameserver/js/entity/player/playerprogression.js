import Messages from '../../message.js';
import { Types } from '../../common.js';

// Split out of entity/player.js -- leveling/XP was one of the largest
// self-contained clusters directly on the Player class body (base/attack/
// defense/weapon exp, level-up, and the party-proximity exp bonus). None of
// it is called externally except through Player's own thin delegates (see
// player.js), so this follows the same constructor(entity) convention as
// the other entity/components/*.js files.
class PlayerProgression {
    constructor(entity) {
        this.entity = entity;
    }

    getState() {
        const entity = this.entity;
        const basestate = entity._getBaseState();
        const sprite1 = entity.getSprite(0),
            sprite2 = entity.getSprite(1);

        const state = [
            entity.level,
            entity.stats.hp,
            entity.stats.hpMax,
            0,
            sprite1,
            sprite2,
            0,
            0
        ];

        return basestate.concat(state);
    }

    getLevel() {
        return Types.getLevel(this.entity.stats.exp.base);
    }

    getAttackLevel() {
        return Types.getAttackLevel(this.entity.stats.exp.attack);
    }

    getDefenseLevel() {
        return Types.getDefenseLevel(this.entity.stats.exp.defense);
    }

    incExp(gotexp) {
        const entity = this.entity;
        let incExp = parseInt(gotexp);

        incExp = Math.ceil(incExp * this.getExpBonus());

        const prevLvl = this.getLevel();
        entity.stats.exp.base =
            parseInt(entity.stats.exp.base) + parseInt(incExp);
        const lvl = this.getLevel();
        entity.sendPlayer(
            new Messages.Stat('exp.base', entity.stats.exp.base, incExp)
        );

        entity.level = Types.getLevel(entity.stats.exp.base);
        if (prevLvl !== lvl) {
            this.levelUp(prevLvl);
        }

        return incExp;
    }

    incAttackExp(gotexp) {
        const entity = this.entity;
        let incExp = parseInt(gotexp);

        incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

        const prevLvl = this.getAttackLevel();
        entity.stats.exp.attack =
            parseInt(entity.stats.exp.attack) + parseInt(incExp);
        const lvl = this.getAttackLevel();
        if (prevLvl !== lvl) {
            entity.sendPlayer(
                new Messages.LevelUp('attack', lvl, entity.stats.exp.attack)
            );
        }
        return incExp;
    }

    incDefenseExp(gotexp) {
        const entity = this.entity;
        let incExp = parseInt(gotexp);

        incExp = Math.ceil(incExp * this.getExpBonus());

        const prevLvl = this.getDefenseLevel();
        entity.stats.exp.defense =
            parseInt(entity.stats.exp.defense) + parseInt(incExp);
        const lvl = this.getDefenseLevel();
        if (prevLvl !== lvl) {
            entity.sendPlayer(
                new Messages.LevelUp('defense', lvl, entity.stats.exp.defense)
            );
        }
        return incExp;
    }

    incWeaponExp(gotexp) {
        const entity = this.entity;
        let incExp = parseInt(gotexp);

        incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

        const type = entity.items.getWeaponType();
        if (!entity.stats.exp.hasOwnProperty(type)) return null;

        let xp = parseInt(entity.stats.exp[type]);
        const plvl = Types.getWeaponLevel(xp);
        xp = xp + incExp;
        const clvl = Types.getWeaponLevel(xp);
        entity.stats.exp[type] = xp;
        if (plvl !== clvl) {
            entity.sendPlayer(new Messages.LevelUp(type, clvl, xp));
        }
        return incExp;
    }

    getExpBonus() {
        const entity = this.entity;
        const self = entity;
        let bonus = 1;
        if (entity.party) {
            entity.party.forEachPlayer(function (player) {
                if (self.isInScreen([player.x, player.y])) {
                    bonus += 0.15;
                }
            });
        }
        return bonus;
    }

    levelUp(prevLevel) {
        const entity = this.entity;
        for (let i = prevLevel; i < entity.level; ++i) {
            if (i < 10) {
                entity.stats.attack += 2;
                entity.stats.defense += 2;
                entity.stats.health += 2;
                entity.stats.energy += 2;
                entity.stats.luck += 2;
            } else {
                entity.stats.free += 5;
            }
        }
        entity.setHpMax();
        entity.setEpMax();
        entity.sendPlayer(new Messages.StatInfo(entity));
        entity.resetBars();
        entity.sendPlayer(new Messages.ChangePoints(entity, 0, 0));
        entity.sendPlayer(
            new Messages.LevelUp('base', entity.level, entity.stats.exp.base)
        );
    }

    getXP() {
        return 20 * this.entity.level;
    }
}

export default PlayerProgression;
