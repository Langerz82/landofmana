// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global JSZipUtils, JSZip */
export default class Sprites {
      constructor(data) {
        const self = this;

        const $file = "sprites/sprites.zip";
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

      }

      makeSprites(data) {
        const sprites = {};

    	  const spriteJson = JSON.parse(data);
        for (let id in spriteJson) {
          const sprite = spriteJson[id];
        	sprites[sprite.id] = sprite;
        }

        this.sprites = sprites;

        /*var i=0;
        for (var id in sprites) {
          console.error((++i)+" "+id);
        }*/
        return sprites;

      }
}
