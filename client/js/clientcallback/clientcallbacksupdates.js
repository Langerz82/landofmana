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

// Mixin extracted from clientcallbacks.js: sprite/animation/block state updates
// (onSetSprite, onSetAnimation, onBlockModify).
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Player from '../entity/player/player.js';
import AppearanceData from '../data/appearancedata.js';
/* global game */

export function installClientCallbacksUpdates(proto) {
    proto.onSetSprite = function (data) {
        const entity = game.getEntityById(Number(data[0]));
        if (!entity) return;

        if (entity instanceof Player) {
            entity.setSpriteByIndex(0, Number(data[1]));
            entity.setSpriteByIndex(1, Number(data[2]));

            game.app.initPlayerBar();
        } else {
            const num = Number(data[1]);
            const sprite = game.sprites[AppearanceData[num].sprite];
            entity.setSprite(sprite);
        }
    };

    proto.onSetAnimation = function (data) {
        const entity = game.getEntityById(Number(data[0]));
        if (!entity) return;

        // TODO - Not yet implemented.
    };

    proto.onBlockModify = function (data) {
        const entityId = Number(data[0]);
        const type = Number(data[1]);
        const blockId = Number(data[2]);

        const entity = game.getEntityById(entityId);
        const block = game.getEntityById(blockId);
        if (!entity || !block) return;

        if (type === 0) {
            block.pickup(entity);
        } else if (type === 1) {
            block.place(entity);
            entity.holdingBlock = null;
        }
    };
}
