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

// Mixin extracted from clientcallbacks.js: Quests/achievements/dialogue/NPC speech.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Achievement from '../achievement.js';
import Quest, { langLines } from '../quest.js';

/* global Types, game */
const QuestType = Types.QuestType;
const QuestStatus = Types.QuestStatus;

export function installClientCallbacksQuest(proto) {
    // FIX (maintainability): was a shared inner closure (`const questSpeech = function
    // (quest) {...}`) only reachable from the onQuest handler below; moved to a method. Body
    // unchanged.
    proto.questSpeech = function (quest) {
        const npc = game.getNpcByQuestKind(quest.npcQuestId);
        if (!npc) return;
        if (!Array.isArray(quest.desc) || quest.desc.length === 0) return;

        const p = game.player;

        npc.dialogue = quest.desc.map((l) => l.slice());
        npc.dialogueIndex = 0;
        npc.dialogueDelay = quest.delay;
        npc.reportSpeechEnd = false;
        npc.quest = quest;

        p.dialogueEntity = npc;

        game.showDialogue();
    };

    // data: 13 quest fields + the server's quest text object (see
    // gameserver/js/message.js Messages.Quest). Text, variables and delay all
    // come from the server; quests are activated server-side at the end of
    // the offer dialogue and arrive here already STARTED.
    proto.onQuest = function (data) {
        const questId = Number(data[0]);
        let quest = game.player.quests[questId];
        if (!quest) {
            quest = new Quest(data);
            game.player.quests[questId] = quest;
        } else {
            quest.update(data);
        }

        const npc = game.getNpcByQuestKind(quest.npcQuestId);
        if (npc) game.bubbleManager.destroyBubble(npc.id);

        if (npc && game.player.canInteract(npc)) {
            this.questSpeech(quest);
        }

        if (quest.status === 0) {
            game.questhandler.handleQuest(quest);
        }

        if (quest.status === QuestStatus.COMPLETE) {
            if (
                quest.type === QuestType.KILLMOBKIND ||
                quest.type === QuestType.KILLMOBS
            )
                game.questhandler.handleQuest(quest);
        }
    };

    proto.onAchievement = function (data) {
        // FIX: `data.parseInt();` called the old Array.prototype.parseInt
        // monkey-patch (since removed) without capturing its return value
        // -- it was a no-op even when the method existed, since
        // Achievement.update() (called via `new Achievement(data)` below)
        // already runs its own Utils.ArrayParseInt() on the raw array.
        // Removed rather than converted, since keeping a discarded-result
        // call around is just dead code.
        const achievementId = Number(data[0]);
        const achievement = new Achievement(data);
        game.player.achievements[achievementId] = achievement;
        game.achievementHandler.handleAchievement(achievement);
    };

    // WC_SPEECH (NPC speech / quest dialogue).
    // data: [npcId, langPath, vars(, delay)] -- the gameserver picks
    // the lang entry (gameserver/js/questtext.js) and sends its path; the
    // client retrieves the lang value and fills in the variables. `vars` are
    // the server's positional {0},{1}... values (NPC names etc.). If this is a
    // quest offer the server activates the quest itself when the dialogue
    // ends and pushes it as a WC_QUEST; showDialogue() reports the end of the
    // dialogue (CW_QUEST) so a player who skipped through doesn't have to
    // wait -- the server ignores it if no offer is pending. `delay` is only
    // sent when it differs from Types.DIALOGUE_DELAY_DEFAULT.
    proto.onSpeech = function (data) {
        const npcId = Number(data[0]);
        const path = data[1];
        const vars = data[2];
        const delay = Number(data[3]);

        const npc = game.getEntityById(npcId);
        const p = game.player;

        // Server-driven npcId with no matching client-side entity (e.g. despawned/unknown) -
        // avoid crashing on the npc.dialogue writes below.
        if (!npc) return;

        const message = langLines(path, vars);
        if (message.length === 0) return;

        npc.dialogue = message;
        npc.dialogueIndex = 0;
        npc.dialogueDelay = delay > 0 ? delay : undefined;
        npc.reportSpeechEnd = true;

        p.dialogueEntity = npc;

        game.showDialogue();
    };
}
