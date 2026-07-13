// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// globalstate.js is imported first (side effect) since Game transitively owns InventoryDialog/BankDialog,
// which rely on the shared DragItem/DragBank/ShortcutData globals seeded there.
import './globalstate.js';

import Detect from './detect.js';
import InfoManager from './infomanager.js';
import BubbleManager from './bubble.js';
import Renderer from './renderer.js';
import Map from './map.js';
import MapContainer from './mapcontainer.js';
import Animation from './animation.js';
import Sprite from './sprite.js';
import Sprites from './sprites.js';
import AnimatedTile from './tile.js';
import GameClient from './gameclient.js';
import ClientCallbacks from './clientcallbacks.js';
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
import InventoryDialog from './inventorydialog.js';
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
import GamePad from './gamepad.js';

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
            //this.itemInfoOn = true;

            // combat
            this.infoManager = new InfoManager(this);
            this.questhandler = new QuestHandler(this);
            this.achievementHandler = new AchievementHandler();
            this.chathandler = new ChatHandler(this);
            //this.playerPopupMenu = new PlayerPopupMenu(this);
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
            //this.equipmentHandler = new EquipmentHandler(this);
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

            //this.moveEntityThreshold = 11;
            //this.showPlayerNames = true;
            this.musicOn = true;
            this.sfxOn = true;
            //this.frameColour = "default";
            this.ignorePlayer = false;

            this.mapStatus = 0;

            this.mapNames = ["map0", "map1", "map2"];

            this.gameTime = 0;
            //this.updateTick = G_UPDATE_INTERVAL;
            //this.renderTick = G_RENDER_INTERVAL;
            //this.renderTime = 0;
            this.updateTime = 0;
            //this.updateRender = 0;

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
          //this.spriteNames = this.spriteJSON.getSpriteList();
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
            this.equipmentHandler = new EquipmentHandler();

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

        initCursors() {
            const sprite = this.sprites["cursors"];
            const target = this.sprites["target"];

            sprite.container = Container.HUD;
            target.container = Container.HUD;
            const pjsSprite = this.renderer.createSprite(sprite);
            sprite.pjsSprite = pjsSprite;
            target.pjsSprite = pjsSprite;

            this.cursorAnim = sprite.createAnimations();
            this.targetAnim = target.createAnimations();

            this.cursors["hand"] = sprite;
            this.cursors["sword"] = sprite;
            this.cursors["loot"] = sprite;
            this.cursors["arrow"] = sprite;
            this.cursors["talk"] = sprite;
            this.cursors["join"] = sprite;

            this.cursors["target"] = target;
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

        setCursor(name, orientation) {
            if(name in this.cursors) {
                this.currentCursor = this.cursors[name];
                this.currentCursor.setAnimation(name);
                this.currentCursorOrientation = orientation;
            } else {
                log.error("Unknown cursor name :"+name);
            }
        }

        updateCursorLogic() {

        	  if(this.hoveringCollidingTile && this.started) {
                this.targetColor = "rgba(255, 50, 50, 0.5)";
            }
            else {
                this.targetColor = "rgba(255, 255, 255, 0.5)";
            }

            if(this.hoveringPlayer && this.started && this.player) {
                if(this.player.pvpFlag || (this.namedEntity && this.namedEntity instanceof Player && this.namedEntity.isWanted)) {
                    this.setCursor("sword");
                } else {
                    this.setCursor("hand");
                }
                this.hoveringTarget = false;
                this.hoveringMob = false;
            } else if(this.hoveringMob && this.started) { // Obscure Mimic.
                this.setCursor("sword");
                this.hoveringTarget = false;
                this.hoveringPlayer = false;
            }
            else if(this.hoveringNpc && this.started) {
                this.setCursor("talk");
                this.hoveringTarget = false;
            }
            else if((this.hoveringItem || this.hoveringChest) && this.started) {
                this.setCursor("loot");
                this.hoveringTarget = false;
            }
            else if (this.currentCursor.currentAnimation.name !== "hand") {
                this.setCursor("hand");
                this.hoveringTarget = false;
                this.hoveringPlayer = false;
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

        /**
         *
         */
        /*initAnimatedTiles: function() {
            var self = this,
                m = this.map;

            this.animatedTiles = [];
            this.forEachVisibleTile(function (id, index) {
                if(m.isAnimatedTile(id)) {
                    var tile = new AnimatedTile(id, m.getTileAnimationLength(id), m.getTileAnimationDelay(id), index),
                        pos = self.map.tileIndexToGridPosition(tile.index);

                    tile.x = pos.x;
                    tile.y = pos.y;
                    self.animatedTiles.push(tile);
                }
            }, 0, false);
            //log.info("Initialized animated tiles.");
        },*/


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
            const self = this;
            //_.each(this.map.musicAreas, function(area) {
            //    self.audioManager.addArea(area.x, area.y, area.w, area.h, area.id);
            //});
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

        entityIdExists(id) {
            return id in this.entities;
        }

        getEntityById(id) {
            if(this.entities && id in this.entities) {
                return this.entities[id];
            }
            else if (this.items && id in this.items) {
            	return this.items[id];
            }
            //else {
            //    log.info("Unknown entity id : " + id, true);
            //}
        }

        getNpcByQuestKind(npcQuestId){
            for(let id in this.npc){
                const entity = this.npc[id];
                if(entity.npcQuestId === npcQuestId){
                    return entity;
                }
            }
            return null;
        }

        getEntityByName(name){
            for(let id in this.entities){
                const entity = this.entities[id];
                if(entity.name.toLowerCase() === name.toLowerCase()){
                    return entity;
                }
            }
            return null;
        }

        loadGameData() {
            const self = this;
            self.loadAudio();

            self.initMusicAreas();

            self.initCursors();
            self.initAnimations();

            self.setCursor("hand");

//                self.settingsHandler.apply();
        }

        teleportMaps(mapIndex, x, y, portalId)
        {
          const self = this;

        	x = x || -1;
        	y = y || -1;
          if (typeof(portalId) === "undefined")
            portalId = -1;

          if (this.mapContainer) {
            this.prevMapContainer = this.mapContainer;
            //if (mapIndex == this.mapContainer.mapIndex)
              //return;

            this.mapContainer = null;
          }

          log.info("teleportMaps");
          this.mapStatus = 0;
          //delete this.mapContainer;
          this.mapContainer = new MapContainer(this, mapIndex, this.mapNames[mapIndex]);

          this.mapContainer.ready(function () {
              self.client.sendTeleportMap([mapIndex, 0, x, y, portalId]);
          });
        }

        onVersionGame(data) {
          this.versionChecked = true;
          const version = Number(data[0]);

          const local_version = Number(config.build.version);
          log.info("config.build.version="+local_version);
          if (version !== local_version)
          {
            $('#container').addClass('error');
            let errmsg = "Please download the new version of Land Of Mana.<br/>";

            if (game.tablet || game.mobile) {
              errmsg += "<br/>For mobile see: <a href=\"" + config.build.updatepage +
                "\" target=\"_self\">UPDATE LINK</a> or search Google play for \"Land of Mana\".";
            } else {
              errmsg += "<br/>For most browsers press Ctrl+F5 to reload the game cache files.";
            }
            game.clienterror_callback(errmsg);
            if (game.tablet || game.mobile)
              window.location.replace(config.build.updatepage);
          }
        }

        onWorldReady(data) {
          const username = data[0];
          const playername = data[1];
          const hash = data[2];
          const protocol = data[3];
          const host = data[4];
          const port = data[5];

          const url = protocol + "://"+ host +":"+ port +"/";

          // Game Client takes over the processing of Messages.
          game.client = new GameClient();

          game.client.callbacks = new ClientCallbacks(game.client);
          game.client.setHandlers();

          game.client.connect(url, [playername,hash]);
        }

        onPlayerLoad(player) {
          log.info("Received player ID from server : "+ player.id);

          // Make zoning possible.
          setInterval(function() {
            if (game.mapStatus >= 2 &&
                 !player.isMoving() && player.canObserve(game.currentTime))
            {
                game.client.sendWhoRequest();

                player.observeTimer.lastTime = game.currentTime;
            }
          }, player.moveSpeed * 4);

          game.renderer.initPIXI();

          game.app.initPlayerBar();

          game.updateBars();
          game.updateExpBar();

          log.info("onWelcome");

      	  $('.validation-summary').text("Loading Map..");

          // TODO - Maybe this is better in main or app class as html.
          if ($('#player_window').is(':visible'))
          {
            $('#intro').hide();
            $('#container').fadeIn(1000);
            //$('#container').css('opacity', '100');
          }

          //var ts = game.tilesize;
          //game.teleportMaps(0);
      	  game.teleportMaps(1);

          //Welcome message
          game.chathandler.show();

          game.gamestart_callback();

          if(game.hasNeverStarted) {
              game.start();
              //app.info_callback({success: true});
          }

          //log.info("game.currentTime="+game.currentTime);
          player.attackTime = game.currentTime;

          // START TUTORIAL SHOW CODE.
          if (player.level === 0)
          {
            const tutName = "["+lang.data["TUTORIAL"]+"]";
            // FIX: `let j = 1` was declared inside the loop body, so each of the 5 closures got its own fresh
            // j=1 and always showed TUTORIAL_1. The original (pre-conversion) code relied on `var j` being a
            // single counter shared/incremented across all 5 timeout closures (firing in order) to walk through
            // TUTORIAL_1..TUTORIAL_5; hoisted here above the loop to restore that shared-counter behavior.
            let j = 1;
            for (let i = 1; i <= 5; ++i)
            {
              setTimeout(function () {
                const tutData = lang.data["TUTORIAL_"+(j++)];
                game.chathandler.addGameNotification(tutName, tutData);
              }, (12500 * i));
            }
          }
        }

        teleportFromTown(player) {
        }

        addPlayerCallbacks(player) {
          const self = this;

          self.player = player;

          self.player.onStartPathing(function(path) {
              const i = path.length - 1,
                  x =  path[i][0],
                  y =  path[i][1];
          });

          self.player.onKeyMove(function(sentMove) {
            const p = self.player;
            if (!sentMove && !p.freeze)
              checkTeleport(p, p.x, p.y);

            p.sendMove(sentMove ? 1 : 0);
            //if (!p.freeze)
            //f (p.sentMoving !== sentMove) {
              //p.sendMove(sentMove ? 1 : 0);
              //p.sentMoving = sentMove;
            //}
          });

          self.player.onBeforeMove(function() {

          });

          self.player.onBeforeStep(function() {

          });

          self.player.onStep(function() {
          });

          self.player.onMoveStop(function () {
            const p = self.player;
            log.info("player.onMoveStop");

            // FIX: this fires whenever movement.stop() runs, including when a manual
            // key-move step gets blocked (e.g. bumping into an adjacent entity). p.keyMove
            // is still true at this point (user.js's forceStop() override only clears it
            // *after* calling _forceStop(), which is what triggers this callback). Without
            // this check, turning toward a different adjacent entity via movement keys got
            // silently reverted every tick by snapping orientation back to the old target,
            // making it look like the player's facing was permanently locked onto it.
            if (p.keyMove) {
              log.info("onMoveStop - blocked key move, keeping player-chosen orientation.");
              return;
            }

            if (p.hasTarget() && p.canReachTarget())
              p.lookAtEntity(p.target);
            else {
              log.info("onMoveStop - NO TARGET!");
            }
          });

          self.player.onAbortPathing(function(path, x, y) {
            const p = self.player;
            self.client.sendMoveEntity(p, 2);
          });

          var checkTeleport = function (p, x, y)
          {
            //self.teleportFromTown(p);

            const dest = self.mapContainer.getDoor(p);
            if(!p.hasTarget() && dest) {
                // Door Level Requirements.
                let msg;
                let notification;
                if (dest.minLevel && self.player.level < dest.minLevel)
                {
                  msg = "I must be Level "+dest.minLevel+" or more to proceed.";
                  notification = "You must be Level "+dest.minLevel+" or more to proceed.";
                }

                if (msg)
                {
                  self.bubbleManager.create(self.player, msg);
                  self.chathandler.addGameNotification("Notification", notification);
                  return;
                }

                p.setOrientation(dest.orientation);

                p.buttonMoving = false;
                self.teleportMaps(dest.tmap, dest.tx, dest.ty, dest.id);

                //self.updatePlateauMode();

                if(dest.portal) {
                    self.audioManager.playSound("teleport");
                }

            }
          };

          self.player.onStopPathing(function(x, y) {
              const p = self.player;
              log.info("onStopPathing");

            	if (p.isDead)
                  return;

              //self.client.sendMoveEntity(p, 2);
              /*if(self.isItemAt(x, y)) {
                  var items = self.getItemsAt(x, y);

                  try {
                      self.client.sendLoot(items);
                  } catch(e) {
                      throw e;
                  }
              }*/
              //p.targetIndex = 0;
              log.info("onStopPathing - 1");
              if (p.hasTarget() && p.canReachTarget()) {
                p.lookAtEntity(p.target);
              } else {
                log.info("onStopPathing - NO TARGET!");
              }
              log.info("onStopPathing - 2");

              checkTeleport(p, x, y);

              if(p.target instanceof NpcStatic || p.target instanceof NpcMove) {
                  self.makeNpcTalk(p.target);
              } else if(p.target instanceof Node && p.target.kind === Node.CHEST_KIND) {
                  // Chests are Nodes (Node.CHEST_KIND) opened the same way
                  // ore/tree nodes are harvested -- reuse that flow instead
                  // of the removed Chest-specific sendOpen().
                  self.makePlayerHarvestEntity(p.target);
              }
          });

          self.player.onRequestPath(function(x, y) {
            const p = self.player;
          	const ignored = [p]; // Always ignore self
          	const included = [];

              if(p.hasTarget() && !p.target.isDead) {

                  ignored.push(p.target);
              }

              const path = self.findPath(p, x, y, ignored);

              if (path && path.length > 0)
              {
                const orientation = p.getOrientationTo([path[1][0],path[1][1]]);
                p.setOrientation(orientation);
                self.client.sendMovePath(p,
                  path.length,
                  path);
      	                }
              return path;
          });

          self.player.onDeath(function() {
              log.info(self.playerId + " is dead");
              const p = self.player;

              p.skillHandler.clear();

              //p.oldSprite = p.getArmorSprite();
              //log.info("oldSprite="+p.oldSprite);
              p.forceStop();
              p.setSprite(self.sprites["death"]);

              p.animate("death", 150, 1, function() {
                  log.info(self.playerId + " was removed");

                  p.isDead = true;
                  self.updateCameraEntity(p.id, null);

                  setTimeout(function() {
                      self.playerdeath_callback();
                  }, 1000);
              });

              self.audioManager.fadeOutCurrentMusic();
              self.audioManager.playSound("death");
          });

          self.player.onHasMoved(function(player) {
          });

        }

        connected(server) {
          const self = this;

          if (this.hasServerPlayer)
          {
            if(this.client.connectgame_callback) {
              this.client.connectgame_callback();
            }
            return;
          }

          this.client.connection.send("startgame,"+server);
          this.hasServerPlayer = true;
        }

        /**
         * Converts the current mouse position on the screen to world grid coordinates.
         * @returns {Object} An object containing x and y properties.
         */
        getMouseGridPosition() {
            return {x: this.mouse.gx, y: this.mouse.gy};
        }

        getMousePosition() {
            const r = this.renderer;
            const c = this.camera;
            let mx = this.mouse.x;
            let my = this.mouse.y;

            mx = (mx + c.x);
            my = (my + c.y);

            this.mouse.gx = Math.floor(mx / G_TILESIZE);
            this.mouse.gy = Math.floor(my / G_TILESIZE);

            return { x: mx, y: my};
        }

        /**
         * Entry point: player pressed interact. Tries, in priority order: showing
         * queued dialogue, targeting/acting on whatever entity the player is
         * currently facing and in reach of, interacting with an adjacent entity,
         * interacting with a harvestable tile, re-engaging the current target,
         * then falling back to the closest interactable entity.
         */
        makePlayerInteractNextTo()
        {
          const p = this.player;

          if (p.isDying || p.isDead)
            return;

          if (this.tryShowDialogue())
            return;

          log.info("makePlayerInteractNextTo");

          // Before any other target logic: if the player is facing an entity
          // (the tile directly ahead of them in their current orientation)
          // and it's within isInReach(), target it and process it
          // (processTarget -> processInput -> move/attack) immediately, in
          // this one call - regardless of whether a different entity was
          // already targeted.
          if (this.tryInteractFacedEntity())
            return;

          this.ignorePlayer = true;

          this.tryInteractAdjacentEntity() ||
            this.tryInteractHarvestTile() ||
            this.tryInteractExistingTarget() ||
            this.tryInteractClosestEntity();

          this.ignorePlayer = false;
        }

        /**
         * Looks at the exact tile the player is currently facing (based on
         * their orientation) for an entity. If one is there, isn't dying/dead,
         * and is within isInReach() of the player, targets it and calls
         * processTarget() in this same call.
         */
        tryInteractFacedEntity() {
          const p = this.player;
          const pos = p.nextTile();
          const entity = this.getEntityAt(pos[0], pos[1]);

          if (!entity || entity.isDying || entity.isDead) return false;
          if (!p.isNextTooEntity(entity)) return false;

          //clearTimeout(p.attackInterval);
          p.setTarget(entity);
          p.lookAtEntity(entity);
          return this.processTarget();
        }

        isEntityDead(entity) {
          return entity && (entity.isDying || entity.isDead);
        }

        /**
         * Interacts with (or moves toward) the player's current target, using the
         * tile the player is currently facing.
         */
        processTarget() {
          const p = this.player;
          const pos = p.nextTile();
          if (this.isEntityDead(p.target)) {
            p.clearTarget();
            return false;
          }

          game.processInput(pos[0], pos[1], true);
          return true;
        }

        tryShowDialogue() {
          const p = this.player;
          const entity = p.dialogueEntity;
          if (entity && p.isNextTooEntity(entity) && p.isFacingEntity(entity)) {
            game.showDialogue();
            return true;
          }
          return false;
        }

        /**
         * Finds any entity within isInReach() of the player and, if found,
         * targets it and calls processTarget() (-> processInput -> move/
         * attack) immediately, in this one call, regardless of whether the
         * player already had a different target.
         *
         * FIX: this used to also require isFacingEntity(e) alongside
         * isInReach(e.x, e.y). isInReach() is already a directional check -
         * its zone is shaped around the player's current orientation (long
         * ahead, narrow to the sides) - so it already *is* the "in reach and
         * facing" test. isFacingEntity() separately picks a direction from
         * whichever of dx/dy is larger, which is a cruder test and can
         * disagree with isInReach() right at the edges: an entity mostly
         * ahead but very slightly to one side (both offsets under half a
         * tile, the sideways one marginally bigger) passes isInReach() but
         * isFacingEntity() picks the other axis and fails it. The `&&` then
         * threw out an entity the player was genuinely in reach of, this
         * function returned false, and the chain fell through to
         * tryInteractClosestEntity() - which only targets (its own reach
         * gate blocks processTarget()) - so the player just saw the target
         * change with no attack. isInReach() alone is the correct/sufficient
         * check.
         */
        tryInteractAdjacentEntity() {
          const p = this.player;

          const candidates = this.camera.forEachInScreenArray(p)
            .filter(e => e && !e.isDying && !e.isDead && p.isInReach(e.x, e.y));

          if (candidates.length === 0) return false;

          candidates.sort((a, b) => Utils.realDistanceXY(p, a) - Utils.realDistanceXY(p, b));
          const entity = candidates[0];

          p.setTarget(entity);
          p.lookAtEntity(entity);
          return this.processTarget();
        }

        /**
         * If the player is next to and facing a Harvest Tile, interacts with it.
         */
        tryInteractHarvestTile() {
          const p = this.player;
          const type = p.items.getWeaponType();
          if (type === null) return false;

          const pos = p.nextTile();
          const gpos = Utils.getGridPosition(pos[0], pos[1]);
          if (this.mapContainer.isHarvestTile(gpos, type)) {
            game.processInput(pos[0], pos[1], true);
            return true;
          }
          return false;
        }

        /**
         * Re-engages the player's already-set target if it's still visible and
         * adjacent (covers diagonal adjacency the cardinal scan above misses).
         */
        tryInteractExistingTarget() {
          const p = this.player;
          const target = p.target;
          if (!target) return false;

          if (!game.camera.isVisible(target)) {
            p.clearTarget();
            return false;
          }

          if (p.isNextTooEntity(target)) {
            if (!p.isMoving())
              p.lookAtEntity(target);
            return this.processTarget();
          }
          return false;
        }

        /**
         * Fallback: auto-target the closest interactable entity, but only act if
         * targeting didn't just change (avoids acting on a brand new target the
         * same frame it was acquired) - unless the newly acquired target is
         * already within reach, in which case there's nothing to "walk into"
         * first and it's safe to act on it immediately.
         */
        tryInteractClosestEntity() {
          const p = this.player;
          const prevTarget = p.target;
          p.targetIndex = 0;
          this.playerTargetClosestEntity(0);
          if (prevTarget !== p.target && !p.canReachTarget())
            return false;

          return this.processTarget();
        }

        /**
         * Moves the current player to a given target location.
         */
        makePlayerGoTo(x, y) {
            this.player.go(x, y);
        }

        /**
         * Moves the current player towards a specific item.
         */
        makePlayerGoToItem(item) {
            const p = this.player;
            if (!item) return;
            if (!p.isNextTooEntity(item)) {
              p.follow(item);
              //this.player.isLootMoving = true;
            } else {
              this.client.sendLootMove(item);
            }
        }

        makePlayerAttack(entity) {
          const p = this.player;
          clearTimeout(p.attackInterval);
          p.attackInterval = null;
          const skillId = (p.attackSkill) ? p.attackSkill.skillId : -1;
          const time = this.currentTime;
          const res = p.makeAttack(entity);
          if (!res) {
            log.info("CANNOT ATTACK.");
            return false;
          }
          else if (res === "attack_toofar") {
            //this.chathandler.addNotification(lang.data["ATTACK_TOOFAR"]);
            return false;
          }
          else if (res === "attack_outoftime") {
            log.info("CANNOT ATTACK DUE TO TIME.");
            return false;
          }
          else if (res === "attack_ok") {
            this.client.sendAttack(p, p.target, skillId);
            if (skillId != -1)
              p.attackSkill = null;

            this.audioManager.playSound("hit"+Math.floor(Math.random()*2+1));

            p.attackCooldown.duration = 1000;
            p.attackCooldown.lastTime = time;

            // FIX: this used to be `setTimeout(this.makePlayerAttack.bind(this, entity),
            // ATTACK_MAX)`, which closure-captures `entity` once and keeps re-attacking it
            // forever regardless of what the player's target becomes later. setTarget()
            // (character.js) now clears p.attackInterval whenever the target actually
            // changes, but guard here too: if this repeat ever does fire after the target
            // moved on (e.g. some other future call path sets p.target directly), bail
            // instead of blindly re-attacking/re-targeting the stale entity.
            p.attackInterval = setTimeout(() => {
              if (p.target !== entity) return;
              this.makePlayerAttack(entity);
            }, ATTACK_MAX);
            return true;
          }
          return false;
        }

        /**
         *
         */
        makeNpcTalk(npc) {
        	let msg;

          if (!npc) return;

          if (!game.player.isNextTooEntity(npc)) {
            game.player.follow(npc);
            return;
          }

          if (npc.type === Types.EntityTypes.NPCMOVE) {
            this.client.sendTalkToNPC(npc.type, npc.id);
            return;
          }

          if (NpcData.Kinds[npc.kind].title==="Craft")
      		{
  		    	this.craftDialog.show(1,100);
          	if (this.gamepad.isActive())
      			{
      				this.gamepad.dialogNavigate();
      			}
          }
          if (NpcData.Kinds[npc.kind].title==="Beginner shop")
      		{
  		    	this.storeDialog.show(1,100);
          	if (this.gamepad.isActive())
      			{
      				this.gamepad.dialogNavigate();
      			}
          } else if (NpcData.Kinds[npc.kind].title==="Bank") {
          	this.bankDialog.show();
          	if (this.gamepad.isActive())
      			{
      				this.gamepad.dialogNavigate();
      			}
          } else if (NpcData.Kinds[npc.kind].title==="Enchant") {
            game.inventoryMode = InventoryMode.MODE_ENCHANT;
          	this.inventoryDialog.showInventory();
          	if (this.gamepad.isActive())
      			{
      				this.gamepad.dialogNavigate();
      			}
          } else if (NpcData.Kinds[npc.kind].title==="Repair") {
            game.inventoryMode = InventoryMode.MODE_REPAIR;
          	this.inventoryDialog.showInventory();
          	if (this.gamepad.isActive())
      			{
      				this.gamepad.dialogNavigate();
      			}
          } else if (NpcData.Kinds[npc.kind].title==="Auction") {
          	this.auctionDialog.show();
          	if (this.gamepad.isActive())
      			{
      				this.gamepad.dialogNavigate();
      			}
          } else if (NpcData.Kinds[npc.kind].title==="Looks") {
          	this.appearanceDialog.show();
          } else {
          	  this.bubbleManager.destroyBubble(npc.id);
              msg = this.questhandler.talkToNPC(npc);
              this.previousClickPosition = {};
              if (msg) {
                  this.bubbleManager.create(npc, msg);
                  this.audioManager.playSound("npc");
              }
          }
          this.player.removeTarget();
        }

        showDialogue() {
          const self = this;
          const p = game.player;
          let entity = p.dialogueEntity;

          const hasFinished = function () {
            clearTimeout(game.destroyMessageTimeout);
            game.destroyMessage();
            self.npcText.html("");
            self.dialogueWindow.hide();
            game.userAlarm.hide();

            if (!entity)
              return;

            const data = entity.dialogue[entity.dialogueIndex-1];
            if (data && data.length === 3) {
              const action = data[2];
              if (action === "QUEST") {
                game.client.sendQuest(entity.id, parseInt(entity.questId), 1);
              }
            }

            if (entity.dialogueIndex >= entity.dialogue.length) {
              if (entity.quest) {
                self.questhandler.handleQuest(entity.quest);
                p.dialogueQuest = null;
                entity.quest = null;
              }
              entity.dialogueIndex = 0;
              p.dialogueEntity = null;
              entity = null;
              game.userAlarm.show();
            }
          };

          hasFinished();
          if (!entity)
            return;

          if (entity.dialogueIndex < entity.dialogue.length)
            game.createMessage();

          entity.dialogueIndex++;

          game.destroyMessageTimeout = setTimeout(function () {
              game.showDialogue();
          }, 5000);
        }

        createMessage() {
          const p = this.player;
          const entity = p.dialogueEntity;
          if (!entity)
            return;

          if (!(entity.dialogueIndex < entity.dialogue.length))
            return;

          const data = entity.dialogue[entity.dialogueIndex];
          const msgEntity = (data[0] === 0) ? entity : game.player;
          const msg = data[1];
          if (!entity || !msg)
            return;

          this.bubbleManager.create(msgEntity, msg);
          this.audioManager.playSound("npc");
          if (data[0] === 0) {
            this.chathandler.addNormalChat({name: "[NPC] "+msgEntity.name}, msg);
            // FIX: XSS - NPC dialogue name/text was inserted unescaped via .html(); escape before rendering
            this.npcText.html(Utils.escapeHtml(msgEntity.name) + ": " + Utils.escapeHtml(msg));
          } else {
            game.chathandler.addNormalChat(p, msg);
            // FIX: XSS - chat message name/text was inserted unescaped via .html(); escape before rendering
            this.npcText.html(Utils.escapeHtml(p.name) + ": " + Utils.escapeHtml(msg));
          }
          game.app.npcDialoguePic(msgEntity);
          this.dialogueWindow.show();
        }

        destroyMessage() {
          const entity = this.player.dialogueEntity;
          if (!entity)
            return;

          if (entity.dialogue) {
            if (!(entity.dialogueIndex < entity.dialogue.length))
              return;

            const data = entity.dialogue[entity.dialogueIndex];
            const msgEntity = (data[0] === 0) ? entity : game.player;
            this.bubbleManager.destroyBubble(msgEntity.id);
          }

          this.audioManager.playSound("npc-end");
          this.npcText.html("");
          this.dialogueWindow.hide();
        }

        /**
         * Loops through all the entities currently present in the game.
         * @param {Function} callback The function to call back (must accept one entity argument).
         */
        forEachEntity(callback, cond) {
            /*_.each(this.entities, function(entity) {
                callback(entity);
            });*/
            cond = cond || function (e) { return true; };
            for (let id in this.entities) {
              const entity = this.entities[id];
              if (cond(entity))
                callback(entity);
            }
        }

        /**
         * Same as forEachEntity but only for instances of the Mob subclass.
         * @see forEachEntity
         */
        forEachMob(callback) {
            const cond = function (e) { return e.type === Types.EntityTypes.MOB; };
            this.forEachEntity(callback, cond);
            /*_.each(this.entities, function(entity) {
                if(entity instanceof Mob) {
                    callback(entity);
                }
            });*/
        }

        /**
         *
         */
        forEachVisibleTileIndex(callback) {
            const self = this;
      			this.camera.forEachVisibleValidPosition(function(x, y) {
                const index = self.mapContainer.GridPositionToTileIndex(x, y);
      			    callback(index, x, y);
      			});
        }

        /**
         *
         */
        forEachVisibleTile(callback) {
            const self = this,
                mc = this.mapContainer,
                tg = mc.tileGrid;

            if(mc.gridReady) {
                this.forEachVisibleTileIndex(function(index, x, y) {
                    if(_.isArray(tg[y][x])) {
                        _.each(tg[y][x], function(index, x, y) {
                            callback(index, x, y);
                        });
                    }
                    else {
                        if(!_.isNaN(tg[y][x]))
                          callback(tg[y][x], x, y);
                    }
                });
            }
        }

        /**
         *
         */
        forEachAnimatedTile(callback) {
            if(this.animatedTiles) {
                _.each(this.animatedTiles, function(tile) {
                    callback(tile);
                });
            }
        }

        getEntitiesAround(x, y, ts, unInclude = []) {
          ts = ts || G_TILESIZE;
          const pos = [[x+ts,y],[x-ts,y],[x,y+ts],[x,y-ts]];
          let entity = null;
          const entities = [];
          for (let p of pos) {
            entity = this.getEntityAt(p[0],p[1]);
            if (entity && unInclude.indexOf(entity) === -1)
              entities.push(entity);
          }
          return entities;
        }

        /**
         * Returns the entity located at the given position on the world grid.
         * @returns {Entity} the entity located at (x, y) or null if there is none.
         */
        getEntityAt(x, y) {
            if(!this.mapContainer.mapLoaded)
        	    return null;

            //log.info("getEntityAt:");
            const entities = this.camera.entities,
                len = Object.keys(entities).length;

            //log.info("x:"+x+",y:"+y);
            if(len > 0) {
              let entity = null;
              //var pos = {x:x,y:y};
              for (let k in entities) {
                  entity = entities[k];
                  if (!entity) continue;

                  //log.info("x2:"+entity.x+",y2:"+entity.y);
                  if (entity.isOverPosition(x,y))
                    return entity;
              }
            }
            return null;
        }

        /*getEntityByName: function (name) {
        	var entity;
        	$.each(this.entities, function (i, v) {
    	        if (v instanceof Player && v.name.toLowerCase() === name.toLowerCase())
    	        {
    	        	entity = v;
    	        	return false;
    	        }
        	});
        	return entity;
        },*/

        getMobAt(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && entity instanceof Mob) {
                return entity;
            }
            return null;
        }

        getPlayerAt(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && (entity instanceof Player) && (entity !== this.player)) {
                return entity;
            }
            return null;
        }

        getNpcAt(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && (entity instanceof NpcMove || entity instanceof NpcStatic)) {
                return entity;
            }
            return null;
        }

        getChestAt(x, y) {
            const entity = this.getEntityAt(x, y);
            if(entity && (entity instanceof Node) && entity.kind === Node.CHEST_KIND) {
                return entity;
            }
            return null;
        }

        getItemAt(x, y) {
            if(this.mapContainer.isOutOfBounds(x, y) || !this.itemGrid || !this.itemGrid[y]) {
                return null;
            }
            let items = this.itemGrid[y][x],
                item = null;

            if(_.size(items) > 0) {
                // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
                _.each(items, function(i) {
                    if(ItemTypes.isConsumableItem(i.kind)) {
                        item = i;
                    };
                });

                // Else, get the first item of the stack
                if(!item) {
                    item = items[_.keys(items)[0]];
                }
            }
            return item;
        }

        getItemsAt(x, y) {
            // FIX: this.map doesn't exist on game; use this.mapContainer like the rest of the codebase
            if(this.mapContainer.isOutOfBounds(x, y) || !this.itemGrid || !this.itemGrid[y]) {
                return null;
            }
            const items = this.itemGrid[y][x];

            return items;
        }

        /**
         * Returns true if an entity is located at the given position on the world grid.
         * @returns {Boolean} Whether an entity is at (x, y).
         */
        isEntityAt(x, y) {
            return !_.isNull(this.getEntityAt(x, y));
        }

        isMobAt(x, y) {
            return !_.isNull(this.getMobAt(x, y));
        }
        isPlayerAt(x, y) {
            return !_.isNull(this.getPlayerAt(x, y));
        }

        isItemAt(x, y) {
            return !_.isNull(this.getItemAt(x, y));
        }

        isNpcAt(x, y) {
            return !_.isNull(this.getNpcAt(x, y));
        }

        isChestAt(x, y) {
            return !_.isNull(this.getChestAt(x, y));
        }

         /**
           * Simplified findPath using AStar directly.
           * Allows exact start/end positions. Ensures path is axis-aligned (no diagonals).
           */
        findPath(character, x, y, ignoreList, includeList) {
            const ts = G_TILESIZE;
            const self = this;

            const mc = this.mapContainer;
            if (!mc || !mc.gridReady || this.mapStatus < 2)
              return null;

            log.info("PATHFINDER CODE - simplified AStar");

            if(!this.pathfinder || !character)
            {
                // FIX: was unconditionally reading character.id even in the !character branch
                // this exists to guard against, throwing a TypeError instead of logging cleanly
                log.error("game.findPath - Error while finding the path to "+x+", "+y+" for "+(character ? character.id : "unknown"));
                return null;
            }

            const grid = this.mapContainer.maps[0].collision;
            if (!grid) {
              console.error("game.js findPath: grid not ready for pathing.")
              return null;
            }

            // Exact world positions
            const start = [character.x, character.y];
            const end = [x, y];
            //const endpos = Utils.fixGridPosition(x,y);
            //const end = [endpos.x, endpos.y];

            // Check if start or end is colliding
            if (mc.isColliding(character.x, character.y)) {
              log.info("pathfind - isColliding start.");
              return null;
            }
            if (mc.isCollidingPoint(x, y)) {
              log.info("pathfind - isColliding end.");
              return null;
            }

            const pS = [start[0]/ts, start[1]/ts];
            const pE = [end[0]/ts, end[1]/ts];

            log.info("game.findPath - pS:", pS, "pE:", pE);

/*
            if (Math.abs(pS[0] - pE[0]) < 0.01 && Math.abs(pS[1] - pE[1]) < 0.01) {
              // Same tile - direct path
              return [[character.x, character.y], [x, y]];
            }
*/

            // Bounds check
            const lx = grid[0].length;
            const ly = grid.length;
            if (pS[0] < 0 || pS[0] >= lx || pS[1] < 0 || pS[1] >= ly ||
                pE[0] < 0 || pE[0] >= lx || pE[1] < 0 || pE[1] >= ly) {
              log.error("game.findPath - path coordinates outside of dimensions.");
              return null;
            }

            // Grid coords for AStar (integer)
            const fpS = [Math.floor(pS[0]), Math.floor(pS[1])];
            const fpE = [Math.floor(pE[0]), Math.floor(pE[1])];

            // Apply ignore/include lists if provided (support for entities)
            if (ignoreList || includeList) {
              // Note: current Pathfinder methods modify grid in place - clone if needed for safety
              this.pathfinder.applyIgnoreList_(grid, true);  // temporarily mark as walkable
              this.pathfinder.applyIncludeList_(grid, true);
            }

            let gridExtra = Math.max(Math.abs(fpS[0]-fpE[0]), Math.abs(fpS[1]-fpE[1]));
            gridExtra = Math.max(3,gridExtra);

            const shortGrid = this.pathfinder.getShortGrid(grid, pS, pE, gridExtra);
            const sgrid = shortGrid.crop;
            const spS = shortGrid.substart;
            const spE = shortGrid.subend;
            const fspS = [Math.floor(spS[0]),Math.floor(spS[1])];
            const fspE = [Math.floor(spE[0]),Math.floor(spE[1])];
            let path = null;
            let longPath = false;

            // FIX: missing var - was an implicit global
            let gridPath = this.pathfinder.findDirectPath(sgrid, fspS, fspE);

            if (!gridPath) {
              log.info("game.findPath - using short path finder.");
              gridPath = this.pathfinder.findShortPath(sgrid,
                shortGrid.minX, shortGrid.minY, fspS, fspE);
              if (gridPath)
                log.info("game.findPath - validpath-mp4:"+JSON.stringify(path));
            }

            if (!gridPath) {
              log.info("game.findPath - using long path finder.");
              path = this.pathfinder.findPath(grid, fpS, fpE, false);
              // FIX: checked the still-falsy `gridPath` instead of the just-computed `path`, and never wrote the
              // result back to `gridPath` - the long-path fallback branch never ran and its result was discarded,
              // so any destination that needed the long path finder was reported as unreachable.
              if (path) {
                gridPath = path;
                longPath = true;
                shortGrid.minX = 0;
                shortGrid.minY = 0;
                log.info("game.findPath - validpath-mp5:"+JSON.stringify(path));
              }
            }

            // Use AStar
            //var gridPath = this.pathfinder.AStar(grid, fpS, fpE);

            // Restore grid if we modified it
            if (ignoreList || includeList) {
              this.pathfinder.clearIgnoreList(grid);
              this.pathfinder.clearIncludeList(grid);
            }

            if (!gridPath || gridPath.length < 1) {
              log.info("No path found with AStar");
              return null;
            }

            // Convert grid path to world coordinates (tile centers initially)
            let realpath = gridPath.map(node => [
              (shortGrid.minX + node[0] + 0.5) * ts,
              (shortGrid.minY + node[1] + 0.5) * ts
            ]);

            // Force exact start and end positions
            realpath[0] = start;
            realpath[realpath.length - 1] = end;

            // Ensure axis-aligned (no diagonal jumps)
            realpath = this.pathfinder._fixDiagonalJumps(realpath, start, end);

            // Clean up unnecessary nodes
            realpath = this.pathfinder.dropUneededNodes(realpath);

            // Final validation
            if (!this.pathfinder.isValidPath(realpath)) {
              console.error("Generated path failed validation");
              character.forceStop();
              return null;
            }

            log.info("Final simplified realPath:", realpath);
            return realpath;
        }

        /**
         *
         */
        movecursor() {
            const pos = this.getMousePosition();
            const x = pos.x, y = pos.y;

            this.cursorVisible = true;

            if (!this.mapContainer)
              return;

            if(this.mapContainer.gridReady && this.player && !this.renderer.mobile && !this.renderer.tablet) {
                this.hoveringMob = this.isMobAt(x, y);
                //log.info("isMobAt x="+x+"y="+y);
                this.hoveringPlayer = this.isPlayerAt(x, y);
                this.hoveringItem = this.isItemAt(x, y);
                this.hoveringNpc = this.isNpcAt(x, y);
                this.hoveringOtherPlayer = this.isPlayerAt(x, y);
                this.hoveringChest = this.isChestAt(x, y);
                this.hoveringEntity = this.getEntityAt(x, y);

                if((this.hoveringMob || this.hoveringPlayer || this.hoveringNpc || this.hoveringChest || this.hoveringOtherPlayer || this.hoveringItem) && !this.player.hasTarget()) {
                    const entity = this.getEntityAt(x, y);
                    if (!entity) return;

                    this.player.showTarget(entity);
                    this.lastHovered = entity;
                }
            }
        }

        /**
         * Moves the player one space, if possible
         */
        moveCharacter(char, x, y, skipOverlap, skipGridCheck) {
          skipOverlap = skipOverlap || false;
          skipGridCheck = skipGridCheck || false;

          const o = char.orientation;
          if (o === Types.Orientations.NONE)
            return false;

          //var cy = (o == 1 || o == 2) ? y : char.y;
          //var cx = (o == 3 || o == 4) ? x : char.x;
          if (this.mapContainer.isColliding(x, y)) {
            //char.setPosition(x,y);
            return false;
          }

          if (char instanceof Player) {
            const block = char.holdingBlock;
            const tile = char.nextTile(x, y);
            if (block && this.mapContainer.isColliding(tile[0], tile[1]))
              return false;
          }

          if (!skipOverlap && this.isOverlapping(char, x, y)) {
            //console.warn("this.isOverlapping("+char.id+","+x+","+y+")");
            return false;
          }

          // This chunk of code makes sure character move into the grid.
          if (!skipGridCheck) {
            const midTile = (G_TILESIZE >> 1);
            const mx = (x % G_TILESIZE);
            const my = (y % G_TILESIZE);
            //var o = char.orientation;
            const check = (o === 1 || o === 2) ?
              (my === midTile) : (mx === midTile);
            //log.info("skipGridCheck, mx:"+mx+", my:"+my);
            if (char.stopKeyMove && check)
            {
              char.setPosition(x,y);
              return false;
            }
          }

          return true;
        }

        isOverlapping(entity, x, y) {
            const entities = this.camera.entities;

            for (let k in entities) {
              const entity2 = entities[k];
              //if (entity2 instanceof Item)
                //continue;
              if (entity2 instanceof Player)
                continue;
              if (entity instanceof Player && entity.holdingBlock === entity2)
                continue;
              if (!entity2 || entity === entity2)
                continue;
              if (entity2.isDead || entity2.isDying)
                continue;

              if (!entity2.isWithinDist(entity.x, entity.y, G_TILESIZE-1) &&
                  entity2.isWithinDist(x, y, G_TILESIZE-1))
                return true;
            }
            return false;
        }

        playerTargetClosestEntity(inc) {
          const p = this.player;
          if (!p.hasOwnProperty("targetIndex"))
            p.targetIndex = 0;

          let excludeTypes = [Types.EntityTypes.NODE, Types.EntityTypes.PLAYER];
          if (game.mapContainer.mapIndex !== 0)
          {
            excludeTypes = excludeTypes.concat([Types.EntityTypes.NPCMOVE, Types.EntityTypes.NPCSTATIC]);
          }
          const entity = this.entityTargetClosestEntity(p, inc, p.targetIndex, excludeTypes);
          if (!entity)
            return false;

          p.setTarget(entity);
          return true;
        }

        entityTargetClosestEntity(entity, inc, index, excludeTypes) {
          //var self = this;
          //var ts = this.tilesize;
          //var cm = this.camera;

          index = index || 0;

          //var entities = Utils.objectToArray(this.camera.entities);
          let entities = this.camera.forEachInScreenArray(entity);
          entities = entities.filter(entity => !(excludeTypes.includes(entity.type) || entity.isDying || entity.isDead));

          for (let entity2 of entities) {
            entity2.playerDistance = Utils.realDistanceXY(entity,entity2);
          }

          if (entities.length === 0) {
            entity.targetIndex = 0;
            return null;
          }
          if (entities.length === 1) {
            entity.targetIndex = 0;
            return entities[0];
          }

          entities.sort(function (a,b) { return (a.playerDistance > b.playerDistance) ? 1 : -1; });

          index = (index+entities.length) % entities.length;
          entity.targetIndex = (index+entities.length+inc) % entities.length;
          return entities[index];
        }

        click() {
            //console.error("game.click");
            const pos = this.getMousePosition();
            const p = game.player;

            if (this.joystick && this.joystick.isActive())
              return;

            if (p.dialogueEntity) {
              game.showDialogue();
              return;
            }

            if (p.movement.inProgress)
              return;

            this.clickMove = true;
            //this.playerPopupMenu.close();

            for (let dialog of this.dialogs) {
              if (dialog.visible)
                dialog.hide();
            }

            const entity = this.getEntityAt(pos.x, pos.y);
            if (p.setTarget(entity))
              return;

            this.processInput(pos.x,pos.y);
            this.clickMove = false;
        }

        rightClick() {
          // TODO Might have some use later.
        }

        /**
         * Processes game logic when the user triggers a click/touch event during the game.
         */
         processInput(px, py) {
           //var pos = {};
           const ts = this.tilesize;
           const p = this.player;

          //log.info("processInput - x:"+pos.x+",y:"+pos.y);

          if (!this.started || !this.player || this.player.isDead)
              return;

          px = Utils.clamp(0, this.mapContainer.widthX, px);
          py = Utils.clamp(0, this.mapContainer.heightY, py);

        	///log.info("x="+pos.x+",y="+pos.y);

          let entity = p.hasTarget() ?
            p.target : this.getEntityAt(px, py);

          if (!entity && this.renderer.mobile) {
            const entities = game.camera.getEntitiesAround(px, py, 16, [game.player]);
            if (entities && entities.length > 0)
            {
              entity = entities[0];
              p.setTarget(entity);
            }
          }

          if (entity && !entity.isDying) {
            this.playerInteract(entity);
          }
          else
          {
      	    //this.playerPopupMenu.close();
            //this.player.clearTarget();
            const type = p.items.getWeaponType();
            const gpos = Utils.getGridPosition(px, py);
            const colliding = this.mapContainer.isColliding(px,py);
            if (colliding && this.mapContainer.isHarvestTile(gpos, type) && p.isNextTooPosition(px, py)) {
                // Start hit animation and send to Server harvest packet.
                this.makePlayerHarvest(px, py);
                return;
            }

            if (this.clickMove)
              this.clickMoveTo(px, py);
          }
        }

        playerInteract(entity)
        {
          const p = this.player;
          if (!entity)
            return;

          if (entity && !p.hasTarget() && !entity.isDying )
          {
            p.setTarget(entity);
          }
          if (p.isNextTooEntity(entity) && !p.movement.inProgress) {
            p.lookAtEntity(entity);
          }
          // FIX: p.target stays null when the entity was skipped above (already had a target,
          // or entity.isDying was true), so this unconditional p.target.id threw a TypeError
          if (p.target) {
            log.info("player target: "+p.target.id);
          }

          if (entity instanceof Block && p.isNextTooEntity(entity) &&
            p.isFacingEntity(entity))
          {
            const block = entity;
            if (block === p.holdingBlock) {
              block.place(p);
              p.holdingBlock = null;
            } else {
              block.pickup(p);
            }
            return;
          }
          if (entity instanceof Item)
          {
            this.makePlayerGoToItem(entity);
            return;
          }
          else if (entity instanceof NpcStatic || entity instanceof NpcMove)
          {
            this.makeNpcTalk(entity);
            return;
          }

          if(entity instanceof Player && entity !== this.player)
          {
              this.makePlayerAttack(entity);
              //this.playerPopupMenu.click(entity);
          }
          else if(entity instanceof Mob ||
                  (entity instanceof Player && entity !== this.player && this.player.pvpTarget === entity))
          {
              log.info("makePlayerAttack!");
              this.makePlayerAttack(entity);
              return;
          }
          else if (entity instanceof Node) {
              // Chests are Node.CHEST_KIND nodes, so this one branch already
              // covers both ore/tree nodes and chests.
              this.makePlayerHarvestEntity(entity);
          }

        }

        makePlayerHarvestEntity(entity) {
          const p = this.player;

          if (!p.isNextTooEntity(entity)) {
            p.follow(entity);
            return;
          }

          if (!p.items.hasHarvestWeapon(entity.weaponType)) {
            game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", entity.weaponType]);
            return;
          }

          p.lookAtEntity(entity);
          p.harvestOn(entity.weaponType);

          if (entity.kind === Node.CHEST_KIND) {
              this.audioManager.playSound("chest");
          }

          this.client.sendHarvestEntity(entity);
        }

        makePlayerHarvest(px, py) {
          const p = this.player;

          if (!p.items.hasHarvestWeapon()) {
            game.showNotification(["CHAT", "HARVEST_NO_WEAPON"]);
            return;
          }

          const type = p.items.getWeaponType();
          if (type === null) {
            game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
            return;
          }

          const gpos = Utils.getGridPosition(px, py);
          if (!this.mapContainer.isHarvestTile(gpos, type)) {
            game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
            return;
          }

          p.lookAtTile(px, py);
          p.harvestOn(type);

          this.client.sendHarvest(px, py);
        }

        clickMoveTo(px, py) {
          //var self = this;
          log.info("makePlayerGoTo");
          //var tsh = G_TILESIZE >> 1;
          //var ts = game.tilesize;

          //log.info("so:"+so[0]+","+so[1]);
          const p = this.player;
          px = (Math.floor(px/G_TILESIZE)+0.5)*G_TILESIZE;
          py = (Math.floor(py/G_TILESIZE)+0.5)*G_TILESIZE;

          const colliding = this.mapContainer.isCollidingPoint(px,py);
          if (colliding)
          {
            /*if (this.renderer.mobile) {
              for (var i=1; i <= 4; i++) {
                var tile = p.nextTile(px,py,i);
                var tx = tile[0];
                var ty = tile[1];
                if (!this.mapContainer.isCollidingPoint(tx,ty))
                {
									this.makePlayerGoTo(tx, ty);
                  return;
                }
              }
            }*/
          }
          else {
              this.makePlayerGoTo(px, py);
          }
        }


        /*speakToNPC: function (entity) {
          var p = this.player;
          if (!p.isWithinDistEntity(entity, 24))
            p.follow(entity);
  				else
  					this.makeNpcTalk(entity);
        },*/

        updateCameraEntity(id, entity)
        {
          //log.info(id+ " updateCameraEntity");
          const self = this;
          if (!self.camera) return;

          if (!entity || (entity instanceof Character && entity.isDead))
          {
            //log.info(id+ " updateCameraEntity - Deleted.");

            self.camera.entities[id] = null;
            self.camera.outEntities[id] = null;

            delete self.camera.entities[id];
            delete self.camera.outEntities[id];
            return;
          }

          if (!self.camera.entities[id] && self.camera.isVisible(entity, 1))
          {
              //log.info(id+ " updateCameraEntity - in Screen Edges");
              self.camera.entities[id] = entity;
              self.camera.outEntities[id] = entity;
              return;
          }

          if (!self.camera.outEntities[id] && self.camera.isVisible(entity, 10))
          {
              self.camera.outEntities[id] = entity;
              return;
          }

        }

        say(message) {
            //All commands must be handled server sided.
            if(!this.chathandler.processSendMessage(message)){
                this.client.sendChat(message);
            }

        }

        respawnPlayer() {
            log.debug("Beginning respawn");

            this.player.revive();

            this.updateBars();

            //this.addEntity(p);
            this.initPlayer(true);

            this.started = true;
            //this.client.enable();
            this.client.sendPlayerRevive();

            log.debug("Finished respawn");
        }

        onGameStart(callback) {
            this.gamestart_callback = callback;
        }

        onClientError(callback) {
            this.clienterror_callback = callback;
        }

        onDisconnect(callback) {
            this.disconnect_callback = callback;
        }

        onPlayerDeath(callback) {
            this.playerdeath_callback = callback;
        }

        onUpdateTarget(callback){
            this.updatetarget_callback = callback;
        }
        onPlayerExpChange(callback){
            this.playerexp_callback = callback;
        }

        onPlayerHealthChange(callback) {
            this.playerhp_callback = callback;
        }

        onBarStatsChange(callback) {
            this.barstats_callback = callback;
        }


        onPlayerHurt(callback) {
            this.playerhurt_callback = callback;
        }

        onNotification(callback) {
            this.notification_callback = callback;
        }

        resize(zoomMod) {
            this.renderer.resizeCanvases(zoomMod);
            this.updateBars();
            this.updateExpBar();

            this.inventoryDialog.refreshInventory();
            /*if (this.player && this.player.skillHandler) {
                this.player.skillHandler.displayShortcuts();
            }*/
            if (this.storeDialog.visible)
            	this.storeDialog.rescale();
            if (this.bankDialog.visible) {
            	this.bankDialog.rescale();
            }
        }

        updateBars() {
            const p = this.player;
            if(p && this.playerhp_callback) {
                this.playerhp_callback(p.stats.hp, p.stats.hpMax);
            }
        }

        updateExpBar(){
            if(this.player && this.playerexp_callback){
                const exp = this.player.stats.exp.base;
                const level = Types.getLevel(exp);
                this.playerexp_callback(level, exp);
            }
        }

        showNotification(data) {
            const group = data.shift();
            const text = data.shift();

            let message = lang.data[text];
            if (message && data.length > 0)
              message = lang.data[text].format(data);

            if (group.indexOf("GLOBAL") === 0)
            {
              message = text;
              game.renderer.pushAnnouncement(message,10000);
              return;
            }

            if (group.indexOf("NOTICE") === 0)
            {
              game.renderer.pushAnnouncement(message,10000);
              return;
            }

            if (group.indexOf('SHOP') === 0 ||
                group.indexOf('INVENTORY') === 0)
            {
              if(this.craftDialog.visible) {
                  game.notifyDialog.notify(message);
              }
              else if(this.storeDialog.visible) {
                  game.notifyDialog.notify(message);
              } else if(this.auctionDialog.visible) {
                  game.notifyDialog.notify(message);
              } else if(this.appearanceDialog.visible) {
                  if (group.indexOf('SHOP') === 0) {
                  	game.notifyDialog.notify(message);
                  }
              }
            }
            this.chathandler.addNotification(message);
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

        /**
         * Fake a mouse move event in order to update the cursor.
         *
         * For instance, to get rid of the sword cursor in case the mouse is still hovering over a dying mob.
         * Also useful when the mouse is hovering a tile where an item is appearing.
         */
        updateCursor() {
            this.movecursor();
            this.updateCursorLogic();
        }

        forEachEntityRange(gx, gy, r, callback) {
            this.forEachEntity(function(e) {
    					if (e.gx >= gx-r && e.gx <= gx+r &&
    						e.gy >= gy-r && e.gy <= gy+r)
    					{
    						callback(e);
    					}
            });
        }
}

// TODO - Overlapping Block Monsters is not working!!!.
