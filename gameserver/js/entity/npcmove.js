/* global module */

var Character = require('./character'),
    Messages = require('../message'),
    NpcMoveController = require('../npcmovecontroller'),
    Quest = require("../quest");
var NPCnames = require("../../shared/data/npc_names.json");


var NpcMove = Character.extend({
    init: function (id, kind, x, y, map) {
        // This is because the npc offsets are centered in the client.
        x += 8;
        y += 8;

        this._super(id, Types.EntityTypes.NPCMOVE, kind, x, y, map);

        this.armor = 0;
        this.weapon = 0;

        this.gender = kind % 2;
        this.setMoveRate(350);

        this.name = NPCnames[kind%NPCnames.length];

        this.activeController = new NpcMoveController(this);

        this.scriptQuests = false;

        this.questCount = 0;
        this.quests = {};
        this.questId = this.kind;

        if (QuestData.NpcData.hasOwnProperty(this.kind)) {
          var qData = QuestData.NpcData[this.kind];
          if (qData && qData.length > 0)
          {
            var newQuest = null;
            var pQuest = null;
            for (var q of qData)
            {
              this.quests[q.id] = q;
            }
          }
        }
    },

    getState: function() {
        return this._getBaseState().concat([this.questId]);
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

    hasQuest: function (player) {
      for (var quest of player.quests.quests)
      {
        var a = (this.questId == quest.npcQuestId);
        if (a) {
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

    dynamicQuests: function (player) {
      if (this.hasQuest(player))
        return;

      this.createQuest(player);
      return;
    },

    sendNoQuest: function (player) {
      var langcode = "QUESTS_NONE";
      //if (Object.keys(this.quests).length > 0)
        //langcode = "QUESTS_NONE_"+this.kind;

      this.map.entities.pushToPlayer(player, new Messages.Dialogue(this, langcode, [this.nextNpcDir, this.nextNpcName, this.name]));
    },

    talk: function (player) {
      for (var q of player.quests.quests) {
        if (q.type == QuestType.GETITEMKIND) {
          if (player.quests.questAboutItemComplete(q, null))
            return;
        }
      }

      if (Object.keys(this.quests).length == 0) {
        this.dynamicQuests(player);
      } else {
        var newQid = -1;

        if (this.hasQuest(player)) {
          return;
        }

        for (var qid in this.quests) {
          var pq = player.quests.getQuestById(qid);
          /*if (pq && pq.status < QuestStatus.COMPLETE)
          {
            this.sendNoQuest(player);
            return;
          }*/
          if (pq)
            continue;
          newQid = qid;
          break;
        }

        if (newQid == -1) {
          this.sendNoQuest(player);
          return;
        }

        var langcode = "DIALOGUE_"+newQid;
        this.map.entities.pushToPlayer(player, new Messages.Dialogue(this, langcode));
      }
    },

    createQuest: function(player) {
      var qTypes = [1,2];
      //var qTypes = [2];
      var questType = qTypes[Utils.randomInt(qTypes.length-1)];

      var pLvl = player.level.base;

      var self = this;
      var getMobObject = function () {
        var entities = self.map.entities.getMobsAround(self, 35);
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
      };

// TODO - FIX UP QUESTS FOR NEW STRUCTURE.
      if (questType == QuestType.GETITEMKIND)
      {
        console.info("GETITEMKIND");

        var itemKind = Utils.randomInt(ItemLootData.ItemLoot.length-1);
        var id = '02'+ Utils.pad(this.kind,6) + Utils.pad(this.questCount++,4);
        var quest = player.quests.getQuestById(id);
        if (!quest)
        {
          var mobObject = getMobObject();
          if (!mobObject)
            return;
          mobObject.count = 0;

          var itemCount = Utils.randomRangeInt(1,5);
          var itemChance = 30*itemCount / (player.level.base+2);
          var itemObject = getQuestObject([Types.EntityTypes.ITEMLOOT, itemKind,
            itemCount, itemChance]);

          quest = new Quest([id, QuestType.GETITEMKIND, this.questId, 0, 0, 0, 0, mobObject, itemObject]);
          player.quests.foundQuest(quest);
        }
        else {
          quest.status = QuestStatus.INPROGRESS;
          player.quests.questAboutItem(quest);
        }
      }
      if (questType == QuestType.KILLMOBKIND)
      {
        console.info("KILLMOBKIND");

        var id = '01'+ Utils.pad(this.kind,6) + Utils.pad(this.questCount++,4);
        var quest = player.quests.getQuestById(id);
        if (!quest)
        {
          var mobObject = getMobObject();
          if (!mobObject)
            return;
          var lw = 5;
          var lh = Math.max(player.level.base-10, 10);
          //log.info("KILLMOBKIND - lh="+lh);
          mobObject.count = Utils.clamp(lw, lh, (mobObject.count / 2));
          mobObject.count = Math.ceil(mobObject.count/5)*5;

          quest = new Quest([id, QuestType.KILLMOBKIND, this.questId, 0, 0, 0, 0, mobObject]);
          player.quests.foundQuest(quest);
        }
        else {
          quest.status = QuestStatus.INPROGRESS;
          player.quests.progressQuest(quest);
        }
      }
    },

});

module.exports = NpcMove;
