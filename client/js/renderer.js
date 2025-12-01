/* global Detect, Class, _, log, Types, font */

define(['camera', 'entity/item', 'data/items', 'data/itemlootdata', 'entity/entity', 'entity/character', 'entity/player', 'timer', 'entity/mob', 'entity/npcmove', 'entity/npcstatic', 'entity/block', 'loaddata'],
    function(Camera, Item, Items, ItemLoot, Entity, Character, Player, Timer, Mob, NpcMove, NpcStatic, Block, LoadData) {
      var checkAnnouncement = function (self) {
          self.announcement = null;
          var sprite = self.pxSprite["announcement_0"];
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

        var Renderer = Class.extend({
            init: function(game) {


                var self = this;
                this.game = game;

                this.loadData = new LoadData();

                PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.HARD_EDGE;
                PIXI.settings.ROUND_PIXELS = false;
                PIXI.settings.SORTABLE_CHILDREN = true;
                //PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false;

                PIXI.tilemap.Constant = {
                    maxTextures: 8,
                    bufferSize: 4096,
                    boundSize: 2048,
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


                var renderer = new PIXI.autoDetectRenderer (this.innerWidth, this.innerHeight, {
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

                this.pxSprite = {};

                this.colTotal = 0;

                this.hitbarWidth = 0;

                this.pushAnnouncement("Welcome to Land Of Mana!", 5000);
                checkAnnouncement(this);

                this.gui = document.getElementById('gui');
                this.hitbar = document.getElementById("energy");

                this.resizeCanvases(1);

                //this.culler = new Culler();
            },

            calcScreenSize: function (zoomMod) {
              this.gameZoom = this.getGameZoom(zoomMod);
              this.gameWidth = window.innerWidth;
              this.gameHeight = window.innerHeight;
              this.innerWidth = ~~(this.gameWidth * this.gameZoom);
              this.innerHeight = ~~(this.gameHeight * this.gameZoom);
            },

            getScaleFactor: function() {
                return 3;
            },

            getUiScaleFactor: function() {
                return 3;
            },

            getIconScaleFactor: function() {
                return 3;
            },

            getGuiZoom: function () {
              var w = window.innerWidth,
                  h = window.innerHeight;

              var zoom = 1;

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
            },

            getGameZoom: function(zoomMod) {
                zoomMod = zoomMod || 1;
                var w = window.innerWidth,
                    h = window.innerHeight;

                //var zoom = (w/window.screen.width * 0.5) + 0.5;
                var zoom = 1;

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
            },

            rescale: function() {
                this.scale = this.getScaleFactor();

                this.initFPS();

                if(this.game.ready && this.game.renderer) {
                    this.game.setSpriteScale(this.scale);
                    this.game.inventory.scale = this.getUiScaleFactor();
                }

                this.renderer.resize(this.innerWidth, this.innerHeight);
                this.renderer.resolution = 1;
            },

            centerStage: function () {
              var zoom = (1/this.gameZoom);
              var rw = ~~(this.renderer.width);
              var rh = ~~(this.renderer.height);

              this.canvas.css({
                left: "0px",
                top:  "0px",
                width: rw + "px !important",
                height: rh + "px !important",
                transform: "scale("+zoom+")",
              });
            },

            createCamera: function() {
                this.camera = new Camera(game, this);
                this.camera.focusEntity = game.player;
            },

            guiResize: function () {


              var guizoom = this.getGuiZoom();

    					var w = Math.round($(window).width() / guizoom);
    					var h = Math.round($(window).height() / guizoom);

    					this.gui.width = w;
    					this.gui.height = h;
    					this.gui.style.width = w+"px";
    					this.gui.style.height = h+"px";
    					log.debug("#gui set to " + this.gui.width + " x " + this.gui.height);

              this.gui.style.transform = "scale("+(guizoom)+")";
            },

            resizeCanvases: function(zoomMod) {
              zoomMod = zoomMod || 1;

              this.calcScreenSize(zoomMod);

              this.guiResize();

              this.rescale();
              this.centerStage();

              this.camera.rescale();
              this.camera.setRealCoords();

              this.forceRedraw = true;
              //this.renderFrame();
            },

            initFPS: function() {
                this.FPS = 60;
            },

            initPIXI: function() {
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
            },

            pushAnnouncement: function (text, duration) {
            	this.announcements.push([text, duration]);
            },

            drawAnnouncement: function () {
              var id = "announcement_0";

              var sprite = this.pxSprite[id];

              var announce = this.announcement;
              if (!announce)
                return;

              if (!sprite)
              {
                var style = new PIXI.TextStyle({
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
            },

            drawText: function(ctx, text, x, y, centered, color, strokeColor) {
                switch(this.scale) {
                    case 1:
                        this.strokeSize = 1; break;
                    case 2:
                        this.strokeSize = 2; break;
                }

                if(text && x && y) {
                    var style = this.defaultFont;
                    if(centered) {
                        style.align = "center";
                    }
                    style.stroke = strokeColor || "#373737";
                    style.strokeThickness = 4;
                    style.fill = color || "white";

                    var pText = new PIXI.Text(text, style);
                    pText.x = x * this.scale * 3;
                    pText.y = y * this.scale * 3;
                }
            },

            drawCursor: function() {
                var mx = game.mouse.x,
                    my = game.mouse.y;
                var anim = game.currentCursor.currentAnimation;
                var frame = anim.currentFrame;
                if(this.game.currentCursor) {
                    this.drawSpriteHUD(game.currentCursor.pjsSprite,
                      frame.x, frame.y,
                      anim.width, anim.height, mx, my, anim.width, anim.height);
                }
            },

            getTexture: function (path)
            {
              if (!this.textures[path])
              {
                this.textures[path] = new PIXI.Texture.from(path);
              }
              return this.textures[path];
            },

            createSprite: function (csprite)
            {
              var tmp = this.getTexture(csprite.filepath).clone();
              var sprite = new PIXI.Sprite(tmp);
              sprite.width = csprite.width * this.gameScale;
              sprite.height = csprite.height * this.gameScale;
              sprite.flipX = false;
              sprite.flipY = false;
              sprite.visible = false;
              sprite.cullable = true;
              sprite.interactiveChildren = false;
              csprite.container.addChild(sprite);
              return sprite;
            },

            changeSprite: function (csprite, pjsSprite)
            {
              var texture = this.getTexture(csprite.filepath);
              var sprite = pjsSprite;
              sprite.texture = texture;
              sprite.width = csprite.width * this.gameScale;
              sprite.height = csprite.height * this.gameScale;
              sprite.flipX = false;
              sprite.flipY = false;
              sprite.visible = false;
              return sprite;
            },

            drawSpriteHUD: function(sprite, imgX, imgY, imgW, imgH, scrX, scrY, scrW, scrH, flipX, flipY)
            {
              var s = 2;
              var size = this.gameScale;
              this.drawSprite([sprite, imgX*s, imgY*s, imgW*s, imgH*s, scrX*size, scrY*size, scrW*size, scrH*size, flipX, flipY, 0, 0, 0]);
            },

            // array: sprite, imgX, imgY, imgW, imgH, scrX, scrY, scrW, scrH, flipX, flipY, z, anchorX, anchorY, visible, opacity
            drawSprite: function(data)
            {
              //var s = 2; //this.scale;
              var sprite = data[0];

              if (!sprite.texture.baseTexture.valid) return;
              sprite.texture.frame = new PIXI.Rectangle(data[1], data[2], data[3], data[4]);
              sprite.x = data[5];
              sprite.y = data[6];
              sprite.width = data[7];
              sprite.height = data[8];

              var flipX = data[9] || false;
              var flipY = data[10] || false;

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
              sprite.opacity = data[15] || 1;

            },

            // containerName, tileid, x, y
            drawTile: function(arr) {
                //if (arr[0])
                  //return;

                var ts = G_TILESIZE;

                 arr[2] *= ts;
                 arr[3] *= ts;

                 var tw = this.tilesetwidth;
                 var tileset = this.tilesets[0];

                 tileset.frame = new PIXI.Rectangle(0, 0, ts, ts);
                 tileset.frame.interactive = false;
                 tileset.frame.interactiveChildren = false;
                 tileset.frame.x = (getX(arr[1], tw) * ts);
                 tileset.frame.y = (~~((arr[1]-1) / tw) * ts);

                 var container = this.tiles["BACKGROUND"];
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
            },

      	    drawItem: function(entity) {
                entity.spriteChanged = game.player.isMoving();

                var itemData = ItemTypes.KindData[entity.kind];
                if (ItemTypes.isLootItem(entity.kind)) {
      	          itemData = ItemLoot[entity.kind - 1000];
      	        }

                var s = 2,
                    ts = G_TILESIZE,
                    w = entity.sprite.width,
                    h = entity.sprite.height;

                var x = itemData.offset[0] * w * s,
      	            y = itemData.offset[1] * h * s;

                var eo = this.getEntityOffset(),
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
                    this.drawSprite([entity.pjsSprite, x, y, w*s, h*s, idx, idy, dw, dh, 0, 0, z, 0.5, 0.5]);
                } catch (err) {
                  log.info(err.message);
                  log.info(err.stack);
                }
      	    },

            drawEntityTargetPos: function (index, x, y) {
              var sprite = this.pxSprite["etp_"+index];
              if (!sprite)
              {
                var gfx = new PIXI.Graphics();
                var l = (this.tilesize >> 1);
                this.drawTarget(gfx, 0, 0, 0xff0000, l, 1);
                var texture = this.renderer.generateTexture(gfx);
                var sprite = new PIXI.Sprite(texture);
                Container.ENTITIES.addChild(sprite);
                this.pxSprite["etp_"+index] = sprite;
                sprite.anchor.set(0.5);
              }
              sprite.x = x;
              sprite.y = y;
            },

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

            drawCenter: function () {
              var sprite = this.pxSprite["center_"];
              if (!sprite)
              {
                var gfx = new PIXI.Graphics();
                this.drawTarget(gfx, 0, 0, 0xffff00, 16, 3);
                var texture = this.renderer.generateTexture(gfx);
                sprite = new PIXI.Sprite(texture);
                Container.HUD.addChild(sprite);
                sprite.anchor.set(0.5,0.5);
                sprite.zIndex = 999999999;

                this.pxSprite["center_"] = sprite;
              }
              var h = window.innerHeight / 2,
                  w = window.innerWidth / 2;
              var c = game.camera,
                p = game.player,
                gs = this.gameScale;

              w = (p.x - c.x)*gs;
              h = (p.y - c.y)*gs;

              sprite.x = w;
              sprite.y = h;
            },

            drawEntityTile: function (index, x, y) {
              var ts = this.tilesize;

              var sprite = this.pxSprite["et_"+index];
              if (!sprite)
              {
                var gfx = new PIXI.Graphics();
                var l = (this.tilesize >> 1);
                gfx.lineStyle(2, 0x00ff00)
                  .drawRoundedRect(x-l, y-l, l << 1, l << 1, 4);
                var texture = this.renderer.generateTexture(gfx);
                var sprite = new PIXI.Sprite(texture);
                Container.ENTITIES.addChild(sprite);
                this.pxSprite["et_"+index] = sprite;
                sprite.anchor.set(0.5);
                sprite.z = (y*(this.camera.gridW*ts)+x);
                sprite.alpha = 0.6;
              }
              sprite.x = x;
              sprite.y = y;
            },

            drawBubbles: function () {
              var self = this;
              _.each(game.bubbleManager.bubbles, function(bubble) {
                  self.drawBubble(bubble);
              });
            },

            showHarvestBar: function (entity) {
              var ts = G_TILESIZE;
              var harvestTime = entity.harvestDuration;
              if (!harvestTime)
                return;

              var duration = Date.now()-entity.startHarvestTime;
              var mod = Math.min(duration, harvestTime) / harvestTime;
              if (mod === 1)
                return;

              var id = "harvestbar_ol_"+entity.id;
              var sprite = this.pxSprite[id];
              var s = this.gameScale;
              var eo = this.getEntityOffset();
              var x = (entity.x + eo[0]) * s;
              var y = (entity.y + eo[1] - ts - (ts >> 1)) * s;

              var id2 = "harvestbar_il_"+entity.id;
              var sprite2 = this.pxSprite[id2];

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

              var gs = this.gameScale;

              sprite2.x = x - (ts * (gs/2));
              sprite2.y = y;
              sprite2.width = ts*gs*mod;
            },

            showHealthBar: function (entity) {
              if (!(entity.stats && entity.stats.hp))
                return;


              var mod = entity.stats.hp / entity.stats.hpMax;
              if (mod === 1) {
                this.removeHealthBar(entity.id);
                return;
              }

              var ts = G_TILESIZE;
              var id = "healthbar_ol_"+entity.id;
              var sprite = this.pxSprite[id];
              var s = this.gameScale;
              var eo = this.getEntityOffset();
              var x = (entity.x + eo[0]) * s;
              var y = (entity.y + eo[1] - ts - (ts >> 1)) * s;

              var id2 = "healthbar_il_"+entity.id;
              var sprite2 = this.pxSprite[id2];

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

              var gs = this.gameScale;

              sprite2.x = x - (ts * (gs/2));
              sprite2.y = y;
              sprite2.width = ts*gs*mod;
            },

            createBarOutline: function (x, y) {
              var gfx = new PIXI.Graphics();
              this.drawBarOutline(gfx, x, y);
              var tx = this.renderer.generateTexture(gfx);
              var sprite = new PIXI.Sprite(tx);
              sprite.anchor.set(0.5,0.5);
              sprite.alpha = 0.75;
              Container.HUD.addChild(sprite);
              return sprite;
            },

            createBarInner: function (x, y, mod, color) {
              var gfx = new PIXI.Graphics();
              this.drawBarInner(gfx, x, y, color);
              var tx = this.renderer.generateTexture(gfx);
              var sprite = new PIXI.Sprite(tx);
              sprite.anchor.set(0,0.5);
              sprite.alpha = 0.75;
              Container.HUD.addChild(sprite);
              return sprite;
            },

// TODO - Make Bubbles
            drawBubble: function (bubble) {
              var eo = this.getEntityOffset();
              var ts = G_TILESIZE;
              var c = game.camera;
              var s = this.scale;
              var id = "bub_"+bubble.id;
              var sprite = this.pxSprite[id];
              var x = (bubble.entity.x + eo[0]) * s;
              var y = (bubble.entity.y + eo[1]) * s;
              if (!sprite)
              {
                var gfx = new PIXI.Graphics();
                gfx.beginFill(0xffffff);
                gfx.lineStyle(2, 0x000000);

                var tw = Math.min(bubble.content.length*12*s,80*s);
                var style = new PIXI.TextStyle({
                  fontFamily: "KomikaHand",
                  fill: 0x000000,
                  fontSize: 5 * this.scale,
                  align: "center",
                  wordWrap: true,
                  wordWrapWidth: ~~(tw*1.3),
                  fontWeight: 900,
                  strokeThickness: 0,
                });

                var txt = new PIXI.Text(bubble.content, style);

                x = (bubble.entity.x + eo[0] - ts/2) * s;
                y = (bubble.entity.y + eo[1] - tw/2) * s;

                var th = ~~(txt.height * 1.25);
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

                var texture = this.renderer.generateTexture(gfx);

                var sprite = new PIXI.Sprite(texture);
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
              var os = (ts/2*s);
              x -= os;
              y -= sprite.height/2 + (os*2);
              sprite.x = x;
              sprite.y = y;
            },

            removeBubble: function (bubble) {
              var sprite = this.pxSprite["bub_"+bubble.id];
              Container.HUD.removeChild(sprite);
              this.pxSprite["bub_"+bubble.id] = null;
            },

            getEntityOffset: function () {
                var cv = this.getCameraView();
                var c = game.camera;
                return [cv[0], cv[1]];
            },

            drawEntity: function(entity) {
                var sprite = entity.sprite,
                    anim = entity.currentAnimation;

                entity.spriteChanged = true;

                if(!(anim && sprite))
                  return;

                var eo = this.getEntityOffset();
                var c = game.camera,
                    frame = anim.currentFrame,
                    s = 2,
                    x = frame.x * s,
                    y = frame.y * s,
                    w = sprite.width,
                    h = sprite.height,
                    offX = (sprite.width >> 1),
                    offY = (sprite.height >> 1),
                    ts = this.tilesize,
                    //tsh = ts >> 1,
                    ox = sprite.offsetX,
                    oy = sprite.offsetY,
                    dx = entity.x,
                    dy = entity.y,
                    dw = w,
                    dh = h,
                    z = (entity.y*(c.gridW*ts)+entity.x) * 2,
                    //tOff = 1.0*ts,
                    ex = (dx + eo[0]),
                    ey = (dy + eo[1]);
                if (entity === game.player) {
                  this.pex = ex;
                  this.pey = ey;
                }
                if (entity === game.player.target) {
                  this.drawEntityTile(entity.id, ex, ey);
                }
                else {
                  this.removeSprite(Container.ENTITIES, "et_"+entity.id);
                }

                //this.drawEntityTargetPos(entity.id, ex, ey);
                entity.fadeRatio = entity.getFadeRatio(this.game.currentTime);

                try {
                    var cx = 0.5, cy = 0.5;
                    if (entity instanceof NpcMove) {
                      ey -= (ts >> 1);
                    }
                    this.drawSprite([entity.pjsSprite, x, y, w*s, h*s, ex, ey,
                      dw, dh, entity.flipSpriteX, entity.flipSpriteY, z, cx, cy]);
                }
                catch (err) { log.info(err.message); log.info(err.stack); }

                if(entity instanceof Character && !(entity.isDead || entity.isDying) && entity.hasWeapon()) {
                    if (!entity.pjsWeaponSprite)
                      entity.setWeaponSprite();
                      //Container.ENTITIES.addChild(entity.pjsWeaponSprite);
                    var weapon = entity.getWeaponSprite();
                    if(weapon) {
                        var weaponAnimData = weapon.animationData[anim.name],
                            index = (weaponAnimData) ? frame.index < weaponAnimData.length ? frame.index : frame.index % weaponAnimData.length : 0,
                            wx = weapon.width * index * s,
                            wy = weapon.height * anim.row * s,
                            ww = weapon.width,
                            wh = weapon.height;

                          // Dont need for now.
                          //var wox = weapon.offsetX;
                          //    woy = weapon.offsetY;
                          var visible = !entity.hideWeapon;
                  				this.drawSprite([entity.pjsWeaponSprite, wx, wy, ww*s, wh*s,
                  					ex,
                  					ey,
                  					ww, wh, entity.flipSpriteX, entity.flipSpriteY, z+1, 0.5, 0.5, visible]);
                    }
                }

            },

            removeEntityStuff: function (entity) {
              this.removeHealthBar(entity.id);
              this.removeEntityName(entity.id);
              if (entity instanceof Player) {
                Container.ENTITIES.removeChild(entity.pjsWeaponSprite);
                entity.pjsWeaponSprite = null;
              }
            },

            hideEntity: function (entity) {
              entity.pjsSprite.renderable = false;
              entity.pjsSprite.visible = false;
              if (this.pxSprite.hasOwnProperty("en_"+entity.id) && this.pxSprite["en_"+entity.id])
                this.pxSprite["en_"+entity.id].visible = false;
            },

            drawEntities: function(dirtyOnly) {
                var self = this;
                //self.drawEntity(game.player);
                if (game.player && game.player.startHarvestTime > 0)
                  this.showHarvestBar(game.player);
                else {
                  this.removeHarvestBar(game.player.id);
                }

                for (var id in game.entities)
                {
                  var entity = game.entities[id];
                  if (entity) {
                    this.hideEntity(entity);
                  }
                }

                self.camera.forEachInScreen(function (entity,id) {
                  if (!entity) return;

                  if (entity.isDying || entity.isDead) {
                    self.removeEntityStuff(entity);
                  }
                  else {
                    self.drawEntityName(entity);
                    if ((entity !== game.player))
                      self.showHealthBar(entity);
                  }

                  if (entity instanceof Item)
                  {
                      self.drawItem(entity);
                  }
                  if (entity instanceof Entity)
                  {
                    entity.pjsSprite.renderable = true;
                    entity.pjsSprite.visible = true;
                    if (!entity.isDead)
                      self.drawEntity(entity);
                  }

                });
            },

            drawEntityName: function(entity) {
                var color = '#FFFFFF';
                var name = "";

                if(entity instanceof Player && entity.isMoving && !entity.isDead) {
                    color = (entity.id === this.game.playerId ? "#ffff00" : (entity.admin ? "#ff0000" : "#fcda5c"));

                    name = entity.name;
                }
                else if(entity instanceof Mob) {
                    var mobLvl = entity.level;
                    var playerLvl;

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
            			var item = entity;
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
                var s = this.gameScale;
                var eo = this.getEntityOffset();
                var sprite = this.pxSprite["en_"+entity.id];

                var ts = this.tilesize;
                var x = (entity.x + eo[0]) * s;
                var y = (entity.y + eo[1] - ts) * s;

                if (!sprite)
                {
                  var style = new PIXI.TextStyle({
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
                  this.pxSprite["en_"+entity.id] = sprite;
                }
                sprite.visible = true;
                sprite.zIndex = (entity.y*(this.camera.gridW*ts)+entity.x);
                sprite.x = x;
                sprite.y = y;
            },

            removeEntityName: function (entityId)
            {
              this.removeSprite(Container.HUD, "en_"+entityId);
            },

            removeHealthBar: function (entityId) {
              this.removeSprite(Container.HUD, "healthbar_ol_"+entityId);
              this.removeSprite(Container.HUD, "healthbar_il_"+entityId);
            },

            removeHarvestBar: function (entityId) {
              this.removeSprite(Container.HUD, "harvestbar_ol_"+entityId);
              this.removeSprite(Container.HUD, "harvestbar_il_"+entityId);
            },

            removeEntity: function (entity)
            {
              Container.ENTITIES.removeChild(entity.pjsSprite);
              if (entity instanceof Player)
                Container.ENTITIES.removeChild(entity.pjsWeaponSprite);
              this.removeEntityName(entity.id);
              Container.ENTITIES.removeChild(this.pxSprite["et_"+entity.id]);
              Container.ENTITIES.removeChild(this.pxSprite["etp_"+entity.id]);
              this.removeHealthBar(entity.id);
            },

            drawTerrain: function(ctx) {
                var self = this,
                    p = this.game.player,
                    mc = this.game.mapContainer,
                    tilesetwidth = this.tilesets[0].baseTexture.width / mc.tilesize;

                var g = this.game,
                    m = this.game.map;

                self.tilesetwidth = tilesetwidth;
                if(g.started) {
      						g.camera.forEachVisibleValidPosition(function(x, y) {
                    //collide = mc.collisionGrid[y][x];
      							if(mc.tileGrid[y][x] instanceof Array) {
                      for (var id of mc.tileGrid[y][x]) {
      								//_.each(mc.tileGrid[y][x], function(id) {
                        self.drawTile([mc.isHighTile(id), id, x, y]);
      									/*if(mc.isHighTile(id)) { // Don't draw unnecessary tiles
      										self.drawTile([1, id, self.tilesets, tilesetwidth, x, y]);
      									} else {
                          self.drawTile([0, id, self.tilesets, tilesetwidth, x, y]);
                        }*/
      								//});
                      }
      							}
      							else {
      								var id = mc.tileGrid[y][x];
      								if(id) {
                        self.drawTile([mc.isHighTile(id), id, x, y]);
      									/*if(mc.isHighTile(id)) { // Don't draw unnecessary tiles
      										self.drawTile([1, id, self.tilesets, tilesetwidth, x, y]);
      									} else {
                          self.drawTile([0, id, self.tilesets, tilesetwidth, x, y]);
                        }*/
      								}
      							}
      						}, 0, m);
                }
            },

            drawAnimatedTiles: function() {
                return; // stub - remove.

                var self = this,
                    mc = this.game.mapContainer,
                    tilesetwidth = this.tilesets[0].baseTexture.width / this.tilesize;

                this.animatedTileCount = 0;
                this.game.forEachAnimatedTile(function (tile) {
                  self.drawTile([0, tile.id, self.tilesets, tilesetwidth, x, y]);
                  self.animatedTileCount += 1;
                });
            },

// TODO - Render in PIXIJS ?
            getFPS: function() {
                var diffTime = Utils.getTime() - this.lastTime;

                if (diffTime >= 1000) {
                    if (this.game.player.isMoving())
                      this.movingFPS = this.frameCount;
                    this.realFPS = this.frameCount;
                    this.frameCount = 0;
                    this.lastTime = Utils.getTime();

                }
                this.frameCount++;
                return "FPS: " + this.realFPS;
            },

            getCoordinates: function () {
      				var realX = game.player.gx;
      				var realY = game.player.gy;

      				if (this.game.player)
      				{
                return "gx:"+realX+",gy:"+realY;
      				}
              return "";
            },

            resetCombatHitBar: function () {
              var self = this;

              function regenerateElements(){
                var clonedElement = self.hitbar.cloneNode(true);
                self.hitbar.parentNode.replaceChild(clonedElement, self.hitbar);
                self.hitbar = document.getElementById('energy');
              }
              regenerateElements();
            },

            /*drawCombatHitBar: function () {
              if (game.player) {
                var attackPower = Math.min(game.currentTime - game.player.attackTime, ATTACK_MAX) / ATTACK_MAX;
                if (attackPower === 1) {
                  //$('#combathitbar-points').removeClass('progress');
                  //$('#combathitbar-points').stop(true);
                }
                var width = ~~(228 * attackPower);
                if ((width - this.hitbarWidth) != 0) {
                  //this.hitbar.style.width = width+"px";
                  this.hitbarWidth = width;
                }
              }
            },*/

            drawDebugInfo: function() {
              var c = game.camera;
              var debugInfo = "";
              debugInfo += this.getFPS() + "\n";
              debugInfo += this.getCoordinates() + "\n";

              var s = this.scale;
              var sprite = this.pxSprite["pc_coords"];
              if (!sprite)
              {
                var style = new PIXI.TextStyle({
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

            },

// TODO - Draw in PIXIJS
            drawCombatInfo: function() {
              var self = this;

              this.game.infoManager.forEachInfo(function(info) {
                var id = "ci_"+info.id;

                var sprite = self.pxSprite[id];
                if (!sprite)
                {
                  var style = new PIXI.TextStyle({
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
                var left = ~~((info.x - self.camera.x)*3);
                var top = ~~((info.y - self.camera.y - self.tilesize)*3);

                sprite.text = info.value;
                sprite.x = left;
                sprite.y = top;
                sprite.alpha = info.opacity;
              });
            },

            removeSprite: function (container, id) {
              var sprite = this.pxSprite[id];
              if (sprite) {
                container.removeChild(sprite);
                this.pxSprite[id] = null;
              }
            },

            getScreenOffset: function () {
              var c = this.camera;
              var gs = this.gameScale;
              var cv = this.getCameraView();

              return [cv[0]+c.wOffX, cv[1]+c.wOffY];
            },

            getCameraView: function() {
              var c = this.camera;

              var x = (-c.x);
              var y = (-c.y);

              return [x,y];
            },

            drawBarOutline: function (gfx, x, y) {
              var gs = this.gameScale;
              var ts = G_TILESIZE;

              var w = ts*gs;
              var h = (ts >> 2)*gs;
              var x = x-(w >> 1);
              var y = y-(h >> 1);
              var border=2;

              gfx.lineStyle(border, "#000000")
                .moveTo(x,y)
                .lineTo(x+w,y)
                .lineTo(x+w,y+h)
                .lineTo(x,y+h)
                .lineTo(x,y);

              return gfx;
            },

            drawBarInner: function (gfx, x, y, color) {
              var gs = this.gameScale;
              var ts = G_TILESIZE;
              var w = ts*gs;
              var h = (ts >> 2)*gs;
              var border=2;

              x+=border >> 1;
              y+=border >> 1;
              w-=(border);
              h-=(border);

              gfx.beginFill(color)
                .drawRect(x, y, w, h)
                .endFill();

              return gfx;
            },

            drawTarget: function (gfx, x, y, color, l, thickness) {
              thickness = thickness || 2;
              l = l || (this.tilesize * this.scale) >> 1;
              gfx.lineStyle(thickness, color)
                 .moveTo(x-l, y)
                 .lineTo(x+l, y)
                 .lineStyle(thickness, color)
                 .moveTo(x, y-l)
                 .lineTo(x, y+l);
            },

            drawSquare: function (gfx, x, y, color, l, thickness) {
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
            },

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

            renderStaticCanvases: function() {
      				var c = this.camera;
              var fe = c.focusEntity;

              //log.info("c.sox:"+c.sox+",c.soy:"+c.soy);
              c.setRealCoords();

              /*var gx = fe.x >> 4;
              var gy = fe.y >> 4;
              if (this.forceRedraw || (fe && (this.fegx !== gx || this.fegy !== gy)))
              {
                var mc = game.mapContainer;
                if (mc)
                  mc.moveGrid();
                this.forceRedraw = true;
              }
              this.fegx = gx;
              this.fegy = gy;*/

              var mc = game.mapContainer;
              if (mc)
                mc.moveGrid();
              //this.forceRedraw = true;

              var go = this.setGridOffset();
              this.setTilesOffset(go[0],go[1]);

              //if (this.forceRedraw)
              //{
                this.refreshGrid();
              //}
            },

            showCutScene: function () {
              var width = ~~($("#container").width()*this.gameZoom);
              var height = ~~($("#container").height()*this.gameZoom);

              var w = width;
              var h = Math.floor(height/8);
              var y2 = height;
              var y2max = y2-h;
              var y = -h;
              var ymax = 0;

              var sprite = this.pxSprite["cutscene_1"];
              var sprite2 = this.pxSprite["cutscene_2"];
              if (!sprite)
              {
                var gfx = new PIXI.Graphics();
                gfx.beginFill(0x000000)
                  .drawRect(0, 0, w, h)
                  .endFill();

                var texture = this.renderer.generateTexture(gfx);
                var sprite = new PIXI.Sprite(texture);
                Container.HUD.addChild(sprite);
                this.pxSprite["cutscene_1"] = sprite;

                var sprite2 = new PIXI.Sprite(texture);
                Container.HUD.addChild(sprite2);
                this.pxSprite["cutscene_2"] = sprite2;

                sprite.y=y;
                sprite2.y=y2;
              }
              if (sprite.y < ymax)
                sprite.y++;
              if (sprite2.y > y2max)
                sprite2.y--;
            },

            setGridOffset: function () {
              var c = this.camera;
              //var mc = game.mapContainer;
              var fe = c.focusEntity;
              //var ts = this.tilesize;
              if (!fe) return;

              var gx = fe.x >> 4;
              var gy = fe.y >> 4;

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

            },

            refreshGrid: function () {
              //log.info("refreshGrid: START");
              this.clearTiles();
              this.drawTerrain();
              //this.drawHighTerrain();
              //this.drawCollision();
              //log.info("refreshGrid: END");
            },

            setTilesOffset: function (x,y) {
              var //ts = this.tilesize,
                  c = game.camera,
                  //p = game.player,
                  gs = this.gameScale;
                  //mc = game.mapContainer;

              x = -x;
              y = -y;

              var mx = Math.abs(c.rx-c.sx);
              var my = Math.abs(c.ry-c.sy);

              var offX = -c.wOffX;
              var offY = -c.wOffY;

              if (c.rx < c.sx) {
                offX = Math.min(offX+mx, 0);
              }
              if (c.ry < c.sy) {
                offY = Math.min(offY+my, 0);
              }
              if (c.rx > c.sx) {
                var max = -c.wOffX * 2;
                offX = Math.max(offX-mx, max);
              }
              if (c.ry > c.sy) {
                var max = -c.wOffY * 2;
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

            },

            clearTiles: function () {
              if (this.tiles.BACKGROUND)
                this.tiles.BACKGROUND.clear();
              if (this.tiles.FOREGROUND)
                this.tiles.FOREGROUND.clear();
            },

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

            clearEntities: function() {
                var self = this;
                self.camera.forEachInScreen(function (entity,id) {
                  if (entity) {
                    if (entity === game.player)
                      return;
                    self.removeEntity(entity);
                  }
                });
            },

            renderFrame: function() {
              //this.calledRender = false;
              if (!game.ready || this.blankFrame)
              {
// TODO Make compatible with all sprites.
                Container.HUD.removeChildren();
                Container.HUD2.removeChildren();
                //if (Container.HUD.children.length > 2)
                  //Container.HUD.removeChildren(2,Container.HUD.children.length);
                //Container.COLLISION.removeChildren();
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

              //this.showCutScene();

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
        });

        return Renderer;
    });
