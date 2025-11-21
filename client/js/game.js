
/* global Types, log, _, self, Class, CharacterDialog, localforage */

define(['text!../shared/data/sprites.json', 'lib/localforage', 'infomanager', 'bubble',
        'renderer', 'map', 'mapcontainer', 'animation', 'sprite', 'sprites', 'tile',
        'gameclient', 'clientcallbacks', 'audio', 'updater',
        'pathfinder', 'entity/entity', 'entity/item', 'data/items', 'data/itemlootdata', 'data/appearancedata', 'dialog/appearancedialog',
        'entity/mob', 'entity/npcstatic', 'entity/npcmove', 'data/npcdata', 'entity/player', 'entity/character', 'entity/chest', 'entity/block', 'entity/node',
        'data/mobdata', 'data/mobspeech', 'config', 'chathandler',
        'playerpopupmenu', 'quest', 'data/questdata', 'questhandler', 'achievementhandler', 'useralarm',
        'equipmenthandler', 'inventoryhandler', 'inventorydialog', 'shortcuthandler', 'bankhandler', 'socialhandler',
        'leaderboardhandler', 'settingshandler','storehandler',
        'skillhandler', 'data/skilldata',
        'dialog/statdialog', 'dialog/skilldialog',
        'dialog/confirmdialog', 'dialog/notifydialog', 'dialog/storedialog', 'dialog/auctiondialog', 'dialog/craftdialog',
        'dialog/bankdialog', 'gamepad'],

function(spriteNamesJSON, localforage, InfoManager, BubbleManager,
        Renderer, Map, MapContainer, Animation, Sprite, Sprites, AnimatedTile,
         GameClient, ClientCallbacks, AudioManager, Updater,
         Pathfinder, Entity, Item, Items, ItemLoot, AppearanceData, AppearanceDialog,
         Mob, NpcStatic, NpcMove, NpcData, Player, Character, Chest, Block, Node,
         MobData, MobSpeech, config, ChatHandler,
         PlayerPopupMenu, Quest, QuestData, QuestHandler, AchievementHandler, UserAlarm,
         EquipmentHandler, InventoryHandler, InventoryDialog, ShortcutHandler, BankHandler, SocialHandler,
         LeaderboardHandler, SettingsHandler, StoreHandler,
         SkillHandler, SkillData,
         StatDialog, SkillDialog,
         ConfirmDialog, NotifyDialog, StoreDialog, AuctionDialog, CraftDialog,
         BankDialog, GamePad) {
        var Game = Class.extend({
            init: function(app) {
                var self = this;

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

                this.mapNames = ["map0", "map1"];

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

            },

            setSpriteJSON: function () {

              sprites = this.spriteJSON.sprites;
              //this.spriteNames = this.spriteJSON.getSpriteList();
              this.loadSprites();
              this.spritesReady = true;
            },

// TODO - Revise.
            setup: function(input) {
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
            },

            setChatInput: function(element) {
                this.chatinput = element;
            },

            initPlayer: function() {
                this.app.initTargetHud();

                this.player.respawn();

                this.camera.entities[this.player.id] = this.player;
                this.camera.outEntities[this.player.id] = this.player;

                log.debug("Finished initPlayer");
            },

            initCursors: function() {
                var sprite = this.sprites["cursors"];
                var target = this.sprites["target"];

                sprite.container = Container.HUD;
                target.container = Container.HUD;
                var pjsSprite = this.renderer.createSprite(sprite);
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
            },

            initAnimations: function() {
                this.targetAnimation = new Animation("idle_down", 0, 4, 0, 16, 16);
                this.targetAnimation.setSpeed(50);
            },

            loadSprite: function(data) {
              this.spritesets[0][data.id] = new Sprite(data, 2, Container.ENTITIES);
            },

            setSpriteScale: function(scale) {
              var self = this;

              _.each(this.entities, function(entity) {
                   try {
                     if (entity !== game.player)
                     {
                        var sprite = self.sprites[entity.getSpriteName()];
                        if (sprite)
                   	      entity.setSprite(sprite);
                     }
                   }
                   catch (e) {}
              });
            },

            loadSprites: function() {
                log.info("Loading sprites...");
                this.spritesets = [];
                this.spritesets[0] = {};
                this.sprites = this.spritesets[0];

                var sprite = null;
                for (var key in sprites) {
                  sprite = sprites[key];
                  this.loadSprite(sprite);
                }
                this.setSpriteScale(this.renderer.scale);
            },

            setCursor: function(name, orientation) {
                if(name in this.cursors) {
                    this.currentCursor = this.cursors[name];
                    this.currentCursor.setAnimation(name);
                    this.currentCursorOrientation = orientation;
                } else {
                    log.error("Unknown cursor name :"+name);
                }
            },

            updateCursorLogic: function() {

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
            },

            addEntity: function(entity) {
                var self = this;

                this.entities[entity.id] = entity;
                this.updateCameraEntity(entity.id, this.entities[entity.id]);
            },

            removeEntity: function(entity) {
                if (this.npc[entity.id])
                  delete this.npc[id];

                if(entity.id in this.entities) {
                    var id = entity.id;
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
            },

            addItem: function(item) {
                if (this.items)
                {
                  this.items[item.id] = item;
                  this.addEntity(item);
                }
                else {
                  console.warn("TODO: Cannot add item. Unknown ID : " + item.id);
                }
            },

            removeItem: function(item) {
                if(item) {
                    this.removeFromItems(item);
                    var id = item.id;
                    this.removeEntity(item);
                } else {
                    log.error("Cannot remove item. Unknown ID : " + item.id);
                }
            },

            removeFromItems: function(item) {
                if(item) {
                    delete this.items[item.id];
                }
            },

            initGrid: function() {
              this.camera.focusEntity = this.player;
              this.mapContainer.reloadMaps(true);
            },

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


            registerEntityPosition: function(entity) {
                var x = entity.gx,
                    y = entity.gy;

                if(entity) {
                    if(entity instanceof Item) {
                        this.itemGrid[y][x][entity.id] = entity;
                        this.items[entity.id] = entity;
                    }
                }
            },

            loadAudio: function() {
                this.audioManager = new AudioManager(this);
            },

            initMusicAreas: function() {
                var self = this;
                //_.each(this.map.musicAreas, function(area) {
                //    self.audioManager.addArea(area.x, area.y, area.w, area.h, area.id);
                //});
            },

            run: function(server, ps) {
            	  var self = this;

                this.player = user.createPlayer(ps);

                this.loadGameData();

                this.updater = new Updater(this);
                this.camera = this.renderer.camera;

                this.settingsHandler = new SettingsHandler(this);
                this.settingsHandler.apply();

                setTimeout(function () {
                    game.resize(game.zoom);
                },2000); // Slight Delay For On-Screen Keybaord to minimize.

                this.gamepad = new GamePad(this);




                this.gameFrame = 0;
                this.pGameFrame = -1;
                /*if (this.animFrame)
                  requestAnimFrame(this.render.bind(this));
                else {
                  this.renderTick = setInterval(this.render, G_UPDATE_INTERVAL);
                }*/
                this.gameInterval = setInterval(this.gametick.bind(self), G_UPDATE_INTERVAL);
                //this.renderInterval = setInterval(this.render.bind(self), G_UPDATE_INTERVAL);
                //this.renderTime = performance.now();
                this.runUpdateInRender = !this.renderer.mobile && !this.renderer.tablet;
            },

            /*render: function () {
              this.processRender = true;

              if (this.runUpdateInRender)
                this.updater.update();

              this.renderer.renderFrame();

              //if (this.animFrame)
                //requestAnimFrame(this.render.bind(this));

              this.processRender = false;
            },*/

            gametick: function() {
              var self = this;

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

              //if (!this.runUpdateInRender)
                this.updater.update();

        			if (this.mapStatus >= 2)
        			{
        				this.updateCursorLogic();
        			}

              this.renderer.renderFrame();

              this.processLogic = false;
            },

            start: function() {
              this.started = true;
              this.ready = true;
              this.hasNeverStarted = false;
              log.info("Game loop started.");
            },

            stop: function() {
                log.info("Game stopped.");
                this.isStopped = true;
            },

            entityIdExists: function(id) {
                return id in this.entities;
            },

            getEntityById: function(id) {
                if(this.entities && id in this.entities) {
                    return this.entities[id];
                }
                else if (this.items && id in this.items) {
                	return this.items[id];
                }
                //else {
                //    log.info("Unknown entity id : " + id, true);
                //}
            },

            getNpcByQuestKind: function(npcQuestId){
                for(var id in this.npc){
                    var entity = this.npc[id];
                    if(entity.npcQuestId === npcQuestId){
                        return entity;
                    }
                }
                return null;
            },

            getEntityByName: function(name){
                for(var id in this.entities){
                    var entity = this.entities[id];
                    if(entity.name.toLowerCase() === name.toLowerCase()){
                        return entity;
                    }
                }
                return null;
            },

            loadGameData: function() {
                var self = this;
                self.loadAudio();

                self.initMusicAreas();

                self.initCursors();
                self.initAnimations();

                self.setCursor("hand");

//                self.settingsHandler.apply();
            },

            teleportMaps: function(mapIndex, x, y)
            {
              var self = this;
              this.mapStatus = 0;
            	log.info("teleportMaps");
            	x = x || -1;
            	y = y || -1;

              if (this.mapContainer)
                this.mapContainer = null;
                //delete this.mapContainer;
              this.mapContainer = new MapContainer(this, mapIndex, this.mapNames[mapIndex]);

              this.mapContainer.ready(function () {
                  self.client.sendTeleportMap([mapIndex, 0, x, y]);
              });
            },

            onVersionGame: function(data) {
              this.versionChecked = true;
              var version = Number(data[0]);

              var local_version = Number(config.build.version_game);
              log.info("config.build.version_game="+local_version);
              if (version !== local_version)
              {
                $('#container').addClass('error');
                var errmsg = "Please download the new version of Land Of Mana.<br/>";

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
            },

            onWorldReady: function (data) {
              var username = data[0];
              var playername = data[1];
              var hash = data[2];
              var protocol = data[3];
              var host = data[4];
              var port = data[5];

              var url = protocol + "://"+ host +":"+ port +"/";

              // Game Client takes over the processing of Messages.
              game.client = new GameClient();

              game.client.callbacks = new ClientCallbacks(game.client);
              game.client.setHandlers();

              game.client.connect(url, [playername,hash]);
            },

            onPlayerLoad: function (player) {
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
              game.renderer.resetCombatHitBar();

              // START TUTORIAL SHOW CODE.
              if (player.level === 0)
              {
                var tutName = "["+lang.data["TUTORIAL"]+"]";
                for (var i = 1; i <= 5; ++i)
                {
                  var j = 1;
                  setTimeout(function () {
                    var tutData = lang.data["TUTORIAL_"+(j++)];
                    game.chathandler.addGameNotification(tutName, tutData);
                  }, (12500 * i));
                }
              }
            },

            teleportFromTown: function (player) {
              var p = player;
              if (p.mapIndex === 0 && (p.gx>=63 && p.gx<=65) && (p.gy>=70 && p.gy<=72))
              {
                this.teleportMaps(1);
              }
            },

            addPlayerCallbacks: function (player) {
              var self = this;

              self.player = player;

              self.player.onStartPathing(function(path) {
                  var i = path.length - 1,
                      x =  path[i][0],
                      y =  path[i][1];

                  /*if(self.player.isMovingToLoot()) {
                      self.player.isLootMoving = false;
                  }*/
              });

              self.player.onKeyMove(function(sentMove) {
                var p = self.player;
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

              self.player.onAbortPathing(function(x, y) {
                var p = self.player;
                self.client.sendMoveEntity(p, 2);
              });

              var checkTeleport = function (p, x, y)
              {
                self.teleportFromTown(p);

                var dest = self.mapContainer.getDoor(p);
                if(!p.hasTarget() && dest) {
                    // Door Level Requirements.
                    var msg;
                    var notification;
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
                    p.forceStop();
                    //self.teleportMaps(dest.map, dest.x, dest.y, dest.difficulty);

                    //self.updatePlateauMode();

                    if(dest.portal) {
                        self.audioManager.playSound("teleport");
                    }

                }
              };

              self.player.onStopPathing(function(x, y) {
                  var p = self.player;
                  log.info("onStopPathing");

                	if (p.isDead)
                      return;

                  self.client.sendMoveEntity(p, 2);
                  /*if(self.isItemAt(x, y)) {
                      var items = self.getItemsAt(x, y);

                      try {
                          self.client.sendLoot(items);
                      } catch(e) {
                          throw e;
                      }
                  }*/
                  //p.targetIndex = 0;
                  log.info("onStopPathing - 1")
                  if (p.hasTarget())
                    p.lookAtEntity(p.target);
                  else {
                    log.info("onStopPathing - NO TARGET!")
                  }
                  log.info("onStopPathing - 2")

                  checkTeleport(p, x, y);

                  if(p.target instanceof NpcStatic || p.target instanceof NpcMove) {
                      self.makeNpcTalk(p.target);
                  } else if(p.target instanceof Chest) {
                      self.client.sendOpen(p.target);
                      self.audioManager.playSound("chest");
                  }
              });

              self.player.onRequestPath(function(x, y) {
                var p = self.player;
              	var ignored = [p]; // Always ignore self
              	var included = [];

                  if(p.hasTarget() && !p.target.isDead) {

                      ignored.push(p.target);
                  }

                  var path = self.findPath(p, x, y, ignored);

                  if (path && path.length > 0)
                  {
                    var orientation = p.getOrientationTo([path[1][0],path[1][1]]);
                    p.setOrientation(orientation);
                    self.client.sendMovePath(p,
                      path.length,
                      path);
	                }
                  return path;
              });

              self.player.onDeath(function() {
                  log.info(self.playerId + " is dead");
                  var p = self.player;

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

            },

            connected: function (server) {
              var self = this;

              if (this.hasServerPlayer)
              {
                if(this.client.connectgame_callback) {
                  this.client.connectgame_callback();
                }
                return;
              }

              this.client.connection.send("startgame,"+server);
              this.hasServerPlayer = true;
            },

            /**
             * Converts the current mouse position on the screen to world grid coordinates.
             * @returns {Object} An object containing x and y properties.
             */
            getMouseGridPosition: function() {
                return {x: this.mouse.gx, y: this.mouse.gy};
            },

            getMousePosition: function() {
          	    var r = this.renderer,
                  c = this.camera,
          	      mx = this.mouse.x,
                  my = this.mouse.y;
                //var sox = c.sox,
                //    soy = c.soy;
                // var ts = this.tilesize;

                mx = ~~(mx + c.x);
                my = ~~(my + c.y);

                this.mouse.gx = ~~(mx / G_TILESIZE);
                this.mouse.gy = ~~(my / G_TILESIZE);

                return { x: mx, y: my};
            },

            /**
             * Moves a character to a given location on the world grid.
             *
             * @param {Number} x The x coordinate of the target location.
             * @param {Number} y The y coordinate of the target location.
             */
            makeCharacterGoTo: function(character, x, y) {
                if(!this.map.isColliding(x,y) && !character.isDead)
                {
                    character.go(x, y);
                }
            },

            makePlayerInteractNextTo: function()
            {
              var p = this.player;

              if (p.isDying || p.isDead)
                return;

              var fnIsDead = function (entity) {
                return entity && (entity.isDying || entity.isDead);
              }

              var fnIsIgnored = function (entity) {
                if (fnIsDead(entity))
                  return true;
                return (entity.type === Types.EntityTypes.NPCSTATIC ||
                    entity.type === Types.EntityTypes.NPCMOVE ||
                    entity.type === Types.EntityTypes.PLAYER ||
                    entity.type === Types.EntityTypes.NODE);
              };

              var processTarget = function () {
                var pos = p.nextTile();
                var target = p.target;
                if (fnIsDead(target)) {
                  p.clearTarget();
                  return false;
                }

                game.processInput(pos[0], pos[1], true);
                return true;
              };

              var entity = p.dialogueEntity;
              if (entity && game.camera.isVisible(entity) && p.isFacingEntity(entity)) {
                game.showDialogue();
                return;
              }

              log.info("makePlayerInteractNextTo");
              //var ts = this.tilesize;

              this.ignorePlayer = true;

              var target = p.target;
              if (target && p.isNextTooEntity(target) && p.isFacingEntity(target)) {
                if (processTarget()) return;
              }

              // If the player is next to and facing a Harvest Tile.
              var pos = p.nextTile();
              var type = p.getWeaponType();
              if (type !== null) {
                var gpos = Utils.getGridPosition(pos[0], pos[1]);
                if (this.mapContainer.isHarvestTile(gpos, type)) {
                  game.processInput(pos[0], pos[1], true);
                  return;
                }
              }

              entity = this.getEntityAt(pos[0], pos[1]);
              if (entity && entity !== p && !fnIsDead(entity)) {
                p.setTarget(entity);
                if (p.hasTarget() && processTarget()) return;
              }

              if (target && fnIsIgnored(target)) {
                p.clearTarget();
              }

              if (target && !game.camera.isVisible(target)) {
                p.clearTarget();
              }

              if (target && p.isNextTooEntity(target)) {
                if (p.isMoving())
                  p.forceStop();
                p.lookAtEntity(target);
                if (processTarget()) return;
              }

              entity = p.target;
              p.targetIndex = 0;
              this.playerTargetClosestEntity(0);
              if (entity != p.target)
                return;

              processTarget();
              this.ignorePlayer = false;
            },

            /**
             * Moves the current player to a given target location.
             * @see makeCharacterGoTo
             */
            makePlayerGoTo: function(x, y) {
                this.player.go(x, y);
            },

            /**
             * Moves the current player towards a specific item.
             * @see makeCharacterGoTo
             */
            makePlayerGoToItem: function(item) {
                var p = this.player;
                if (!item) return;
                if (!p.isWithinDistEntity(item, 24)) {
                  p.follow(item);
                  //this.player.isLootMoving = true;
                } else {
                  this.client.sendLootMove(item);
                }
            },

            makePlayerAttack: function(entity) {
              var p = this.player;
              var skillId = (p.attackSkill) ? p.attackSkill.skillId : -1;
              var time = this.currentTime;
              var res = p.makeAttack(entity);
              if (!res) {
                log.info("CANNOT ATTACK.");
                return false;
              }
              else if (res === "attack_toofar") {
                this.chathandler.addNotification(lang.data["ATTACK_TOOFAR"]);
                return false;
              }
              else if (res === "attack_outoftime") {
                log.info("CANNOT ATTACK DUE TO TIME.");
                return false;
              }
              else if (res === "attack_ok") {
                this.client.sendAttack(p, p.target, skillId);
                this.audioManager.playSound("hit"+Math.floor(Math.random()*2+1));

                p.attackCooldown.duration = 1000;
                p.attackCooldown.lastTime = time;
                game.renderer.resetCombatHitBar();
                return true;
              }
              return false;
            },

            /**
             *
             */
            makeNpcTalk: function(npc) {
            	var msg;

              if (!npc) return;

              if (!game.player.isWithinDistEntity(npc, 24)) {
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
            },

            showDialogue: function () {
              var self = this;
              var p = game.player;
              var entity = p.dialogueEntity;

              var hasFinished = function () {
                clearTimeout(game.destroyMessageTimeout);
                game.destroyMessage();
                self.npcText.html("");
                self.dialogueWindow.hide();
                game.userAlarm.hide();

                if (!entity)
                  return;

                var data = entity.dialogue[entity.dialogueIndex-1];
                if (data && data.length === 3) {
                  var action = data[2];
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
            },

            createMessage: function () {
              var p = this.player;
              var entity = p.dialogueEntity;
              if (!entity)
                return;

              if (!(entity.dialogueIndex < entity.dialogue.length))
                return;

              var data = entity.dialogue[entity.dialogueIndex];
              var msgEntity = (data[0] === 0) ? entity : game.player;
              var msg = data[1];
              if (!entity || !msg)
                return;

              this.bubbleManager.create(msgEntity, msg);
              this.audioManager.playSound("npc");
              if (data[0] === 0) {
                this.chathandler.addNormalChat({name: "[NPC] "+msgEntity.name}, msg);
                this.npcText.html(msgEntity.name + ": " + msg);
              } else {
                game.chathandler.addNormalChat(p, msg);
                this.npcText.html(p.name + ": " + msg);
              }
              game.app.npcDialoguePic(msgEntity);
              this.dialogueWindow.show();
            },

            destroyMessage: function () {
              var entity = this.player.dialogueEntity;
              if (!entity)
                return;

              if (entity.dialogue) {
                if (!(entity.dialogueIndex < entity.dialogue.length))
                  return;

                var data = entity.dialogue[entity.dialogueIndex];
                var msgEntity = (data[0] === 0) ? entity : game.player;
                this.bubbleManager.destroyBubble(msgEntity.id);
              }

              this.audioManager.playSound("npc-end");
              this.npcText.html("");
              this.dialogueWindow.hide();
            },

            /**
             * Loops through all the entities currently present in the game.
             * @param {Function} callback The function to call back (must accept one entity argument).
             */
            forEachEntity: function(callback, cond) {
                /*_.each(this.entities, function(entity) {
                    callback(entity);
                });*/
                cond = cond || function (e) { return true; };
                for (var id in this.entities) {
                  var entity = this.entities[id];
                  if (cond(entity))
                    callback(entity);
                }
            },

            /**
             * Same as forEachEntity but only for instances of the Mob subclass.
             * @see forEachEntity
             */
            forEachMob: function(callback) {
                var cond = function (e) { return e.type === Types.EntityTypes.MOB; };
                this.forEachEntity(callback, cond);
                /*_.each(this.entities, function(entity) {
                    if(entity instanceof Mob) {
                        callback(entity);
                    }
                });*/
            },

            /**
             *
             */
            forEachVisibleTileIndex: function(callback) {
                var self = this;
          			this.camera.forEachVisibleValidPosition(function(x, y) {
                    var index = self.mapContainer.GridPositionToTileIndex(x, y);
          			    callback(index, x, y);
          			});
            },

            /**
             *
             */
            forEachVisibleTile: function(callback) {
                var self = this,
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
            },

            /**
             *
             */
            forEachAnimatedTile: function(callback) {
                if(this.animatedTiles) {
                    _.each(this.animatedTiles, function(tile) {
                        callback(tile);
                    });
                }
            },

            getEntitiesAround: function(x, y, ts) {
              ts = ts || G_TILESIZE;
              var pos = [[x+ts,y],[x-ts,y],[x,y+ts],[x,y-ts]];
              var entity = null;
              var entities = [];
              for (var p of pos) {
                entity = this.getEntityAt(p[0],p[1]);
                if (entity)
                  entities.push(entity);
              }
              return entities;
            },

            /**
             * Returns the entity located at the given position on the world grid.
             * @returns {Entity} the entity located at (x, y) or null if there is none.
             */
            getEntityAt: function(x, y) {
                if(!this.mapContainer.mapLoaded)
            	    return null;

                //log.info("getEntityAt:");
                var entities = this.camera.entities,
                    len = Object.keys(entities).length;

                //log.info("x:"+x+",y:"+y);
                if(len > 0) {
                  var entity = null;
                  //var pos = {x:x,y:y};
                  for (var k in entities) {
                      entity = entities[k];
                      if (!entity) continue;

                      //log.info("x2:"+entity.x+",y2:"+entity.y);
                      if (entity.isOverPosition(x,y))
                        return entity;
                  }
                }
                return null;
            },

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

            getMobAt: function(x, y) {
                var entity = this.getEntityAt(x, y);
                if(entity && entity instanceof Mob) {
                    return entity;
                }
                return null;
            },

            getPlayerAt: function(x, y) {
                var entity = this.getEntityAt(x, y);
                if(entity && (entity instanceof Player) && (entity !== this.player)) {
                    return entity;
                }
                return null;
            },

            getNpcAt: function(x, y) {
                var entity = this.getEntityAt(x, y);
                if(entity && (entity instanceof NpcMove || entity instanceof NpcStatic)) {
                    return entity;
                }
                return null;
            },

            getChestAt: function(x, y) {
                var entity = this.getEntityAt(x, y);
                if(entity && (entity instanceof Chest)) {
                    return entity;
                }
                return null;
            },

            getItemAt: function(x, y) {
                if(this.mapContainer.isOutOfBounds(x, y) || !this.itemGrid || !this.itemGrid[y]) {
                    return null;
                }
                var items = this.itemGrid[y][x],
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
            },

            getItemsAt: function(x, y) {
                if(this.map.isOutOfBounds(x, y) || !this.itemGrid || !this.itemGrid[y]) {
                    return null;
                }
                var items = this.itemGrid[y][x];

                return items;
            },

            /**
             * Returns true if an entity is located at the given position on the world grid.
             * @returns {Boolean} Whether an entity is at (x, y).
             */
            isEntityAt: function(x, y) {
                return !_.isNull(this.getEntityAt(x, y));
            },

            isMobAt: function(x, y) {
                return !_.isNull(this.getMobAt(x, y));
            },
            isPlayerAt: function(x, y) {
                return !_.isNull(this.getPlayerAt(x, y));
            },

            isItemAt: function(x, y) {
                return !_.isNull(this.getItemAt(x, y));
            },

            isNpcAt: function(x, y) {
                return !_.isNull(this.getNpcAt(x, y));
            },

            isChestAt: function(x, y) {
                return !_.isNull(this.getChestAt(x, y));
            },

            /**
             * Finds a path to a grid position for the specified character.
             * The path will pass through any entity present in the ignore list.
             */
            findPath: function(character, x, y, ignoreList, includeList) {

                var self = this,
                    path = [],
                    isPlayer = (character === this.player);

                var mc = this.mapContainer;
                if (!mc || !mc.gridReady)
                  return null;

                if (this.mapStatus < 2)
                	return null;

                log.info("PATHFINDER CODE");

                if(this.pathfinder && character)
                {

                    var ts = G_TILESIZE;
                    var grid = this.mapContainer.collisionGrid;
                    if (!grid) {
                      console.error("game.js findPath: grid not ready for pathing.")
                      return null;
                    }

                    var c = this.camera;

                    var pS = c.getGridPos([character.x, character.y]);
                    if (mc.isColliding(character.x, character.y))
                    {
                      log.info("pathfind - isColliding start.");
                      return null;
                    }
                    var pE = c.getGridPos([x, y]);
                    if (mc.isColliding(x, y))
                    {
                      log.info("pathfind - isColliding end.");
                      return null;
                    }

                    log.info("pS[0]="+pS[0]+",pS[1]="+pS[1]);
                    log.info("pE[0]="+pE[0]+",pE[1]="+pE[1]);

                    if (pS[0] === pE[0] && pS[1] === pE[1])
                      return null;

                    var lx = grid[0].length;
                    var ly = grid.length;
                    if (pS[0] < 0 || pS[0] >= lx || pS[1] < 0 || pS[1] >= ly ||
                        pE[0] < 0 || pE[0] >= lx || pE[1] < 0 || pE[1] >= ly)
                    {
                        log.error("path cordinates outside of dimensions.");
                        log.error(JSON.stringify([pS, pE]));
                        return null;
                    }

                    var shortGrid = this.pathfinder.getShortGrid(grid, pS, pE, 3);
                    var sgrid = shortGrid.crop;
                    var spS = shortGrid.substart;
                    var spE = shortGrid.subend;
                    var path = null;

                    path = this.pathfinder.findDirectPath(sgrid, spS, spE);

                    if (!path) {
                      var lx = grid[0].length;
                      var ly = grid.length;
                      if (pS[0] < 0 || pS[0] >= lx || pS[1] < 0 || pS[1] >= ly ||
                          pE[0] < 0 || pE[0] >= lx || pE[1] < 0 || pE[1] >= ly)
                      {
                              log.error("short path cordinates outside of dimensions.");
                              log.error(JSON.stringify([pS, pE]));
                              return null;
                      }
                      log.info("using short path finder.");
                      path = this.pathfinder.findShortPath(sgrid,
                        shortGrid.minX, shortGrid.minY, spS, spE);
                      if (path)
                        log.info("validpath-mp4:"+JSON.stringify(path));
                    }

                    if (!path) {
                      log.info("using long path finder.");
                      path = this.pathfinder.findPath(grid, pS, pE, false);
                      if (path)
                        log.info("validpath-mp5:"+JSON.stringify(path));
                    }

                    if (path)
                    {
                      //log.info("path_result: "+JSON.stringify(path));
                      var dx = character.x - spS[0]*ts;
                      var dy = character.y - spS[1]*ts;

                      for (var node of path)
                      {
                        node[0] = ~~(node[0]*ts+dx);
                        node[1] = ~~(node[1]*ts+dy);
                      }
                      // NOT NEEDED.
                      //path = this.pathfinder.compressPath(path);

                      log.info("path_result2: "+JSON.stringify(path));
                      if (!(path[0][0] === (character.x) && path[0][1] === (character.y)))
                      {
                        log.error("player path start co-ordinates mismatch.");
                        log.error("path start coordinate: "+path[0][0]+","+path[0][1]);
                        log.error("player start coordinate: "+character.x+","+character.y);
                        return null;
                      }
                    }
                } else {
                    log.error("Error while finding the path to "+x+", "+y+" for "+character.id);
                }
                return path;
            },

            /**
             *
             */
            movecursor: function() {
                var pos = this.getMousePosition();
                var x = pos.x, y = pos.y;

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
                        var entity = this.getEntityAt(x, y);
                        if (!entity) return;

                        this.player.showTarget(entity);
                        this.lastHovered = entity;
                    }
                }
            },

            /**
             * Moves the player one space, if possible
             */
            moveCharacter: function(char, x, y, skipOverlap) {
              skipOverlap = skipOverlap || false;
              var res = true;

              if (res && char.orientation === Types.Orientations.NONE)
                res = false;

              if (res && this.mapContainer.isColliding(x, y))
                res = false;


              if (res && char instanceof Player) {
                var block = char.holdingBlock;
                var tile = char.nextTile(x, y);
                if (block && this.mapContainer.isColliding(tile[0], tile[1]))
                  res = false;
              }

              if (res && !skipOverlap && this.isOverlapping(char, x, y)) {
                //console.warn("this.isOverlapping("+char.id+","+x+","+y+")");
                res = false;
              }

              /*if (!res && char === this.player) {
                char.forceStop();
              }*/

              return res;
            },

            isOverlapping: function(entity, x, y) {
                var entities = this.camera.entities;

                for (var k in entities) {
                  var entity2 = entities[k];
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

                  if (!entity2.isNextTooEntity(entity) &&
                      entity2.isNextTooPosition(x, y))
                    return true;
                }
                return false;
            },

            playerTargetClosestEntity: function (inc) {
              var p = this.player;
              if (!p.hasOwnProperty("targetIndex"))
                p.targetIndex = 0;

              var excludeTypes = [Types.EntityTypes.NODE, Types.EntityTypes.PLAYER];
              if (game.mapContainer.mapIndex !== 0)
              {
                excludeTypes = excludeTypes.concat([Types.EntityTypes.NPCMOVE, Types.EntityTypes.NPCSTATIC]);
              }
              var entity = this.entityTargetClosestEntity(p, inc, p.targetIndex, excludeTypes);
              if (!entity)
                return false;

              p.setTarget(entity);
              return true;
            },

            entityTargetClosestEntity: function (entity, inc, index, excludeTypes) {
              //var self = this;
              //var ts = this.tilesize;
              //var cm = this.camera;

              index = index || 0;

              var entities = Utils.objectToArray(this.camera.entities);
              entities = entities.filter(entity => !(excludeTypes.includes(entity.type) || entity.isDying || entity.isDead));

              for (var entity2 of entities) {
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
            },

            click: function() {
                var pos = this.getMousePosition();
                var p = game.player;

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

                for (var dialog of this.dialogs) {
                  if (dialog.visible)
                    dialog.hide();
                }

                var entity = this.getEntityAt(pos.x, pos.y);
                if (p.setTarget(entity))
                  return;

                this.processInput(pos.x,pos.y);
                this.clickMove = false;
            },

            rightClick: function() {
              // TODO Might have some use later.
            },

            /**
             * Processes game logic when the user triggers a click/touch event during the game.
             */
             processInput: function(px, py) {
               //var pos = {};
               var ts = this.tilesize;
               var p = this.player;

              //log.info("processInput - x:"+pos.x+",y:"+pos.y);

              if (!this.started || !this.player || this.player.isDead)
                  return;

              px = px.clamp(0, this.mapContainer.widthX);
              py = py.clamp(0, this.mapContainer.heightY);

            	///log.info("x="+pos.x+",y="+pos.y);

              var entity = p.hasTarget() ?
                p.target : this.getEntityAt(px, py);

              if (!entity && this.renderer.mobile) {
                var entities = this.getEntitiesAround(px, py, 16);
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
                var colliding = this.mapContainer.isColliding(px,py);
                if (colliding && p.isNextTooPosition(px, py)) {
                    // Start hit animation and send to Server harvest packet.
                    this.makePlayerHarvest(px, py);
                    return;
                }

                if (this.clickMove)
                  this.clickMoveTo(px, py);
              }
            },

            playerInteract: function (entity)
            {
              var p = this.player;
              if (!entity)
                return;

              if (entity && !p.hasTarget() && !entity.isDying )
              {
                p.setTarget(entity);
              }
              if (p.isNextTooEntity(entity))
                p.lookAtEntity(entity);
              log.info("player target: "+p.target.id);

              if (entity instanceof Block && p.isNextTooEntity(entity) &&
                p.isFacingEntity(entity))
              {
                var block = entity;
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
                  this.makePlayerHarvestEntity(entity);
              }
              else if(entity instanceof Chest)
              {
                  this.makePlayerOpenChest(entity);
              }

            },

            makePlayerHarvestEntity: function (entity) {
              var p = this.player;

              if (!p.isNextTooEntity(entity)) {
                p.follow(entity);
                return;
              }

              if (!p.hasHarvestWeapon(entity.weaponType)) {
                game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", entity.weaponType]);
                return;
              }

              p.lookAtEntity(entity);
              p.harvestOn(entity.weaponType);

              this.client.sendHarvestEntity(entity);
            },

            makePlayerHarvest: function (px, py) {
              var p = this.player;

              if (!p.hasHarvestWeapon()) {
                game.showNotification(["CHAT", "HARVEST_NO_WEAPON"]);
                return;
              }

              var type = p.getWeaponType();
              if (type === null) {
                game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
                return;
              }

              var gpos = Utils.getGridPosition(px, py);
              if (!this.mapContainer.isHarvestTile(gpos, type)) {
                game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
                return;
              }

              p.lookAtTile(px, py);
              p.harvestOn(type);

              this.client.sendHarvest(px, py);
            },

            clickMoveTo: function (px, py) {
              //var self = this;
              log.info("makePlayerGoTo");
              //var tsh = G_TILESIZE >> 1;
              //var ts = game.tilesize;

              //log.info("so:"+so[0]+","+so[1]);
              var p = this.player;

              var colliding = this.mapContainer.isColliding(px,py);

              //var tpos = {x: pos.x, y: pos.y};
              if (colliding)
              {
                var x = p.x - px;
                var y = p.y - py;

                var o1 = (x < 0) ? Types.Orientations.LEFT : Types.Orientations.RIGHT;
                var o2 = (y < 0) ? Types.Orientations.UP : Types.Orientations.DOWN;
                var o = (Math.abs(x) > Math.abs(y)) ? o1 : o2;

                var orientations = [1,2,3,4];
                orientations.splice(orientations.indexOf(o), 1);
                orientations.unshift(o);

								if (!this.mapContainer.isColliding(px,py))
                {
									this.makePlayerGoTo(px, py);
                  return;
                }
              }
              else {
                  this.makePlayerGoTo(px, py);
              }
            },


            /*speakToNPC: function (entity) {
              var p = this.player;
              if (!p.isWithinDistEntity(entity, 24))
                p.follow(entity);
      				else
      					this.makeNpcTalk(entity);
            },*/

            updateCameraEntity: function(id, entity)
            {
              //log.info(id+ " updateCameraEntity");
              var self = this;
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

            },

            say: function(message) {
                //All commands must be handled server sided.
                if(!this.chathandler.processSendMessage(message)){
                    this.client.sendChat(message);
                }

            },

            respawnPlayer: function() {
                log.debug("Beginning respawn");

                this.player.revive();

                this.updateBars();

                //this.addEntity(p);
                this.initPlayer();

                this.started = true;
                //this.client.enable();
                this.client.sendPlayerRevive();

                log.debug("Finished respawn");
            },

            onGameStart: function(callback) {
                this.gamestart_callback = callback;
            },

            onClientError: function(callback) {
                this.clienterror_callback = callback;
            },

            onDisconnect: function(callback) {
                this.disconnect_callback = callback;
            },

            onPlayerDeath: function(callback) {
                this.playerdeath_callback = callback;
            },

            onUpdateTarget: function(callback){
                this.updatetarget_callback = callback;
            },
            onPlayerExpChange: function(callback){
                this.playerexp_callback = callback;
            },

            onPlayerHealthChange: function(callback) {
                this.playerhp_callback = callback;
            },

            onPlayerEnergyChange: function(callback) {
                this.playerep_callback = callback;
            },

            onBarStatsChange: function(callback) {
                this.barstats_callback = callback;
            },


            onPlayerHurt: function(callback) {
                this.playerhurt_callback = callback;
            },

            onNotification: function(callback) {
                this.notification_callback = callback;
            },

            resize: function(zoomMod) {
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
            },

            updateBars: function() {
                if(this.player && this.playerhp_callback && this.playerep_callback) {
                    this.playerhp_callback(this.player.stats.hp, this.player.stats.hpMax);
                    this.playerep_callback(this.player.stats.ep, this.player.stats.epMax);
                }
            },

            updateExpBar: function(){
                if(this.player && this.playerexp_callback){
                    var level = this.player.level;
                    var exp = this.player.exp.base;
                    this.playerexp_callback(level, exp);
                }
            },

            showNotification: function(data) {
                var group = data.shift();
                var text = data.shift();

                var message = lang.data[text];
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
            },

            removeObsoleteEntities: function() {
                var entities = game.entities;
                var p = game.player;
                var entity = null;
                for (var id in entities) {
                  entity = entities[id];
                  if (entity)
                    continue;
                  if (Math.abs(p.x - entity.x) > 64 || Math.abs(p.y - entity.y) > 64)
                    this.obsoleteEntities.push(entity);
                }

                var nb = _.size(this.obsoleteEntities),
                    self = this,
                    delist = [];

                if(nb > 0) {
                	for (var i=0; i < self.removeObsoleteEntitiesChunk; ++i)
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
            },

            /**
             * Fake a mouse move event in order to update the cursor.
             *
             * For instance, to get rid of the sword cursor in case the mouse is still hovering over a dying mob.
             * Also useful when the mouse is hovering a tile where an item is appearing.
             */
            updateCursor: function() {
                this.movecursor();
                this.updateCursorLogic();
            },

            forEachEntityRange: function(gx, gy, r, callback) {
                this.forEachEntity(function(e) {
        					if (e.gx >= gx-r && e.gx <= gx+r &&
        						e.gy >= gy-r && e.gy <= gy+r)
        					{
        						callback(e);
        					}
                });
            },
        });

        return Game;
});

// TODO - Overlapping Block Monsters is not working!!!.
