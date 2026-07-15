// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global JSZipUtils, JSZip */
import fetchJsonSync from './data/fetchjsonsync.js';

export default class Sprites {
      constructor(data) {
        const self = this;

        const $file = "data/sprites/sprites.zip";
        JSZipUtils.getBinaryContent($file, function(err, data) {
            if(err) {
                console.error("Failed to load sprites.zip:", err);
                self.loadSpritesJSON();
                return;
            }

            JSZip.loadAsync(data).then(function(zip) {
              try {
                // FIX: no .catch on this promise chain meant a corrupt/missing sprites.json
                // entry silently hung sprite loading forever - the surrounding try/catch only
                // catches synchronous setup errors, not this async rejection. Same class of
                // bug already fixed in map.js/mapcontainer.js's zip-load paths.
                zip.file("sprites.json").async("string").then(function(data) {
                    self.makeSprites(data);
                    game.setSpriteJSON();
                }).catch(function(err) {
                    console.error("Failed to load sprites.json from zip:", err);
                    self.loadSpritesJSON();
                });
              }
              catch (err) {
                console.error(JSON.stringify(err));
                self.loadSpritesJSON();
              }
            }).catch(function(err) {
                // FIX: mirrors the outer JSZip.loadAsync(...).catch fallback already used in
                // mapcontainer.js - if sprites.zip is present but fails to parse (corrupt file,
                // stale/partial cached response, etc.) fall back to loading sprites.json directly.
                console.error("Failed to load sprites.zip contents:", err);
                self.loadSpritesJSON();
            });
        });

      }

      // FIX: fallback used whenever data/sprites/sprites.zip can't be loaded or parsed --
      // loads data/sprites/sprites.json directly instead, via the same fetchJsonSync helper
      // already used by the data/*.js modules (shared/data/items2.json etc.).
      loadSpritesJSON() {
        try {
            const spriteJson = fetchJsonSync("data/sprites/sprites.json");
            this.makeSprites(JSON.stringify(spriteJson));
            game.setSpriteJSON();
        }
        catch (err) {
            console.error("Failed to load sprites.json fallback:", err);
        }
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
