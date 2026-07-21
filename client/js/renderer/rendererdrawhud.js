// Mixin extracted from renderer.js/rendererdraw.js: debug/combat HUD text, terrain tile
// pass, FPS/coordinate readouts, cursor, announcement banner, and the letterbox
// cutscene bars (drawDebugInfo, drawCombatInfo, drawTerrain, drawCursor, drawAnnouncement,
// showCutScene/startCutScene/endCutScene).
// Applied onto Renderer.prototype via install*(...) call in renderer.js; not a standalone class.
/* global Utils, PIXI, Container */

export function installRendererDrawHud(proto) {

    proto.drawDebugInfo = function() {
      const c = game.camera;
      let debugInfo = "";
      debugInfo += this.getFPS() + "\n";
      debugInfo += this.getCoordinates() + "\n";
      if (this.isDebugInfoVisible)
        debugInfo += this.getRealCoordinates() + "\n";

      const s = this.scale;
      let sprite = this.pxSprite["pc_coords"];
      if (!sprite)
      {
        const style = new PIXI.TextStyle({
          fontFamily: "GraphicPixel",
          fill: "white",
          fontSize: 18,
          align: "right",
          stroke: "black",
          strokeThickness: 4,
        });
        sprite = new PIXI.Text(debugInfo, style);
        sprite.anchor.set(1.0,0);
        sprite.zIndex = 999;
        Container.HUD.addChild(sprite);
        this.pxSprite["pc_coords"] = sprite;
      }
      sprite.text = debugInfo;
      sprite.x = ~~(this.renderer.screen.width / Container.HUD.scale.x);
      sprite.y = ~~(this.renderer.screen.height / Container.HUD.scale.y * 0.06);

    };

    proto.drawCombatInfo = function() {
      const self = this;

      this.game.infoManager.forEachInfo(function(info) {
        const id = "ci_"+info.id;

        let sprite = self.pxSprite[id];
        if (!sprite)
        {
          const style = new PIXI.TextStyle({
            fontFamily: "KomikaHand",
            fill: info.fillColor,
            fontSize: info.fontSize * self.scale,
            align: "center",
            strokeThickness: 4
          });
          sprite = new PIXI.Text(info.value, style);
          sprite.anchor.set(0.5,0);
          Container.HUD.addChild(sprite);
          self.pxSprite[id] = sprite;
        }
        const left = ~~((info.x - self.camera.x)*3);
        const top = ~~((info.y - self.camera.y - self.tilesize)*3);

        sprite.text = info.value;
        sprite.x = left;
        sprite.y = top;
        sprite.alpha = info.opacity;
      });
    };

    proto.getFPS = function() {
        const diffTime = Utils.getTime() - this.lastTime;

        if (diffTime >= 1000) {
            if (this.game.player.isMoving())
              this.movingFPS = this.frameCount;
            this.realFPS = this.frameCount;
            this.frameCount = 0;
            this.lastTime = Utils.getTime();

        }
        this.frameCount++;
        return "FPS: " + this.realFPS;
    };

    proto.getCoordinates = function() {
  				const realX = game.player.gx;
  				const realY = game.player.gy;

  				if (this.game.player)
  				{
            return "gx:"+realX+",gy:"+realY;
  				}
          return "";
    };

    proto.getRealCoordinates = function() {
  				const realX = game.player.x;
  				const realY = game.player.y;

  				if (this.game.player)
  				{
            return "x:"+realX+",y:"+realY;
  				}
          return "";
    };

    proto.drawTerrain = function(ctx) {
        const self = this,
            p = game.player,
            mc = game.mapContainer,
            tilesetwidth = this.tilesets[0].baseTexture.width / mc.tilesize;


        self.tilesetwidth = tilesetwidth;

        if(game.started) {
  						game.camera.forEachVisibleValidPosition(function(x, y) {
  							if(mc.tileGrid[y][x] instanceof Array) {
                  for (let id of mc.tileGrid[y][x]) {
                    self.drawTile([mc.isHighTile(id), id, x, y]);
                  }
  							}
  							else {
  								const id = mc.tileGrid[y][x];
  								if(id) {
                    self.drawTile([mc.isHighTile(id), id, x, y]);
  								}
  							}
  						}, 0, null);
        }
    };

    proto.drawAnnouncement = function() {
      const id = "announcement_0";

      let sprite = this.pxSprite[id];

      const announce = this.announcement;
      if (!announce)
        return;

      if (!sprite)
      {
        const style = new PIXI.TextStyle({
          fontFamily: "KomikaHand",
          fill: "#FFFF00",
          fontSize: 6 * this.scale,
          align: "center",
          strokeThickness: 4,
        });
        sprite = new PIXI.Text(announce[0], style);
        sprite.anchor.set(0.5,0.5);
        sprite.zIndex = 1000000;
        Container.HUD2.addChild(sprite);
        this.pxSprite[id] = sprite;
      }
      sprite.text = announce[0];
      sprite.updateTransform();
      sprite.updateText();
      sprite.position.x = (this.renderer.width / 2);
      sprite.position.y = (this.renderer.height / 4);
    };

    proto.drawCursor = function() {
        const mx = game.mouse.x,
            my = game.mouse.y;
        const anim = game.currentCursor.currentAnimation;
        const frame = anim.currentFrame;
        if (this.mobile)
          return;

        if(this.game.currentCursor) {
            this.drawSpriteHUD(game.currentCursor.pjsSprite,
              frame.x, frame.y,
              anim.width, anim.height, mx, my, anim.width, anim.height);
        }
    };

    proto.showCutScene = function() {
      const width = ~~($("#container").width()*this.gameZoom);
      const height = ~~($("#container").height()*this.gameZoom);

      const w = width;
      const h = Math.floor(height/8);
      const y2 = height;
      const y2max = y2-h;
      const y = -h;
      const ymax = 0;

      let sprite = this.pxSprite["cutscene_1"];
      let sprite2 = this.pxSprite["cutscene_2"];
      if (!sprite)
      {
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0x000000)
          .drawRect(0, 0, w, h)
          .endFill();

        const texture = this.renderer.generateTexture(gfx);
        sprite = new PIXI.Sprite(texture);
        Container.HUD.addChild(sprite);
        this.pxSprite["cutscene_1"] = sprite;

        sprite2 = new PIXI.Sprite(texture);
        Container.HUD.addChild(sprite2);
        this.pxSprite["cutscene_2"] = sprite2;

        sprite.y=y;
        sprite2.y=y2;
      }

      if (this.cutSceneActive) {
        if (sprite.y < ymax)
          sprite.y++;
        if (sprite2.y > y2max)
          sprite2.y--;
      } else {
        sprite.y--;
        sprite2.y++;
        if (sprite.y <= y && sprite2.y >= y2) {
          // Bars are fully retracted offscreen - tear them down so a future
          // startCutScene() rebuilds them cleanly instead of reusing stale sprites.
          Container.HUD.removeChild(sprite);
          Container.HUD.removeChild(sprite2);
          delete this.pxSprite["cutscene_1"];
          delete this.pxSprite["cutscene_2"];
        }
      }
    };

    proto.startCutScene = function() {
      this.cutSceneActive = true;
    };

    proto.endCutScene = function() {
      this.cutSceneActive = false;
    };

}
