/* global module */

var Character = require('./character'),
    Messages = require('../message'),
    NpcMoveController = require('../npcmovecontroller'),
    QuestHandler = require("../questhandler");
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
        this.questHandler = new QuestHandler(this);

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

    talk: function (player) {
      var self = this;

      var res = false;
      player.quests.forQuestsType(QuestType.GETITEMKIND, function (q) {
        if (q.npcQuestId == self.questId) {
          if (player.quests.questAboutItemComplete(q, null))
            res = true;
        }
      });
      if (res)
        return;

      if (Object.keys(this.quests).length == 0) {
        this.questHandler.dynamicQuests(player);
      } else {
        var newQid = -1;

        if (this.questHandler.hasQuest(player)) {
          return;
        }

        for (var qid in this.quests) {
          var pq = player.quests.getQuestById(qid);
          if (pq)
            continue;
          newQid = qid;
          break;
        }

        if (newQid == -1) {
          this.questHandler.sendNoQuest(player);
          return;
        }

        var langcode = "DIALOGUE_"+newQid;
        this.map.entities.pushToPlayer(player, new Messages.Dialogue(this, langcode));
      }
    },


});

module.exports = NpcMove;
