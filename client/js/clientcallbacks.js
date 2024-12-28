define(['infomanager', 'hoveringinfo', 'bubble',
        'renderer', 'map', 'mapcontainer', 'animation', 'sprite', 'tile',
        'gameclient', 'clientcallbacks', 'audio', 'updater',
        'pathfinder', 'entity/entity', 'entity/entitymoving', 'entity/item', 'data/items', 'data/itemlootdata', 'data/appearancedata', 'dialog/appearancedialog',
        'entity/mob', 'entity/npcstatic', 'entity/npcmove', 'data/npcdata', 'entity/player', 'entity/character', 'entity/chest', 'entity/block',
        'data/mobdata', 'data/mobspeech', 'exceptions', 'config', 'chathandler',
        'playerpopupmenu', 'classpopupmenu', 'quest', 'data/questdata', 'questhandler', 'achievement',
        'equipmenthandler', 'inventoryhandler', 'bankhandler', 'socialhandler',
        'leaderboardhandler', 'settingshandler','storehandler','bools',
        'skillhandler', 'data/skilldata', 'dialog/storedialog', 'dialog/auctiondialog',
        'dialog/bankdialog', 'data/langdata', 'gamepad'],

function(InfoManager, HoveringInfo, BubbleManager,
        Renderer, Map, MapContainer, Animation, Sprite, AnimatedTile,
         GameClient, ClientCallbacks, AudioManager, Updater,
         Pathfinder, Entity, EntityMoving, Item, Items, ItemLoot, AppearanceData, AppearanceDialog,
         Mob, NpcStatic, NpcMove, NpcData, Player, Character, Chest, Block,
         MobData, MobSpeech, Exceptions, config, ChatHandler,
         PlayerPopupMenu, ClassPopupMenu, Quest, QuestData, QuestHandler, Achievement,
         EquipmentHandler, InventoryHandler, BankHandler, SocialHandler,
         LeaderboardHandler, SettingsHandler, StoreHandler, Bools,
         SkillHandler, SkillData, StoreDialog, AuctionDialog,
         BankDialog, LangData, GamePad) {
  var ClientCallbacks = Class.extend({
      init: function(client) {
        this.client = client;

        //var client = game.client;

        // data - mapIndex, mapStatus, x, y.
        client.onPlayerTeleportMap(function(data) {
          var mapId = parseInt(data[0]),
              x = parseInt(data[2]),
              y = parseInt(data[3]);
          var status = game.mapStatus = parseInt(data[1]);

          log.info("ON PLAYER TELEPORT MAP:"+mapId+"status: "+status+",x:"+x+",y:"+y);

          if (status == -1)
          {
            game.mapIndex = 0;
            game.mapStatus = 2;
            game.player.forceStop();
            game.player.clearTarget();
            //game.player.path = null;
            //game.player.step = 0;
            return;
          }

          if (status == 1)
          {
            log.info("spawnMap");

            if (game.player.isMoving())
              game.player.forceStop();
            game.mapIndex = mapId;
            game.player.mapIndex = mapId;
            //game.player.forceStop();
            game.player.clearTarget();
            game.player.freeze = true;
            //game.player.path = null;
            //game.player.step = 0;

            game.renderer.clearEntities();

            delete game.entities;
            game.entities = {};
            delete game.camera.entities;
            game.camera.entities = {};
            delete game.camera.outEntities;
            game.camera.outEntities = {};
            delete game.items;
            game.items = {};

            log.info("Map loaded.");
            client.sendTeleportMap([mapId, 1, x, y]);
            //game.renderer.initPIXI();
            game.renderer.blankFrame = true;
            //game.initCursors();
            //game.setCursor("hand");
          }

          if (status == 2)
          {
              log.info("spawnMap - Loaded");
              game.initPlayer();


// TODO - ERROR, On position 50,50 pathing is allowing move inside collisionGrid.
              //x = 200 * game.tilesize, y = 200 * game.tilesize;
              //game.player.setPosition(x, y);
              game.player.setPositionSpawn(x, y);
              game.player.forceStop();
              //game.player.gx = x >> 4;
              //game.player.gy = y >> 4;
              var c = game.camera;
              //c.scrollX = false;
              //c.scrollY = false;
              //c.sox = 0;
              //c.soy = 0;

              game.initGrid();
              c.setRealCoords();

              game.pathfinder = new Pathfinder(game.mapContainer.chunkWidth, game.mapContainer.chunkHeight);
              //game.initAnimatedTiles();
              log.info("spawnMap - Cleared");

              var mapReady = function ()
              {
                log.info("spawnPlayer - started");

                var p = game.player;
                //p.setWeaponSprite(p.getWeaponSprite());
                //p.setArmorSprite(p.getArmorSprite());

                game.addEntity(p);

                //game.mapIndex = mapId;

                game.audioManager.updateMusic();




                game.mapStatus = 2;

                //if (game.player.x % ts === 0 || game.player.y % ts === 0)
                //{
                  //var mc = game.mapContiainer;
                  //var x=game.player.x, y=game.player.y;
                  log.info("moveGrid");
                  //mc.fx = x;
                  //mc.fy = y;
                  //mc.fgx = p.gx;
                  //mc.fgy = p.gy;
                  //mc.moveGrid();
                  //game.renderer.refreshGrid();
                //}
                //game.mapContainer.moveGrid();
                //game.renderer.refreshGrid();
                //game.mapContainer.moveGrid();
                //game.renderer.refreshGrid();

                game.renderer.forceRedraw = true;
                log.info("spawnPlayer - finished");
                //game.renderer.blankFrame = false;
                game.player.freeze = false;
              };
              //game.renderer.forceRedraw = true;
              game.mapContainer.allReady(function() {
                mapReady();
              });
              game.renderer.forceRedraw = true;
          }

        });

        /*client.onEntityList(function(list) {
            var entityIds = _.pluck(game.entities, 'id'),
                knownIds = _.intersection(entityIds, list),
                newIds = _.difference(list, knownIds);

            // Ask the server for spawn information about unknown entities
            if(_.size(newIds) > 0) {
                client.sendWho(newIds);
            }
        });*/

        /*client.onKnownEntityList(function(list) {
            if (!list || list.length == 0) {
              client.sendKnowWho([]);
              return;
            }

            if (game.camera)
            {
              game.camera.forEachInOuterScreen(function(entity,id) {
                  if(!entity || entity.isDead)
                  {
                      game.camera.outEntities[id] = null;
                      delete game.camera.outEntities[id];
                  }
              });
            }

            var entityIds = _.pluck(list, 'id');
            client.sendKnowWho(entityIds);
        });*/

        client.onLogin(function () {
        	client.sendLogin(game.player);
        });

        client.onSpawnItem(function(data, item) {
            //log.info("Spawned " + ItemTypes.KindData[item.kind].name + " (" + item.id + ") at "+x+", "+y);
            if (!item) return;

            var x = parseInt(data[5]),
                y = parseInt(data[6]),
                count = parseInt(data[8]);

            var kind = item.kind;
            var sprite = null;
						if (ItemTypes.isLootItem(kind))
							sprite = game.sprites['itemloot'];
            else
              sprite = game.sprites[ItemTypes.KindData[item.kind].spriteName];

						item.setSprite(sprite);
						item.wasDropped = true;
						log.info("x:"+x+",y:"+y);
						item.setPosition(x, y);
						item.count = parseInt(count);

            game.addItem(item);
            game.updateCursor();
            game.updateCameraEntity(item.id, item);
        });

        /*client.onSpawnChest(function(chest, x, y) {
            log.info("Spawned chest (" + chest.id + ") at "+x+", "+y);
            chest.setSprite(game.sprites[chest.getSpriteName()]);
            chest.setPosition(x, y);
            chest.setAnimation("idle_down", 150);
            game.addEntity(chest, x, y);
            chest.onOpen(function() {
                chest.setSprite(game.sprites["death"]);
                chest.setAnimation("death", 120, 1, function() {
                    log.info(chest.id + " was removed");
                    game.removeEntity(chest);
                    game.previousClickPosition = {};
                    game.player.removeTarget();
                });
            });
        });*/

        var spawnEntity = function(data, entity)
        {
          var id = data[0];
          if(id === game.playerId)
            return;

          entity.setPosition(data[5], data[6]);
          var orientation = data[7];
          entity.level = parseInt(data[8]);
          if (data.length > 10 && !(entity instanceof Block)) {
            entity.setHP(parseInt(data[9]));
            entity.setMaxHP(parseInt(data[10]));
          }

          if(entity.type === Types.EntityTypes.PLAYER)
          {
              //entity.setClass(parseInt(data[11]));
              entity.sprites[0] = parseInt(data[12]); // Main sprite.
              entity.sprites[1] = parseInt(data[13]);
              entity.armorColor = '#'+data[14];
              entity.weaponColor = '#'+data[15];
          }
          if (entity.type === Types.EntityTypes.NODE)
          {
            //entity.level = data[10];
            entity.name = data[3];
            entity.isDying = entity.isDead = false;
            var spriteName = data[9];
            var animName = data[10];
            entity.weaponType = data[11];
            entity.setSprite(game.sprites[spriteName]);
            entity.animate(animName, entity.idleSpeed);
          }

          if (entity instanceof Mob)
          {
            var spriteName = entity.getSpriteName();
            entity.name = spriteName;
            entity.setSprite(game.sprites[spriteName]);
          }
          else if (entity instanceof Player)
          {
            entity.setArmorSprite();
            entity.setWeaponSprite();

            //entity.setWeaponSpriteId(entity.sprites[0]);
            //entity.setArmorSpriteId(entity.sprites[1]);
          }
          else if (entity instanceof Block)
          {
            var nameData = data[3].split("-");
            var spriteName = "block-"+entity.kind;
            entity.setSprite(game.sprites[spriteName]);
            entity.animate(nameData[1], entity.idleSpeed);
          }
          else if (entity.type == Types.EntityTypes.TRAP)
          {
            var spriteName = "trap-"+entity.kind;
            entity.setSprite(game.sprites[spriteName]);

            var animName = (spriteId == 0) ? "off" : "on";
            entity.animate(animName, entity.idleSpeed);

          }
          else if (entity instanceof NpcStatic)
          {
              var uid = NpcData.Kinds[entity.kind].uid;
              entity.setSprite(game.sprites[uid]);
          }
          else if (entity instanceof NpcMove)
          {
              var uid = "npc"+(1+(~~(entity.kind/8)%4))+"_"+(1+(entity.kind%8));
              entity.setSprite(game.sprites[uid]);
              entity.questId = data[8];
          }

          if (entity instanceof EntityMoving && !(entity instanceof Block)) {
              entity.setOrientation(orientation);
              entity.idle(orientation);
          }

          game.addEntity(entity);
          //game.updateCameraEntity(entity.id, entity);

          var entityName = entity.name;
          //if (entity instanceof Mob)
          //  entityName = MobData.Kinds[entity.kind].name;

          if (entity instanceof NpcStatic)
            entityName = NpcData.Kinds[entity.kind].uid;
          else if (entity instanceof Item)
            entityName = ItemTypes.KindData[entity.kind].name;

          log.debug("Spawned " + entityName + " (" + entity.id + ") at "+entity.x+", "+entity.y);

          if (entity instanceof Character)
          {
            entity.onBeforeStep(function() {
            });

            entity.onStep(function() {
            });

            entity.onStopPathing(function(x, y) {
            });

            entity.onRequestPath(function(x, y) {
                var include = [];
                var ignored = [entity], // Always ignore self
                    ignoreTarget = function(target) {
                        ignored.push(target);
                    };

                if(entity.hasTarget()) {
                    ignoreTarget(entity.target);
                } else if(entity.previousTarget) {
                    ignoreTarget(entity.previousTarget);
                }

                var path = game.findPath(entity, x, y, ignored, include);
                if (!game.pathfinder.checkValidPath(path))
                {
                  try { throw new Error(); } catch(err) { console.error("invalidpath: "+JSON.stringify(path)); }
                }
                return path;
            });

            entity.onHasMoved(function(entity) {
            });
          }

          if(entity instanceof Character || entity.type === Types.EntityTypes.NODE)
          {
              entity.isDead = false;
              entity.isDying = false;

              entity.onRemove(function () {
                var p = game.player;
                if(p.target === entity) {
                    p.disengage();
                }

                log.info(entity.id + " was removed");

                entity.isDead = true;
                game.removeEntity(entity);
              });

              entity.onDeath(function() {
                var p = game.player;

                if (entity == p)
                  return;

                p.targetIndex = 0;
                log.info(entity.id + " is dead");

                if(p.target === entity) {
                    p.disengage();
                }

                entity.isDying = true;
                entity.forceStop();
                entity.freeze = true;
                entity.setSprite(game.sprites["death"]);
                entity.animate("death", 150, 1, function() {
                    log.info(entity.id + " was removed");

                    entity.isDead = true;
                    game.removeEntity(entity);
                });

                if(game.camera.isVisible(entity, 0)) {
                    game.audioManager.playSound("kill"+Math.floor(Math.random()*2+1));
                }

                game.updateCursor();
              });


            }
        };

        client.onSpawnCharacter(function(data, entity) {
            spawnEntity(data, entity);
        });

        // data - entityId, x, y, mapIndex
        client.onDespawnEntity(function(data) {
            if (game.mapIndex != data[1])
              return;

          var entity = game.getEntityById(data[0]);
            if(entity) {
              var entityName;

              if (entity instanceof Mob)
                entityName = MobData.Kinds[entity.kind].name;
              else if (entity instanceof NpcStatic || entity instanceof NpcMove)
                entityName = NpcData.Kinds[entity.kind].name;
              else if (entity instanceof Item)
              {
                  if (ItemTypes.isLootItem(entity.kind))
                    entityName = ItemLoot[entity.kind-1000].name;
                  else
                    entityName = ItemTypes.KindData[entity.kind].name;
              }
              log.info("Despawned " + entityName + " (" + entity.id + ") at "+entity.x+", "+entity.y);

              if(entity instanceof Item) {
                  game.removeItem(entity);
              } else if(entity instanceof Character) {
                  entity.die();
              } else if(entity instanceof Chest) {
                  entity.open();
              } else if(entity instanceof Block) {
                game.removeEntity(entity);
              } else if (entity.type == Types.EntityTypes.TRAP) {
                game.removeEntity(entity);
              } else if (entity.type == Types.EntityTypes.NODE) {
                game.removeEntity(entity);
              }
              entity.clean();
            }
        });

        // data - time, mapIndex, entityId, orientation, state, moveSpeed, x, y.
        client.onEntityMove(function(data)
        {
            var time = parseInt(data[0]),
                map = parseInt(data[1]),
                id = parseInt(data[2]),
                orientation = parseInt(data[3]),
                state = parseInt(data[4]),
                moveSpeed = parseInt(data[5]),
                x = parseInt(data[6]),
                y = parseInt(data[7]);

            if (game.mapStatus < 2 || game.mapIndex != map ||
                map != game.player.mapIndex)
              return;

            //var lockStepTime = (G_LATENCY - (getWorldTime()-time)).clamp(0,G_LATENCY);
            //console.warn("lockStepTime="+lockStepTime);
            //var entity = null;
            //if(id === game.player.id)
              //return;

            var entity = game.getEntityById(id);
            if (!entity)
            {
              log.info("UNKNOWN ENTITY")
              game.unknownEntities.push(id);
              return;
            }
            if(entity.isDying || entity.isDead)
            {
              log.info("ENTITY DYING OR DEAD CANT MOVE")
              return;
            }

            if (entity == game.player)
            {
              var p = entity;
              if(!p || p.isDying || p.isDead)
                return;

              if (!(p.x==x && p.y==y))
              {
                console.warn("PLAYER NOT IN CORRECT POSITION.");
                //log.info("DEBUG: p.x="+p.x+",x="+x+"p.y="+p.y+",y="+y);
                // Dirty hack to avoid sending a incorrect packet in forcestop.
                p.keyMove = false;
                p.forceStop();
                p.setPositionGrid(x,y);
                game.player.user.client.sendSyncTime();
                game.renderer.forceRedraw;
                //log.info("DEBUG: p.x="+p.x+",x="+x+"p.y="+p.y+",y="+y);
                return;
              }
            }

            entity.setMoveRate(moveSpeed);
            if (state)
              entity.move(time, orientation, false, x, y);
            entity.move(time, orientation, state, x, y);
        });

        // time, mapIndex, entityId, orientation, interrupted, moveSpeed, path.
        client.onEntityMovePath(function(data)
        {
            var time = parseInt(data[0]),
              map = parseInt(data[1]),
              id = parseInt(data[2]),
              orientation = parseInt(data[3]),
              interrupted = (data[4] ? true : false),
              moveSpeed = parseInt(data[5]);

            var path = data.splice(6, data.length-6);

            if (game.mapStatus < 2 || game.mapIndex != map ||
                map != game.player.mapIndex)
              return;

            var entity = null;

            if(id === game.player.id) return;

            entity = game.getEntityById(id);

            if (!entity)
            {
              game.unknownEntities.push(id);
              return;
            }

            if(entity.isDying || entity.isDead)
              return;

            if (entity == game.player)
              return;

            var lockStepTime = (G_LATENCY - (getWorldTime()-time) + G_UPDATE_INTERVAL);
            lockStepTime = lockStepTime.clamp(0,G_LATENCY);
            //console.warn("lockStepTime="+lockStepTime);
            //console.warn("getDiffTime(time):"+(Date.now() - time));
            //console.warn("recv - lockStepTime="+lockStepTime);

            entity.forceStop();
            entity.setPosition(path[0][0], path[0][1]);
            entity.setOrientation(orientation);

            var movePathFunc = function () {
              if (entity.isDying || entity.isDead) {
                entity.forceStop();
                return;
              }

              if (path.length < 2)
                 return;

              if (moveSpeed)
              {
                entity.setMoveRate(moveSpeed);
              }

              entity.movePath(path,orientation);
            };

            if (lockStepTime == 0)
              movePathFunc();
            else
              setTimeout(movePathFunc, lockStepTime);
        });

        client.onEntityDestroy(function(data) {
            var id = data[0];
            var entity = game.getEntityById(id);
            if(entity) {
                if(entity instanceof Item) {
                    game.removeItem(entity);
                } else {
                    game.removeEntity(entity);
                }
                log.debug("Entity was destroyed: "+entity.id);
            }
        });

        client.onCharacterDamage(function(data) {
            data.parseInt();

            var sEntity = game.getEntityById(data[0]),
                tEntity = game.getEntityById(data[1]),
                orientation = data[2],
                hpMod = data[3],
                hp = data[4],
                hpMax = data[5],
                epMod = data[6],
                ep = data[7],
                epMax = data[8],
                crit = (data[9] == 1);

            if (!sEntity || !tEntity)
              return;

            client.change_points_callback([tEntity.id,hp,hpMax,hpMod,ep,epMax,epMod,crit]);

            if(hpMod < 0) {
                if (sEntity != game.player) {
                  sEntity.lookAtEntity(tEntity);
                  sEntity.hit(sEntity.orientation);
                }
            }

            if (game.player === sEntity) // sanity
            {
              sEntity.attackTime = game.currentTime;
            }

            /*if (data.length > 10)
            {
              var effects = data.splice(10, data.length);

              $('#targeteffects').empty();
              var effectId = 'targeteffect';

              for (var i=0; i < effects.length; ++i)
              {
                var effect = effects[i];
                var position = SkillData.Ordered[effect].iconOffset;
                $('#targeteffects').append("<div id='targeteffect"+i+"' ></div>");
                if (game.renderer.scale == 2)
                {
                  $('#'+effectId+i).css({
                    'display': 'inline-block',
                    'width': '24px',
                    'height': '24px',
                    'background-image': 'url("img/1/skillicons.png")',
                    'background-position': (-position[0]*24)+"px "+(-position[1]*24)+"px" ,
                    'background-repeat': 'no-repeat'
                  });
                }
                else if (game.renderer.scale == 1)
                {
                  $('#'+effectId+i).css({
                    'display': 'inline-block',
                    'width': '12px',
                    'height': '12px',
                    'background-image': 'url("img/1/skillicons.png")',
                    'background-position': (-position[0]*12)+"px "+(-position[1]*12)+"px" ,
                    'background-repeat': 'no-repeat',
                    'background-size': '180px 168px'
                  });
                }
              }
            }*/

        });
// TODO
        /*client.onPlayerKillMob(function(data) {
          var id = data[0];
          var level = data[1];
          var exp = data[2];

          if (exp > 0)
          {
            game.infoManager.addDamageInfo("+"+exp+" exp", game.player.x, game.player.y, "experience", 3000);
            game.player.level.base = level;
            game.player.exp.base += exp;
            game.updateExpBar();
          }
        });*/

        client.onPlayerStat(function(data) {
            var statType = parseInt(data[0]);
            var statValue = parseInt(data[1]);
            var statChange = parseInt(data[2]);

            if (statType == 1) // exp.base
            {
              game.player.exp.base = statValue;
              game.player.level.base = Types.getLevel(statValue)
              if (statChange > 0) {
                game.infoManager.addDamageInfo("+"+statChange+" exp", game.player.x, game.player.y, "experience", 3000);
              }
              game.updateExpBar();
            }
        });

        client.onPlayerLevelUp(function(data) {
          var type = data[0];
          var level = data[1];
          var exp = data[2];

          var scale = game.renderer.scale;
          var x=game.player.x, y=game.player.y, id=game.player.id;
          if (type==1 && game.player.level.base != level) {
              id="lu"+id+"_"+level;
              var info = new HoveringInfo(id, "Level "+level, x, y, 5000, 'levelUp');
              game.infoManager.addInfo(info);

              game.player.level.base = level;
              return;
          }
          if (type==2 && game.player.level.attack != level) {
            id="lau"+id+"_"+level;
            var info = new HoveringInfo(id, "Attack Level "+level, x, y, 3500, 'minorLevelUp');
            game.infoManager.addInfo(info);

            game.player.level.attack = level;
            return;
          }
          if (type==3 && game.player.level.defense != level) {
            id="ldu"+id+"_"+level;
            var info = new HoveringInfo(id, "Defense Level "+level, x, y, 3500, 'minorLevelUp');
            game.infoManager.addInfo(info);

            game.player.level.defense = level;
            return;
          }

          var types = {
            10: "sword",
            11: "bow",
            12: "hammer",
            13: "axe",
          }

          if (type >= 10) {
            weaponType = types[type];
            var curLevel = Types.getWeaponLevel(game.player.exp[weaponType]);
            if (curLevel != level) {
              id="wu"+id+"_"+level;
              var info = new HoveringInfo(id, weaponType+" Level "+level, x, y, 3500, 'minorLevelUp');
              game.infoManager.addInfo(info);
            }
            game.player.exp[weaponType] = exp
            game.player.level[weaponType] = level;
          }
        });

        client.onPlayerItemLevelUp(function(data) {
          var type = data[0];
          var level = data[1];
          var exp = data[2];

          var x=game.player.x, y=game.player.y, id=game.player.id;
          if (type == 0)
          {
            id="laru"+id+"_"+level;
            var info = new HoveringInfo(id, "Armor Level "+level, x, y, 3500, 'minorLevelUp');
            game.infoManager.addInfo(info);
          }
          else if (type == 1)
          {
            id="lweu"+id+"_"+level;
            var info = new HoveringInfo(id, "Weapon Level "+level, x, y, 3500, 'minorLevelUp');
            game.infoManager.addInfo(info);
          }
        });

        client.onGold(function (data) {
          var gold = parseInt(data[0]);
          var bankgold = parseInt(data[1]);
          var gems = parseInt(data[2]);

          game.player.gold[0] = gold;
          game.player.gold[1] = bankgold;
          game.player.gems = gems;

          game.inventoryHandler.setCurrency(gold, gems);
          game.bankHandler.setGold(bankgold);
        });
/*
        client.onDropItem(function(item) {
            game.addItem(item);
            game.updateCursor();
            game.updateCameraEntity(item.id, item);
        });
*/

        client.onChatMessage(function(data) {
          var entityId = data[0];
          var message = data[1];

          if(!game.chathandler.processReceiveMessage(entityId, message)) {
                var entity = game.getEntityById(entityId);
                if (entity)
                {
                  if (game.camera.isVisible(entity))
                    game.bubbleManager.create(entity, message);

                  game.chathandler.addNormalChat(entity, message);
                }
          }
          game.audioManager.playSound("chat");
        });

// TODO - Try and reconnect on dc.
        client.onDisconnected(function(message) {
            if(game.player) {
                game.player.die();
            }
            if(game.disconnect_callback) {
                game.disconnect_callback(message);
            }
            for (var dialog of game.dialogs)
              dialog.hide();
        });

        var questSpeech = function (quest) {
          var npc = game.getNpcByQuestId(quest.npcQuestId);
          if (!npc)
            return;

          var p = game.player;
          var desc = quest.desc;

          if (!Array.isArray(quest.desc))
            desc = [[0, quest.desc]];

          npc.dialogue = desc;
          npc.dialogueIndex = 0;
          npc.quest = quest;

          p.dialogueEntity = npc;

          game.showDialogue();
        };

        client.onQuest(function(data){
            data.parseInt();
            var questId = data[0];
            var quest = game.player.quests[questId];
            if (!quest)
            {
              quest = new Quest(data);
              game.player.quests[questId] = quest;
            }
            else {
               //if (quest.status != QuestStatus.COMPLETE)
                quest.update(data);
            }

            var npc = game.getNpcByQuestId(quest.npcQuestId);
            if (npc)
              game.bubbleManager.destroyBubble(npc.id);

            if (npc && game.player.canInteract(npc)) {
              questSpeech(quest);
            }

            if (quest.status == 0) {
              game.questhandler.handleQuest(quest);
            }

            //if (quest.status > 0)
              //game.questhandler.handleQuest(quest);

            if (quest.status == QuestStatus.COMPLETE) {
              if (quest.type == QuestType.KILLMOBKIND || quest.type == QuestType.KILLMOBS)
                game.questhandler.handleQuest(quest);
              //delete quest;
            }
        });

        client.onAchievement(function (data) {
          data.parseInt();
          var achievementId = data[0];
          var achievement = new Achievement(data);
          game.player.achievements[achievementId] = achievement;
          game.achievementHandler.handleAchievement(achievement);
        });

        client.onItemSlot(function(data){
          data.parseInt();
          var type = data.shift();
          var count = data.shift();
          var items = [];
          var t = 0;
          for (var i=0; i < count; ++i)
          {
            var slot = parseInt(data[t]);
            var kind = parseInt(data[t+1]);
            if (kind == -1) {
              items.push({slot:slot,itemKind:-1});
              t += 2;
              continue;
            }
            var itemRoom = new ItemRoom(
              parseInt(slot),
              parseInt(kind),
              parseInt(data[t+2]),
              parseInt(data[t+3]),
              parseInt(data[t+4]),
              parseInt(data[t+5]),
            );
            t += 6;
            items.push(itemRoom);
          }
          if (type == 0) {
            game.inventoryHandler.setInventory(items);
            game.shortcuts.refresh();
          }
          else if (type == 1) {
            game.bankHandler.setBank(items);
            if (game.bankDialog.visible)
              game.bankDialog.bankFrame.open(game.bankDialog.bankFrame.page);
          }
          if (type == 2) {
            game.equipmentHandler.setEquipment(items);
          }
        });

        client.onDialogue(function (data) {
          var npcId = data.shift();
          var langCode = data.shift();

          var npc = game.getEntityById(npcId);
          var p = game.player;

          // Needs to do a deep copy so lang data does not get overwritten.
          var message = JSON.parse(JSON.stringify(lang.data[langCode]));
          if (data.length > 0) {
            if (Array.isArray(message)) {
              for (var msg of message)
              {
                msg[1] = msg[1].format(data);
              }
              /*for (var i=0; i < message.length; ++i) {
                var tmp = message[i][1].format(data);
                message[i][1] = tmp;
              }*/
            }
            else {
              message[1] = message[1].format(data);
            }
          }

          npc.dialogue = message;
          npc.dialogueIndex = 0;

          p.dialogueEntity = npc;

          game.showDialogue();
        });

        client.onNotify(function(data){
          game.showNotification(data);
        });

        client.onStatInfo(function(datas) {
          datas.parseInt();
          var stats = {
            attack: datas[0],
            defense: datas[1],
            health: datas[2],
            energy: datas[3],
            luck: datas[4],
            free: datas[5],
          };
          game.player.stats = stats;
          game.statDialog.update();
        });

        /*client.onShop(function(message){
        });*/

        client.onAuction(function(message){
            var type = message.shift();
            var itemCount = message.shift();

            /*if (!itemCount || itemCount == 0) {
              return;
            }*/

            var itemData = [];

            for (var i = 0; i < itemCount; ++i)
            {
                /*var index = message[j];
                var status = message[j+1];
                if (status == -1)
                {

                }*/
                j = (i*9);
                itemData.push({
                    index: message[j],
                    player: message[j+1],
                    buy: message[j+2],
                    item: new ItemRoom (
                      message[j+3],
                      message[j+4],
                      message[j+5],
                      message[j+6],
                      message[j+7],
                      message[j+8])
                });
            }
            // TODO - Check if this is correct.
            //if (itemData.length > 0 && type >= 2)
            //{
              curPage = game.auctionDialog.storeFrame.getActivePage();
              var page = game.auctionDialog.storeFrame.pages[type];
              if (curPage === page) {
                page.setPageIndex(0);
                page.setItems(itemData);
                page.reload();
              }
            /*}
            else
            {
              var page = game.auctionDialog.storeFrame.pages[0];
              page.setPageIndex(0);
              page.setItems(itemData);
              page.reload();
            }

            var page = game.auctionDialog.storeFrame.pages[type];
            page.setItems(itemData);
            page.setPageIndex(type);
            page.reload();*/

        });

        client.onSkillLoad(function(datas) {
            var skillIndex = datas[0];
            var skillExp = datas[1];

            skillLevel = Types.getSkillLevel(skillExp);
            game.player.skillHandler.setSkill(skillIndex, skillExp);
            game.skillsDialog.page.setSkill(skillIndex, skillLevel);
        });

        client.onSkillXP(function(data) {
            data.parseInt();
            var skillCount = message.shift();

            if (skillCount == 0)
              return;

            for (var i = 0; i < skillCount; ++i)
            {
              game.player.skillHandler.setSkill(message[i*2],message[i*2+1]);
            }
        });

        client.onSkillEffects(function(data){
            var id = data.shift();
            entity = game.getEntityById(id);
            if (!entity) return;

            var effects = entity.effects = data;

            var htmlEffects;
            var effectId;
            if (game.player == entity)
            {
              htmlEffects = $('#playereffects');
              effectId = "playereffect";
            }
            else if (entity == game.player.target)
            {
              htmlEffects = $('#targeteffects');
              effectId = "targeteffect";
            }
            if (htmlEffects)
              htmlEffects.empty();

            var s = game.renderer.scale;
            if (effects)
            {
              for (var i=0; i < effects.length; ++i)
              {
                var effect = effects[i];
                var position = SkillData.Ordered[effect].iconOffset;
                htmlEffects.append("<div id='"+(effectId + i)+"' ></div>");

                $('#'+effectId+i).css({
                  'display': 'inline-block',
                  'width': (12*s)+'px',
                  'height': (12*s)+'px',
                  'background-image': 'url("img/1/skillicons.png")',
                  'background-position': (-position[0]*12*s)+"px "+(-position[1]*12*s)+"px" ,
                  'background-repeat': 'no-repeat'
                });
                if (s == 1)
                {
                  $('#'+effectId+i).css({
                    'background-size': '180px 168px'
                  });
                }
              }
            }
        });

        client.onSpeech(function (id, key, value) {
          var entity = game.getEntityById(id);
          if (!entity) return;

          var msg = "";
          if (entity instanceof Mob)
            msg = MobSpeech.Speech[key][value];
          else {
            // TODO
          }
          game.createBubble(entity, msg);
        });

        client.onMapStatus(function (mapId, status)
        {
          log.info("mapStatus="+mapId+","+status);
          game.mapIndex = parseInt(mapId);
          game.mapStatus = parseInt(status);
        });

        client.onSetSprite(function (data)
        {

          var entity = game.getEntityById(parseInt(data[0]));
          if (!entity) return;

          if (entity instanceof Player)
          {
            entity.sprites[0] = parseInt(data[1]);
            entity.sprites[1] = parseInt(data[2]);

            entity.setArmorSprite();
            entity.setWeaponSprite();
          } else {
            entity.setSprite(game.sprites[data[1]]);
          }

        });

        client.onSetAnimation(function (data)
        {

          var entity = game.getEntityById(parseInt(data[0]));
          if (!entity) return;

          // TODO - Not yet implemented.
        });

        client.onProducts(function(data) {
          game.products = data;
        });

        client.onSwapSprite(function (data) {
          var entityId = parseInt(data[0]);
          var spriteId = parseInt(data[1]);
          var animId = parseInt(data[2]);

          var entity = game.getEntityById(entityId);
          switch (entity.type) {
            case Types.EntityTypes.TRAP:
              var spriteName = "trap-"+spriteId;
              entity.setSprite(game.sprites[spriteName]);
              var animName = (spriteId == 0) ? "off" : "on";
              entity.animate(animName, entity.idleSpeed);
              break;
          }
        });

        client.onAppearance(function (data) {
          game.appearanceDialog.assign(data);
        });

        client.onBlockModify(function (data) {
          var entityId = parseInt(data[0]);
          var type = parseInt(data[1]);
          var blockId = parseInt(data[2]);


          var entity = game.getEntityById(entityId);
          var block = game.getEntityById(blockId);
          if (!entity || !block)
            return;

          if (type === 0) {
            block.pickup(entity);
          }
          else if (type === 1) {
            block.place(entity);
            entity.holdingBlock = null;
          }
        });

        var onPlayerChangeHealth = function(player, points, crit) {
            var isRegen = false;
            if (points < 0)
              isRegen = true;

            if (!player || !(player instanceof Player) || player.isDead)
              return;

            player.stats.hp = (player.stats.hp-points).clamp(0, player.stats.hpMax);

            var isHurt = (points <= player.stats.hp);
            if(isHurt && game.playerhurt_callback) {
                game.playerhurt_callback();
            }

            game.updateBars();
            if(player.stats.hp <= 0) {
                player.stats.hp = 0;
                player.die();
            }
        };

        var showDamageInfo = function (points, x, y, crit) {
            //log.info("crit="+crit);
            if(points == 0) {
              game.infoManager.addDamageInfo("miss", x, y - 15, "health");
              return;
            }

            if(points < 0) {
                if (crit > 0) {
                    game.infoManager.addDamageInfo(-points, x, y - 15, "crit", 1500, crit);
                }
                else {
                  game.infoManager.addDamageInfo(-points, x, y - 15, "inflicted");
                }
                game.audioManager.playSound("hurt");
            } else {
                game.infoManager.addDamageInfo(points, x, y - 15, "healed");
            }
        };

        client.onCharacterChangePoints(function (data) {
          data.parseInt();
          var id = data[0];
          var hp = data[1];
          var hpMax = data[2];
          var hpMod = data[3];
          var ep = data[4];
          var epMax = data[5];
          var epMod = data[6];
          var crit = data[7] || 0;

          if (id <= 0)
            return;

          var entity = game.getEntityById(id);
          if (!entity)
            return;

          var stats = entity.stats;
          stats.hp = hp;
          stats.hpMax = hpMax;
          stats.ep = ep;
          stats.epMax = epMax;

          showDamageInfo(hpMod, entity.x, entity.y, crit);

          if (hpMod > hp)
            hpMod += (hp - hpMod);

          if (entity == game.player)
          {
            if (hpMod != 0) {
              game.playerhp_callback(hp, hpMax);
              onPlayerChangeHealth(entity, -hpMod);
            }
            if (epMod != 0) {
              game.playerep_callback(ep, epMax);
            }
            game.updateBars();
          }
          else {
            // DO SOMETHING WITH ENTITY HP/EP ADJUSTMENT.
            if(hp <= 0) {
                entity.stats.hp = 0;
                entity.die();
            }
          }
        });

        client.onParty(function (data) {
          var partyType = data.shift();
          if (partyType == 1) {
            game.socialHandler.setPartyMembers(data);
          }
          if (partyType == 2) {
            var id = data[0];
            var player = game.getEntityById(id);
            game.socialHandler.inviteParty(player);

          }
        });

        client.onLooks(function (data) {
          data = data.parseInt();

          var id = data.shift();
          var p = game.getEntityById(id);
          if (!p)
            return;

          var isArcher = data.shift();

          p.sprites[0] = data.shift();
          p.sprites[1] = data.shift();

          p.setWeaponSprite();
          p.setArmorSprite();

        });

        client.onHarvest(function (data) {
          data = data.parseInt();

          var id = data.shift();
          var p = game.getEntityById(id);
          if (!p)
            return;

          var action = data.shift();

          var x=data.shift(), y=data.shift();

          if (action == 1)
          {
            if (p.fsm != "HARVEST") {
              p.lookAtTile(x, y);
              p.harvestOn();
            }
            if (p == game.player)
              p.harvestDuration = data.shift();

          }
          if (action == 2) {
            p.forceStop();
          }

        });

        client.onPlayerInfo(function (data) {
          game.statDialog.page.assign(data);
        });

        client.onPlayer(function(data) {
            //setWorldTime(data[0], data[1]);
            data.shift();
            data.shift();

            var p = game.player;

            p.id = parseInt(data.shift());
            p.name = data.shift();
            p.mapIndex = parseInt(data.shift());
            p.orientation = Types.Orientations.DOWN;
            p.x = parseInt(data.shift()), p.y = parseInt(data.shift());
            p.setPositionSpawn(p.x, p.y);

            p.setMaxHP(parseInt(data.shift()));
            p.setMaxEP(parseInt(data.shift()));
            //p.setClass(parseInt(data.shift()));

            p.exp = {
              base: parseInt(data.shift()),
              attack: parseInt(data.shift()),
              defense: parseInt(data.shift()),
              move: parseInt(data.shift()),
              sword: parseInt(data.shift()),
              bow: parseInt(data.shift()),
              hammer: parseInt(data.shift()),
              axe: parseInt(data.shift()),
              logging: parseInt(data.shift()),
              mining: parseInt(data.shift())
            };

            p.level = {
              base: Types.getLevel(p.exp.base),
              attack: Types.getAttackLevel(p.exp.attack),
              defense: Types.getDefenseLevel(p.exp.defense),
              move: Types.getMoveLevel(p.exp.move),
              sword: Types.getWeaponLevel(p.exp.sword),
              bow: Types.getWeaponLevel(p.exp.bow),
              hammer: Types.getWeaponLevel(p.exp.hammer),
              axe: Types.getWeaponLevel(p.exp.axe),
            }
            p.colors = [];
            p.colors[0] = parseInt(data.shift());
            p.colors[1] = parseInt(data.shift());

            p.gold = [];
            p.gold[0] = parseInt(data.shift()); // inventory gold.
            p.gold[1] = parseInt(data.shift()); // bank gold.
            p.gems = parseInt(data.shift());

            game.inventoryHandler.setCurrency(p.gold[0], p.gems);
            game.bankHandler.setGold(p.gold[1]);

            p.setMoveRate(500-p.level.move)

            p.stats.attack = parseInt(data.shift());
            p.stats.defense = parseInt(data.shift());
            p.stats.health = parseInt(data.shift());
            p.stats.energy = parseInt(data.shift());
            p.stats.luck = parseInt(data.shift());
            p.stats.free = parseInt(data.shift());

            // TODO fix item inits, and skill functions.
            var itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              var items = [];
              var itemArray = data.splice(0,(itemCount*6)).parseInt();
              for(var i=0; i < itemCount; ++i)
              {
                var index = i*6;
                var itemRoom = new ItemRoom(
                  itemArray[index+0],
                  itemArray[index+1],
                  itemArray[index+2],
                  itemArray[index+3],
                  itemArray[index+4],
                  itemArray[index+5],
                );
                items.push(itemRoom);
              }
              game.equipmentHandler.setEquipment(items);
            }

            p.sprites = [];
            p.sprites[0] = parseInt(data.shift());
            p.sprites[1] = parseInt(data.shift());

            p.setWeaponSprite();
            p.setArmorSprite();
            p.setRange();

            var itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              var items = [];
              var itemArray = data.splice(0,(itemCount*6)).parseInt();
              for(var i=0; i < itemCount; ++i)
              {
                var index = i*6;
                var itemRoom = new ItemRoom(
                  itemArray[index+0],
                  itemArray[index+1],
                  itemArray[index+2],
                  itemArray[index+3],
                  itemArray[index+4],
                  itemArray[index+5],
                );
                items.push(itemRoom);
              }
              game.inventoryHandler.initInventory(items);
            }

            var itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              var items = [];
              var itemArray = data.splice(0,(itemCount*6)).parseInt();
              for(var i=0; i < itemCount; ++i)
              {
                  var index = i*6;
                  var itemRoom = new ItemRoom(
                    itemArray[index+0],
                    itemArray[index+1],
                    itemArray[index+2],
                    itemArray[index+3],
                    itemArray[index+4],
                    itemArray[index+5],
                  );
                  items.push(itemRoom);
              }
              game.bankHandler.initBank(items);
            }

            p.quests = {};
            var questCount = parseInt(data.shift());
            if (questCount > 0)
            {
              var questArray = data.splice(0,(questCount*13));
              questArray.parseInt();
              for(var i=0; i < questCount; ++i)
              {
                var index = i*13;
                p.quests[questArray[index]] = new Quest(questArray.slice(index,index+13));
              }
            }

            p.achievements = [];
            var achieveCount = parseInt(data.shift());
            if (achieveCount > 0)
            {
              var achieveArray = data.splice(0,(achieveCount*7));
              achieveArray.parseInt();
              var achievement = null;
              for(var i=0; i < achieveCount; ++i)
              {
                var index = i*7;
                achievement = new Achievement(achieveArray.slice(index,index+7));
                p.achievements.push(achievement);
              }
              game.achievementHandler.achievementReloadLog();
            }

            p.skillHandler = new SkillHandler(self);

            var skillCount = parseInt(data.shift());
            var skillExps = data.splice(0,skillCount);
            skillExps.parseInt();
            p.setSkills(skillExps);
            game.skillDialog.page.setSkills(skillExps);


            var shortcutCount = parseInt(data.shift());
            if (shortcutCount > 0)
            {
              var shortcutArray = data.splice(0,(shortcutCount*3));
              shortcutArray.parseInt();
              var shortcuts = [];
              for(var i=0; i < shortcutCount; ++i)
              {
                var index = i*3;
                shortcuts.push(shortcutArray.slice(index,index+3));
              }
              game.shortcuts.installAll(shortcuts);
            }

            game.onPlayerLoad(p);
        });

      }
  });

  return ClientCallbacks;

});
