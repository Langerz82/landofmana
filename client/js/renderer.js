// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, ItemTypes, Utils, Detect, Class, _, log, font */
import Detect from './detect.js';
import Camera from './camera.js';
import Item from './entity/item.js';
import Items from './data/items.js';
import ItemLoot from './data/itemlootdata.js';
import Entity from './entity/entity.js';
import Character from './entity/character.js';
import Player from './entity/player.js';
import Timer from './timer.js';
import Mob from './entity/mob.js';
import NpcMove from './entity/npcmove.js';
import NpcStatic from './entity/npcstatic.js';
import Block from './entity/block.js';
import LoadData from './loaddata.js';

const getX = function(num, w) {
    if (num === 0) {
        return 0;
    }
    return (num % w === 0) ? w - 1 : (num % w) - 1;
};

const checkAnnouncement = function (self) {
    self.announcement = null;
    const sprite = self.pxSprite["announcement_0"];
    if (sprite)
      sprite.visible = false;
    if (self.announcements.length > 0)
    {
      self.announcement = self.announcements.shift();
      if (sprite)
        sprite.visible = true;
    }
    setTimeout(function () { checkAnnouncement(self); },
      (self.announcement) ? self.announcement[1] : 5000
    );
};

export default class Renderer {
    constructor(game) {


        const self = this;
        this.game = game;

        this.loadData = new LoadData();

        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.HARD_EDGE;
        PIXI.settings.ROUND_PIXELS = false;
        PIXI.settings.SORTABLE_CHILDREN = true;
        //PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false;

        PIXI.tilemap.Constant = {
            maxTextures: 8,
            bufferSize: 4096,
            boundSize: 4096,
            boundCountPerBuffer: 4,
            use32bitIndex: true,
            SCALE_MODE: PIXI.SCALE_MODES.LINEAR,
        };
        PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;

        WebFont.load({
            custom: {
                families: ['KomikaHand','GraphicPixel','AdvoCut']
            },
            loading: function() { console.log('Font(s) Loading'); },
            active: function() { console.log('Font(s) Loaded'); },
            inactive: function() { console.log('Font(s) Failure'); }
        });

        this.scale = this.getScaleFactor();

        this.resolution = 1;
        //this.gameZoom = this.getGameZoom(1);

        this.calcScreenSize(1);


        const renderer = new PIXI.autoDetectRenderer (this.innerWidth, this.innerHeight, {
              width: this.innerWidth,
              height: this.innerHeight,
              antialias: false,
              transparent: false,
              resolution: this.resolution,
              autoResize: true,
              class: "clickable"
          });
        this.renderer = renderer;
        // Assuming 'renderer' is your PIXI renderer object
        this.renderer.plugins.interaction.autoPreventDefault = false;

        this.canvas = $("#canvas");
        this.canvas.css({
           'cursor' : 'none'
        });

        //this.centerStage();

        console.warn(this.renderer.type);
        if (this.renderer.type === PIXI.WEBGL_RENDERER){
           console.warn('Using WebGL');
         } else {
           console.warn('Using Canvas');
         };

        this.renderer.view.style.position = "absolute";
        this.renderer.view.style.display = "block";
        this.renderer.view.id = "game";
        //this.renderer.resize(window.innerWidth, window.innerHeight);
        //Container.STAGE.width = window.innerWidth;
        //Container.STAGE.height = window.innerHeight;

        this.docCanvas = document.getElementById("canvas");
        this.docCanvas.appendChild(this.renderer.view);
        this.docCanvas.firstElementChild.getContext("2d", { willReadFrequently: true })

        Container.STAGE.addChild(Container.BACKGROUND);
        Container.STAGE.addChild(Container.ENTITIES);
        Container.STAGE.addChild(Container.FOREGROUND);
        //Container.STAGE.addChild(Container.COLLISION);
        //Container.STAGE.addChild(Container.COLLISION2);
        Container.STAGE.addChild(Container.HUD);
        Container.STAGE.addChild(Container.HUD2);

        //Container.BACKGROUND.sortableChildren = true;
        Container.ENTITIES.sortableChildren = true;

        Container.BACKGROUND.zIndex = 1;
        Container.ENTITIES.zIndex = 2;
        Container.FOREGROUND.zIndex = 3;
        //Container.COLLISION.zIndex = 4;
        //Container.COLLISION2.zIndex = 5;
        Container.HUD.zIndex = 4;
        Container.HUD2.zIndex = 5;

        this.guiScale = 3;
        this.scaleHUD = 1;
        this.gameScale = 3;

        Container.BACKGROUND.scale.x = this.gameScale;
        Container.BACKGROUND.scale.y = this.gameScale;
        Container.ENTITIES.scale.x = this.gameScale;
        Container.ENTITIES.scale.y = this.gameScale;
        Container.FOREGROUND.scale.x = this.gameScale;
        Container.FOREGROUND.scale.y = this.gameScale;
        //Container.COLLISION.scale.x = this.gameScale;
        //Container.COLLISION.scale.y = this.gameScale;
        //Container.COLLISION2.scale.x = 1;
        //Container.COLLISION2.scale.y = 1;
        Container.HUD.scale.x = this.scaleHUD;
        Container.HUD.scale.y = this.scaleHUD;
        Container.HUD2.scale.x = 1;
        Container.HUD2.scale.y = 1;

        Container.STAGE.interactive = false;
        Container.BACKGROUND.interactive = false;
        Container.ENTITIES.interactive = false;
        Container.FOREGROUND.interactive = false;
        //Container.COLLISION.interactive = false;
        //Container.COLLISION2.interactive = false;
        Container.HUD.interactive = false;
        Container.HUD2.interactive = false;

        Container.STAGE.interactiveChildren = false;
        Container.BACKGROUND.interactiveChildren = false;
        Container.ENTITIES.interactiveChildren = false;
        Container.FOREGROUND.interactiveChildren = false;
        //Container.COLLISION.interactiveChildren = false;
        //Container.COLLISION2.interactiveChildren = false;
        Container.HUD.interactiveChildren = false;
        Container.HUD2.interactiveChildren = false;


        this.resources = {};
        this.tiles = {};

        this.initFPS();
        this.tilesize = G_TILESIZE;

        this.upscaledRendering = true;
			        this.rescaling = true;
        this.supportsSilhouettes = this.upscaledRendering;
        this.isFirefox = Detect.isFirefox();
        this.isCanary = Detect.isCanaryOnWindows();
        this.isEdge = Detect.isEdgeOnWindows();
        this.isSafari = Detect.isSafari();
        this.tablet = Detect.isTablet(window.innerWidth);
        this.mobile = Detect.isMobile();
        this.isTablet = this.tablet;
        this.isMobile = this.mobile;
        this.isDesktop = !(this.isTablet || this.isMobile);

        this.lastTime = 0;
        this.frameCount = 0;
        //this.maxFPS = this.FPS;
        this.realFPS = 0;
        this.movingFPS = this.FPS;
        this.fullscreen = true;

        //Turn on or off Debuginfo (FPS Counter)
        this.isDebugInfoVisible = false;
        this.animatedTileCount = 0;
        this.highTileCount = 0;

        this.forceRedraw = true;

        this.delta = 0;
        this.last = Date.now();

        this.announcements = [];

        this.createCamera();

        this.guiScale = this.getUiScaleFactor();

        this.textures = {};
        this.sprite = {};
        this.spriteTextures = {};

        this.blankFrame = false;

        // FIX: showCutScene() (letterbox bars) had no way to actually be turned on -
        // its only caller was permanently commented out in the render loop. Added an
        // explicit flag plus startCutScene()/endCutScene() control methods below so
        // something (a quest trigger, server message, etc.) can actually activate it.
        this.cutSceneActive = false;

        this.pxSprite = {};

        this.colTotal = 0;

        this.hitbarWidth = 0;

        this.pushAnnouncement("Welcome to Land Of Mana!", 5000);
        checkAnnouncement(this);

        this.gui = document.getElementById('gui');
        this.hitbar = document.getElementById("energy");

        this.resizeCanvases(1);

        this.isDebugInfoVisible = false;
        //this.culler = new Culler();
    }

