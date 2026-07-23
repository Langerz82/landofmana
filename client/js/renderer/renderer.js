// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, ItemTypes, Utils, Detect, Class, _, log, font */
import Detect from '../detect.js';
import Camera from '../camera.js';
import Item from '../entity/item.js';
import Items from '../data/items.js';
import ItemLoot from '../data/itemlootdata.js';
import Entity from '../entity/entity.js';
import Character from '../entity/character/character.js';
import Player from '../entity/player/player.js';
import Timer from '../timer.js';
import Mob from '../entity/mob.js';
import NpcMove from '../entity/npcmove.js';
import NpcStatic from '../entity/npcstatic.js';
import Block from '../entity/block.js';
import LoadData from '../loaddata.js';

// FIX (split cleanup): getX() moved to rendererdraw.js - it's only used by drawTile(),
// which now lives there; keeping a second copy here would be dead code.
const checkAnnouncement = function (self) {
    self.announcement = null;
    const sprite = self.pxSprite['announcement_0'];
    if (sprite) sprite.visible = false;
    if (self.announcements.length > 0) {
        self.announcement = self.announcements.shift();
        if (sprite) sprite.visible = true;
    }
    setTimeout(
        function () {
            checkAnnouncement(self);
        },
        self.announcement ? self.announcement[1] : 5000
    );
};

// Renderer's own behavior is split across these mixin modules for readability (renderer.js
// had grown to ~1730 lines). Each install* call below merges plain-function methods onto
// Renderer.prototype; they're not subclasses/separate instances, just Renderer's own methods
// living in separate files.
import { installRendererScaling } from './rendererscaling.js';
import { installRendererDrawSprites } from './rendererdrawsprites.js';
import { installRendererDrawEntities } from './rendererdrawentities.js';
import { installRendererDrawBars } from './rendererdrawbars.js';
import { installRendererDrawNames } from './rendererdrawnames.js';
import { installRendererDrawHud } from './rendererdrawhud.js';

export default class Renderer {
    constructor(game) {
        const self = this;
        this.game = game;

        this.loadData = new LoadData();

        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.HARD_EDGE;
        PIXI.settings.ROUND_PIXELS = false;
        PIXI.settings.SORTABLE_CHILDREN = true;

        PIXI.tilemap.Constant = {
            maxTextures: 8,
            bufferSize: 4096,
            boundSize: 4096,
            boundCountPerBuffer: 4,
            use32bitIndex: true,
            SCALE_MODE: PIXI.SCALE_MODES.LINEAR
        };
        PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;

        WebFont.load({
            custom: {
                families: ['KomikaHand', 'GraphicPixel', 'AdvoCut']
            },
            loading: function () {
                console.log('Font(s) Loading');
            },
            active: function () {
                console.log('Font(s) Loaded');
            },
            inactive: function () {
                console.log('Font(s) Failure');
            }
        });

        this.scale = this.getScaleFactor();

        this.resolution = 1;

        this.calcScreenSize(1);

        const renderer = new PIXI.autoDetectRenderer(
            this.innerWidth,
            this.innerHeight,
            {
                width: this.innerWidth,
                height: this.innerHeight,
                antialias: false,
                transparent: false,
                resolution: this.resolution,
                autoResize: true,
                class: 'clickable'
            }
        );
        this.renderer = renderer;
        // Assuming 'renderer' is your PIXI renderer object
        this.renderer.plugins.interaction.autoPreventDefault = false;

        this.canvas = $('#canvas');
        this.canvas.css({
            cursor: 'none'
        });

        console.warn(this.renderer.type);
        if (this.renderer.type === PIXI.WEBGL_RENDERER) {
            console.warn('Using WebGL');
        } else {
            console.warn('Using Canvas');
        }

        this.renderer.view.style.position = 'absolute';
        this.renderer.view.style.display = 'block';
        this.renderer.view.id = 'game';

        this.docCanvas = document.getElementById('canvas');
        this.docCanvas.appendChild(this.renderer.view);
        this.docCanvas.firstElementChild.getContext('2d', {
            willReadFrequently: true
        });

        Container.STAGE.addChild(Container.BACKGROUND);
        Container.STAGE.addChild(Container.ENTITIES);
        Container.STAGE.addChild(Container.FOREGROUND);
        Container.STAGE.addChild(Container.HUD);
        Container.STAGE.addChild(Container.HUD2);

        Container.ENTITIES.sortableChildren = true;

        Container.BACKGROUND.zIndex = 1;
        Container.ENTITIES.zIndex = 2;
        Container.FOREGROUND.zIndex = 3;
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
        Container.HUD.scale.x = this.scaleHUD;
        Container.HUD.scale.y = this.scaleHUD;
        Container.HUD2.scale.x = 1;
        Container.HUD2.scale.y = 1;

        Container.STAGE.interactive = false;
        Container.BACKGROUND.interactive = false;
        Container.ENTITIES.interactive = false;
        Container.FOREGROUND.interactive = false;
        Container.HUD.interactive = false;
        Container.HUD2.interactive = false;

        Container.STAGE.interactiveChildren = false;
        Container.BACKGROUND.interactiveChildren = false;
        Container.ENTITIES.interactiveChildren = false;
        Container.FOREGROUND.interactiveChildren = false;
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

        this.pushAnnouncement('Welcome to Land Of Mana!', 5000);
        checkAnnouncement(this);

        this.gui = document.getElementById('gui');
        this.hitbar = document.getElementById('energy');

        this.resizeCanvases(1);

        this.isDebugInfoVisible = false;
    }

