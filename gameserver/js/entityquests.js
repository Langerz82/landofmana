import Quest, { getQuestObject } from './quest.js';
import Messages from './message.js';
import { Types } from './common.js';
import Utils from './utils.js';
import MobData from './data/mobdata.js';
import ItemData from './data/itemdata.js';
import ItemLootData from './data/itemlootdata.js';
import ItemRoom from './items/itemroom.js';

// FIX: MobData, ItemData, ItemLootData, and ItemRoom were all used throughout
// this file (getMobObject, createQuestItemKind, giveReward) but never
// imported -- the stale `/* global ... */` comment below was a leftover from
// the CommonJS version where these really were implicit globals. Uncaught
// ReferenceErrors here broke dynamic quest generation and reward-giving
// entirely. Utils was also referenced (getMobObject/createQuestItemKind) but
// commented out above; uncommented and switched to a real import.
/* global log */

class EntityQuests {
    constructor(entity) {
      this.entity = entity;

      this.questsCount = 0;
      this.quests = {};
    }

    acceptQuest(player, questId) {
      if (!this.quests.hasOwnProperty(questId))
        return;

      const quest = this.quests[questId];

      let pQuest = player.quests.getQuestById(parseInt(questId));
      if (pQuest) {
        if (pQuest.status < Types.QuestStatus.COMPLETE) {
          pQuest.status = Types.QuestStatus.INPROGRESS;
          player.quests.progressQuest(pQuest);
          return;
        }
      }

      pQuest = Object.assign(new Quest(), quest);
      pQuest.data = quest.data;
      player.quests.foundQuest(pQuest);
    }

    rejectQuest(player, questId) {

    }