    calcScreenSize(zoomMod) {
      this.gameZoom = this.getGameZoom(zoomMod);
      this.gameWidth = window.innerWidth;
      this.gameHeight = window.innerHeight;
      this.innerWidth = ~~(this.gameWidth * this.gameZoom);
      this.innerHeight = ~~(this.gameHeight * this.gameZoom);
    }

    getScaleFactor() {
        return 3;
    }

    getUiScaleFactor() {
        return 3;
    }

    getIconScaleFactor() {
        return 3;
    }

    getGuiZoom() {
      const w = window.innerWidth,
          h = window.innerHeight;

      let zoom = 1;

      if (this.mobile) {
        zoom *= 0.75;
      }
      else if (this.tablet) {
        zoom *= 1;
      }
      else {
        if ((w < 500 && h < 1000) || (w < 1000 && h < 500))
          zoom *= 0.75;
        else if (w <= 1500 || h <= 870)
          zoom *= 1;
        else
          zoom *= 1.25;
      }
      return zoom;
    }

    getGameZoom(zoomMod) {
        zoomMod = zoomMod || 1;
        const w = window.innerWidth,
            h = window.innerHeight;

        //var zoom = (w/window.screen.width * 0.5) + 0.5;
        let zoom = 1;

        if (this.mobile) {
          zoom *= 1.2;
        }
        else if (this.tablet) {
          zoom *= 0.9;
        }
        else {
          if ((w < 500 && h < 1000) || (w < 1000 && h < 500))
        		zoom *= 1.2;
        	else if (w <= 1500 || h <= 870)
        		zoom *= 0.9;
          else
            zoom *= 0.8;
        }
        return zoom * zoomMod;
    }

    rescale() {
        this.scale = this.getScaleFactor();

        this.initFPS();

        if(this.game.ready && this.game.renderer) {
            this.game.inventory.scale = this.getUiScaleFactor();
        }

        this.renderer.resize(this.innerWidth, this.innerHeight);
        this.renderer.resolution = 1;
    }

    centerStage() {
      const zoom = (1/this.gameZoom);
      const rw = ~~(this.renderer.width);
      const rh = ~~(this.renderer.height);

      // FIX: width/height were passed as "Npx !important" through jQuery's .css(), which
      // sets them via elem.style[prop] = value - assigning a value containing "!important"
      // that way is invalid per CSSOM and the browser silently drops the whole declaration,
      // so #canvas's box was never actually resized to match the renderer's buffer size.
      // Also missing transform-origin: with the default "50% 50%", scaling a box whose
      // actual (stale) size didn't match rw/rh pushed the canvas off-center and partially
      // off-screen instead of scaling from the top-left corner where left/top:0 assumed it
      // would. #gui (styled in main.css) already sets transform-origin: top left for the
      // same reason - #canvas needs it too.
      this.canvas.css({
        left: "0px",
        top:  "0px",
        width: rw + "px",
        height: rh + "px",
        transformOrigin: "top left",
        transform: "scale("+zoom+")",
      });
    }

    createCamera() {
        this.camera = new Camera(game, this);
        this.camera.focusEntity = game.player;
    }

    guiResize() {


      const guizoom = this.getGuiZoom();

					const w = Math.round($(window).width() / guizoom);
					const h = Math.round($(window).height() / guizoom);

					this.gui.width = w;
					this.gui.height = h;
					this.gui.style.width = w+"px";
					this.gui.style.height = h+"px";
					log.debug("#gui set to " + this.gui.width + " x " + this.gui.height);

      this.gui.style.transform = "scale("+(guizoom)+")";
    }

    resizeCanvases(zoomMod) {
      zoomMod = zoomMod || 1;

      this.calcScreenSize(zoomMod);

      this.guiResize();

      this.rescale();
      this.centerStage();

      this.camera.rescale();
      this.camera.setRealCoords();

      this.forceRedraw = true;
      //this.renderFrame();
    }