    createCamera() {
        this.camera = new Camera(game, this);
        this.camera.focusEntity = game.player;
    }

    initFPS() {
        this.FPS = 60;
    }

    initPIXI() {
        this.tilesets = this.loadData.tilesets;
        this.tiles.BACKGROUND = new PIXI.tilemap.CompositeRectTileLayer(
            0,
            this.tilesets
        );
        this.tiles.FOREGROUND = new PIXI.tilemap.CompositeRectTileLayer(
            0,
            this.tilesets
        );

        this.tiles.BACKGROUND.interactive = false;
        this.tiles.FOREGROUND.interactive = false;

        this.tiles.BACKGROUND.interactiveChildren = false;
        this.tiles.FOREGROUND.interactiveChildren = false;

        Container.BACKGROUND.addChild(this.tiles.BACKGROUND);
        Container.FOREGROUND.addChild(this.tiles.FOREGROUND);

        this.textStyleName = new PIXI.TextStyle({
            fontFamily: 'KomikaHand',
            stroke: 'black',
            strokeThickness: 3
        });
    }

    pushAnnouncement(text, duration) {
        this.announcements.push([text, duration]);
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

        c.setRealCoords();

        // FIX: restored the dirty-check that used to skip moveGrid()/refreshGrid() when the
        // camera hasn't moved to a new grid cell. It had been commented out, so the grid was
        // being rebuilt unconditionally every single frame - real, scaling per-frame cost.
        const gx = fe ? fe.x >> 4 : this.fegx;
        const gy = fe ? fe.y >> 4 : this.fegy;
        if (
            this.forceRedraw ||
            (fe && (this.fegx !== gx || this.fegy !== gy))
        ) {
            const mc = game.mapContainer;
            if (mc) mc.moveGrid();
            this.forceRedraw = true;
        }
        this.fegx = gx;
        this.fegy = gy;

        const go = this.setGridOffset();
        this.setTilesOffset(go[0], go[1]);

        if (this.forceRedraw) {
            this.refreshGrid();
        }
    }

