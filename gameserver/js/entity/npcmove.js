/* global module */

var Character = require('./character'),
    Messages = require('../message'),
    NpcMoveController = require('../npcmovecontroller'),
    EntityQuests = require("../entityquests");
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
        this.entityQuests = new EntityQuests(this);

        //this.scriptQuests = false;

        if (QuestData.NpcData.hasOwnProperty(this.kind)) {
          var qData = QuestData.NpcData[this.kind];
          if (qData && qData.length > 0)
          {
            var newQuest = null;
            var pQuest = null;
            for (var q of qData)
            {
              this.entityQuests.quests[q.id] = q;
            }
          }
        }
    },

    getState: function() {
        // DANGER - if questhandler variable changes so should this.
        return this._getBaseState().concat([this.entityQuests.questEntityKind]);
    },

    talk: function (player) {
      var self = this;

      var res = false;
      player.quests.forQuestsType(QuestType.GETITEMKIND, function (q) {
        if (q.npcQuestId == self.kind) {
          if (player.quests.questAboutItemComplete(q, null))
            res = true;
        }
      });
      if (res)
        return;

      if (Object.keys(this.entityQuests.quests).length == 0) {
        this.entityQuests.dynamicQuests(player);
      } else {
        var newQid = -1;

        if (this.entityQuests.hasQuest(player)) {
          return;
        }

        for (var qid in this.entityQuests.quests) {
          var pq = player.quests.getQuestById(qid);
          if (pq)
            continue;
          newQid = qid;
          break;
        }

        if (newQid == -1) {
          this.entityQuests.sendNoQuest(player);
          return;
        }

        var langcode = "DIALOGUE_"+newQid;
        this.map.entities.sendToPlayer(player, new Messages.Dialogue(this, langcode));
      }
    },


});

module.exports = NpcMove;