    giveReward(player, quest) {
      const pquest = player.quests.completeQuests[quest.id];
      if (!pquest) return false;

      if (!pquest.hasOwnProperty("reward")) {
        const count = player.items.inventory.hasRoomCount();
        if (quest.reward.length > 0 && count < quest.reward.length) {
          player.sendPlayer(new Messages.Notify("INVENTORY", "INVENTORY_FULL"));
          return false;
        }

        // NOTE: `msg` is reused/reassigned inside the reward loop below
        // (each rewarded item sends its own "ITEM_ADDED" notify through
        // the same binding), so it stays `let`; the loop's own
        // `var msg = ...` is now a plain reassignment instead of a second
        // declaration.
        let msg = new Messages.Dialogue(this.entity, "QUESTS_REWARD", [this.entity.name]);
        player.sendPlayer(msg);

        if (quest.gold > 0)
          player.items.modifyGold(parseInt(quest.gold, 10));

        for (const reward of quest.reward)
        {
            const item = new ItemRoom([
              parseInt(reward.itemKind, 10),
              parseInt(reward.itemNumber, 10) || 1,
              parseInt(reward.itemDurability, 10) || null,
              parseInt(reward.itemDurabilityMax, 10) || null,
              parseInt(reward.itemExperience, 10) || 0]);

            player.items.inventory.putItem(item);
            msg = new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name])
            player.sendPlayer(msg);
        }
        pquest.reward = 1;
        return true;
      }
      return false;
    }

    hasQuest(player) {
      for (const quest of player.quests.quests)
      {
        if (this.entity.npcQuestId === quest.npcQuestId) {
          /*if (player.quests.hasNpcCompleteQuest(quest.npcQuestId)) {
            continue;
          }*/
          player.quests.progressQuest(quest);
          return true;
        }
      }

      for (const id in this.quests) {
        const quest = this.quests[id];

        if (player.quests.hasNpcCompleteQuest(quest.npcQuestId)) {
          if (this.giveReward(player, quest)) {
            return true;
          }
        }
      }
      return false;
    }

    getNextQuestId(player) {
      for (const qid in this.quests) {
        if (player.quests.completeQuests[qid])
          continue;

        const pq = player.quests.getQuestById(qid);
        if (pq)
          continue;
        return qid;
      }
      return null;
    }

    sendNoQuest(player) {
      const entity = this.entity;
      const msg = new Messages.Dialogue(entity, "QUESTS_NONE", [entity.nextNpcDir, entity.nextNpcName, entity.name])
      player.sendPlayer(msg);
    }

    dynamicQuests(player) {
      if (this.hasQuest(player))
        return;

      this.createQuest(player);
      return;
    }

    // FIX: `self` was referenced here without ever being declared/assigned
    // in this method -- a ReferenceError on every call. `this.entity` (used
    // consistently elsewhere in this class) is what was meant.
    getMobObject() {
      let entities = this.entity.map.entities.getMobsAround(this.entity, 35);
      if (entities.length === 0)
        return;

      const entitycount = Utils.GetGroupCountArray(entities, "kind");
      console.warn("entitycount="+JSON.stringify(entitycount));
      if (entitycount.length === 0)
        return null;
      log.info("entitycount="+JSON.stringify(entitycount));
      entitycount.sort(function(a, b){return b[1]-a[1]});
      log.info("entitycount="+JSON.stringify(entitycount));
      const kind = parseInt(entitycount[0][0], 10);

      entities = entities.filter(function(entity) { return entity.kind === kind; });
      const minLevel = Utils.minProp(entities, "level").level;

      const mobCount = parseInt(entitycount[0][1], 10);
      if (mobCount <= 0)
        return null;
      if (!MobData.Kinds[kind])
        return null;

      return getQuestObject([Types.EntityTypes.MOB, kind,
        mobCount, 0, minLevel, 100]);
    }

    createQuest(player) {
      const qTypes = [1,2];
      //var qTypes = [2];
      const questType = qTypes[Utils.randomInt(qTypes.length-1)];

      const pLvl = player.level;

// TODO - FIX UP QUESTS FOR NEW STRUCTURE.
      if (questType === Types.QuestType.GETITEMKIND)
      {
        this.createQuestItemKind(player);
      }
      if (questType === Types.QuestType.KILLMOBKIND)
      {
        this.createQuestKillMobKind(player);
      }
    }

    createQuestItemKind(player) {
      console.info("GETITEMKIND");

      const itemKind = Utils.randomInt(ItemLootData.ItemLoot.length-1);
      const id = '02'+ Utils.pad(this.entity.kind,6) + Utils.pad(this.questsCount++,4);
      let quest = player.quests.getQuestById(id);
      if (!quest)
      {
        const mobObject = this.getMobObject();
        if (!mobObject)
          return;
        mobObject.count = 0;

        const itemCount = Utils.randomRangeInt(1,5);
        const itemChance = 30*itemCount / (player.level+2);
        const itemObject = getQuestObject([Types.EntityTypes.ITEMLOOT, itemKind,
          itemCount, itemChance]);

        quest = new Quest([id, Types.QuestType.GETITEMKIND, this.entity.npcQuestId, 0, 0, 0, 0, mobObject, itemObject]);
        //quest.entityId = this.entity.id;
        player.quests.foundQuest(quest);
      }
      else {
        quest.status = Types.QuestStatus.INPROGRESS;
        player.quests.questAboutItem(quest);
      }
    }

    createQuestKillMobKind(player) {
      console.info("KILLMOBKIND");

      const id = '01'+ Utils.pad(this.entity.kind,6) + Utils.pad(this.questsCount++,4);
      let quest = player.quests.getQuestById(id);
      if (!quest)
      {
        const mobObject = this.getMobObject();
        if (!mobObject)
          return;
        const lw = 5;
        const lh = Math.max(player.level-10, 10);
        //log.info("KILLMOBKIND - lh="+lh);
        mobObject.count = Utils.clamp(lw, lh, (mobObject.count / 2));
        mobObject.count = Math.ceil(mobObject.count/5)*5;

        quest = new Quest([id, Types.QuestType.KILLMOBKIND, this.entity.npcQuestId, 0, 0, 0, 0, mobObject]);
        //quest.entityId = this.entity.id;
        player.quests.foundQuest(quest);
      }
      else {
        quest.status = Types.QuestStatus.INPROGRESS;
        player.quests.progressQuest(quest);
      }
    }
}

export default EntityQuests;
