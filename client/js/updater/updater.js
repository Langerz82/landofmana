// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
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

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Character from '../entity/character/character.js';
import Timer from '../timer.js';
import Player from '../entity/player/player.js';
import EntityMoving from '../entity/entitymoving/entitymoving.js';
// FIX (maintainability): Updater's low-level movement-step primitives (checkStopDanger/
// charPath*/charKey*/playerKey*/playerPath*/stopTransition) and their four per-tick dispatchers
// (updateCharacterPathMovement/updateCharacterKeyMovement/updatePlayerPathMovement/
// updatePlayerKeyMovement) moved to updatermovement.js as an instance-installer (see
// that file for why they need to stay bound to this specific Updater instance regardless of how
// they're later invoked). Installed onto `this` at the end of the constructor below, same as the
// class fields they replace were previously assigned during construction.
import { installUpdaterMovement } from './updatermovement.js';

/* global Types */

export default class Updater {
    constructor(game) {
        this.game = game;
        this.performanceTime = 0;
        this.lastUpdateTime = Date.now();

        installUpdaterMovement(this);
    }

    update() {
        if (game.mapStatus < 2) return;

        this.looping = true;

        this.updateCharacters();
        this.updateTransitions();

        this.updateAnimations();
        //this.updateAnimatedTiles();
        this.updateChatBubbles();
        this.updateInfos();
        this.looping = false;
        this.lastUpdateTime = Date.now();
    }

    updateCharacters() {
        const self = this;
        const mc = game.currentMap;

        // TODO - Optimization not working.
        // This code is intensive.
        game.forEachEntity(function (entity) {
            self.game.updateCameraEntity(entity.id, entity);
            if (!(entity instanceof EntityMoving)) return;

            entity.tickFrames = 0;
            if (entity.tick > 0) {
                entity.tickFrames = entity.tick;
            }
            if (entity instanceof Player) {
                if (entity === game.player) {
                    self.updatePlayerPathMovement(entity);
                    self.updatePlayerKeyMovement(entity);
                } else {
                    self.updateCharacterKeyMovement(entity);
                    self.updateCharacterPathMovement(entity);
                }
            } else if (entity instanceof Character) {
                self.updateCharacterPathMovement(entity);
            }
        });
    }

    updateTransitions() {
        let self = this,
            m = null;

        game.forEachEntity(function (entity) {
            if (!entity || entity.freeze || entity.isDead || entity.isDying)
                return;

            m = entity.movement;
            if (m && m.inProgress) {
                m.step();
            }
        });
    }

    updateAnimations() {
        const t = game.currentTime;

        game.camera.forEachInScreen(function (entity) {
            if (!entity) return;

            const anim = entity.currentAnimation;

            if (anim && !entity.isStun) {
                if (anim.update(t)) {
                }
            }
        });

        const target = this.game.targetAnimation;
        if (target) {
            target.update(t);
        }

        if (game.appearanceDialog.visible) {
            const pa = game.appearanceDialog.playerAnim;
            if (pa.currentAnimation) {
                const animName = pa.currentAnimation.name;
                pa.currentAnimation.update(t);
                pa.show();
            }
        }
    }

    updateAnimatedTiles() {
        const self = this,
            t = game.currentTime;

        game.forEachAnimatedTile(function (tile) {
            tile.animate(t);
        });
    }

    updateChatBubbles() {
        const t = this.game.currentTime;
        game.bubbleManager.update(t);
    }

    updateInfos() {
        const t = this.game.currentTime;

        this.game.infoManager.update(t);
    }
}
