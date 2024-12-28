/* global module */

var Entity = require('./entity'),
    Player = require('./player'),
    Utils = require('../utils'),
    Messages = require('../message');

var NpcStatic = Entity.extend({
    init: function (id, kind, x, y, map) {
        // This is because the npc offsets are centered in the client.
        x += 8;
        y += 8;

        this._super(id, Types.EntityTypes.NPCSTATIC, kind, x, y, map);

        this.map = map;
    },

    talk: function (player)
    {
      console.info("talk");
      console.info("kind: "+this.kind);
      if (this.kind == 44)
      {
        console.info("THIS IS FOR COLLECTING ITEMS NPC.")
        if (player.questStatus) {
          for (let [key, questStatus] of Object.entries(player.questStatus))
          {
            console.info("questStatus"+JSON.stringify(questStatus));
            if (questStatus.type==1 && questStatus.count <= questStatus.objectCount)
            {
                player.questAboutItem(questStatus, null);
            }
          }
        }
        return;
      }

      //var npcIsBusy = false;
      //if (player.questStatus) {
        for (var quest in player.quests)
        {
          if (quest.npcKind == this.kind)
          {
            //npcIsBusy = true;
            return;
          }
        }
      //}

    }
});

module.exports = NpcStatic;
