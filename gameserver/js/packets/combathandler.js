import Mob from '../entity/mob.js';
import Player from '../entity/player.js';
import Messages from '../message.js';
import Formulas from '../formulas.js';
import { ATTACK_INTERVAL, mobState } from '../constants.js';

// Split out of packethandler.js (see that file's dispatch table) as part of
// breaking up a single ~1300-line class -- this is the melee/skill-damage
// combat path: CW_ATTACK handling, the queued-attack-while-moving flow, and
// damage calculation. Follows the same constructor(packetHandler) convention
// already used by partyhandler.js/shophandler.js: cache the owning
// PacketHandler plus the couple of properties (player, world) every method
// here actually needs, and reach back through `this.ph` for anything that
// belongs to the core packet-handling surface (send/sendPlayer) or to
// another split-out handler (skillActionHandler).
class CombatHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = this.ph.player;
        this.world = this.ph.world;
    }

    handleAttack(message) {
        const self = this;
        const time = parseInt(message[0]);
        const p = this.player;

        if (p.isDead)
            return;

        if (p.isMoving() || p.isMovingPath()) {
            p.attackQueue = message;
        } else {
            self.handleHitEntity(p, message);
        }
    }

    processAttack() {
        const p = this.player;

        if (p.attackQueue) {
            this.handleHitEntity(p, p.attackQueue);
            p.attackQueue = null;
        }
    }

    handleHitEntity(sEntity, message) { // 8
        const self = this;
        const p = this.player;

        const targetId = parseInt(message[1]),
            orientation = parseInt(message[2]),
            skillId = parseInt(message[3]);

        if (targetId < 0) {
            console.warn("invalid targetId");
            return;
        }

        const tEntity = sEntity.map.entities.getEntityById(targetId);
        if (!tEntity) {
            console.warn("invalid entity");
            return;
        }

        const attackTime = Date.now() - sEntity.attackTimer + 100;
        if (attackTime < ATTACK_INTERVAL) {
            console.warn("attack interval");
            return;
        }

        // If PvP then both players must be level 20 or higher.
        if (tEntity instanceof Player && sEntity instanceof Player &&
            (sEntity.level < 20 || tEntity.level < 20 ||
              Math.abs(sEntity.level-tEntity.level) > 10))
        {
            console.warn("pvp invalid diff");
            return;
        }

        if (tEntity.aiState === mobState.RETURNING)
            return;

        if (tEntity.invincible) {
            this.ph.sendPlayer(new Messages.Notify("CHAT","COMBAT_TARGETINVINCIBLE"));
            console.warn("target invincible");
            return;
        }

// TODO fill sEntity, tEntity.

        if (sEntity.map.isColliding(sEntity.x, sEntity.y)) {
            console.warn("char.isColliding("+sEntity.id+","+sEntity.x+","+sEntity.y+")");
            return;
        }

        if (skillId >= 0) {
            this.ph.skillActionHandler.handleSkill([skillId, targetId, tEntity.x, tEntity.y]);
        }

        sEntity.setOrientation(orientation);
        sEntity.engage(tEntity);

        if (sEntity === this.player) {
            if (!sEntity.canReach(tEntity)) {
                console.info("Player not close enough!");
                console.info("p.x:" + sEntity.x + ",p.y:" + sEntity.y);
                console.info("e.x:" + tEntity.x + ",e.y:" + tEntity.y);
                console.info("dx:"+Math.abs(sEntity.x-tEntity.x)+",dy:"+Math.abs(sEntity.y-tEntity.y));
                return;
            }

            if (!sEntity.attackedTime.isOver()) {
                console.warn("attackedTime is not over.");
                return;
            }
            sEntity.isHarvesting = false;
        }

        sEntity.isBlocking = false;
        sEntity.hasAttacked = true;

        const fnDamage = function (sEntity, tEntity, damageObj) {
            if (sEntity instanceof Player && tEntity instanceof Mob) {
                tEntity.mobAI.checkHitAggro(tEntity, sEntity);
            }
            self.dealDamage(sEntity, tEntity, damageObj.damage, damageObj.crit);
        };

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval("beforehit",0);
        }
        const damageObj = this.calcDamage(sEntity, tEntity, null, 0); // no skill

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval("onhit", damageObj.damage);
            for (const skillEffect of sEntity.activeEffects)
            {
                const data = skillEffect.data;
                if (data.skillType === "attack" && data.targetType === "enemy_aoe")
                {
                    const damageObjAOE = this.calcDamageAOE(sEntity, null, 0);
                    for (const target of skillEffect.targets) {
                        if (target === tEntity)
                            continue;
                        else
                            fnDamage(sEntity, target, damageObjAOE);
                    }
                }
            }
        }
        fnDamage(sEntity, tEntity, damageObj);

        if (sEntity.attackTimer)
            sEntity.attackTimer = Date.now();

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval("afterhit",0);
        }
    }

    calcDamageAOE(sEntity, skill, attackType) {
        const damageObj = {
            damage: 0,
            crit: 0,
            dot: 0
        };

        damageObj.damage = Math.round(Formulas.dmgAOE(sEntity));
        return damageObj;
    }

    calcDamage(sEntity, tEntity, skill, attackType) {
        const damageObj = {
            damage: 0,
            crit: 0,
            dot: 0
        };

        damageObj.damage = Math.round(Formulas.dmg(sEntity, tEntity));
        if (damageObj.damage === 0)
            return damageObj;

        const canCrit = Formulas.crit(sEntity, tEntity);
        if (canCrit) {
            damageObj.damage *= 2;
            damageObj.crit = 1;
        }
        return damageObj;
    }

    dealDamage(sEntity, tEntity, dmg, crit) {
        if (!tEntity) return;

        if (tEntity instanceof Mob)
            tEntity.aggroPlayer(sEntity);

        this.world.handleDamage(tEntity, sEntity, -dmg, crit);
        if (sEntity instanceof Player)
            sEntity.weaponDamage += dmg;

        if (tEntity instanceof Player) {
            if (tEntity.isDead) {
                if (sEntity === this.player)
                    this.player.map.entities.sendBroadcast(new Messages.Notify("CHAT","COMBAT_PLAYERKILLED", [sEntity.name, tEntity.name]));

                sEntity.pStats.pk++;
                tEntity.pStats.pd++;
            }
        }
    }
}

export default CombatHandler;
