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

// Mixin extracted from game.js: NPC dialogue/speech bubble message flow: showDialogue, createMessage, destroyMessage.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
/* global Utils, game */

export function installGameDialogue(proto) {
    proto.showDialogue = function () {
        const self = this;
        const p = game.player;
        let entity = p.dialogueEntity;

        const hasFinished = function () {
            clearTimeout(game.destroyMessageTimeout);
            game.destroyMessage();
            self.jqNpcText.html('');
            self.jqDialogueWindow.hide();
            game.userAlarm.hide();

            if (!entity) return;

            const data = entity.dialogue[entity.dialogueIndex - 1];
            if (data && data.length === 3) {
                const action = data[2];
                if (action === 'QUEST') {
                    game.client.sendQuest(
                        entity.id,
                        parseInt(entity.questId),
                        1
                    );
                }
            }

            if (entity.dialogueIndex >= entity.dialogue.length) {
                if (entity.quest) {
                    self.questhandler.handleQuest(entity.quest);
                    p.dialogueQuest = null;
                    entity.quest = null;
                }
                entity.dialogueIndex = 0;
                p.dialogueEntity = null;
                entity = null;
                game.userAlarm.show();
            }
        };

        hasFinished();
        if (!entity) return;

        if (entity.dialogueIndex < entity.dialogue.length) game.createMessage();

        entity.dialogueIndex++;

        game.destroyMessageTimeout = setTimeout(function () {
            game.showDialogue();
        }, 5000);
    };

    proto.createMessage = function () {
        const p = this.player;
        const entity = p.dialogueEntity;
        if (!entity) return;

        if (!(entity.dialogueIndex < entity.dialogue.length)) return;

        const data = entity.dialogue[entity.dialogueIndex];
        const msgEntity = data[0] === 0 ? entity : game.player;
        const msg = data[1];
        if (!entity || !msg) return;

        this.bubbleManager.create(msgEntity, msg);
        this.audioManager.playSound('npc');
        if (data[0] === 0) {
            this.chathandler.addNormalChat(
                { name: '[NPC] ' + msgEntity.name },
                msg
            );
            // FIX: XSS - NPC dialogue name/text was inserted unescaped via .html(); escape before rendering
            this.jqNpcText.html(
                Utils.escapeHtml(msgEntity.name) + ': ' + Utils.escapeHtml(msg)
            );
        } else {
            game.chathandler.addNormalChat(p, msg);
            // FIX: XSS - chat message name/text was inserted unescaped via .html(); escape before rendering
            this.jqNpcText.html(
                Utils.escapeHtml(p.name) + ': ' + Utils.escapeHtml(msg)
            );
        }
        game.app.npcDialoguePic(msgEntity);
        this.jqDialogueWindow.show();
    };

    proto.destroyMessage = function () {
        const entity = this.player.dialogueEntity;
        if (!entity) return;

        if (entity.dialogue) {
            if (!(entity.dialogueIndex < entity.dialogue.length)) return;

            const data = entity.dialogue[entity.dialogueIndex];
            const msgEntity = data[0] === 0 ? entity : game.player;
            this.bubbleManager.destroyBubble(msgEntity.id);
        }

        this.audioManager.playSound('npc-end');
        this.jqNpcText.html('');
        this.jqDialogueWindow.hide();
    };
}
