// Mixin extracted from renderer.js/rendererdraw.js: health/harvest bars and the
// low-level target/square/bar-outline PIXI.Graphics primitives they're built from.
// Applied onto Renderer.prototype via install*(...) call in renderer.js; not a standalone class.
/* global G_TILESIZE, PIXI, Container */

export function installRendererDrawBars(proto) {
    proto.showHealthBar = function (entity) {
        if (!(entity.stats && entity.stats.hp)) return;

        const mod = entity.stats.hp / entity.stats.hpMax;
        if (mod === 1) {
            this.removeHealthBar(entity.id);
            return;
        }

        const ts = G_TILESIZE;
        const id = 'healthbar_ol_' + entity.id;
        let sprite = this.pxSprite[id];
        const s = this.gameScale;
        const eo = this.getEntityOffset();
        const x = (entity.x + eo[0]) * s;
        const y = (entity.y + eo[1] - ts - (ts >> 1)) * s;

        const id2 = 'healthbar_il_' + entity.id;
        let sprite2 = this.pxSprite[id2];

        if (!sprite) {
            sprite = this.createBarOutline(x, y);
            this.pxSprite[id] = sprite;
            sprite2 = this.createBarInner(x, y, mod, 0xff0000);
            this.pxSprite[id2] = sprite2;
        }

        sprite2.zindex = sprite.zIndex =
            entity.y * (this.camera.gridW * ts) + entity.x;
        sprite2.mod = mod;

        sprite2.x = sprite.x = x;
        sprite2.y = sprite.y = y;

        const gs = this.gameScale;

        sprite2.x = x - ts * (gs / 2);
        sprite2.y = y;
        sprite2.width = ts * gs * mod;
    };

    proto.showHarvestBar = function (entity) {
        const ts = G_TILESIZE;
        const harvestTime = entity.harvestDuration;
        if (!harvestTime) return;

        const duration = Date.now() - entity.startHarvestTime;
        const mod = Math.min(duration, harvestTime) / harvestTime;
        if (mod === 1) return;

        const id = 'harvestbar_ol_' + entity.id;
        let sprite = this.pxSprite[id];
        const s = this.gameScale;
        const eo = this.getEntityOffset();
        const x = (entity.x + eo[0]) * s;
        const y = (entity.y + eo[1] - ts - (ts >> 1)) * s;

        const id2 = 'harvestbar_il_' + entity.id;
        let sprite2 = this.pxSprite[id2];

        if (!sprite) {
            sprite = this.createBarOutline(x, y);
            this.pxSprite[id] = sprite;
            sprite2 = this.createBarInner(x, y, mod, 0x00ff00);
            this.pxSprite[id2] = sprite2;
        }

        sprite2.zindex = sprite.zIndex =
            entity.y * (this.camera.gridW * ts) + entity.x;
        sprite2.mod = mod;

        sprite2.x = sprite.x = x;
        sprite2.y = sprite.y = y;

        const gs = this.gameScale;

        sprite2.x = x - ts * (gs / 2);
        sprite2.y = y;
        sprite2.width = ts * gs * mod;
    };

    proto.createBarOutline = function (x, y) {
        const gfx = new PIXI.Graphics();
        this.drawBarOutline(gfx, x, y);
        const tx = this.renderer.generateTexture(gfx);
        const sprite = new PIXI.Sprite(tx);
        sprite.anchor.set(0.5, 0.5);
        sprite.alpha = 0.75;
        Container.HUD.addChild(sprite);
        return sprite;
    };

    proto.createBarInner = function (x, y, mod, color) {
        const gfx = new PIXI.Graphics();
        this.drawBarInner(gfx, x, y, color);
        const tx = this.renderer.generateTexture(gfx);
        const sprite = new PIXI.Sprite(tx);
        sprite.anchor.set(0, 0.5);
        sprite.alpha = 0.75;
        Container.HUD.addChild(sprite);
        return sprite;
    };

    proto.removeHealthBar = function (entityId) {
        this.removeSprite(Container.HUD, 'healthbar_ol_' + entityId);
        this.removeSprite(Container.HUD, 'healthbar_il_' + entityId);
    };

    proto.removeHarvestBar = function (entityId) {
        this.removeSprite(Container.HUD, 'harvestbar_ol_' + entityId);
        this.removeSprite(Container.HUD, 'harvestbar_il_' + entityId);
    };

    proto.drawBarOutline = function (gfx, x, y) {
        const gs = this.gameScale;
        const ts = G_TILESIZE;

        const w = ts * gs;
        const h = (ts >> 2) * gs;
        // FIX (var cleanup): x/y here were redeclaring their own parameters with var - illegal
        // with let/const, so these are just reassignments now.
        x = x - (w >> 1);
        y = y - (h >> 1);
        const border = 2;

        gfx.lineStyle(border, '#000000')
            .moveTo(x, y)
            .lineTo(x + w, y)
            .lineTo(x + w, y + h)
            .lineTo(x, y + h)
            .lineTo(x, y);

        return gfx;
    };

    proto.drawBarInner = function (gfx, x, y, color) {
        const gs = this.gameScale;
        const ts = G_TILESIZE;
        let w = ts * gs;
        let h = (ts >> 2) * gs;
        const border = 2;

        x += border >> 1;
        y += border >> 1;
        w -= border;
        h -= border;

        gfx.beginFill(color).drawRect(x, y, w, h).endFill();

        return gfx;
    };

    proto.drawTarget = function (gfx, x, y, color, l, thickness) {
        thickness = thickness || 2;
        l = l || (this.tilesize * this.scale) >> 1;
        gfx.lineStyle(thickness, color)
            .moveTo(x - l, y)
            .lineTo(x + l, y)
            .lineStyle(thickness, color)
            .moveTo(x, y - l)
            .lineTo(x, y + l);
    };

    proto.drawSquare = function (gfx, x, y, color, l, thickness) {
        thickness = thickness || 2;
        l = l || (this.tilesize * this.scale) >> 1;
        gfx.lineStyle(thickness, color).drawRect(x - l, y - l, l << 1, l << 1);
        /*gfx.lineStyle(thickness, color)
             .moveTo(x-l, y-l)
             .lineTo(x+l, y-l)
             .lineTo(x+l, y+l)
             .lineTo(x-l, y+l)
             .lineTo(x-l, y-l);*/
    };
}
