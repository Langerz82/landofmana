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

// Mixin extracted from clientcallbacks.js: Login, chat messages, disconnect handling, notifications, party updates.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
/* global game */

export function installClientCallbacksSocial(proto) {
    proto.onLogin = function () {
        this.client.sendLogin(game.player);
    };

    proto.onChatMessage = function (data) {
        // FIX: gameserver/js/message.js's Messages.Chat sends [WC_CHAT,
        // playerId, group, message] -- after gameclient.js's receiveAction()
        // strips the type byte, `data` here is [playerId, group, message], so
        // the real chat text is data[2], not data[1] (that's the group,
        // e.g. "world"/"whisper"). Every chat message -- not just the new
        // whisper command -- was rendering as the literal group name instead
        // of what the player actually typed.
        const entityId = Number(data[0]);
        const message = data[2];

        if (!game.chathandler.processReceiveMessage(entityId, message)) {
            const entity = game.getEntityById(entityId);
            if (entity) {
                if (game.camera.isVisible(entity))
                    game.bubbleManager.create(entity, message);

                game.chathandler.addNormalChat(entity, message);
            }
        }
        game.audioManager.playSound('chat');
    };

    // TODO - Try and reconnect on dc.
    proto.onDisconnected = function (message) {
        if (game.player) {
            game.player.die();
        }
        if (game.disconnect_callback) {
            game.disconnect_callback(message);
        }
        for (let dialog of game.dialogs) dialog.hide();
    };

    proto.onNotify = function (data) {
        game.showNotification(data);
    };

    proto.onParty = function (data) {
        const partyType = Number(data.shift());
        if (partyType === 1) {
            game.socialHandler.setPartyMembers(data);
        }
        if (partyType === 2) {
            const id = data[0];
            const player = game.getEntityById(id);
            game.socialHandler.inviteParty(player);
        }
    };
}
