// Mixin extracted from game.js/gameinteraction.js: combat/harvest actions
// (makePlayerAttack, scheduleAttackRetry, makePlayerHarvestEntity, makePlayerHarvest).
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Node from '../entity/node.js';
/* global ATTACK_MAX, Utils, log, game */

export function installGameInteractionCombat(proto) {
    proto.makePlayerAttack = function (entity) {
        const p = this.player;
        const time = this.currentTime;
        const res = p.makeAttack(entity);

        switch (res) {
            case 'attack_ok': {
                const skillId = p.attackSkill ? p.attackSkill.skillId : -1;
                this.client.sendAttack(p, p.target, skillId);
                if (skillId !== -1) p.attackSkill = null;

                this.audioManager.playSound(
                    'hit' + Math.floor(Math.random() * 2 + 1)
                );

                p.attackCooldown.duration = 1000;
                p.attackCooldown.lastTime = time;

                this.scheduleAttackRetry(ATTACK_MAX);
                return true;
            }

            case 'attack_outoftime':
                // Switching targets mid-cooldown retargets immediately (see makeAttack() in
                // player.js), but the attack itself has to wait out whatever's left of the
                // shared, server-enforced cooldown from the *previous* target. Retry once it
                // clears instead of requiring another interact press.
                log.info('CANNOT ATTACK DUE TO TIME.');
                this.scheduleAttackRetry(
                    p.attackCooldown.duration -
                        (time - p.attackCooldown.lastTime)
                );
                return false;

            // FIX: attack_toofar/attack_aborted used to fall into the default branch below,
            // which schedules nothing - so a temporary pathfinding block (followAttack() in
            // character.js failing to find a spot, attack_toofar) or a same-tick target-death
            // race (hasTarget() flipping false between setTarget() and the hit() check,
            // attack_aborted) silently ended the auto-attack loop until the player pressed
            // interact again, even though the obstruction was often gone a moment later.
            // attack_moving doesn't need this - it already self-heals via onStopPathing() ->
            // makePlayerInteractNextTo() once the player finishes walking in. Keep probing
            // here too as long as there's still a target; it stops on its own once the target
            // is cleared or dies (p.hasTarget() goes false).
            case 'attack_toofar':
            case 'attack_aborted':
                if (p.hasTarget()) this.scheduleAttackRetry(ATTACK_MAX);
                return false;

            default: // null/undefined, "attack_moving", "attack_notfacing"
                if (!res) log.info('CANNOT ATTACK.');
                return false;
        }
    };

    proto.scheduleAttackRetry = function (delay) {
        const p = this.player;

        clearTimeout(p.attackInterval);
        // Small buffer so canAttack()'s strict `>` comparison has definitely cleared by the
        // time this fires, rather than racing it by a millisecond.
        p.attackInterval = setTimeout(
            () => {
                if (p.isDead || p.isDying) return;

                if (this.tryInteractFacedEntity()) return;

                if (p.hasTarget()) this.makePlayerAttack(p.target);
            },
            Math.max(0, delay) + 16
        );
    };

    proto.makePlayerHarvestEntity = function (entity) {
        const p = this.player;

        if (!p.isNextTooEntity(entity)) {
            p.follow(entity);
            return;
        }

        if (!p.items.hasHarvestWeapon(entity.weaponType)) {
            game.showNotification([
                'CHAT',
                'HARVEST_WRONG_TYPE',
                entity.weaponType
            ]);
            return;
        }

        p.lookAtEntity(entity);
        p.harvestOn(entity.weaponType);

        if (entity.kind === Node.CHEST_KIND) {
            this.audioManager.playSound('chest');
        }

        this.client.sendHarvestEntity(entity);
    };

    proto.makePlayerHarvest = function (px, py) {
        const p = this.player;

        if (!p.items.hasHarvestWeapon()) {
            game.showNotification(['CHAT', 'HARVEST_NO_WEAPON']);
            return;
        }

        const type = p.items.getWeaponType();
        if (type === null) {
            game.showNotification(['CHAT', 'HARVEST_WRONG_TYPE', type]);
            return;
        }

        const gpos = Utils.getGridPosition(px, py);
        if (!this.mapContainer.isHarvestTile(gpos, type)) {
            game.showNotification(['CHAT', 'HARVEST_WRONG_TYPE', type]);
            return;
        }

        p.lookAtTile(px, py);
        p.harvestOn(type);

        this.client.sendHarvest(px, py);
    };
}