    initFPS() {
        this.FPS = 60;
    }

    initPIXI() {
      this.tilesets = this.loadData.tilesets;
      this.tiles.BACKGROUND = new PIXI.tilemap.CompositeRectTileLayer(0, this.tilesets);
      this.tiles.FOREGROUND = new PIXI.tilemap.CompositeRectTileLayer(0, this.tilesets);

      this.tiles.BACKGROUND.interactive = false;
      this.tiles.FOREGROUND.interactive = false;

      this.tiles.BACKGROUND.interactiveChildren = false;
      this.tiles.FOREGROUND.interactiveChildren = false;

      Container.BACKGROUND.addChild(this.tiles.BACKGROUND);
      Container.FOREGROUND.addChild(this.tiles.FOREGROUND);

      this.textStyleName = new PIXI.TextStyle({fontFamily: 'KomikaHand', stroke: 'black', strokeThickness: 3});
    }

    pushAnnouncement(text, duration) {
    	this.announcements.push([text, duration]);
    }

    drawAnnouncement() {
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
      //sprite.style = sprite.pstyle;
      sprite.position.x = (this.renderer.width / 2);
      sprite.position.y = (this.renderer.height / 4);
    }

    // FIX (dead code): removed drawText() - it had no call sites anywhere in the codebase,
    // referenced `this.defaultFont` which is never set on Renderer (would throw if reached),
    // and the PIXI.Text it built was never added to any container or returned, so it was
    // non-functional even if something had called it.

    drawCursor() {
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
    }

    getTexture(path)
    {
      if (!this.textures[path])
      {
        this.textures[path] = new PIXI.Texture.from(path);
      }
      return this.textures[path];
    }

    createSprite(csprite)
    {
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
    }

    changeSprite(csprite, pjsSprite)
    {
      const texture = this.getTexture(csprite.filepath);
      const sprite = pjsSprite;
      sprite.texture = texture;
      sprite.width = csprite.width * this.gameScale;
      sprite.height = csprite.height * this.gameScale;
      sprite.flipX = false;
      sprite.flipY = false;
      sprite.visible = false;
      return sprite;
    }

    drawSpriteHUD(sprite, imgX, imgY, imgW, imgH, scrX, scrY, scrW, scrH, flipX, flipY)
    {
      const s = 2;
      const size = this.gameScale;
      this.drawSprite([sprite, imgX*s, imgY*s, imgW*s, imgH*s, scrX*size, scrY*size, scrW*size, scrH*size, flipX, flipY, 0, 0, 0]);
    }

    // array: sprite, imgX, imgY, imgW, imgH, scrX, scrY, scrW, scrH, flipX, flipY, z, anchorX, anchorY, visible, opacity
    drawSprite(data)
    {
      //var s = 2; //this.scale;
      const sprite = data[0];

      if (!sprite.texture.baseTexture.valid) return;
      sprite.texture.frame = new PIXI.Rectangle(data[1], data[2], data[3], data[4]);
      sprite.x = data[5];
      sprite.y = data[6];
      sprite.width = data[7];
      sprite.height = data[8];

      const flipX = data[9] || false;
      const flipY = data[10] || false;

      if (flipX) {
        if (sprite.scale.x > 0)
          sprite.scale.x *= -1;
      } else {
        if (sprite.scale.x < 0)
          sprite.scale.x *= -1;
      }
      if (flipY) {
        if (sprite.scale.y > 0)
          sprite.scale.y *= -1;
      } else {
        if (sprite.scale.y < 0)
          sprite.scale.y *= -1;
      }

      sprite.zIndex = data[11] || 0;
      sprite.anchor.x = data[12] || 0;
      sprite.anchor.y = data[13] || 0;

      sprite.visible = (data.length > 14) ? data[14] : true;
      sprite.alpha = data[15] || 1; // FIX: PIXI.Sprite has no "opacity" property (that's a no-op DOM-style name); the transparency setter is "alpha"

    }

    // containerName, tileid, x, y
    drawTile(arr) {
        //if (arr[0])
          //return;

        const ts = G_TILESIZE;

         arr[2] *= ts;
         arr[3] *= ts;

         const tw = this.tilesetwidth;
         const tileset = this.tilesets[0];

         tileset.frame = new PIXI.Rectangle(0, 0, ts, ts);
         tileset.frame.interactive = false;
         tileset.frame.interactiveChildren = false;
         tileset.frame.x = (getX(arr[1], tw) * ts);
         tileset.frame.y = (~~((arr[1]-1) / tw) * ts);

         let container = this.tiles["BACKGROUND"];
         if (arr[0])
          container = this.tiles["FOREGROUND"];
         container.addFrame(tileset, arr[2], arr[3], ts, ts);


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
    }

	    drawItem(entity) {
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
            z = (entity.y*(game.camera.gridW*ts)+entity.x) * 2;
            //z = (y*(game.camera.gridW*ts)+x)*((game.camera.gridW*ts)*(game.camera.gridH*ts))+2;

        if (ItemTypes.isLootItem(entity.kind) || ItemTypes.isCraftItem(entity.kind)) {
          dw /= 2;
          dh /= 2;
        }

        try {
            this.drawSprite([entity.pjsSprites[0], x, y, w*s, h*s, idx, idy, dw, dh, 0, 0, z, 0.5, 0.5]);
        } catch (err) {
          log.info(err.message);
          log.info(err.stack);
        }
	    }

    drawEntityTargetPos(index, x, y) {
      let sprite = this.pxSprite["etp_"+index];
      if (!sprite)
      {
        const gfx = new PIXI.Graphics();
        const l = (this.tilesize >> 1);
        this.drawTarget(gfx, 0, 0, 0xff0000, l, 1);
        const texture = this.renderer.generateTexture(gfx);
        sprite = new PIXI.Sprite(texture);
        Container.ENTITIES.addChild(sprite);
        this.pxSprite["etp_"+index] = sprite;
        sprite.anchor.set(0.5);
      }
      sprite.x = x;
      sprite.y = y;
    }

