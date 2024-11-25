
/* global Types, log, _, self, Class, CharacterDialog, localforage */

define(['text!../shared/data/sprites.json', 'lib/localforage', 'infomanager', 'bubble',
        'renderer', 'map', 'mapcontainer', 'animation', 'sprite', 'sprites', 'tile',
        'gameclient', 'clientcallbacks', 'audio', 'updater',
        'pathfinder', 'entity/entity', 'entity/item', 'data/items', 'data/itemlootdata', 'data/appearancedata', 'dialog/appearancedialog',
        'entity/mob', 'entity/npcstatic', 'entity/npcmove', 'data/npcdata', 'entity/player', 'entity/character', 'entity/chest', 'entity/block', 'entity/node',
        'data/mobdata', 'data/mobspeech', 'exceptions', 'config', 'chathandler',
        'playerpopupmenu', 'classpopupmenu', 'quest', 'data/questdata', 'questhandler', 'achievementhandler', 'useralarm',
        'equipmenthandler', 'inventoryhandler', 'shortcuthandler', 'bankhandler', 'socialhandler',
        'leaderboardhandler', 'settingshandler','storehandler','bools',
        'skillhandler', 'data/skilldata',
        'dialog/statdialog', 'dialog/skilldialog',
        'dialog/confirmdialog', 'dialog/notifydialog', 'dialog/storedialog', 'dialog/auctiondialog', 'dialog/craftdialog',
        'dialog/bankdialog', 'gamepad'],

function(spriteNamesJSON, localforage, InfoManager, BubbleManager,
        Renderer, Map, MapContainer, Animation, Sprite, Sprites, AnimatedTile,
         GameClient, ClientCallbacks, AudioManager, Updater,
         Pathfinder, Entity, Item, Items, ItemLoot, AppearanceData, AppearanceDialog,
         Mob, NpcStatic, NpcMove, NpcData, Player, Character, Chest, Block, Node,
         MobData, MobSpeech, Exceptions, config, ChatHandler,
         PlayerPopupMenu, ClassPopupMenu, Quest, QuestData, QuestHandler, AchievementHandler, UserAlarm,
         EquipmentHandler, InventoryHandler, ShortcutHandler, BankHandler, SocialHandler,
         LeaderboardHandler, SettingsHandler, StoreHandler, Bools,
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
                this.currentTime = getTime();

                this.cursors = {};

                this.sprites = {};

                // tile animation
                this.animatedTiles = null;

                this.dialogs = [];
                this.statDialog = new StatDialog();
                this.skillDialog = new SkillDialog();
                this.equipmentHandler = new EquipmentHandler(this);
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

                this.classPopupMenu = new ClassPopupMenu(this);
                this.inventoryHandler = new InventoryHandler(this);
                this.inventory = this.inventoryHandler;
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
                else if (this.currentCursor.currentAnimation.name != "hand") {
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
                if(entity.id in this.entities) {
                    var id = entity.id;
                    if (this.player.target == entity) {
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

                game.player = user.createPlayer(ps);

                this.loadGameData();

                this.updater = new Updater(this);
                this.camera = this.renderer.camera;

                //self.renderer.resizeCanvases();

                setTimeout(function () {
                    self.renderer.rescale();
                    self.renderer.resizeCanvases();
                },1500); // Slight Delay For On-Screen Keybaord to minimize.


                game.gamepad = new GamePad(self);

                this.gameTick = setInterval(self.tick, G_UPDATE_INTERVAL);

                if (this.animFrame)
                  requestAnimFrame(this.render.bind(this));
                else {
                  this.renderTick = setInterval(this.render, G_UPDATE_INTERVAL);
                }
            },

            render: function () {
              var self = game;

              self.renderer.renderFrame();

              if (self.animFrame)
                requestAnimationFrame(self.render.bind(self));
            },

            tick: function() {
              var self = game;

              self.currentTime = getTime();

              if (!self.started || self.isStopped) {
                return;
              }

              self.updateTime = self.currentTime;

              if (self.gamepad)
                self.gamepad.interval();

              self.updater.update();

        			if (self.mapStatus >= 2)
        			{
        				self.updateCursorLogic();
        			}
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

            getNpcByQuestId: function(questId){
                for(var id in this.entities){
                    var entity = this.entities[id];
                    if(entity.hasOwnProperty("questId") && entity.questId == questId){
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

            onPlayerLoad: function (player) {
              game.settingsHandler = new SettingsHandler(game, game.app);
              game.settingsHandler.apply();

              // Game Client takes over the processing of Messages.
              game.client = new GameClient(game, user.client);

              game.client.callbacks = new ClientCallbacks(game.client);
              game.client.setHandlers();

              log.info("Received player ID from server : "+ player.id);

              // Make zoning possible.
              //var ts = 4 * game.renderer.tilesize;
              setInterval(function() {
                if (game.mapStatus >= 2 &&
                    (/*(player.x % ts == 0 || player.y % ts == 0) ||*/
                     !player.isMoving()) && player.canObserve(game.currentTime))
                {
                    game.client.sendWho();

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

              var ts = game.tilesize;
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
              if (player.level.base == 0)
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
              if (p.mapIndex == 0 && (p.gx>=63 && p.gx<=65) && (p.gy>=70 && p.gy<=72))
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
                //f (p.sentMoving != sentMove) {
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

                    p.orientation = dest.orientation;

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

                  if(self.player.target instanceof NpcStatic || self.player.target instanceof NpcMove) {
                      self.makeNpcTalk(self.player.target);
                  } else if(self.player.target instanceof Chest) {
                      self.client.sendOpen(self.player.target);
                      self.audioManager.playSound("chest");
                  }
              });

              self.player.onRequestPath(function(x, y) {
              	var ignored = [self.player]; // Always ignore self
              	var included = [];

                  if(self.player.hasTarget() && !self.player.target.isDead) {

                      ignored.push(self.player.target);
                  }

                  var path = self.findPath(self.player, x, y, ignored);

                  if (path && path.length > 0)
                  {
                    self.player.orientation = self.player.getOrientationTo([path[1][0],path[1][1]]);
                    self.client.sendMovePath(self.player,
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

              var fnIsIgnored = function (entity) {
                if (entity && (entity.isDying || entity.isDead))
                  return true;
                return (entity.type == Types.EntityTypes.NPCSTATIC ||
                    entity.type == Types.EntityTypes.NPCMOVE ||
                    entity.type == Types.EntityTypes.PLAYER ||
                    entity.type == Types.EntityTypes.NODE);
              };

              var processTarget = function () {
                var pos = p.nextTile();
                var target = p.target;
                if (target && (target.isDying || target.isDead)) {
                  p.clearTarget();
                  return false;
                }

                game.processInput(pos[0], pos[1], true);
                return true;
              };

              var entity = p.dialogueEntity;
              if (entity && p.isNextTooEntity(entity) && p.isFacingEntity(entity)) {
                game.showDialogue();
                return;
              }

              if (p.isDying || p.isDead)
                return;

              log.info("makePlayerInteractNextTo");
              //var ts = this.tilesize;

              this.ignorePlayer = true;



              //var targetFound = false;

              var fnIsDead = function (entity) {
                return entity && (entity.isDying || entity.isDead);
              }

              var target = p.target;
              if (target && p.isNextTooEntity(target) && p.isFacingEntity(target)) {
                if (processTarget()) return;
              }

              var pos = p.nextTile();
              entity = this.getEntityAt(pos[0], pos[1]);
              if (entity && entity != p && !fnIsDead(entity)) {
                p.setTarget(entity);
                if (p.hasTarget() && processTarget()) return;
              }

              if (target && fnIsIgnored(target)) {
                p.clearTarget();
              }

              if (target && !game.camera.isVisible(target)) {
                p.clearTarget();
              }

              if (target && p.isNextToo(target)) {
                if (p.isMoving())
                  p.forceStop();
                p.lookAtEntity(target);
                if (processTarget()) return;
              }

              if (this.mapContainer.isColliding(pos[0], pos[1])) {
                p.clearTarget();
                this.processInput(pos[0], pos[1], true);
                return;
              }

              entity = null;
              var entities = Object.values(this.camera.entities);
              entities = entities.filter(entity => !fnIsIgnored(entity));

              var loopEntities = function (entities, fn) {
                for (var entity of entities) {
                  if (!entity || entity == p)
                    continue;

                  if (!p.isNextTooEntity(entity))
                    continue;

                  if (fn(p, entity)) {
                    return entity;
                  }
                }
                return null;
              };

              target = p.target;
              if (!target) {
                target = loopEntities(entities, function (p,e) {
                  return p.isNextTooEntity(e);
                });
              }

              if (target) {
                p.clearTarget();
                p.setTarget(target);
              }
              else {
                if (!p.hasTarget()) {
                  p.targetIndex = 0;
                }
                if (p.targetIndex == 0)
                {
                  this.playerTargetClosestEntity(1);
                  if (p.target && !p.isNextTooEntity(p.target))
                    return;
                }
              }

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
                if (!p.isNextTooEntity(item)) {
                  p.follow(item);
                  //this.player.isLootMoving = true;
                } else {
                  this.client.sendLootMove(item);
                }
            },

            /**
             *
             */
            makePlayerAttack: function(entity, spellId) {
              spellId = (spellId >= 0) ? spellId : -1;
              log.info("makePlayerAttack " + entity.id);
              var self = this;
              var time = this.currentTime;
              var p = this.player;

      				if (!p || p === entity || p.isDead || p.isDying) // sanity check.
      					return;

    					if (entity && entity.isDead)
    					{
    						p.removeTarget();
    						return;
    					}

              //if (p.isMoving())
                //p.forceStop();

              if (!p.canReach(p.target))
              {
                p.followAttack(p.target);

                if (p.isArcher())
                  this.chathandler.addNotification(lang.data["ATTACK_TOOFAR"]);

                log.info("CANNOT REACH TARGET!!");
                return;
              } else {
                if (p.isMoving())
                  p.forceStop();
                p.lookAtEntity(p.target);
              }
              log.info("CAN REACH TARGET!!");

              //var attackTime = this.currentTime-p.attackTime;
    					//if (p.canAttack(time) && attackTime > ATTACK_INTERVAL)
              //p.fsm = "MOVE";

              if (!p.canAttack(time))
              {
                log.info("CANNOT ATTACK DUE TO TIME.");
                return;
              }

              //p.forceStop();
              //p.engage(p.target);
              //p.hit();

              if (p.hit() && p.hasTarget()) {
                //this.client.sendMoveEntity(p, 0);
                //p.forceStop();
                this.client.sendAttack(p, p.target, spellId);
              }
              else {
                return;
              }

              log.info("CAN ATTACK!! "+p.target.id);

              self.audioManager.playSound("hit"+Math.floor(Math.random()*2+1));

              p.skillHandler.showActiveSkill();

              p.attackCooldown.duration = 1000;
              p.attackCooldown.lastTime = time;

            },

            /**
             *
             */
            makeNpcTalk: function(npc) {
            	var msg;

              if (!npc) return;

              if (!game.player.isNextToo(npc.x, npc.y))
                return;

              if (npc.type == Types.EntityTypes.NPCMOVE) {
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
              	this.inventoryHandler.showInventory();
              	if (this.gamepad.isActive())
          			{
          				this.gamepad.dialogNavigate();
          			}
              } else if (NpcData.Kinds[npc.kind].title==="Repair") {
                game.inventoryMode = InventoryMode.MODE_REPAIR;
              	this.inventoryHandler.showInventory();
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
                if (data && data.length == 3) {
                  var action = data[2];
                  var splitAction = action.split("_");
                  if (splitAction[0] == "QUEST") {
                    game.client.sendQuest(entity.id, parseInt(splitAction[1]), 1);
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
              var msgEntity = (data[0] == 0) ? entity : game.player;
              var msg = data[1];
              if (!entity || !msg)
                return;

              this.bubbleManager.create(msgEntity, msg);
              this.audioManager.playSound("npc");
              if (data[0] == 0) {
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
                var msgEntity = (data[0] == 0) ? entity : game.player;
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
                var cond = function (e) { return e.type == Types.EntityTypes.MOB; };
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
                  var dx, dy;
                  for (var k in entities) {
                      entity = entities[k];
                      if (!entity) continue;

                      //log.info("x2:"+entity.x+",y2:"+entity.y);
                      if (entity.isOver(x, y))
                        return entity;
                  }
                }
                return null;
            },

            /*getEntityByName: function (name) {
            	var entity;
            	$.each(this.entities, function (i, v) {
        	        if (v instanceof Player && v.name.toLowerCase() == name.toLowerCase())
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

                    var ts = this.tilesize;
                    var grid = this.mapContainer.collisionGrid;
                    if (!grid) {
                      console.error("game.js findPath: grid not ready for pathing.")
                      return null;
                    }

                    var c = this.camera;
                    var path = null;
                    //var ts = this.tilesize;
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

                    if (pS[0] == pE[0] && pS[1] == pE[1])
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
                    if (!path || path.length == 0) {
                      if (pS[0] == pE[0] || pS[1] == pE[1]) {
                        mp = [pS, pE];
                        if(this.pathfinder.isValidPath(grid, mp)) {
                          log.info("validpath-mp:"+JSON.stringify(mp));
                          path = mp;
                        }
                      }
                    }

                    if (!path || path.length == 0) {
                      var mp = [pS, [pS[0],pE[1]], pE];
                      log.info("mp:"+JSON.stringify(mp));
                      if(this.pathfinder.isValidPath(grid, mp)) {
                        log.info("validpath-mp2:"+JSON.stringify(mp));
                        path = mp;
                      }
                    }

                    if (!path || path.length == 0) {
                      //log.info("path:"+JSON.stringify(path));
                      mp = [pS, [pE[0],pS[1]], pE];
                      log.info("mp:"+JSON.stringify(mp));
                      if(this.pathfinder.isValidPath(grid, mp)) {
                        log.info("validpath-mp3:"+JSON.stringify(mp));
                        path = mp;
                      }
                    }

                    if (!path || path.length == 0) {
                      var shortGrid = this.pathfinder.getShortGrid(grid, pS, pE, 3);

                      var grid = shortGrid.crop,
                        pS = shortGrid.substart,
                        pE = shortGrid.subend;

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
                      path = this.pathfinder.findShortPath(shortGrid.crop,
                        shortGrid.minX, shortGrid.minY, shortGrid.substart, shortGrid.subend);
                    }

                    if (!path || path.length == 0) {
                      log.info("using long path finder.");
                      path = this.pathfinder.findPath(grid, pS, pE, false);
                    }

                    if (path && path.length > 0)
                    {
                      //log.info("path_result: "+JSON.stringify(path));
                      var dx = character.x - pS[0]*ts;
                      var dy = character.y - pS[1]*ts;

                      for (var node of path)
                      {
                        node[0] = ~~(node[0]*ts+dx);
                        node[1] = ~~(node[1]*ts+dy);
                      }
                      log.info("path_result2: "+JSON.stringify(path));
                      if (!(path[0][0] == (character.x) && path[0][1] == (character.y)))
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

              if (res && char.orientation == Types.Orientations.NONE)
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

              /*if (!res && char == this.player) {
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
                  if (entity instanceof Player && entity.holdingBlock == entity2)
                    continue;
                  if (!entity2 || entity == entity2)
                    continue;
                  if (entity2.isDead || entity2.isDying)
                    continue;

                  if (!entity2.isWithin(entity) &&
                      entity2.isWithin({x:x, y:y}))
                    return true;
                }
                return false;
            },

            playerTargetClosestEntity: function (inc) {
              var p = this.player;
              if (!p.hasOwnProperty("targetIndex"))
                p.targetIndex = 0;

              var excludeTypes = [Types.EntityTypes.NODE, Types.EntityTypes.PLAYER];
              if (game.mapContainer.mapIndex != 0)
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
              var self = this;
              var ts = this.tilesize;
              var cm = this.camera;

              index = index || 0;

              var entities = cm.forEachInScreenArray();
              entities = entities.filter(entity => !(excludeTypes.includes(entity.type) || entity.isDying || entity.isDead));


              for (var entity2 of entities) {
                entity2.playerDistance = realDistance(entity,entity2);
              }

              if (entities.length == 0) {
                entity.targetIndex = 0;
                return null;
              }
              if (entities.length == 1) {
                entity.targetIndex = 1;
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

                if (p.dialogueEntity) {
                  game.showDialogue();
                  return;
                }

                if (p.movement.inProgress)
                  return;

                this.clickMove = true;
                //this.playerPopupMenu.close();

                for(var i = 0; i < this.dialogs.length; i++) {
                    if(this.dialogs[i].visible){
                        this.dialogs[i].hide();
                    }
                }

                var entity = this.getEntityAt(pos.x, pos.y);
                if (p.setTarget(entity))
                  return;

                this.processInput(pos.x,pos.y);
                this.clickMove = false;
            },

            dropItem: function(itemSlot, x, y) {
                var pos = this.getMouseGridPosition();
                x = x || pos.x;
                y = y || pos.y;
                var item = this.inventoryHandler.inventory[itemSlot];
      	        var kind = item.itemKind;
                var count = item.itemNumber;
                this.player.droppedX = x;
                this.player.droppedY = y;
        				if((ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind) || ItemTypes.isCraftItem(kind)) &&
        					(count > 1))
        				{
        					$('#dropCount').val(count);

        					this.app.showDropDialog(itemSlot);
        				} else {
        					this.client.sendItemSlot([3, 0, itemSlot, 1]);
        				}
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
                if (colliding && p.isNextToo(px, py)) {
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
                if (block == p.holdingBlock) {
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
                this.speakToNPC(entity);
                return;
              }

              if(entity instanceof Player && entity !== this.player)
              {
                  this.makePlayerAttack(entity);
                  //this.playerPopupMenu.click(entity);
              }
              else if(entity instanceof Mob ||
                      (entity instanceof Player && entity !== this.player && this.player.pvpTarget == entity))
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
              if (type == null) {
                game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
                return;
              }

              var gpos = getGridPosition(px, py);
              if (!this.mapContainer.isHarvestTile(gpos, type)) {
                game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
                return;
              }

              p.lookAtTile(px, py);
              p.harvestOn(type);

              this.client.sendHarvest(px, py);
            },

            clickMoveTo: function (px, py) {
              var self = this;
              log.info("makePlayerGoTo");
              var tsh = G_TILESIZE >> 1;
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

                for(var o of orientations)
                {
                  var p2 = this.player.nextDist(px, py, o, tsh);
                  if (!this.mapContainer.isColliding(p2[0],p2[1]))
                  {
                    this.makePlayerGoTo(p2[0], p2[1]);
                    return;
                  }
                }
              }
              else {
                  this.makePlayerGoTo(px, py);
              }
            },


            speakToNPC: function (entity) {
              var p = this.player;
              if (!p.isNextTooEntity(entity))
                p.follow(entity);
      				else
      					this.makeNpcTalk(entity);
            },

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

            resize: function() {
                var x = this.camera.x,
                    y = this.camera.y,
                    currentScale = this.renderer.scale,
                    newScale = this.renderer.getScaleFactor();
                var self = this;

                var resizeGameFunc = function () {
                  self.ready = false;
                  self.renderer.rescaling = true;
                  //self.renderer.setWinDimension();
                  //self.renderer.calcZoom();
                  self.renderer.rescale();
                  self.renderer.resizeCanvases();
                  self.camera.setRealCoords();
                  self.moveEntityThreshold = ~~(self.camera.gridW / 2) + 1;
                  self.ready = true;
                  self.renderer.rescaling = false;
                  self.updateBars();
                  self.updateExpBar();
                  //self.updateTarget();
                }

                resizeGameFunc();

                this.inventoryHandler.refreshInventory();
                if (this.player && this.player.skillHandler) {
                    this.player.skillHandler.displayShortcuts();
                }
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
                    var level = this.player.level.base;
                    var exp = this.player.exp.base;
                    //var expInThisLevel = this.player.exp.base - Types.expForLevel[this.player.level.base-2];
                    //var expForLevelUp = Types.expForLevel[this.player.level.base-1] - Types.expForLevel[this.player.level.base-2];
                    this.playerexp_callback(level, exp);
                }
            },

            showNotification: function(data) {
                var group = data.shift();
                var langCode = data.shift();

                var message = lang.data[langCode];
                if (data.length > 0)
                  message = lang.data[langCode].format(data);

                if (group.indexOf("NOTICE") == 0)
                {
                  game.renderer.pushAnnouncement(message,30000);
                  return;
                }

                if (group.indexOf('SHOP') == 0 ||
                    group.indexOf('INVENTORY') == 0)
                {
                  if(this.craftDialog.visible) {
                      game.notifyDialog.notify(message);
                  }
                  else if(this.storeDialog.visible) {
                      game.notifyDialog.notify(message);
                  } else if(this.auctionDialog.visible) {
                      if (langCode.indexOf('SHOP_SOLD') == 0) {
                          this.auctionDialog.storeFrame.open();

                          this.auctionDialog.storeFrame.pageMyAuctions.reload();
                          this.auctionDialog.storeFrame.pageArmor.reload();
              		        this.auctionDialog.storeFrame.pageWeapon.reload();
                      }
                      else {
                      	game.notifyDialog.notify(message);
                      }
                  } else if(this.appearanceDialog.visible) {
                      if (langCode.indexOf('SHOP_SOLD') == 0) {
                          this.appearanceDialog.storeFrame.open();
                      }
                      else if (langCode.indexOf('SHOP') == 0) {
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
                		if (i == nb)
                			break;
                		entity = this.obsoleteEntities.shift();
                  	log.info("Removed Entity: "+ entity.id);
                  	delist.push(entity.id);
                  	self.removeEntity(entity);
                  }
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

            /**
             * Change player plateau mode when necessary
             */
            /*updatePlateauMode: function() {
                if(this.map && this.map.isPlateau(this.player.gx, this.player.gy)) {
                    this.player.isOnPlateau = true;
                } else {
                    this.player.isOnPlateau = false;
                }
            },*/

            forEachEntityRange: function(gx, gy, r, callback) {
                this.forEachEntity(function(e) {
        					if (e.gx >= gx-r && e.gx <= gx+r &&
        						e.gy >= gy-r && e.gy <= gy+r)
        					{
        						callback(e);
        					}
                });
            },

            keyDown: function(key){
                var self = this;
                if(key >= 49 && key <= 54){ // 1, 2, 3, 4, 5, 6
                    var itemSlot = key - 49;
                    var kind = this.inventoryHandler.inventory[itemSlot].itemKind;
                    if(ItemTypes.isConsumableItem(kind)){
                        this.eat(inventoryNumber);
                    }
                }
            },

// TODO - Check the Packet.
            equip: function(itemSlot){
                var itemKind = this.inventoryHandler.inventory[itemSlot].itemKind;

                var equipSlot = ItemTypes.getEquipmentSlot(itemKind);
                if (equipSlot > -1)
                  this.client.sendItemSlot([1, 0, itemSlot, 0, 2, equipSlot]);

                //this.menu.close();
                game.statDialog.update();
            },

            unequip: function(index) {
                this.client.sendItemSlot([1, 2, index, 0, 0, -1]);
                game.statDialog.update();
            },

            useItem: function(item, type){
              var kind = item.itemKind;
              if (ItemTypes.isConsumableItem(kind)) {
                if(kind && this.inventoryHandler.healingCoolTimeCallback === null
                   && (ItemTypes.isHealingItem(kind) && this.player.stats.hp < this.player.stats.hpMax
                   && this.player.stats.hp > 0) || (ItemTypes.isConsumableItem(kind) && !ItemTypes.isHealingItem(kind)))
                {
                    if(this.inventoryHandler.decInventory(item.slot))
                    {
                        this.client.sendItemSlot([0, 0, item.slot, 1]);
                        this.audioManager.playSound("heal");
                        game.shortcuts.refresh();
                        return true;
                    }
                }
              } else if (ItemTypes.isEquippable(kind)) {
                if (type == 2) {
                  game.unequip(slot);
                }
                else {
                  game.equip(realslot);
                }
                return true;
              }
              return false;
            },

            repairItem: function (type, item, itemIndex) {
              var self = this;
              if (!item) return;

              if(!this.ready) return;

              var price = ItemTypes.getRepairPrice(item);
              var strPrice = 'Cost ' + price + ' to Repair.';
              if (price > this.player.gold[0]) {
                  game.showNotification(["SHOP", "SHOP_NOGOLD"]);
                  return;
              }
              this.confirmDialog.confirm(strPrice, function(result) {
                  if(result) {
                      self.client.sendStoreRepair(type, itemIndex);
                  }
              });
            },

            enchantItem: function (type, item, itemIndex) {
              var self = this;
              if (!item) return;

              if(!this.ready) return;

              var price = ItemTypes.getEnchantPrice(item);
              var strPrice = 'Cost ' + price + ' to Enchant.';
              if (price > this.player.gold[0]) {
                  game.showNotification(["SHOP", "SHOP_NOGOLD"]);
                  return;
              }
              this.confirmDialog.confirm(strPrice, function(result) {
                  if(result) {
                      self.client.sendStoreEnchant(type, itemIndex);
                  }
              });
            },

        });

        return Game;
});

// TODO - Overlapping Block Monsters is not working!!!.
