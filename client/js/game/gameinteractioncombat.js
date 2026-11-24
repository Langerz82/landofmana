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

// Mixin extracted from game.js/gameinteraction.js: combat/harvest actions
// (makePlayerAttack, scheduleAttackRetry, makePlayerHarvestEntity, makePlayerHarvest).
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Node from '../entity/node.js';
/* global ATTACK_MAX, Utils, log, game, ItemTypes */

export function installGameInteractionCombat(proto) {
    proto.makePlayerAttack = function (entity) {
        const p = this.player;
        const time = this.currentTime;
        const res = p.makeAttack(entity);

        switch (res) {
            case 'attack_ok': {
                // An armed hit-based skill executes with this attack (see
                // SkillActive.execute()/fire() in skillhandler.js).
                // The skill packet (CW_SKILL) goes to the server before the
                // attack packet, so the skill is applied first and the attack
                // itself carries no skill (-1).
                const skill = p.attackSkill;
                if (skill) {
                    p.attackSkill = null;
                    this.client.sendSkill(skill.skillId, p.target.id);
                    if (skill.fire) skill.fire();
                }
                this.client.sendAttack(p, p.target, -1);

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

                // Turned from the target to another entity next to the
                // player: attack it when it's an enemy; an NPC / node ends
                // the attack loop (no talking to it or harvesting it until
                // the player interacts).
                const faced = this.facedSwitchTarget();
                if (faced) {
                    if (this.isAttackableEntity(faced)) {
                        p.setTarget(faced);
                        this.makePlayerAttack(faced);
                    }
                    return;
                }

                const pos = p.nextTile();
                const ahead = this.getEntityAt(pos[0], pos[1]);
                if (
                    ahead &&
                    this.isAttackableEntity(ahead) &&
                    this.tryInteractFacedEntity()
                )
                    return;

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

        if (!this.ensureHarvestWeapon(entity.weaponType || 'any')) {
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

    // The right tool is equipped from the inventory first when needed.
    proto.makePlayerHarvest = function (px, py) {
        const p = this.player;

        const gpos = Utils.getGridPosition(px, py);
        const type = this.currentMap.getHarvestTileType(gpos);
        if (type === null) {
            if (p.items.hasHarvestWeapon())
                game.showNotification([
                    'CHAT',
                    'HARVEST_WRONG_TYPE',
                    p.items.getWeaponType()
                ]);
            else game.showNotification(['CHAT', 'HARVEST_NO_WEAPON']);
            return;
        }

        if (!this.ensureHarvestWeapon(type)) {
            if (p.items.hasHarvestWeapon())
                game.showNotification(['CHAT', 'HARVEST_WRONG_TYPE', type]);
            else game.showNotification(['CHAT', 'HARVEST_NO_WEAPON']);
            return;
        }

        p.lookAtTile(px, py);
        p.harvestOn(type);

        this.client.sendHarvest(px, py);
    };

    // ---------------------------------------------- harvest weapon auto-swap
    // Harvesting a node / tile that needs a weapon type the player isn't
    // holding equips one of that type from the inventory; when the harvest
    // ends (done or aborted, see playerlocalmovement.js forceStop()) the
    // weapon it replaced is equipped again. Equipping is a swap on the
    // server, so the old weapon lands in the tool's inventory slot.

    // The best inventory weapon of type `type` ('axe', 'hammer') the player
    // can equip, or null. Weapons above the player's level are skipped (the
    // server refuses to equip them); then unbroken beats broken (durability
    // 0), then highest weapon level (modifier), enchant, durability.
    proto.findHarvestWeapon = function (type) {
        const inv = this.inventory;
        const level = this.player.level;
        const rank = (item) => [
            item.itemDurability > 0 ? 1 : 0,
            ItemTypes.getWeaponLevel(item.itemKind) || 0,
            item.itemNumber || 0,
            item.itemDurability || 0
        ];
        const better = (a, b) => {
            const ra = rank(a),
                rb = rank(b);
            for (let i = 0; i < ra.length; ++i)
                if (ra[i] !== rb[i]) return ra[i] > rb[i];
            return false;
        };
        let best = null;
        for (let i = 0; i < inv.maxNumber; ++i) {
            const item = inv.rooms[i];
            if (
                !item ||
                !ItemTypes.isWeapon(item.itemKind) ||
                ItemTypes.getType(item.itemKind) !== type ||
                (ItemTypes.getWeaponLevel(item.itemKind) || 0) > level
            )
                continue;
            if (!best || better(item, best)) {
                item.slot = i;
                best = item;
            }
        }
        return best;
    };

    // Holding a weapon of type `type`, or carrying one to swap to.
    proto.canHarvestWith = function (type) {
        return (
            this.player.items.hasHarvestWeapon(type) ||
            !!this.findHarvestWeapon(type)
        );
    };

    // Make sure a weapon of type `type` is (being) equipped. False when the
    // player has none. The equip packet goes out before the harvest one, and
    // the server handles them in order.
    proto.ensureHarvestWeapon = function (type) {
        const p = this.player;
        if (type === 'any' || p.items.hasHarvestWeapon(type)) return true;

        const item = this.findHarvestWeapon(type);
        if (!item) return false;

        if (!this.harvestSwap) {
            const prev = p.items.getWeapon();
            this.harvestSwap = {
                prevKind: prev ? prev.itemKind : -1,
                toolKind: item.itemKind,
                slot: item.slot
            };
        } else {
            // Already swapped for an earlier harvest that hasn't been undone:
            // keep the original weapon to go back to.
            this.harvestSwap.toolKind = item.itemKind;
            this.harvestSwap.slot = item.slot;
        }
        this.equipment.equip(item, item.slot);
        return true;
    };

    // The harvest ended: re-equip the weapon ensureHarvestWeapon() replaced.
    // Nothing when there was no swap, no weapon before it, or the player has
    // changed weapon since.
    proto.restoreHarvestWeapon = function () {
        const s = this.harvestSwap;
        if (!s) return;
        this.harvestSwap = null;
        if (s.prevKind < 0) return;

        const weapon = this.player.items.getWeapon();
        if (!weapon || weapon.itemKind !== s.toolKind) return;

        let item = this.inventory.rooms[s.slot];
        if (item && item.itemKind === s.prevKind) item.slot = s.slot;
        else item = this.inventory.getItemByKind(s.prevKind);
        if (item) this.equipment.equip(item, item.slot);
    };
}
