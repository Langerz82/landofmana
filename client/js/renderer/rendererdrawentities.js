// Mixin extracted from renderer.js/rendererdraw.js: entity sprite rendering/visibility
// (drawEntity, drawEntities, drawEntityTile, drawEntityTargetPos, entityVisible,
// removeEntity, removeEntityStuff, drawCenter).
// Applied onto Renderer.prototype via install*(...) call in renderer.js; not a standalone class.
import Item from '../entity/item.js';
import Entity from '../entity/entity.js';
import Player from '../entity/player/player.js';
import NpcMove from '../entity/npcmove.js';
/* global Types, ItemTypes, log, PIXI, Container */

export function installRendererDrawEntities(proto) {
    proto.drawEntity = function (entity) {
        const sprite = entity.getSprite(),
            anim = entity.currentAnimation;

        entity.spriteChanged = true;

        if (!(anim && sprite)) return;

        const eo = this.getEntityOffset();
        // FIX (var cleanup): `ey` in this multi-declaration is reassigned below (`ey -= (ts >>
        // 1)` for NpcMove entities), so the whole group needs `let`, not `const`.
        let c = game.camera,
            frame = anim.currentFrame,
            s = 2,
            x = frame.x * s,
            y = frame.y * s,
            w = sprite.width,
            h = sprite.height,
            //offX = (sprite.width >> 1),
            //offY = (sprite.height >> 1),
            ts = this.tilesize,
            //tsh = ts >> 1,
            //ox = sprite.offsetX,
            //oy = sprite.offsetY,
            dx = entity.x,
            dy = entity.y,
            //dw = w,
            //dh = h,
            z = (entity.y * (c.gridW * ts) + entity.x) * 2,
            //tOff = 1.0*ts,
            ex = dx + eo[0],
            ey = dy + eo[1];

        /*if (entity === game.player) {
          this.pex = ex;
          this.pey = ey;
        }*/
        if (entity === game.player.target) {
            this.drawEntityTile(entity.id, ex, ey);
        } else {
            this.removeSprite(Container.ENTITIES, 'et_' + entity.id);
        }

        entity.fadeRatio = entity.getFadeRatio(this.game.currentTime);

        try {
            if (entity instanceof NpcMove) {
                ey -= ts >> 1;
            }
            this.drawSprite([
                entity.pjsSprites[0],
                x,
                y,
                w * s,
                h * s,
                ex,
                ey,
                w,
                h,
                entity.flipSpriteX,
                entity.flipSpriteY,
                z,
                0.5,
                0.5
            ]);
        } catch (err) {
            log.info(err.message);
            log.info(err.stack);
        }

        if (entity instanceof Player && !(entity.isDead || entity.isDying)) {
            const weapon = entity.getSprite(1);
            if (weapon) {
                const weaponAnimData = weapon.animationData[anim.name],
                    index = weaponAnimData
                        ? frame.index < weaponAnimData.length
                            ? frame.index
                            : frame.index % weaponAnimData.length
                        : 0,
                    wx = weapon.width * index * s,
                    wy = weapon.height * anim.row * s,
                    ww = weapon.width,
                    wh = weapon.height;

                // Dont need for now.
                const visible = !entity.hideWeapon;
                this.drawSprite([
                    entity.pjsSprites[1],
                    wx,
                    wy,
                    ww * s,
                    wh * s,
                    ex,
                    ey,
                    ww,
                    wh,
                    entity.flipSpriteX,
                    entity.flipSpriteY,
                    z + 1,
                    0.5,
                    0.5,
                    visible
                ]);
            }
        }
    };

    proto.drawEntities = function (dirtyOnly) {
        const self = this;
        if (game.player && game.player.startHarvestTime > 0)
            this.showHarvestBar(game.player);
        // FIX: this else branch unconditionally read game.player.id, which throws if
        // game.player is falsy; not currently reachable since renderFrame() already gates the
        // call to drawEntities() on `!game.player`, but one refactor away from a null-deref
        else if (game.player) {
            this.removeHarvestBar(game.player.id);
        }

        // FIX: this used to walk *every* entity in game.entities each frame just to hide it
        // before re-showing whatever was actually on screen - O(n) over the whole world on
        // every frame. Instead, track which entity ids were on screen last frame and only
        // flip visibility for ids that left the screen this frame.
        const newlyVisible = {};

        self.camera.forEachInScreen(function (entity, id) {
            if (!entity) return;

            newlyVisible[id] = true;

            self.drawEntityName(entity);
            if (entity !== game.player) self.showHealthBar(entity);

            if (entity instanceof Item) {
                self.drawItem(entity);
            }
            if (entity instanceof Entity) {
                self.entityVisible(entity, true);
                if (!entity.isDead) self.drawEntity(entity);
            }

            if (entity.isDying || entity.isDead) {
                self.removeEntityStuff(entity);
            }
        });

        if (this.lastVisibleEntities) {
            for (let id in this.lastVisibleEntities) {
                if (!newlyVisible[id]) {
                    const entity = game.entities[id];
                    if (entity) {
                        this.entityVisible(entity, false);
                    }
                }
            }
        }
        this.lastVisibleEntities = newlyVisible;
    };

    proto.drawEntityTile = function (index, x, y) {
        const ts = this.tilesize;

        let sprite = this.pxSprite['et_' + index];
        if (!sprite) {
            const gfx = new PIXI.Graphics();
            const l = this.tilesize >> 1;
            gfx.lineStyle(2, 0x00ff00).drawRoundedRect(
                x - l,
                y - l,
                l << 1,
                l << 1,
                4
            );
            const texture = this.renderer.generateTexture(gfx);
            sprite = new PIXI.Sprite(texture);
            Container.ENTITIES.addChild(sprite);
            this.pxSprite['et_' + index] = sprite;
            sprite.anchor.set(0.5);
            sprite.z = y * (this.camera.gridW * ts) + x;
            sprite.alpha = 0.6;
        }
        sprite.x = x;
        sprite.y = y;
    };

    proto.drawEntityTargetPos = function (index, x, y) {
        let sprite = this.pxSprite['etp_' + index];
        if (!sprite) {
            const gfx = new PIXI.Graphics();
            const l = this.tilesize >> 1;
            this.drawTarget(gfx, 0, 0, 0xff0000, l, 1);
            const texture = this.renderer.generateTexture(gfx);
            sprite = new PIXI.Sprite(texture);
            Container.ENTITIES.addChild(sprite);
            this.pxSprite['etp_' + index] = sprite;
            sprite.anchor.set(0.5);
        }
        sprite.x = x;
        sprite.y = y;
    };

    proto.entityVisible = function (entity, flag) {
        for (let pjsSprite of entity.pjsSprites) {
            if (pjsSprite === null) continue;
            pjsSprite.renderable = flag;
            pjsSprite.visible = flag;
        }
    };

    proto.removeEntity = function (entity) {
        Container.ENTITIES.removeChild(entity.pjsSprites[0]);
        if (entity instanceof Player)
            Container.ENTITIES.removeChild(entity.pjsSprites[1]);
        this.removeEntityName(entity.id);
        Container.ENTITIES.removeChild(this.pxSprite['et_' + entity.id]);
        Container.ENTITIES.removeChild(this.pxSprite['etp_' + entity.id]);
        this.removeHealthBar(entity.id);
    };

    proto.removeEntityStuff = function (entity) {
        this.removeHealthBar(entity.id);
        this.removeEntityName(entity.id);

        // Hide the weapon of a player.
        if (entity instanceof Player) {
            entity.pjsSprites[1].renderable = false;
            entity.pjsSprites[1].visible = false;
        }
    };

    proto.drawCenter = function () {
        let sprite = this.pxSprite['center_'];
        if (!sprite) {
            const gfx = new PIXI.Graphics();
            this.drawTarget(gfx, 0, 0, 0xffff00, 16, 3);
            const texture = this.renderer.generateTexture(gfx);
            sprite = new PIXI.Sprite(texture);
            Container.HUD.addChild(sprite);
            sprite.anchor.set(0.5, 0.5);
            sprite.zIndex = 999999999;

            this.pxSprite['center_'] = sprite;
        }
        let h = window.innerHeight / 2,
            w = window.innerWidth / 2;
        const c = game.camera,
            p = game.player,
            gs = this.gameScale;

        w = (p.x - c.x) * gs;
        h = (p.y - c.y) * gs;

        sprite.x = w;
        sprite.y = h;
    };
}
