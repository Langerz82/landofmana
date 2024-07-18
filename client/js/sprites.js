define([],
  //'text!../sprites/sprites.json',
  //'text!../sprites/items.json',
  //'text!../sprites/blocks.json'],
  function() {
    var Sprites = Class.extend({
      init: function (data) {
        var self = this;

        var $file = "sprites/sprites.zip";
        JSZipUtils.getBinaryContent($file, function(err, data) {
            if(err) {
                throw err; // or handle err
            }

            JSZip.loadAsync(data).then(function(zip) {
              try {
                zip.file("sprites.json").async("string").then(function(data) {
                    self.makeSprites(data);
                    game.setSpriteJSON();
                });
              }
              catch (err) {
                console.error(JSON.stringify(err));
              }
            });
        });

      },

      makeSprites: function (data) {
        var sprites = {};

    	  var spriteJson = JSON.parse(data);
        for (var id in spriteJson) {
          var sprite = spriteJson[id];
        	sprites[sprite.id] = sprite;
        }

        this.sprites = sprites;
        return sprites;

      }

    });

    return Sprites;
});
