// Mixin extracted from renderer.js/rendererdraw.js: PIXI sprite/texture primitives and
// tile/item drawing (getTexture, createSprite, changeSprite, drawSprite*, drawTile, drawItem)
// plus the generic removeSprite() helper used by the other rendererdraw* mixins.
// Applied onto Renderer.prototype via install*(...) call in renderer.js; not a standalone class.
import ItemLoot from '../data/itemlootdata.js';
/* global Types, ItemTypes, Utils, log, G_TILESIZE, PIXI, Container */

// Helper used only by drawTile() below (moved out of module scope in renderer.js since
// drawTile is the only caller).
const getX = function (num, w) {
    if (num === 0) {
        return 0;
    }
    return num % w === 0 ? w - 1 : (num % w) - 1;
};

export function installRendererDrawSprites(proto) {
    proto.getTexture = function (path) {
        if (!this.textures[path]) {
            this.textures[path] = new PIXI.Texture.from(path);
        }
        return this.textures[path];
    };

    proto.createSprite = function (csprite) {
        const tmp = this.getTexture(csprite.filepath).clone();
        const sprite = new PIXI.Sprite(tmp);
        sprite.width = csprite.width * this.gameScale;
        sprite.height = csprite.height * this.gameScale;
        sprite.flipX = false;
        sprite.flipY = false;
        sprite.visible = false;
        sprite.cullable = true;
        sprite.interactiveChildren = false;
        csprite.container.addChild(sprite);
        return sprite;
    };

    proto.changeSprite = function (csprite, pjsSprite) {
        const texture = this.getTexture(csprite.filepath);
        const sprite = pjsSprite;
        sprite.texture = texture;
        sprite.width = csprite.width * this.gameScale;
        sprite.height = csprite.height * this.gameScale;
        sprite.flipX = false;
        sprite.flipY = false;
        sprite.visible = false;
        return sprite;
    };

    proto.drawSpriteHUD = function (
        sprite,
        imgX,
        imgY,
        imgW,
        imgH,
        scrX,
        scrY,
        scrW,
        scrH,
        flipX,
        flipY
    ) {
        const s = 2;
        const size = this.gameScale;
        this.drawSprite([
            sprite,
            imgX * s,
            imgY * s,
            imgW * s,
            imgH * s,
            scrX * size,
            scrY * size,
            scrW * size,
            scrH * size,
            flipX,
            flipY,
            0,
            0,
            0
        ]);
    };

    proto.drawSprite = function (data) {
        const sprite = data[0];

        if (!sprite.texture.baseTexture.valid) return;
        sprite.texture.frame = new PIXI.Rectangle(
            data[1],
            data[2],
            data[3],
            data[4]
        );
        sprite.x = data[5];
        sprite.y = data[6];
        sprite.width = data[7];
        sprite.height = data[8];

        const flipX = data[9] || false;
        const flipY = data[10] || false;

        if (flipX) {
            if (sprite.scale.x > 0) sprite.scale.x *= -1;
        } else {
            if (sprite.scale.x < 0) sprite.scale.x *= -1;
        }
        if (flipY) {
            if (sprite.scale.y > 0) sprite.scale.y *= -1;
        } else {
            if (sprite.scale.y < 0) sprite.scale.y *= -1;
        }

        sprite.zIndex = data[11] || 0;
        sprite.anchor.x = data[12] || 0;
        sprite.anchor.y = data[13] || 0;

        sprite.visible = data.length > 14 ? data[14] : true;
        sprite.alpha = data[15] || 1; // FIX: PIXI.Sprite has no "opacity" property (that's a no-op DOM-style name); the transparency setter is "alpha"
    };

    // PERF: took a single `[isHigh, id, gx, gy]` array instead of four plain
    // arguments. Its only two callers (rendererdrawhud.js's drawTerrain())
    // built a fresh array literal for every single tile drawn -- and
    // drawTerrain() calls this once per visible tile, every frame (a
    // ~20x15 screen is a few hundred tiles/frame at 60fps), so this was a
    // few-hundred-to-low-thousands short-lived array allocations per
    // second purely for argument passing, same class of GC churn as the
    // gameserver's map.js isColliding()/pathfinder.js fixes. Plain
    // positional args carry the same four values with no allocation.
    // Deliberately NOT touching the `new PIXI.Rectangle(...)` a few lines
    // below despite it being a bigger per-call allocation than the array
    // was: PIXI's Texture.frame setter may rely on object-identity dirty-
    // checking internally (skipping its own update work when the assigned
    // Rectangle reference doesn't change), which isn't something to guess
    // at without being able to actually run this PIXI version and watch
    // tiles render -- reusing one Rectangle instance across calls could
    // silently break tile updates instead of speeding them up. Left as-is.
    proto.drawTile = function (isHigh, id, gx, gy) {
        const ts = G_TILESIZE;

        const px = gx * ts;
        const py = gy * ts;

        const tw = this.tilesetwidth;
        const tileset = this.tilesets[0];

        tileset.frame = new PIXI.Rectangle(0, 0, ts, ts);
        tileset.frame.interactive = false;
        tileset.frame.interactiveChildren = false;
        tileset.frame.x = getX(id, tw) * ts;
        tileset.frame.y = ~~((id - 1) / tw) * ts;

        let container = this.tiles['BACKGROUND'];
        if (isHigh) container = this.tiles['FOREGROUND'];
        container.addFrame(tileset, px, py, ts, ts);

        // UNcomment to enable tile numbering.
        /*var id = "tct_"+ix+"_"+iy;
         var gs = this.gameScale;
         var sprite = this.pxSprite[id];
         if (!sprite)
         {
           var style = new PIXI.TextStyle({
             fontFamily: "Arial",
             fill: "#000000",
             fontSize: 14,
             align: "center",
             fontWeight: "bold"
           });
           sprite = new PIXI.Text(ix+","+iy, style);
           sprite.anchor.set(0.5,0.5);
           Container.COLLISION2.addChild(sprite);
           this.pxSprite[id] = sprite;
         }
         sprite.x = x * gs + ts*3/2;
         sprite.y = y * gs + ts*3/2;
         */
    };

    proto.drawItem = function (entity) {
        entity.spriteChanged = game.player.isMoving();

        let itemData = ItemTypes.KindData[entity.kind];
        if (ItemTypes.isLootItem(entity.kind)) {
            itemData = ItemLoot[entity.kind - 1000];
        }

        const s = 2,
            ts = G_TILESIZE,
            w = entity.sprites[0].width,
            h = entity.sprites[0].height;

        const x = itemData.offset[0] * w * s,
            y = itemData.offset[1] * h * s;

        let eo = this.getEntityOffset(),
            idx = entity.x + eo[0],
            idy = entity.y + eo[1],
            dw = w,
            dh = h,
            z = (entity.y * (game.camera.gridW * ts) + entity.x) * 2;

        if (
            ItemTypes.isLootItem(entity.kind) ||
            ItemTypes.isCraftItem(entity.kind)
        ) {
            dw /= 2;
            dh /= 2;
        }

        try {
            this.drawSprite([
                entity.pjsSprites[0],
                x,
                y,
                w * s,
                h * s,
                idx,
                idy,
                dw,
                dh,
                0,
                0,
                z,
                0.5,
                0.5
            ]);
        } catch (err) {
            log.info(err.message);
            log.info(err.stack);
        }
    };

    proto.removeSprite = function (container, id) {
        const sprite = this.pxSprite[id];
        if (sprite) {
            container.removeChild(sprite);
            this.pxSprite[id] = null;
        }
    };
}
