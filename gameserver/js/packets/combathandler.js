// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import Mob from '../entity/mob/mob.js';
import Player from '../entity/player/player.js';
import Messages from '../message.js';
import Formulas from '../formulas.js';
import { ATTACK_INTERVAL, mobState, G_DEBUG } from '../constants.js';

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
        // FIX: removed `const time = parseInt(message[0]);` -- never used
        // anywhere in this method; computed on every single attack packet
        // for no purpose.
        const p = this.player;

        if (p.isDead) return;

        const attackTime = Date.now() - p.attackTimer + 50;
        if (attackTime < ATTACK_INTERVAL) {
            if (G_DEBUG) console.warn('attack interval');
            return;
        }

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

    handleHitEntity(sEntity, message) {
        // 8
        const self = this;
        const p = this.player;

        const targetId = parseInt(message[1]),
            orientation = parseInt(message[2]),
            skillId = parseInt(message[3]);

        // PERF/FIX: every console.warn/console.info below in this reject-path
        // sequence used to run unconditionally. These are all reached by
        // rejected CW_ATTACK packets, and unlike the equivalent "happy path"
        // logging elsewhere in this codebase (which is G_DEBUG-gated),
        // rejection is entirely client-controlled -- a client attacking
        // faster than ATTACK_INTERVAL, out of range, or at an invalid
        // target hits these on every packet at whatever rate the connection
        // allows. That's a client-triggerable log-volume/string-concat cost
        // vector, not just diagnostic noise. Gated the same way the rest of
        // this codebase gates per-packet logging.
        if (targetId < 0) {
            if (G_DEBUG) console.warn('invalid targetId');
            return;
        }

        const tEntity = sEntity.map.entities.getEntityById(targetId);
        if (!tEntity) {
            if (G_DEBUG) console.warn('invalid entity');
            return;
        }

        // FIX: nothing here rejected `targetId === sEntity.id` -- a client
        // could send CW_ATTACK naming its own entity id. Every gate below
        // (the PvP level-diff check, canReach()/distance, attackedTime)
        // trivially passes at distance 0, so `dealDamage` ran with attacker
        // === target: real self-damage applied, and if it killed the
        // player, `sEntity.pStats.pk++`/`tEntity.pStats.pd++` both
        // incremented on the very same player (corrupting their kill/death
        // stats) alongside a COMBAT_PLAYERKILLED broadcast naming the same
        // player as both killer and victim.
        if (tEntity === sEntity) {
            if (G_DEBUG) console.warn('cannot attack self');
            return;
        }

        if (!this.canAttackTarget(sEntity, tEntity)) return;

        // TODO fill sEntity, tEntity.

        if (sEntity.map.isColliding(sEntity.x, sEntity.y)) {
            if (G_DEBUG)
                console.warn(
                    'char.isColliding(' +
                        sEntity.id +
                        ',' +
                        sEntity.x +
                        ',' +
                        sEntity.y +
                        ')'
                );
            return;
        }

        if (skillId >= 0) {
            this.ph.skillActionHandler.handleSkill([
                skillId,
                targetId,
                tEntity.x,
                tEntity.y
            ]);
        }

        sEntity.setOrientation(orientation);
        sEntity.engage(tEntity);

        if (sEntity === this.player) {
            if (!sEntity.canReach(tEntity)) {
                if (G_DEBUG) {
                    console.info('Player not close enough!');
                    console.info('p.x:' + sEntity.x + ',p.y:' + sEntity.y);
                    console.info('e.x:' + tEntity.x + ',e.y:' + tEntity.y);
                    console.info(
                        'dx:' +
                            Math.abs(sEntity.x - tEntity.x) +
                            ',dy:' +
                            Math.abs(sEntity.y - tEntity.y)
                    );
                }
                return;
            }

            if (!sEntity.attackedTime.isOver()) {
                if (G_DEBUG) console.warn('attackedTime is not over.');
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
            sEntity.effectHandler.interval('beforehit', 0);
        }
        const damageObj = this.calcDamage(sEntity, tEntity, null, 0); // no skill

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval('onhit', damageObj.damage);
            for (const skillEffect of sEntity.activeEffects) {
                const data = skillEffect.data;
                if (
                    data.skillType === 'attack' &&
                    data.targetType === 'enemy_aoe'
                ) {
                    const damageObjAOE = this.calcDamageAOE(sEntity, null, 0);
                    for (const target of skillEffect.targets) {
                        if (target === tEntity) continue;
                        else fnDamage(sEntity, target, damageObjAOE);
                    }
                }
            }
        }
        fnDamage(sEntity, tEntity, damageObj);

        if (sEntity.attackTimer) sEntity.attackTimer = Date.now();

        if (sEntity.effectHandler) {
            sEntity.effectHandler.interval('afterhit', 0);
        }
    }

    // Target rules shared by plain attacks (handleHitEntity) and skills
    // (skillactionhandler.js) -- skills used to skip all of these.
    canAttackTarget(sEntity, tEntity) {
        // ADMIN: admins can't attack anything (mobs or players). Also
        // covers targeted skills, which call this same check.
        if (sEntity.isAdmin) return false;
        // EXPLOIT FIX: dead targets were never rejected. A dead mob stays on
        // the server (invisible, at full HP, at its spawn point) until it
        // respawns, so a modified client could keep "killing" it for XP,
        // gold and quest progress with no respawn wait and no risk. A dead
        // player could also keep being hit, re-running the death penalty
        // (gold + item drop) on every hit.
        if (tEntity.isDead) return false;
        // If PvP then both players must be level 20 or higher, and within
        // 10 levels of each other.
        if (
            tEntity instanceof Player &&
            sEntity instanceof Player &&
            (sEntity.level < 20 ||
                tEntity.level < 20 ||
                Math.abs(sEntity.level - tEntity.level) > 10)
        ) {
            if (G_DEBUG) console.warn('pvp invalid diff');
            return false;
        }

        if (tEntity.aiState === mobState.RETURNING) return false;

        if (tEntity.invincible) {
            this.ph.sendPlayer(
                new Messages.Notify('CHAT', 'COMBAT_TARGETINVINCIBLE')
            );
            if (G_DEBUG) console.warn('target invincible');
            return false;
        }
        return true;
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
        if (damageObj.damage === 0) return damageObj;

        const canCrit = Formulas.crit(sEntity, tEntity);
        if (canCrit) {
            damageObj.damage *= 2;
            damageObj.crit = 1;
        }
        return damageObj;
    }

    dealDamage(sEntity, tEntity, dmg, crit) {
        if (!tEntity) return;

        if (tEntity instanceof Mob) tEntity.aggroPlayer(sEntity);

        this.world.handleDamage(tEntity, sEntity, -dmg, crit);
        if (sEntity instanceof Player) sEntity.weaponDamage += dmg;

        if (tEntity instanceof Player) {
            if (tEntity.isDead) {
                if (sEntity === this.player)
                    this.player.map.entities.sendBroadcast(
                        new Messages.Notify('CHAT', 'COMBAT_PLAYERKILLED', [
                            sEntity.name,
                            tEntity.name
                        ])
                    );

                sEntity.pStats.pk++;
                tEntity.pStats.pd++;
            }
        }
    }
}

export default CombatHandler;
