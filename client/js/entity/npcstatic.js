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

    getSpriteName: function() {
        return NpcData.Kinds[this.kind].uid;
    },

    getAnimationByName: function (name) {
      return this._super(name); // FIX: was ignoring the name argument and always returning "idle_down"; forward the requested animation like other entity classes
    }
  });
  return NpcStatic;
});