    /*drawTopLeft: function () {
      var sprite = this.pxSprite["tltarget_"];
      if (!sprite)
      {
        var gfx = new PIXI.Graphics();
        this.drawTarget(gfx, 0, 0, 0x0000ff, 16, 2);
        var texture = this.renderer.generateTexture(gfx);
        sprite = new PIXI.Sprite(texture);
        Container.COLLISION.addChild(sprite);
        sprite.anchor.set(0.5,0.5);
        sprite.zIndex = 999999999;

        this.pxSprite["tltarget_"] = sprite;
      }
      var c = game.camera,
        p = game.player,
        gs = this.gameScale;

      var w = (-this.cOffX+c.sox);
      var h = (-this.cOffY+c.soy);

      sprite.x = w;
      sprite.y = h;
    },*/

    drawCenter() {
      let sprite = this.pxSprite["center_"];
      if (!sprite)
      {
        const gfx = new PIXI.Graphics();
        this.drawTarget(gfx, 0, 0, 0xffff00, 16, 3);
        const texture = this.renderer.generateTexture(gfx);
        sprite = new PIXI.Sprite(texture);
        Container.HUD.addChild(sprite);
        sprite.anchor.set(0.5,0.5);
        sprite.zIndex = 999999999;

        this.pxSprite["center_"] = sprite;
      }
      let h = window.innerHeight / 2,
          w = window.innerWidth / 2;
      const c = game.camera,
        p = game.player,
        gs = this.gameScale;

      w = (p.x - c.x)*gs;
      h = (p.y - c.y)*gs;

      sprite.x = w;
      sprite.y = h;
    }

    drawEntityTile(index, x, y) {
      const ts = this.tilesize;

      let sprite = this.pxSprite["et_"+index];
      if (!sprite)
      {
        const gfx = new PIXI.Graphics();
        const l = (this.tilesize >> 1);
        gfx.lineStyle(2, 0x00ff00)
          .drawRoundedRect(x-l, y-l, l << 1, l << 1, 4);
        const texture = this.renderer.generateTexture(gfx);
        sprite = new PIXI.Sprite(texture);
        Container.ENTITIES.addChild(sprite);
        this.pxSprite["et_"+index] = sprite;
        sprite.anchor.set(0.5);
        sprite.z = (y*(this.camera.gridW*ts)+x);
        sprite.alpha = 0.6;
      }
      sprite.x = x;
      sprite.y = y;
    }

    drawBubbles() {
      const self = this;
      _.each(game.bubbleManager.bubbles, function(bubble) {
          self.drawBubble(bubble);
      });
    }

    showHarvestBar(entity) {
      const ts = G_TILESIZE;
      const harvestTime = entity.harvestDuration;
      if (!harvestTime)
        return;

      const duration = Date.now()-entity.startHarvestTime;
      const mod = Math.min(duration, harvestTime) / harvestTime;
      if (mod === 1)
        return;

      const id = "harvestbar_ol_"+entity.id;
      let sprite = this.pxSprite[id];
      const s = this.gameScale;
      const eo = this.getEntityOffset();
      const x = (entity.x + eo[0]) * s;
      const y = (entity.y + eo[1] - ts - (ts >> 1)) * s;

      const id2 = "harvestbar_il_"+entity.id;
      let sprite2 = this.pxSprite[id2];

      if (!sprite) {
        sprite = this.createBarOutline(x, y);
        this.pxSprite[id] = sprite;
        sprite2 = this.createBarInner(x, y, mod, 0x00FF00);
        this.pxSprite[id2] = sprite2;
      }

      sprite2.zindex = sprite.zIndex = (entity.y*(this.camera.gridW*ts)+entity.x);
      sprite2.mod = mod;

      sprite2.x = sprite.x = x;
      sprite2.y = sprite.y = y;

      const gs = this.gameScale;

      sprite2.x = x - (ts * (gs/2));
      sprite2.y = y;
      sprite2.width = ts*gs*mod;
    }

    showHealthBar(entity) {
      if (!(entity.stats && entity.stats.hp))
        return;


      const mod = entity.stats.hp / entity.stats.hpMax;
      if (mod === 1) {
        this.removeHealthBar(entity.id);
        return;
      }

      const ts = G_TILESIZE;
      const id = "healthbar_ol_"+entity.id;
      let sprite = this.pxSprite[id];
      const s = this.gameScale;
      const eo = this.getEntityOffset();
      const x = (entity.x + eo[0]) * s;
      const y = (entity.y + eo[1] - ts - (ts >> 1)) * s;

      const id2 = "healthbar_il_"+entity.id;
      let sprite2 = this.pxSprite[id2];

      if (!sprite) {
        sprite = this.createBarOutline(x, y);
        this.pxSprite[id] = sprite;
        sprite2 = this.createBarInner(x, y, mod, 0xFF0000);
        this.pxSprite[id2] = sprite2;
      }

      sprite2.zindex = sprite.zIndex = (entity.y*(this.camera.gridW*ts)+entity.x);
      sprite2.mod = mod;

      sprite2.x = sprite.x = x;
      sprite2.y = sprite.y = y;

      const gs = this.gameScale;

      sprite2.x = x - (ts * (gs/2));
      sprite2.y = y;
      sprite2.width = ts*gs*mod;
    }

    createBarOutline(x, y) {
      const gfx = new PIXI.Graphics();
      this.drawBarOutline(gfx, x, y);
      const tx = this.renderer.generateTexture(gfx);
      const sprite = new PIXI.Sprite(tx);
      sprite.anchor.set(0.5,0.5);
      sprite.alpha = 0.75;
      Container.HUD.addChild(sprite);
      return sprite;
    }

