/* global Types */

define(['./character','data/appearancedata','../sprites'], function(Character, AppearanceData, Sprites) {
  var NpcMove = Character.extend({
    init: function(id, type, map, kind, name) {
      this._super(id, type, map, kind);
      this.mapIndex = map;
      this.talkIndex = 0;
      this.name = name;
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

    /*getSprite: function () {
  	    if (this.sprite[0] > 0)
  	    {
  	    	    return Sprites[this.sprite[0]].sprite;
  	    }
  	},*/

    getSpriteName: function() {
        return game.spriteNames[this.sprites[0]];
    },

    /*setClass: function(pClass) {
      this.pClass = pClass;
      ts = game.tilesize;
      this.setAttackRange(1);
    },*/

    });

    return NpcMove;
});