    refreshGrid() {
        const mc = game.mapContainer;

        // Optimization only redraw tilegrid if it has changed.
        if (typeof this.fnTileGridEqual === 'undefined') {
            this.fnTileGridEqual = function (tg1, tg2) {
                if (!(
                    tg1.length === tg2.length && tg1[0].length === tg2[0].length
                ))
                    return false;

                const ly = tg2.length;
                const lx = tg2[0].length;

                for (let y = 0; y < ly; ++y) {
                    for (let x = 0; x < lx; ++x) {
                        if (tg1[y][x] !== tg2[y][x]) return false;
                    }
                }
                return true;
            };
        }

        if (mc.tileGrid) {
            const cond = this.tileGrid
                ? this.fnTileGridEqual(this.tileGrid, mc.tileGrid)
                : false;
            if (!cond) {
                this.clearTiles();
                this.drawTerrain();
                this.tileGrid = mc.tileGrid.map((row) => row.slice());
            }
        }
    }

    clearTiles() {
        if (this.tiles.BACKGROUND) this.tiles.BACKGROUND.clear();
        if (this.tiles.FOREGROUND) this.tiles.FOREGROUND.clear();
        // FIX (same-screen teleport blank map): refreshGrid()'s dirty-check skips
        // clearTiles()+drawTerrain() whenever mc.tileGrid deep-equals the cached
        // this.tileGrid. The blank-frame transition (renderFrame's blankFrame
        // branch, triggered on every teleport) calls clearTiles() directly to wipe
        // the BACKGROUND/FOREGROUND graphics for one frame, but never touched the
        // cached this.tileGrid. For a cross-map teleport the destination's tile
        // content differs, so the next refreshGrid() naturally finds a mismatch
        // and redraws. But teleporting to a new position on the *same* screen
        // often produces an identical visible tileGrid, so the equality check
        // passed, drawTerrain() was skipped, and the wiped BACKGROUND/FOREGROUND
        // graphics were never redrawn - leaving the map permanently blank behind
        // the player. Clearing the cache here forces the next refreshGrid() call
        // to treat it as a mismatch and actually redraw terrain, regardless of
        // whether the tile content changed.
        this.tileGrid = null;
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
        self.camera.forEachInScreen(function (entity, id) {
            if (entity) {
                if (entity === game.player) return;
                self.removeEntity(entity);
            }
        });
    }

    renderFrame() {
        if (!game.ready || this.blankFrame) {
            // TODO Make compatible with all sprites.
            Container.HUD.removeChildren();
            Container.HUD2.removeChildren();
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
            this.renderer.render(Container.STAGE);

            this.blankFrame = false;
            this.forceRedraw = true;
            this.drawEntity(game.player);
            game.initCursors();
            game.setCursor('hand');
            return;
        }

        if (
            !game.ready ||
            !game.player ||
            game.mapStatus < 2 ||
            !game.mapContainer.gridReady ||
            this.tilesets.length === 0 ||
            !this.loadData.loaded
        ) {
            this.forceRedraw = true;
            return;
        }

        this.delta = Date.now() - this.last;

        this.renderStaticCanvases();

        // FIX: was permanently commented out, so showCutScene() (letterbox bars) had no
        // caller and could never run. Now driven by this.cutSceneActive - call
        // renderer.startCutScene()/endCutScene() to turn it on/off; the pxSprite check
        // keeps it running for the last few frames of the retract animation after
        // endCutScene() flips the flag back off.
        if (this.cutSceneActive || this.pxSprite['cutscene_1'])
            this.showCutScene();

        this.drawEntities();

        this.drawAnnouncement();

        this.drawBubbles();

        this.drawCombatInfo();
        this.drawDebugInfo();
        this.drawCursor();

        /*this.culler.cull(Container.STAGE, {
        "x":0,
        "y":0,
        "width": window.innerWidth,
        "height": window.innerHeight
      });*/

        this.renderer.render(Container.STAGE);

        this.last = Date.now();

        this.forceRedraw = false;
    }
}

installRendererScaling(Renderer.prototype);
installRendererDrawSprites(Renderer.prototype);
installRendererDrawEntities(Renderer.prototype);
installRendererDrawBars(Renderer.prototype);
installRendererDrawNames(Renderer.prototype);
installRendererDrawHud(Renderer.prototype);
