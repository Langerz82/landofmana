/* global Types */

define(['./character','data/appearancedata','../sprites'], function(Character, AppearanceData, Sprites) {
  var NpcMove = Character.extend({
    init: function(id, type, map, kind, name) {
      this._super(id, type, map, kind);
      this.mapIndex = map;
      this.talkIndex = 0;
      this.name = name;
    },

    getSpriteName: function() {
        return game.spriteNames[this.sprites[0]];
    },

    });

    return NpcMove;
});
