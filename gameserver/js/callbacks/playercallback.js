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
import { G_DEBUG } from '../constants.js';

class PlayerCallback {
    constructor() {}

    setCallbacks(entity) {
        const p = entity;
        this.player = entity;
        this.entities = p.map.entities;

        p.onStep(function (player, x, y) {});

        p.onRequestPath(function (x, y) {
            const path = this.entities.findPath(this, x, y);
            // PERF: fires on every click-to-move path request from every
            // player -- this JSON.stringify ran unconditionally, unlike the
            // equivalent per-path-request logging already gated elsewhere
            // (pathfinder.js findPath, etc.).
            if (G_DEBUG)
                console.info(
                    'onRequestPath, id:' +
                        this.id +
                        ', path:' +
                        JSON.stringify(path)
                );
            // FIX: was a bare `return` (undefined), discarding the computed
            // `path` -- the sibling mob/NPC onRequestPath callbacks
            // (callbacks/mobcallback.js, callbacks/npcmovecallback.js) both
            // correctly return their computed path. Whatever calls this
            // callback (entitymoving.js's requestPathfindingTo -> _moveTo)
            // checks `if (path) this.followPath(path)`, so returning
            // undefined here silently meant a player's path request never
            // resulted in movement.
            return path;
        });

        const attackFunc = function (p) {
            // processAttack() moved into packets/combathandler.js as part of
            // splitting packethandler.js's combat logic out of the core
            // packet-handling class; reached the same way partymanager.js
            // already reaches packetHandler.partyHandler.handleAbandoned().
            p.packetHandler.combatHandler.processAttack();
        };

        const stopPathing = function (p, x, y) {
            // PERF: onStopPathing fires whenever a moving player's path
            // completes/stops -- gated behind G_DEBUG like the rest of the
            // per-movement-event logging in this file.
            if (G_DEBUG) console.info('onStopPathing');
            p.setPosition(x, y);

            if (G_DEBUG)
                console.info(
                    'onStopPathing - p.id' + p.id + 'p.x:' + p.x + ',p.y=' + p.y
                );
            attackFunc(p);
            // FIX: drains any CW_HARVEST/CW_USE_NODE queued by
            // worldActionHandler.handleHarvest()/handleUseNode() while this player was
            // still mid-click-to-move - same "queue while moving, replay once the
            // server's own path simulation actually stops" pattern attackFunc() above
            // already uses for CW_ATTACK. See worldactionhandler.js's FIX comment on
            // handleHarvest() for the click-to-move race this closes.
            p.packetHandler.worldActionHandler.processHarvest();
        };

        p.onStopPathing(function (x, y) {
            if (G_DEBUG) console.info('onStopPathing');
            stopPathing(this, x, y);
        });

        p.onAbortPathing(function (path, x, y) {
            // The server simulated this path itself at server speed, so
            // there's nothing left to validate -- stop where it stopped.
            if (G_DEBUG) console.info('onAbortPathing');
            stopPathing(this, x, y);
        });

        p.onMoveStop(function () {
            this.keyMove = false;
            this.endMoveTime = Date.now();

            attackFunc(this);
        });

        p.onTeleport(function () {
            this.forEachAttacker(function (entity) {
                if (entity instanceof Mob) {
                    entity.returnToSpawn();
                }
            });
            this.clearAttackerRefs();
        });

        p.onKilled(function (attacker, damage) {});

        p.onDeath(function (attacker) {
            this.world.loot.handleDropItem(this, attacker);
        });
    }
}

export default PlayerCallback;
