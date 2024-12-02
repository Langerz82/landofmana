/* global Types */

define(['./character', '../questhandler', 'data/npcdata'], function(Character, QH, NpcData) {
  var NpcStatic = Character.extend({
    init: function(id, type, map, kind, name) {
      this._super(id, type, map, kind, 1);
      //this.itemKind = ItemTypes.getKindAsString(this.kind);
      this.talkIndex = 0;

      log.info("Npc.title: "+NpcData.Kinds[this.kind].title);
      log.info("Npc.name: "+NpcData.Kinds[this.kind].name);

      this.name = name || NpcData.Kinds[this.kind].title;
    },

    /*talk: function(msgs) {
        if(!this.talkIndex)
    	   this.talkIndex = 0;
        if (!Array.isArray(msgs))
          return "Well, hello there!";

        var msg = null;
        var talkCount = msgs.length;

        if(this.talkIndex < talkCount) {
          return msgs[this.talkIndex++];
        } else {
          return null;
        }
    },*/

      getSpriteName: function() {
          return NpcData.Kinds[this.kind].uid;
      },

      getAnimationByName: function () {
        return this._super("idle_down");
      }
    });
  return NpcStatic;
});
