import Messages from '../../message.js';
import { Types } from '../../common.js';

class PlayerQuests {
    constructor(player) {
        this.player = player;
        this.quests = [];
        this.completeQuests = {};
    }

    questAboutKill(mob, quest) {
        var mobKind = mob.kind, mobLevel = mob.level;

        var a = (quest.count < quest.object.count);
        var b = (quest.type === Types.QuestType.KILLMOBKIND && a && (mobKind === quest.object.kind));
        var c = (quest.type === Types.QuestType.KILLMOBS && a);
        var d = (mob.level >= quest.object.level[0] && mob.level <= quest.object.level[1]);
        if((b || c) && d)
        {
            console.info("_questAboutKill - conditions met.")
            quest.data1 += ~~(mob.stats.xp / 1.5);
            if(++quest.count === quest.object.count) {
                this.completeQuest(quest, quest.data1);
            }
            else {
                this.progressQuest(quest);
            }
        }
    }

    questAboutItemCheck(target, quest) {
        var p = this.player;

        var lootKind = quest.object2.kind+1000;
        if (quest.object2.type === Types.EntityTypes.ITEMLOOT &&
            quest.object.type === Types.EntityTypes.MOB &&
            quest.object.kind === target.kind &&
            quest.status != Types.QuestStatus.COMPLETE &&
            (quest.count < quest.object2.count || p.items.inventory.hasItemCount(lootKind) < quest.object2.count))
        {
            target.questDrops[lootKind] = parseInt(quest.object2.chance*10);
            quest.object2.chance += 1;
        }
    }

    questAboutUseNode(quest) {
        var p = this.player;

        quest.count++;
        if(quest.count >= quest.object.count) {
            quest.count = quest.object.count;
            var xp = quest.object.count * 10 * p.level;
            this.completeQuest(quest, xp);
        } else {
            this.progressQuest(quest);
        }
    }

    questAboutItem(quest) {
        var p = this.player;

        console.info(JSON.stringify(quest));
        var kind = quest.object2.kind+1000;
        var countItems = p.inventory.hasItemCount(kind);
        quest.count = countItems;
        this.progressQuest(quest);
    }

    questAboutFind(quest) {
        var p = this.player;
        //console.info(JSON.stringify(quest));
        if(quest.count++ >= quest.object.count && quest.status === Types.QuestStatus.INPROGRESS) {
            quest.count = quest.object.count;
            var xp = quest.object.count * 10 * p.level;
            this.completeQuest(quest, xp);
        }
    }

    questAboutItemComplete(quest, callback){
        var p = this.player;
        if(quest.count >= quest.object2.count && quest.status==Types.QuestStatus.INPROGRESS) {
            var kind = quest.object2.kind+1000;
            if(!p.items.inventory.hasItemCount(kind))
                return;

            p.items.inventory.removeItemKind(kind, quest.object2.count);
            var xp = quest.object2.count * 20 * p.level;
            this.completeQuest(quest, xp);
            if (callback)
                callback(quest);
            return true;
        }
        return false;
    }

    sendQuest(quest) {
        var p = this.player;
        //var entityId = this.player.map.entities.getNpcByQuestId(quest.npcQuestId);
        p.sendPlayer(new Messages.Quest(quest));
    }

    progressQuest(quest) {
        quest.status = Types.QuestStatus.INPROGRESS;
        this.sendQuest(quest);
    }

    completeQuest(quest, xp) {
        if (xp > 0) {
            var multiplier = (quest.data) ? quest.data.expMultiplier : 1;
            this.player.incExp(xp * multiplier);
        }

        quest.status = Types.QuestStatus.COMPLETE;
        this.sendQuest(quest);
        this.completeQuests[quest.id] = {"npcid":quest.npcQuestId};
        this.removeQuest(quest);
    }

    removeQuest(quest) {
        this.quests.removeVal(quest);
        //this.quests.splice(this.quests.indexOf(quest), 1);
        //delete quest;
        quest = null;
    }

    foundQuest(quest){
        //console.info("foundQuest="+questId);
        this.quests.push(quest);
        quest.status = Types.QuestStatus.STARTED;
        this.sendQuest(quest);
    }

    hasNpcCompleteQuest(npcQuestId) {
        var cq = this.completeQuests;
        for (var qid in cq) {
            var q = cq[qid];
            if (q.hasOwnProperty("npcid") && q.npcid === npcQuestId)
                return true;
        }
        return false;
    }

    getQuestById(id) {
        return this.quests.find(function (q) { return q.id === id; });
    }

    hasQuest(id) {
        return this.getQuestById(id) != null;
    }

    /*forQuestsType: function (type, callback) {
      for (var q of this.quests) {
        if (q.type === type && callback)
            callback(q);
      }
    },*/

    // Use modern array methods
    forQuestsType(type, callback) {
        this.quests
            .filter(q => q.type === type)
            .forEach(callback);
    }
}

export default PlayerQuests;
