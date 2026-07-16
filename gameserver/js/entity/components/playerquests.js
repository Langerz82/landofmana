import Messages from '../../message.js';
import { Types } from '../../common.js';
import Utils from '../../utils.js';

class PlayerQuests {
    constructor(player) {
        this.player = player;
        this.quests = [];
        this.completeQuests = {};
    }

    questAboutKill(mob, quest) {
        const mobKind = mob.kind, mobLevel = mob.level;

        const a = (quest.count < quest.object.count);
        const b = (quest.type === Types.QuestType.KILLMOBKIND && a && (mobKind === quest.object.kind));
        const c = (quest.type === Types.QuestType.KILLMOBS && a);
        const d = (mob.level >= quest.object.level[0] && mob.level <= quest.object.level[1]);
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
        const p = this.player;

        const lootKind = quest.object2.kind+1000;
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
        const p = this.player;

        quest.count++;
        if(quest.count >= quest.object.count) {
            quest.count = quest.object.count;
            const xp = quest.object.count * 10 * p.level;
            this.completeQuest(quest, xp);
        } else {
            this.progressQuest(quest);
        }
    }

    questAboutItem(quest) {
        const p = this.player;

        console.info(JSON.stringify(quest));
        const kind = quest.object2.kind+1000;
        const countItems = p.items.inventory.hasItemCount(kind);
        quest.count = countItems;
        this.progressQuest(quest);
    }

    // NOTE: questAboutFind() (would have handled Types.QuestType.HIDEANDSEEK
    // -- shared/js/gametypes.js) was removed from here. It had no callers
    // anywhere in the codebase -- taskhandler.js's processEvent() only ever
    // dispatches KILLMOBKIND/GETITEMKIND/USENODE quest types (there's no
    // EventType for "found" something, and no quest in shared/data/quests.json
    // uses type 4/HIDEANDSEEK either), so this was unreachable dead code, not
    // a live feature with a broken call site. A previous pass already fixed
    // an off-by-one in its completion check (postfix vs. prefix `++quest.count`)
    // without noticing it was unreachable either way. Left out rather than
    // fixed-in-place, matching how other confirmed-dead methods have been
    // handled elsewhere in this codebase (e.g. mapentities.js's
    // getEachEntityAround) -- if HIDEANDSEEK quests are wired up later, this
    // logic (and the fix) can be resurrected from version control.

    questAboutItemComplete(quest, callback){
        const p = this.player;
        if(quest.count >= quest.object2.count && quest.status==Types.QuestStatus.INPROGRESS) {
            const kind = quest.object2.kind+1000;
            // FIX: hasItemCount(kind) returns the raw total count, used
            // here only as a truthy "has at least 1" gate instead of "has
            // at least quest.object2.count". quest.count (checked above) is
            // a cached snapshot from the last LOOTITEM event and can be
            // stale if the player has since spent/dropped/sold the item, so
            // this was the only live check standing between an
            // under-stocked player and a free completion. hasItems() (used
            // correctly elsewhere in this file, e.g. questAboutItemCheck)
            // checks real sufficiency.
            if(!p.items.inventory.hasItems(kind, quest.object2.count))
                return;

            p.items.inventory.removeItemKind(kind, quest.object2.count);
            const xp = quest.object2.count * 20 * p.level;
            this.completeQuest(quest, xp);
            if (callback)
                callback(quest);
            return true;
        }
        return false;
    }

    sendQuest(quest) {
        const p = this.player;
        //var entityId = this.player.map.entities.getNpcByQuestId(quest.npcQuestId);
        p.sendPlayer(new Messages.Quest(quest));
    }

    progressQuest(quest) {
        quest.status = Types.QuestStatus.INPROGRESS;
        this.sendQuest(quest);
    }

    completeQuest(quest, xp) {
        if (xp > 0) {
            const multiplier = (quest.data) ? quest.data.expMultiplier : 1;
            this.player.incExp(xp * multiplier);
        }

        quest.status = Types.QuestStatus.COMPLETE;
        this.sendQuest(quest);
        this.completeQuests[quest.id] = {"npcid":quest.npcQuestId};
        this.removeQuest(quest);
    }

    removeQuest(quest) {
        // FIX: removeVal() was an Array.prototype monkey-patch; migrated to
        // the named Utils.removeFromArray() helper (see utils.js).
        Utils.removeFromArray(this.quests, quest);
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
        const cq = this.completeQuests;
        for (const qid in cq) {
            const q = cq[qid];
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
