var Messages = require("./message");

module.exports = PlayerQuests = cls.Class.extend({
  init: function (player) {
    this.player = player;
    this.quests = [];
    this.completeQuests = {};
  },

  questAboutKill: function(mob, quest) {
    var mobKind = mob.kind, mobLevel = mob.level;

    var a = (quest.count < quest.object.count);
    var b = (quest.type == QuestType.KILLMOBKIND && a && (mobKind == quest.object.kind));
    var c = (quest.type == QuestType.KILLMOBS && a);
    var d = (mob.level >= quest.object.level[0] && mob.level <= quest.object.level[1]);
    if((b || c) && d)
    {
        console.info("_questAboutKill - conditions met.")
        quest.data1 += ~~(mob.stats.xp / 1.5);
        if(++quest.count == quest.object.count) {
          this.completeQuest(quest, quest.data1);
        }
        else {
            this.progressQuest(quest);
        }
    }
  },

  questAboutUseNode: function(quest) {
    quest.count++;
    if(quest.count >= quest.object.count) {
      quest.count = quest.object.count;
      var xp = quest.object.count * 10 * this.level.base;
      this.completeQuest(quest, xp);
    } else {
      this.progressQuest(quest);
    }
  },

  questAboutItem: function(quest) {
      console.info(JSON.stringify(quest));
      var kind = quest.object2.kind+1000;
      var countItems = this.player.inventory.hasItemCount(kind);
      quest.count = countItems;
      this.progressQuest(quest);
  },

  questAboutFind: function(quest) {
      //console.info(JSON.stringify(quest));
      if(quest.count++ >= quest.object.count && quest.status == QuestStatus.INPROGRESS) {
        quest.count = quest.object.count;
        var xp = quest.object.count * 10 * this.player.level.base;
        this.completeQuest(quest, xp);
      }
  },

  questAboutItemComplete: function(quest, callback){

      if(quest.count >= quest.object2.count && quest.status==QuestStatus.INPROGRESS) {
        var kind = quest.object2.kind+1000;
        if(!player.inventory.hasItemCount(kind))
            return;

        player.inventory.removeItemKind(kind, quest.object2.count);
        var xp = quest.object2.count * 20 * this.player.level.base;
        this.completeQuest(quest, xp);
        if (callback)
          callback(quest);
        return true;
      }
      return false;
  },

  progressQuest: function (quest) {
    quest.status = QuestStatus.INPROGRESS;
    this.player.pushToPlayer(new Messages.Quest(quest));
  },


  completeQuest: function(quest, xp) {
    if (xp > 0) {
      this.player.incExp(xp);
    }

    quest.status = QuestStatus.COMPLETE;
    this.player.pushToPlayer(new Messages.Quest(quest));
    this.completeQuests[quest.id] = quest.npcQuestId;
    this.removeQuest(quest);
  },

  removeQuest: function (quest) {
    this.quests.splice(this.quests.indexOf(quest), 1);
    delete quest;
  },

  foundQuest: function(quest){
      //console.info("foundQuest="+questId);
      this.quests.push(quest);
      quest.status = QuestStatus.STARTED;
      this.player.pushToPlayer(new Messages.Quest(quest));
  },

  hasNpcCompleteQuest: function (npcQuestId) {
    var cq = this.completeQuests;
    for (var qid in cq) {
      var q = cq[qid];
      if (q == npcQuestId)
        return true;
    }
    return false;
    // Don't know why this won't work.
    //return Object.values(this.completeQuests).find(function (el) { return el == npcQuestId; }) !== null;
  },

  getQuestById: function (id) {
    return this.quests.find(function (q) { return q.id == id; });
   },

  hasQuest: function (id) {
    return this.getQuestById(id) != null;
  },

  forQuestsType: function (type, callback) {
    for (var q of this.quests) {
      if (q.type == type && callback)
          callback(q);
    }
  },

});
