// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// globalstate.js is imported first (side effect) since Game transitively owns InventoryDialog/BankDialog,
// which rely on the shared DragItem/DragBank/ShortcutData globals seeded there.
import './globalstate.js';

import Detect from './detect.js';
import InfoManager from './infomanager.js';
import BubbleManager from './bubble.js';
import Renderer from './renderer/renderer.js';
import Map from './map.js';
import MapContainer from './mapcontainer/mapcontainer.js';
import Animation from './animation.js';
import Sprite from './sprite.js';
import Sprites from './sprites.js';
import AnimatedTile from './tile.js';
import GameClient from './gameclient/gameclient.js';
import ClientCallbacks from './clientcallback/clientcallbacks.js';
import AudioManager from './audio.js';
import Updater from './updater.js';
import Pathfinder from './pathfinder.js';
import Entity from './entity/entity.js';
import Item from './entity/item.js';
import Items from './data/items.js';
import ItemLoot from './data/itemlootdata.js';
import AppearanceData from './data/appearancedata.js';
import AppearanceDialog from './dialog/appearancedialog.js';
import Mob from './entity/mob.js';
import NpcStatic from './entity/npcstatic.js';
import NpcMove from './entity/npcmove.js';
import NpcData from './data/npcdata.js';
import Player from './entity/player.js';
import Character from './entity/character.js';
import Block from './entity/block.js';
import Node from './entity/node.js';
import MobData from './data/mobdata.js';
import MobSpeech from './data/mobspeech.js';
import config from './config.js';
import ChatHandler from './chathandler.js';
import PlayerPopupMenu from './playerpopupmenu.js';
import Quest from './quest.js';
import QuestData from './data/questdata.js';
import QuestHandler from './questhandler.js';
import AchievementHandler from './achievementhandler.js';
import UserAlarm from './useralarm.js';
import EquipmentHandler from './equipmenthandler.js';
import InventoryHandler from './inventoryhandler.js';
import InventoryDialog from './inventorydialog/inventorydialog.js';
import ShortcutHandler from './shortcuthandler.js';
import BankHandler from './bankhandler.js';
import SocialHandler from './socialhandler.js';
import LeaderboardHandler from './leaderboardhandler.js';
import SettingsHandler from './settingshandler.js';
import StoreHandler from './storehandler.js';
import SkillHandler from './skillhandler.js';
import SkillData from './data/skilldata.js';
import StatDialog from './dialog/statdialog.js';
import SkillDialog from './dialog/skilldialog.js';
import ConfirmDialog from './dialog/confirmdialog.js';
import NotifyDialog from './dialog/notifydialog.js';
import StoreDialog from './dialog/storedialog.js';
import AuctionDialog from './dialog/auctiondialog.js';
import CraftDialog from './dialog/craftdialog.js';
import BankDialog from './dialog/bankdialog.js';
import GamePad from './gamepad/gamepad.js';

// Game's own behavior is split across these mixin modules for readability (game.js had grown
// to ~2500 lines). Each install* call below merges plain-function methods onto Game.prototype;
// they're not subclasses/separate instances, just Game's own methods living in separate files.
import { installGameCursor } from './game/gamecursor.js';
import { installGameEntityQueries } from './game/gameentityqueries.js';
import { installGameMovement } from './game/gamemovement.js';
import { installGameCallbacks } from './game/gamecallbacks.js';
import { installGameInteraction } from './game/gameinteraction.js';
import { installGameDialogue } from './game/gamedialogue.js';
import { installGameUI } from './game/gameui.js';

/* global Types, ItemTypes, Utils, log, _, Detect, lang, Container, G_TILESIZE, ATTACK_MAX, user, game, app, localforage */

