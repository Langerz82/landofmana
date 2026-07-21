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
            self.npcText.html('');
            self.dialogueWindow.hide();
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
            this.npcText.html(
                Utils.escapeHtml(msgEntity.name) + ': ' + Utils.escapeHtml(msg)
            );
        } else {
            game.chathandler.addNormalChat(p, msg);
            // FIX: XSS - chat message name/text was inserted unescaped via .html(); escape before rendering
            this.npcText.html(
                Utils.escapeHtml(p.name) + ': ' + Utils.escapeHtml(msg)
            );
        }
        game.app.npcDialoguePic(msgEntity);
        this.dialogueWindow.show();
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
        this.npcText.html('');
        this.dialogueWindow.hide();
    };
}