    createBarInner(x, y, mod, color) {
      const gfx = new PIXI.Graphics();
      this.drawBarInner(gfx, x, y, color);
      const tx = this.renderer.generateTexture(gfx);
      const sprite = new PIXI.Sprite(tx);
      sprite.anchor.set(0,0.5);
      sprite.alpha = 0.75;
      Container.HUD.addChild(sprite);
      return sprite;
    }

// TODO - Make Bubbles
    drawBubble(bubble) {
      const eo = this.getEntityOffset();
      const ts = G_TILESIZE;
      const c = game.camera;
      const s = this.scale;
      const id = "bub_"+bubble.id;
      let sprite = this.pxSprite[id];
      let x = (bubble.entity.x + eo[0]) * s;
      let y = (bubble.entity.y + eo[1]) * s;
      if (!sprite)
      {
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0xffffff);
        gfx.lineStyle(2, 0x000000);

        let tw = Math.min(bubble.content.length*12*s,80*s);
        const style = new PIXI.TextStyle({
          fontFamily: "KomikaHand",
          fill: 0x000000,
          fontSize: 5 * this.scale,
          align: "center",
          wordWrap: true,
          wordWrapWidth: ~~(tw*1.3),
          fontWeight: 900,
          strokeThickness: 0,
        });

        const txt = new PIXI.Text(bubble.content, style);

        x = (bubble.entity.x + eo[0] - ts/2) * s;
        y = (bubble.entity.y + eo[1] - tw/2) * s;

        const th = ~~(txt.height * 1.25);
        tw = ~~(tw * 0.75);

        gfx.drawEllipse(x, y, tw, th);
        gfx.endFill();

        // Draw speech triangle.
        gfx.beginFill(0xffffff);
        gfx.moveTo(x, y+th*1.5);
        gfx.lineTo(x-ts/3, y+th);
        gfx.lineTo(x+ts/3, y+th);
        gfx.lineTo(x, y+th*1.5);
        gfx.endFill();

        // Hack cover speech triangle and ellipse join.
        gfx.lineStyle(2, 0xffffff);
        gfx.moveTo(x-ts/3, y+th);
        gfx.lineTo(x+ts/3, y+th);

        const texture = this.renderer.generateTexture(gfx);

        sprite = new PIXI.Sprite(texture);
        sprite.cullable = true;
        sprite.anchor.set(0.5,0.5);
        sprite.alpha = 0.85;


        txt.anchor.set(0.5,0.35);
        txt.position.y = -(th/2);

        sprite.addChild(txt);
        Container.HUD.addChild(sprite);
        this.pxSprite[id] = sprite;

      }