// FIX: 'sprites' was a bare implicit global (assigned in setSpriteJSON, read in loadSprites);
// confirmed single-file usage via grep, so it's declared here as a module-scoped variable.
let sprites;

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global (gametypes.js's
// top-level `const InventoryMode` was visible to sibling classic <script> tags even without a
// window property). Now that gametypes.js is a real ES module, its top-level consts are scoped
// to that module only, so this is aliased from Types.InventoryMode instead.
const InventoryMode = Types.InventoryMode;

export default class Game {
      constructor(app) {
        const self = this;

      	  this.app = app;
            this.app.config = config;
            this.ready = false;
            this.started = false;
            this.hasNeverStarted = true;
            this.hasServerPlayer = false;

            this.client = null;
            this.renderer = null;
            this.camera = null;
            this.updater = null;
            this.pathfinder = null;
            this.chatinput = null;
            this.bubbleManager = null;
            this.audioManager = null;

            // Game state
            this.entities = {};
            this.npc = {};
            this.pathingGrid = [];
            this.tileGrid = [];
            this.itemGrid = [];

            this.currentCursor = null;
            this.mouse = { x: 0, y: 0 };
            this.previousClickPosition = {};

            this.cursorVisible = true;
            this.selectedX = 0;
            this.selectedY = 0;
            this.selectedCellVisible = false;
            this.targetColor = "rgba(255, 255, 255, 0.5)";
            this.targetCellVisible = true;
            this.hoveringTarget = false;
            this.hoveringPlayer = false;
            this.hoveringMob = false;
            this.hoveringItem = false;
            this.hoveringCollidingTile = false;
            this.hoveringEntity = null;

            // Global chats
            this.chats = 0;
            this.maxChats = 3;
            this.globalChatColor = '#A6FFF9';


            // Item Info

            // combat
            this.infoManager = new InfoManager(this);
            this.questhandler = new QuestHandler(this);
            this.achievementHandler = new AchievementHandler();
            this.chathandler = new ChatHandler(this);
            this.socialHandler = new SocialHandler(this);

            this.leaderboardHandler = new LeaderboardHandler(this);
            this.storeHandler = new StoreHandler(this, this.app);

            // Move Sync
            this.lastCurrentTime = 0;
            this.updateCurrentTime = 0;
            this.logicTime = 0;
            this.currentTime = Utils.getTime();

            this.cursors = {};

            this.sprites = {};

            // tile animation
            this.animatedTiles = null;

            this.dialogs = [];
            this.statDialog = new StatDialog();
            this.skillDialog = new SkillDialog();
            this.userAlarm = new UserAlarm();

            this.dialogs.push(this.statDialog);
            this.dialogs.push(this.skillDialog);

            //New Stuff
            this.soundButton = null;

            this.expMultiplier = 1;

            this.showInventory = 0;

            this.selectedSkillIndex = 0;

            this.usejoystick = false;
            this.joystick = null;
            this.clickMove = false;

            this.inputLatency = 0;
            this.keyInterval = null;

            this.optimized = true;

            this.products = null;

            /**
             * Settings - For player
             */

            this.musicOn = true;
            this.sfxOn = true;
            this.ignorePlayer = false;

            this.mapStatus = 0;

            this.mapNames = ["map0", "map1", "map2"];

            this.gameTime = 0;
            this.updateTime = 0;

            this.previousDelta = 0;
            this.animFrame = (typeof(requestAnimFrame) !== "undefined");

            this.spritesReady = false;

            this.unknownEntities = [];
            // FIX: was never initialized anywhere, so removeObsoleteEntities()'s `this.obsoleteEntities.push(...)`
            // would throw as soon as its (separately fixed) loop condition could actually reach it.
            this.obsoleteEntities = [];
            this.removeObsoleteEntitiesChunk = 32;

            this.inventoryMode = 0;

            this.spriteJSON = new Sprites();

            this.dialogueWindow = $("#npcDialog");
            this.npcText = $("#npcText");

            this.isFirefox = Detect.isFirefox();
            this.isCanary = Detect.isCanaryOnWindows();
            this.isEdge = Detect.isEdgeOnWindows();
            this.isSafari = Detect.isSafari();
            this.tablet = Detect.isTablet(window.innerWidth);
            this.mobile = Detect.isMobile();

            setInterval(function() {
            	self.removeObsoleteEntities();
            },30000);

        }

        setSpriteJSON() {

          sprites = this.spriteJSON.sprites;
          this.loadSprites();
          this.spritesReady = true;
        }

// TODO - Revise.
        setup(input) {
            this.bubbleManager = new BubbleManager();
            this.renderer = new Renderer(this);
            this.tilesize = this.renderer.tilesize;

            this.camera = this.renderer.camera;

            this.bankHandler = new BankHandler(this);
            this.setChatInput(input);

            this.storeDialog = new StoreDialog(this);
            this.dialogs.push(this.storeDialog);
            this.craftDialog = new CraftDialog(this);
            this.dialogs.push(this.craftDialog);

            this.bankDialog = new BankDialog(this);
            this.dialogs.push(this.bankDialog);
            this.auctionDialog = new AuctionDialog(this);
            this.dialogs.push(this.auctionDialog);
            this.appearanceDialog = new AppearanceDialog(this);
            this.dialogs.push(this.appearanceDialog);
            this.confirmDialog = new ConfirmDialog();
            this.notifyDialog = new NotifyDialog();

            this.inventoryDialog = new InventoryDialog();
            this.inventoryHandler = new InventoryHandler(this.inventoryDialog);
            // FIX: constructor takes `game` and stores it as `this.game`, but no
            // argument was ever passed here, so `this.game` was permanently
            // undefined. Every method in EquipmentHandler works around this by
            // reading the bare global `game` instead, which happens to resolve
            // via window.game -- but that makes the constructor param/this.game
            // dead and misleading. Pass it through like InventoryHandler does.
            this.equipmentHandler = new EquipmentHandler(this);

            this.inventory = this.inventoryHandler;
            this.equipment = this.equipmentHandler;
            this.shortcuts = new ShortcutHandler();
        }

        setChatInput(element) {
            this.chatinput = element;
        }

        initPlayer(died = false) {
            this.app.initTargetHud();

            this.player.respawn(died);

            this.camera.entities[this.player.id] = this.player;
            this.camera.outEntities[this.player.id] = this.player;

            log.debug("Finished initPlayer");
        }

        initAnimations() {
            this.targetAnimation = new Animation("idle_down", 0, 4, 0, 16, 16);
            this.targetAnimation.setSpeed(50);
        }

        loadSprite(data) {
          this.spritesets[0][data.id] = new Sprite(data, 2, Container.ENTITIES);
        }

        loadSprites() {
            log.info("Loading sprites...");
            this.spritesets = [];
            this.spritesets[0] = {};
            this.sprites = this.spritesets[0];

            let sprite = null;
            for (let key in sprites) {
              sprite = sprites[key];
              this.loadSprite(sprite);
            }
        }

        addEntity(entity) {
            const self = this;

            this.entities[entity.id] = entity;
            this.updateCameraEntity(entity.id, this.entities[entity.id]);
        }

        removeEntity(entity) {
            // FIX: was `delete this.npc[id]` using an undefined/wrong `id`; use entity.id so npc entries actually get removed
            if (this.npc[entity.id])
              delete this.npc[entity.id];

            if(entity.id in this.entities) {
                const id = entity.id;
                if (this.player.target === entity) {
                  this.player.clearTarget();
                  this.player.targetIndex = 0;
                }
                this.renderer.removeEntity(entity);
                this.updateCameraEntity(id, null);
                delete this.entities[id];
            }
            else {
                log.info("Cannot remove entity. Unknown ID : " + entity.id);
            }
        }

        addItem(item) {
            if (this.items)
            {
              this.items[item.id] = item;
              this.addEntity(item);
            }
            else {
              console.warn("TODO: Cannot add item. Unknown ID : " + item.id);
            }
        }

        removeItem(item) {
            if(item) {
                this.removeFromItems(item);
                const id = item.id;
                this.removeEntity(item);
            } else {
                log.error("Cannot remove item. Unknown ID : " + item.id);
            }
        }

        removeFromItems(item) {
            if(item) {
                delete this.items[item.id];
            }
        }

        initGrid() {
          this.camera.focusEntity = this.player;
          this.mapContainer.reloadMaps(true);
        }

        registerEntityPosition(entity) {
            const x = entity.gx,
                y = entity.gy;

            if(entity) {
                if(entity instanceof Item) {
                    this.itemGrid[y][x][entity.id] = entity;
                    this.items[entity.id] = entity;
                }
            }
        }

        loadAudio() {
            this.audioManager = new AudioManager(this);
        }

        initMusicAreas() {
        }

        run(server, ps) {
        	  const self = this;

            this.player = app.user.createPlayer(ps);

            this.loadGameData();

            this.updater = new Updater(this);
            this.camera = this.renderer.camera;

            this.settingsHandler = new SettingsHandler(this);
            this.settingsHandler.apply();

            setTimeout(function () {
                self.resize(self.zoom);
            },2000); // Slight Delay For On-Screen Keybaord to minimize.

            this.gamepad = new GamePad(this);

            this.gameFrame = 0;
            this.pGameFrame = -1;
            this.gameInterval = setInterval(this.gametick.bind(this), G_UPDATE_INTERVAL);
        }

        // FIX (dead code): removed the never-called rAF-driven `render()` method and the
        // `runUpdateInRender` flag it alone relied on. gametick() (setInterval-driven) is the
        // only active loop and always calls updater.update() once per tick; the flag/branch
        // were vestigial from an abandoned rAF loop and, if that loop were ever re-enabled
        // without noticing gametick's unconditional call, would have caused update() to run
        // twice per frame on non-mobile/tablet devices.
        gametick() {
          const self = this;

          this.processLogic = true;

          this.tickTime = Date.now();
          this.currentTime = Utils.getTime();

          if (!this.started || this.isStopped) {
            this.stateChanged = true;
            return;
          }

          this.updateTime = this.currentTime;

          if (self.gamepad)
            this.gamepad.interval();

          this.updater.update();

    			if (this.mapStatus >= 2)
    			{
    				this.updateCursorLogic();
    			}

          this.renderer.renderFrame();

          this.processLogic = false;
        }

        start() {
          this.started = true;
          this.ready = true;
          this.hasNeverStarted = false;
          log.info("Game loop started.");
        }

        stop() {
            log.info("Game stopped.");
            this.isStopped = true;
        }

        loadGameData() {
            const self = this;
            self.loadAudio();

            self.initMusicAreas();

            self.initCursors();
            self.initAnimations();

            self.setCursor("hand");

        }

        removeObsoleteEntities() {
            const entities = game.entities;
            const p = game.player;
            let entity = null;
            for (let id in entities) {
              entity = entities[id];
              // FIX: inverted condition skipped every truthy (real) entity and fell through to `entity.x` on the
              // rare null one, so obsolete entities were never actually collected for cleanup; should skip nulls.
              if (!entity)
                continue;
              // FIX: was culling anything >64px (4 tiles) from the player, but the camera's visible area is far
              // larger than that (screenX/screenY, i.e. the whole viewport in world pixels), so entities still
              // on screen were being removed. Use camera visibility (with the same 10-tile buffer margin used
              // for outEntities elsewhere) instead of a fixed, much-too-small radius.
              if (!game.camera.isVisible(entity, 64))
                this.obsoleteEntities.push(entity);
            }

            const nb = _.size(this.obsoleteEntities),
                self = this,
                delist = [];

            if(nb > 0) {
            	for (let i=0; i < self.removeObsoleteEntitiesChunk; ++i)
            	{
            		if (i === nb)
            			break;
            		entity = this.obsoleteEntities.shift();
              	log.info("Removed Entity: "+ entity.id);
              	delist.push(entity.id);
              	self.removeEntity(entity);
              }
              if (delist.length > 0)
                self.client.sendWho(delist);
            }
        }

}

installGameCursor(Game.prototype);
installGameEntityQueries(Game.prototype);
installGameMovement(Game.prototype);
installGameCallbacks(Game.prototype);
installGameInteraction(Game.prototype);
installGameDialogue(Game.prototype);
installGameUI(Game.prototype);

// TODO - Overlapping Block Monsters is not working!!!.
