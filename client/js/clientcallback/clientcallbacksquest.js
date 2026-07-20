// Mixin extracted from clientcallbacks.js: Quests/achievements/dialogue/NPC speech.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Mob from '../entity/mob.js';
import MobSpeech from '../data/mobspeech.js';
/* global Types, game */
const QuestType = Types.QuestType;
const QuestStatus = Types.QuestStatus;

export function installClientCallbacksQuest(proto) {

      // FIX (maintainability): was a shared inner closure (`const questSpeech = function
      // (quest) {...}`) only reachable from the onQuest handler below; moved to a method. Body
      // unchanged.
      proto.questSpeech = function(quest) {
          const npc = game.getNpcByQuestKind(quest.npcQuestId);
          if (!npc)
            return;

          const p = game.player;
          let desc = quest.desc;

          if (!Array.isArray(quest.desc))
            desc = [[0, quest.desc]];

          npc.dialogue = desc;
          npc.dialogueIndex = 0;
          npc.quest = quest;

          p.dialogueEntity = npc;

          game.showDialogue();
      };


      proto.onQuest = function(data){
            const questId = Number(data[0]);
            let quest = game.player.quests[questId];
            if (!quest)
            {
              quest = new Quest(data);
              game.player.quests[questId] = quest;
            }
            else {
                quest.update(data);
            }

            const npc = game.getNpcByQuestKind(quest.npcQuestId);
            if (npc)
              game.bubbleManager.destroyBubble(npc.id);

            if (npc && game.player.canInteract(npc)) {
              this.questSpeech(quest);
            }

            if (quest.status === 0) {
              game.questhandler.handleQuest(quest);
            }


            if (quest.status === QuestStatus.COMPLETE) {
              if (quest.type === QuestType.KILLMOBKIND || quest.type === QuestType.KILLMOBS)
                game.questhandler.handleQuest(quest);
            }
      };


      proto.onAchievement = function(data) {
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


      proto.onDialogue = function(data) {
          const npcId = Number(data.shift());
          const langCode = data.shift();

          const npc = game.getEntityById(npcId);
          const p = game.player;

          let message;
          const questPattern = /^QUESTS_[0-9]+$/g;
          if (questPattern.test(langCode))
          {
            const questId = langCode.split('_')[1];
            npc.questId = questId;
            message = JSON.parse(JSON.stringify(lang.data['QUESTS'][questId][0]));
          } else {
            message = JSON.parse(JSON.stringify(lang.data[langCode]));
          }

          // Needs to do a deep copy so lang data does not get overwritten.
          if (data.length > 0) {
            if (Array.isArray(message)) {
              for (let msg of message)
              {
                msg[1] = msg[1].format(data);
              }
            }
            else {
              message[1] = message[1].format(data);
            }
          }

          npc.dialogue = message;
          npc.dialogueIndex = 0;

          p.dialogueEntity = npc;

          game.showDialogue();
      };


      // FIX: handler was declared with 3 separate params (id, key, value), but receiveAction() always invokes
      // registered handlers with a single `data` array (`this.handlers[action].call(this, data)`), same as every
      // other handler in this file - `id` received the whole array and `key`/`value` were always undefined, so
      // Number(id) was NaN, getEntityById() returned null, and speech bubbles never showed.
      proto.onSpeech = function(data) {
          const id = data[0], key = data[1], value = data[2];
          const entity = game.getEntityById(Number(id));
          if (!entity) return;

          let msg = "";
          if (entity instanceof Mob)
            msg = MobSpeech.Speech[key][value];
          else {
            // TODO
          }
          game.createBubble(entity, msg);
      };

}
