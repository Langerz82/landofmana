var Quest = require('./quest');
var Messages = require('./message');

module.exports = EntityQuests = cls.Class.extend({
    init: function(entity) {
      this.entity = entity;

      this.questsCount = 0;
      this.quests = {};
      this.questEntityKind = this.entity.kind;
    },

    acceptQuest: function (player, questId) {
      if (!this.quests.hasOwnProperty(questId))
        return;

      var quest = this.quests[questId];

      pQuest = player.quests.getQuestById(parseInt(questId));
      if (pQuest) {
        if (pQuest.status < QuestStatus.COMPLETE) {
          pQuest.status = QuestStatus.INPROGRESS;
          player.quests.progressQuest(pQuest);
          return;
        }
      }

      pQuest = Object.assign(new Quest(), quest);
      player.quests.foundQuest(pQuest);
    },

    rejectQuest: function (player, questId) {

    },

// BUGGED - WHEN A QUEST IS IN-PROGRESS IT DOES NOT SHOW THE QUEST SUMMARY.
    hasQuest: function (player) {
      for (var quest of player.quests.quests)
      {
        if (this.questEntityKind == quest.npcQuestId) {
          player.quests.progressQuest(quest);
          return true;
        }
      }

      for (var id in this.quests) {
        var quest = this.quests[id];
        if (player.quests.hasNpcCompleteQuest(quest.npcQuestId)) {
          this.sendNoQuest(player);
          return true;
        }
      }
      return false;
    },

    sendNoQuest: function (player) {
      var entity = this.entity;
      var msg = new Messages.Dialogue(entity, "QUESTS_NONE", [entity.nextNpcDir, entity.nextNpcName, entity.name])
      entity.map.entities.sendToPlayer(player, msg);
    },

    dynamicQuests: function (player) {
      if (this.hasQuest(player))
        return;

      this.createQuest(player);
      return;
    },

    getMobObject: function () {
      var entities = self.map.entities.getMobsAround(this.entity, 35);
      if (entities.length == 0)
        return;

      var entitycount = Utils.GetGroupCountArray(entities, "kind");
      console.warn("entitycount="+JSON.stringify(entitycount));
      if (entitycount.length == 0)
        return null;
      log.info("entitycount="+JSON.stringify(entitycount));
      entitycount.sort(function(a, b){return b[1]-a[1]});
      log.info("entitycount="+JSON.stringify(entitycount));
      var kind = parseInt(entitycount[0][0]);

      entities = entities.filter(function(entity) { return entity.kind == kind; });
      var minLevel = Utils.minProp(entities, "level").level;

      var mobCount = parseInt(entitycount[0][1]);
      if (mobCount <= 0)
        return null;
      if (!MobData.Kinds[kind])
        return null;

      return getQuestObject([Types.EntityTypes.MOB, kind,
        mobCount, 0, minLevel, 100]);
    },

    createQuest: function(player) {
      var qTypes = [1,2];
      //var qTypes = [2];
      var questType = qTypes[Utils.randomInt(qTypes.length-1)];

      var pLvl = player.level;

// TODO - FIX UP QUESTS FOR NEW STRUCTURE.
      if (questType == QuestType.GETITEMKIND)
      {
        this.createQuestItemKind(player);
      }
      if (questType == QuestType.KILLMOBKIND)
      {
        this.createQuestKillMobKind(player);
      }
    },

    createQuestItemKind: function (player) {
      console.info("GETITEMKIND");

      var itemKind = Utils.randomInt(ItemLootData.ItemLoot.length-1);
      var id = '02'+ Utils.pad(this.entity.kind,6) + Utils.pad(this.questsCount++,4);
      var quest = player.quests.getQuestById(id);
      if (!quest)
      {
        var mobObject = this.getMobObject();
        if (!mobObject)
          return;
        mobObject.count = 0;

        var itemCount = Utils.randomRangeInt(1,5);
        var itemChance = 30*itemCount / (player.level+2);
        var itemObject = getQuestObject([Types.EntityTypes.ITEMLOOT, itemKind,
          itemCount, itemChance]);

        quest = new Quest([id, QuestType.GETITEMKIND, this.questEntityKind, 0, 0, 0, 0, mobObject, itemObject]);
        //quest.entityId = this.entity.id;
        player.quests.foundQuest(quest);
      }
      else {
        quest.status = QuestStatus.INPROGRESS;
        player.quests.questAboutItem(quest);
      }
    },

    createQuestKillMobKind: function (player) {
      console.info("KILLMOBKIND");

      var id = '01'+ Utils.pad(this.entity.kind,6) + Utils.pad(this.questsCount++,4);
      var quest = player.quests.getQuestById(id);
      if (!quest)
      {
        var mobObject = this.getMobObject();
        if (!mobObject)
          return;
        var lw = 5;
        var lh = Math.max(player.level-10, 10);
        //log.info("KILLMOBKIND - lh="+lh);
        mobObject.count = Utils.clamp(lw, lh, (mobObject.count / 2));
        mobObject.count = Math.ceil(mobObject.count/5)*5;

        quest = new Quest([id, QuestType.KILLMOBKIND, this.questEntityKind, 0, 0, 0, 0, mobObject]);
        //quest.entityId = this.entity.id;
        player.quests.foundQuest(quest);
      }
      else {
        quest.status = QuestStatus.INPROGRESS;
        player.quests.progressQuest(quest);
      }
    },
});
