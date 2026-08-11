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