      sprite.anchor.set(0.5, 0.5);
      const os = (ts/2*s);
      x -= os;
      y -= sprite.height/2 + (os*2);
      sprite.x = x;
      sprite.y = y;
    }

    removeBubble(bubble) {
      const sprite = this.pxSprite["bub_"+bubble.id];
      Container.HUD.removeChild(sprite);
      this.pxSprite["bub_"+bubble.id] = null;
    }

    getEntityOffset() {
        const cv = this.getCameraView();
        const c = game.camera;
        return [cv[0], cv[1]];
    }

    drawEntity(entity) {
        const sprite = entity.getSprite(),
            anim = entity.currentAnimation;

        entity.spriteChanged = true;

        if(!(anim && sprite))
          return;

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
            z = (entity.y*(c.gridW*ts)+entity.x) * 2,
            //tOff = 1.0*ts,
            ex = (dx + eo[0]),
            ey = (dy + eo[1]);

        /*if (entity === game.player) {
          this.pex = ex;
          this.pey = ey;
        }*/
        if (entity === game.player.target) {
          this.drawEntityTile(entity.id, ex, ey);
        }
        else {
          this.removeSprite(Container.ENTITIES, "et_"+entity.id);
        }

        //this.drawEntityTargetPos(entity.id, ex, ey);
        entity.fadeRatio = entity.getFadeRatio(this.game.currentTime);

        try {
            if (entity instanceof NpcMove) {
              ey -= (ts >> 1);
            }
            this.drawSprite([entity.pjsSprites[0], x, y, w*s, h*s, ex, ey,
              w, h, entity.flipSpriteX, entity.flipSpriteY, z, 0.5, 0.5]);
        }
        catch (err) { log.info(err.message); log.info(err.stack); }

        if(entity instanceof Player && !(entity.isDead || entity.isDying)) {
            //if (!entity.sprites[1].pjsSprite)
              //entity.setWeaponSprite();
              //Container.ENTITIES.addChild(entity.pjsWeaponSprite);
            const weapon = entity.getSprite(1);
            if(weapon) {
                const weaponAnimData = weapon.animationData[anim.name],
                    index = (weaponAnimData) ? frame.index < weaponAnimData.length ? frame.index : frame.index % weaponAnimData.length : 0,
                    wx = weapon.width * index * s,
                    wy = weapon.height * anim.row * s,
                    ww = weapon.width,
                    wh = weapon.height;

                  // Dont need for now.
                  //var wox = weapon.offsetX;
                  //    woy = weapon.offsetY;
                  const visible = !entity.hideWeapon;
          				this.drawSprite([entity.pjsSprites[1], wx, wy, ww*s, wh*s,
          					ex,
          					ey,
          					ww, wh, entity.flipSpriteX, entity.flipSpriteY, z+1, 0.5, 0.5, visible]);
            }
        }

    }

    removeEntityStuff(entity) {
      this.removeHealthBar(entity.id);
      this.removeEntityName(entity.id);

      // Hide the weapon of a player.
      if (entity instanceof Player) {
        entity.pjsSprites[1].renderable = false;
        entity.pjsSprites[1].visible = false;
      }
    }

    entityVisible(entity, flag) {
      for (let pjsSprite of entity.pjsSprites) {
        if (pjsSprite === null)
          continue;
        pjsSprite.renderable = flag;
        pjsSprite.visible = flag;
      }
      //if (this.pxSprite.hasOwnProperty("en_"+entity.id) && this.pxSprite["en_"+entity.id])
        //this.pxSprite["en_"+entity.id].visible = flag;
    }

    drawEntities(dirtyOnly) {
        const self = this;
        //self.drawEntity(game.player);
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

        self.camera.forEachInScreen(function (entity,id) {
          if (!entity) return;

          newlyVisible[id] = true;

          self.drawEntityName(entity);
          if (entity !== game.player)
            self.showHealthBar(entity);

          if (entity instanceof Item)
          {
              self.drawItem(entity);
          }
          if (entity instanceof Entity)
          {
            self.entityVisible(entity, true);
            if (!entity.isDead)
              self.drawEntity(entity);
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
    }

    drawEntityName(entity) {
        let color = '#FFFFFF';
        let name = "";

        if(entity instanceof Player && entity.isMoving && !entity.isDead) {
            color = (entity.id === this.game.playerId ? "#ffff00" : (entity.admin ? "#ff0000" : "#fcda5c"));

            name = entity.name;
        }
        else if(entity instanceof Mob) {
            const mobLvl = entity.level;
            let playerLvl;

            color = "#FFFF00";
            if (entity.data.isAggressive)
              color = "#FF3333";

            name = "Level "+entity.level;
        }
        else if(entity.type === Types.EntityTypes.NPCSTATIC) {
            color = "#FFFFFF";
            name = entity.name;
        }
        else if(entity.type === Types.EntityTypes.NPCMOVE) {
            color = "#00FFFF";
            name = entity.name;
        }
    		else if(entity instanceof Item) {
    			const item = entity;
          if (ItemTypes.isEquipment(item.kind)) {
            name = ItemTypes.getLevelByKind(item.kind) + '+' + item.count;
          }
          else if (ItemTypes.isLootItem(item.kind)) {
            if (item.count > 1)
              name = item.count + "x ";
            name += ItemLoot[item.kind - 1000].name;
          }
    			else if(ItemTypes.isConsumableItem(item.kind) || ItemTypes.isCraftItem(item.kind)) {
    			    if (item.count > 1)
    				      name = item.count + "x ";
              name += ItemTypes.KindData[item.kind].name;
    			}
    			else {
    			    name = ItemTypes.KindData[item.kind].modifier + '+' + item.count;
    			}
    		}
        const s = this.gameScale;
        const eo = this.getEntityOffset();
        // FIX: was building "en_"+entity.id twice (once to read, once to write below) - compute
        // once and reuse. (Left the cross-method duplication where removeEntityName() etc.
        // rebuild the same key from an id elsewhere as-is - fixing that would mean changing
        // those methods' signatures to take the entity object everywhere they're called, for a
        // marginal gain over a cheap string concat; not worth the call-site churn/risk.)
        const spriteKey = "en_"+entity.id;
        let sprite = this.pxSprite[spriteKey];

        const ts = this.tilesize;
        const x = (entity.x + eo[0]) * s;
        const y = (entity.y + eo[1] - ts) * s;

        if (!sprite)
        {
          const style = new PIXI.TextStyle({
            fontFamily: "KomikaHand",
            fill: color,
            fontSize: 5 * this.scale,
            align: "center",
            strokeThickness: 4,
          });
          sprite = new PIXI.Text(name, style);
          sprite.anchor.set(0.5, 0.5);
          sprite.interactive  = false;
          sprite.interactiveChildren = false;

          Container.HUD.addChild(sprite);
          this.pxSprite[spriteKey] = sprite;
        }
        sprite.text = name; // FIX: .text was never reassigned after creation, so name/stack-count changes never rendered (see drawDebugInfo/drawCombatInfo pattern)
        sprite.visible = true;
        sprite.zIndex = (entity.y*(this.camera.gridW*ts)+entity.x);
        sprite.x = x;
        sprite.y = y;
    }

    removeEntityName(entityId)
    {
      this.removeSprite(Container.HUD, "en_"+entityId);
    }

    removeHealthBar(entityId) {
      this.removeSprite(Container.HUD, "healthbar_ol_"+entityId);
      this.removeSprite(Container.HUD, "healthbar_il_"+entityId);
    }

    removeHarvestBar(entityId) {
      this.removeSprite(Container.HUD, "harvestbar_ol_"+entityId);
      this.removeSprite(Container.HUD, "harvestbar_il_"+entityId);
    }

    removeEntity(entity)
    {
      Container.ENTITIES.removeChild(entity.pjsSprites[0]);
      if (entity instanceof Player)
        Container.ENTITIES.removeChild(entity.pjsSprites[1]);
      this.removeEntityName(entity.id);
      Container.ENTITIES.removeChild(this.pxSprite["et_"+entity.id]);
      Container.ENTITIES.removeChild(this.pxSprite["etp_"+entity.id]);
      this.removeHealthBar(entity.id);
    }

    drawTerrain(ctx) {
        const self = this,
            p = game.player,
            mc = game.mapContainer,
            tilesetwidth = this.tilesets[0].baseTexture.width / mc.tilesize;

        //var m = game.map;

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
    }

    // FIX: removed drawAnimatedTiles() - it was a stub (`return;` as its first statement,
    // with dead/unreachable code below referencing undefined `x`/`y`) with no remaining
    // callers anywhere in the client. Dead code removed rather than left half-implemented.

// TODO - Render in PIXIJS ?
    getFPS() {
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
    }

    getCoordinates() {
  				const realX = game.player.gx;
  				const realY = game.player.gy;

  				if (this.game.player)
  				{
            return "gx:"+realX+",gy:"+realY;
  				}
          return "";
    }

    getRealCoordinates() {
  				const realX = game.player.x;
  				const realY = game.player.y;

  				if (this.game.player)
  				{
            return "x:"+realX+",y:"+realY;
  				}
          return "";
    }

    drawDebugInfo() {
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

    }

// TODO - Draw in PIXIJS
    drawCombatInfo() {
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
    }

    removeSprite(container, id) {
      const sprite = this.pxSprite[id];
      if (sprite) {
        container.removeChild(sprite);
        this.pxSprite[id] = null;
      }
    }

    getScreenOffset() {
      const c = this.camera;
      const gs = this.gameScale;
      const cv = this.getCameraView();

      return [cv[0]+c.wOffX, cv[1]+c.wOffY];
    }

    getCameraView() {
      const c = this.camera;

      const x = (-c.x);
      const y = (-c.y);

      return [x,y];
    }

    drawBarOutline(gfx, x, y) {
      const gs = this.gameScale;
      const ts = G_TILESIZE;

      const w = ts*gs;
      const h = (ts >> 2)*gs;
      // FIX (var cleanup): x/y here were redeclaring their own parameters with var - illegal
      // with let/const, so these are just reassignments now.
      x = x-(w >> 1);
      y = y-(h >> 1);
      const border=2;

      gfx.lineStyle(border, "#000000")
        .moveTo(x,y)
        .lineTo(x+w,y)
        .lineTo(x+w,y+h)
        .lineTo(x,y+h)
        .lineTo(x,y);

      return gfx;
    }

    drawBarInner(gfx, x, y, color) {
      const gs = this.gameScale;
      const ts = G_TILESIZE;
      let w = ts*gs;
      let h = (ts >> 2)*gs;
      const border=2;

      x+=border >> 1;
      y+=border >> 1;
      w-=(border);
      h-=(border);

      gfx.beginFill(color)
        .drawRect(x, y, w, h)
        .endFill();

      return gfx;
    }

    drawTarget(gfx, x, y, color, l, thickness) {
      thickness = thickness || 2;
      l = l || (this.tilesize * this.scale) >> 1;
      gfx.lineStyle(thickness, color)
         .moveTo(x-l, y)
         .lineTo(x+l, y)
         .lineStyle(thickness, color)
         .moveTo(x, y-l)
         .lineTo(x, y+l);
    }

    drawSquare(gfx, x, y, color, l, thickness) {
      thickness = thickness || 2;
      l = l || (this.tilesize * this.scale) >> 1;
      gfx.lineStyle(thickness, color)
        .drawRect(x-l, y-l, l << 1, l << 1);
      /*gfx.lineStyle(thickness, color)
             .moveTo(x-l, y-l)
             .lineTo(x+l, y-l)
             .lineTo(x+l, y+l)
             .lineTo(x-l, y+l)
             .lineTo(x-l, y-l);*/
    }

    /*drawCollision: function () {
      var self = this,
          mc = this.game.mapContainer,
          g = this.game;

      var color = 0xFF0000;
      if(g.started) {
        var index = 0;
        g.camera.forEachVisibleValidPosition(function(x, y) {
          if (mc.collisionGrid[y][x]) {
            //console.warn("tile drawn");
            self.drawCollisionTile(index++, x, y, color);
          }
        });

        for(var i=index; i < this.colTotal; ++i)
        {
          Container.COLLISION.removeChild(this.pxSprite["tc_"+i]);
          this.pxSprite["tc_"+i] = null;
        }
        this.colTotal = index;
      }
    },*/

    /*drawCollisionTile: function (index, x, y, color) {
      var ts = this.tilesize;

      x = (x * ts);
      y = (y * ts);

      var sprite = this.pxSprite["tc_"+index];
      if (!sprite)
      {
        var gfx = new PIXI.Graphics();
        var l = (this.tilesize >> 1);
        this.drawSquare(gfx, x, y, color, l, 1);
        var texture = this.renderer.generateTexture(gfx);
        var sprite = new PIXI.Sprite(texture);
        Container.COLLISION.addChild(sprite);
        this.pxSprite["tc_"+index] = sprite;
      }
      sprite.x = x;
      sprite.y = y;
    },*/

    renderStaticCanvases() {
  				const c = this.camera;
      const fe = c.focusEntity;

      //log.info("c.sox:"+c.sox+",c.soy:"+c.soy);
      c.setRealCoords();

      // FIX: restored the dirty-check that used to skip moveGrid()/refreshGrid() when the
      // camera hasn't moved to a new grid cell. It had been commented out, so the grid was
      // being rebuilt unconditionally every single frame - real, scaling per-frame cost.
      const gx = fe ? fe.x >> 4 : this.fegx;
      const gy = fe ? fe.y >> 4 : this.fegy;
      if (this.forceRedraw || (fe && (this.fegx !== gx || this.fegy !== gy)))
      {
        const mc = game.mapContainer;
        if (mc)
          mc.moveGrid();
        this.forceRedraw = true;
      }
      this.fegx = gx;
      this.fegy = gy;

      const go = this.setGridOffset();
      this.setTilesOffset(go[0],go[1]);

      if (this.forceRedraw)
      {
        this.refreshGrid();
      }
    }

    // FIX: this method only ever animated the letterbox bars INTO view (sprite.y
    // incrementing toward ymax / sprite2.y decrementing toward y2max) and had no logic
    // to ever remove them again - once shown they'd be stuck onscreen forever with no
    // way to end the cutscene. Added a reverse branch driven by this.cutSceneActive so
    // endCutScene() (below) actually retracts and cleans up the bars.
    showCutScene() {
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
    }

    // Activates the letterbox cutscene bars; call once per frame from the render loop
    // (see draw()) while this.cutSceneActive is true, and this.showCutScene() will
    // animate them into view.
    startCutScene() {
      this.cutSceneActive = true;
    }

    // Deactivates the cutscene bars. showCutScene() keeps running for a few more frames
    // (still gated by the same `this.pxSprite["cutscene_1"]` check in draw()) to animate
    // them back offscreen and tear down the sprites.
    endCutScene() {
      this.cutSceneActive = false;
    }

    setGridOffset() {
      const c = this.camera;
      //var mc = game.mapContainer;
      const fe = c.focusEntity;
      //var ts = this.tilesize;
      if (!fe) return;

      const gx = fe.x >> 4;
      const gy = fe.y >> 4;

      //this.sox = (fe.x - (gx * G_TILESIZE));
      //this.soy = (fe.y - (gy * G_TILESIZE));

      this.sox = fe.x % G_TILESIZE;
      this.soy = fe.y % G_TILESIZE;

      /*if (this.sox != this.sox2 || this.soy != this.soy2)
      {
        console.error("NOT EQUAL");
      }*/
      //log.info("setGridOffset: r.sox:"+c.sox+"r.soy:"+c.soy);

      if (!c.scrollX) this.sox = 0;
      if (!c.scrollY) this.soy = 0;

      return [this.sox, this.soy];

    }

    refreshGrid() {
      const mc = game.mapContainer;
      const self = this;

      // Optimization only redraw tilegrid if it has changed.
      if (typeof(this.fnTileGridEqual) === "undefined") {
        this.fnTileGridEqual = function (tg1, tg2) {
          if (!(tg1.length === tg2.length && tg1[0].length === tg2[0].length))
            return false;

          const ly = tg2.length;
          const lx = tg2[0].length;

          for (let y=0; y < ly; ++y) {
            for (let x=0; x < lx; ++x) {
              if (tg1[y][x] !== tg2[y][x])
                return false;
            }
          }
          return true;
        };
      }

      if (mc.tileGrid) {
        const cond = (this.tileGrid) ? this.fnTileGridEqual(this.tileGrid, mc.tileGrid) : false;
        if (!cond)
        {
          this.clearTiles();
          this.drawTerrain();
          this.tileGrid = mc.tileGrid.map(row => row.slice());
        }
      }
    }

    setTilesOffset(x,y) {
      const //ts = this.tilesize,
          c = game.camera,
          //p = game.player,
          gs = this.gameScale;
          //mc = game.mapContainer;

      x = -x;
      y = -y;

      const mx = Math.abs(c.rx-c.sx);
      const my = Math.abs(c.ry-c.sy);

      let offX = -c.wOffX;
      let offY = -c.wOffY;

      if (c.rx < c.sx) {
        offX = Math.min(offX+mx, 0);
      }
      if (c.ry < c.sy) {
        offY = Math.min(offY+my, 0);
      }
      if (c.rx > c.sx) {
        const max = -c.wOffX * 2;
        offX = Math.max(offX-mx, max);
      }
      if (c.ry > c.sy) {
        const max = -c.wOffY * 2;
        offY = Math.max(offY-my, max);
      }

      x += offX;
      y += offY;

      this.hOffX = x;
      this.hOffY = y;

      x *= gs;
      y *= gs;

      Container.BACKGROUND.x = x;
      Container.BACKGROUND.y = y;
      Container.FOREGROUND.x = x;
      Container.FOREGROUND.y = y;
      //Container.COLLISION.x = x;
      //Container.COLLISION.y = y;
      //Container.COLLISION2.x = x;
      //Container.COLLISION2.y = y;

    }

    clearTiles() {
      if (this.tiles.BACKGROUND)
        this.tiles.BACKGROUND.clear();
      if (this.tiles.FOREGROUND)
        this.tiles.FOREGROUND.clear();
    }

    /*clearFullTiles: function () {
      Container.BACKGROUND.children[0].clear();
      if (this.tiles.BACKGROUND) {
        this.tiles.BACKGROUND.clear();
      }
      Container.FOREGROUND.children[0].clear();
      if (this.tiles.FOREGROUND) {
        this.tiles.FOREGROUND.clear();
      }
    },*/

    clearEntities() {
        const self = this;
        self.camera.forEachInScreen(function (entity,id) {
          if (entity) {
            if (entity === game.player)
              return;
            self.removeEntity(entity);
          }
        });
    }

    renderFrame() {
      //this.calledRender = false;
      if (!game.ready || this.blankFrame)
      {
// TODO Make compatible with all sprites.
        Container.HUD.removeChildren();
        Container.HUD2.removeChildren();
        //if (Container.HUD.children.length > 2)
          //Container.HUD.removeChildren(2,Container.HUD.children.length);
        //Container.COLLISION.removeChildren();
        // NOTE: intentionally NOT calling Container.ENTITIES.removeChildren() here (a prior
        // attempted fix did this and broke the player, who is redrawn a few lines down via
        // drawEntity(game.player)). Blindly clearing the container strips out entities' PIXI
        // sprites without resetting their cached entity.pjsSprites/entity.sprites references,
        // so setSprite()'s "sprite unchanged" fast path never re-adds them to the display
        // tree - the entity silently stops rendering. Cleanup of on-screen non-player entity
        // sprites is already handled correctly (via proper removeChild calls) by
        // clearEntities(), which callers invoke before setting blankFrame - see
        // clientcallbacks.js's map-transition handler.
        this.pxSprite = {};
        this.clearTiles();
        //this.renderer.gl.flush();
        this.renderer.render(Container.STAGE);

        //game.initCursors();
        this.blankFrame = false;
        this.forceRedraw = true;
        this.drawEntity(game.player);
        game.initCursors();
        game.setCursor("hand");
        return;
      }

      //this.forceRedraw = true;

      if (!game.ready || !game.player || game.mapStatus < 2 ||
          !game.mapContainer.gridReady || this.tilesets.length === 0 ||
          !this.loadData.loaded) {
        this.forceRedraw = true;
        return;
      }

      this.delta = Date.now() - this.last;

      //this.renderer.clear();
      this.renderStaticCanvases();

      // FIX: was permanently commented out, so showCutScene() (letterbox bars) had no
      // caller and could never run. Now driven by this.cutSceneActive - call
      // renderer.startCutScene()/endCutScene() to turn it on/off; the pxSprite check
      // keeps it running for the last few frames of the retract animation after
      // endCutScene() flips the flag back off.
      if (this.cutSceneActive || this.pxSprite["cutscene_1"])
        this.showCutScene();

      this.drawEntities();

      //Container.HUD.clear();
      this.drawAnnouncement();

      //this.drawEntityNames();
      this.drawBubbles();

      this.drawCombatInfo();
      this.drawDebugInfo();
      //this.drawCombatHitBar();
      this.drawCursor();

      //this.drawCenter();
      //this.drawEdgeLine();
      //this.drawTopLeft();
      //Container.STAGE.sortChildren();

      /*this.culler.cull(Container.STAGE, {
        "x":0,
        "y":0,
        "width": window.innerWidth,
        "height": window.innerHeight
      });*/

      this.renderer.render(Container.STAGE);
      //this.renderer.gl.flush();

      this.last = Date.now();

      this.forceRedraw = false;
    }
}
