// Mixin extracted from clientcallbacks.js: Entity/map lifecycle: spawn/despawn/move/destroy, sprite/animation/block updates, map transitions, and the big initial onPlayer() state deserialization.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Pathfinder from '../pathfinder.js';
import Entity from '../entity/entity.js';
import EntityMoving from '../entity/entitymoving.js';
import Item, { ItemRoom } from '../entity/item.js';
import ItemLoot from '../data/itemlootdata.js';
import Mob from '../entity/mob.js';
import NpcStatic from '../entity/npcstatic.js';
import NpcMove from '../entity/npcmove.js';
import NpcData from '../data/npcdata.js';
import Player from '../entity/player.js';
import Character from '../entity/character.js';
import Block from '../entity/block.js';
import MobData from '../data/mobdata.js';
import AppearanceData from '../data/appearancedata.js';
import Quest from '../quest.js';
import Achievement from '../achievement.js';
import SkillHandler from '../skillhandler.js';
/* global Types, ItemTypes, Utils, log, game */

export function installClientCallbacksLifecycle(proto) {

      // data - mapIndex, mapStatus, x, y.
      proto.onPlayerTeleportMap = function(data) {
          const mapId = Number(data[0]),
              x = Number(data[2]),
              y = Number(data[3]),
              portalId = Number(data[4]);
          const status = game.mapStatus = Number(data[1]);
          const p = game.player;

          log.info("ON PLAYER TELEPORT MAP:"+mapId+"status: "+status+",x:"+x+",y:"+y);

          if (status === -1)
          {
            game.mapIndex = 0;
            game.mapStatus = 2;
            p.forceStop();
            p.clearTarget();
            return;
          }

          if (status === 1)
          {
            log.info("spawnMap");

            p.forceStop();
            game.mapIndex = mapId;
            p.mapIndex = mapId;
            p.clearTarget();
            game.initPlayer();
            // FIX: this used to run *before* game.initPlayer(), but initPlayer()
            // -> player.respawn() -> forceStop() -> stop() (entitymoving.js)
            // unconditionally sets `freeze = false` as part of stopping the
            // player's movement/animation state -- so setting freeze=true first
            // just got silently undone one line later, leaving the player
            // unfrozen for the entire status 0->2 map-transition window.
            // onKeyMove/onStopPathing's checkTeleport() (game.js) is only gated
            // on `!p.freeze`, so any movement/stop event firing mid-transition
            // re-evaluated checkTeleport() while the player's x/y were still
            // sitting on the origin door tile (setPositionSpawn to the real
            // destination doesn't happen until status 2). For a cross-map
            // portal that stale position rarely lines up with a door on the
            // unrelated destination map, but a same-map portal's new
            // MapContainer has the identical door at the identical coordinates,
            // so getDoor(p) matched the same door again and re-triggered
            // teleportMaps() -> another full status 0->2 handshake, repeating
            // indefinitely. Setting freeze=true after initPlayer() (instead of
            // before) means it survives the internal forceStop() call here and
            // stays true until the legitimate final forceStop() at status 2
            // (below) actually completes the transition.
            p.freeze = true;
            if (portalId >= 0 && portalId < game.prevMapContainer.doors.length) {
              const portal = game.prevMapContainer.doors[portalId];
              const orientation = portal.orientation;
              p.orientation = orientation;
              p.suppressTeleportCheck = true;
            }

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
            this.client.sendTeleportMap([mapId, 1, x, y, -1]);
            game.renderer.blankFrame = true;
          }

          if (status === 2)
          {
              log.info("spawnMap - Loaded");

              p.setPositionSpawn(x, y);

              const c = game.camera;

              game.initGrid();
              c.setRealCoords();

              game.pathfinder = new Pathfinder(0, 0);
              log.info("spawnMap - Cleared");

              const fnReady = function () {
                log.info("spawnPlayer - started");

                const p = game.player;

                game.addEntity(p);

                game.audioManager.updateMusic();

                game.mapStatus = 2;

                log.info("moveGrid");

                game.renderer.forceRedraw = true;
                log.info("spawnPlayer - finished");

                p.forceStop();

                // FIX: freeze was only ever cleared as a side effect of forceStop() ->
                // user.js's override -> this._forceStop() -> entitymoving.js's stop(),
                // which sets `this.freeze = false` internally. But that override
                // deliberately *skips* calling _forceStop() whenever
                // `fsm === "ATTACK"` (so a teleport landing mid-swing doesn't cut off
                // the attack animation) -- and with no explicit reset here, that left
                // freeze stuck `true` forever whenever the teleport completed while the
                // player's fsm hadn't yet settled back from "ATTACK", permanently
                // blocking movement (updater.js gates updateCharacterKeyMovement/
                // updatePlayerPathMovement/etc. on `!entity.freeze`). The teleport
                // transition is genuinely done at this point regardless of fsm state,
                // so clear it unconditionally here instead of relying on forceStop()'s
                // internal, conditional path to do it.
                p.freeze = false;

                // FIX: suppressTeleportCheck (game.js's checkTeleport) now stays true
                // for the whole transition instead of clearing itself after the first
                // read -- see checkTeleport's comment for why it can't be one-shot
                // (forceStop()'s internal stop() clears p.freeze as a side effect,
                // which meant relying on freeze alone let a second forceStop() call
                // slip a real re-entry through). This is the one place that's supposed
                // to explicitly clear it again, at the same genuine end-of-transition
                // point freeze itself gets cleared, so a real subsequent door trigger
                // (from the player's own later movement) isn't permanently suppressed.
                p.suppressTeleportCheck = false;

                game.app.releaseKeys();
              };

              game.mapContainer.allReady(function() {
                this.allready = true;
                fnReady();
              });
          }

      };


      proto.onSpawnItem = function(data, item) {
            if (!item) return;

            const x = Number(data[5]),
                y = Number(data[6]),
                count = Number(data[8]);

            const kind = item.kind;
            let sprite = null;
						if (ItemTypes.isLootItem(kind))
							sprite = game.sprites['itemloot'];
            else
              sprite = game.sprites[ItemTypes.KindData[item.kind].spriteName];

						item.setSprite(sprite);
						item.wasDropped = true;
						item.setPosition(x, y);
						item.count = parseInt(count);

            game.addItem(item);
            game.updateCursor();
            game.updateCameraEntity(item.id, item);
      };


      // FIX (maintainability): was a shared inner closure (`const spawnEntity = function(data,
      // entity) {...}`) defined in the constructor and only reachable from the onSpawnCharacter
      // handler below; moved to a proper method since it no longer has a constructor scope to
      // live in. Body unchanged.
      proto.spawnEntity = function(data, entity)
      {
          const id = Number(data[0]);
          if(id === game.playerId)
            return;

          entity.setPosition(Number(data[5]), Number(data[6]));
          const orientation = Number(data[7]);
          entity.level = Number(data[8]);
          if (data.length > 10 && entity instanceof Character) {
            entity.setHp(Number(data[9]));
            entity.setHpMax(Number(data[10]));
          }

          if(entity.type === Types.EntityTypes.PLAYER)
          {
              entity.setSpriteByIndex(0, Number(data[12]));
              entity.setSpriteByIndex(1, Number(data[13]));
          }
          if (entity.type === Types.EntityTypes.NODE)
          {
            entity.name = data[3];
            entity.isDying = entity.isDead = false;
            const spriteName = data[9];
            const animName = data[10];
            entity.weaponType = data[11];
            entity.setSprite(game.sprites[spriteName]);
            entity.animate(animName, entity.idleSpeed);
          }

          if (entity instanceof Mob)
          {
            const spriteName = entity.getSpriteName();
            entity.name = spriteName;
            entity.setSprite(game.sprites[spriteName]);
          }
          else if (entity instanceof Block)
          {
            const nameData = data[3].split("-");
            const spriteName = "block-"+entity.kind;
            entity.setSprite(game.sprites[spriteName]);
            entity.animate(nameData[1], entity.idleSpeed);
          }
          else if (entity.type === Types.EntityTypes.TRAP)
          {
            const spriteName = "trap-"+entity.kind;
            entity.setSprite(game.sprites[spriteName]);

            // FIX: missing var, was an implicit global in the old non-strict build (silently undefined, so animName
            // was always "on"); under ES module strict mode this threw a ReferenceError, crashing all TRAP spawns.
            // Declared locally to preserve original behavior.
            let spriteId;
            const animName = (spriteId === 0) ? "off" : "on";
            entity.animate(animName, entity.idleSpeed);

          }
          else if (entity instanceof NpcStatic)
          {
              const uid = NpcData.Kinds[entity.kind].uid;
              entity.setSprite(game.sprites[uid]);
          }
          else if (entity instanceof NpcMove)
          {
              const uid = "npc"+(1+(~~(entity.kind/8)%4))+"_"+(1+(entity.kind%8));
              entity.setSprite(game.sprites[uid]);
              entity.npcQuestId = Number(data[8]);
              game.npc[entity.id] = entity;
          }

          if (entity instanceof EntityMoving && !(entity instanceof Block)) {
              entity.setOrientation(orientation);
              entity.idle(orientation);
          }

          game.addEntity(entity);

          let entityName = entity.name;

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
                const include = [];
                const ignored = [entity], // Always ignore self
                    ignoreTarget = function(target) {
                        ignored.push(target);
                    };

                if(entity.hasTarget()) {
                    ignoreTarget(entity.target);
                } else if(entity.previousTarget) {
                    ignoreTarget(entity.previousTarget);
                }

                const path = game.findPath(entity, x, y, ignored, include);
                if (!game.pathfinder.isValidPath(path))
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
                const p = game.player;
                if(p.target === entity) {
                    p.disengage();
                }

                log.info(entity.id + " was removed");

                entity.isDead = true;
                game.removeEntity(entity);
              });

              entity.onDeath(function() {
                const p = game.player;

                if (entity === p)
                  return;

                p.targetIndex = 0;
                log.info(entity.id + " is dead");

                if(p.target === entity) {
                    p.disengage();
                    clearTimeout(p.attackInterval);
                    p.attackInterval = null;
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


      proto.onSpawnCharacter = function(data, entity) {
            this.spawnEntity(data, entity);
      };


      // data - entityId, x, y, mapIndex
      proto.onDespawnEntity = function(data) {
            if (game.mapIndex !== Number(data[1]))
              return;

          const entity = game.getEntityById(Number(data[0]));
            if(entity) {
              let entityName;

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
              } else if(entity instanceof Block) {
                game.removeEntity(entity);
              } else if (entity.type === Types.EntityTypes.TRAP) {
                game.removeEntity(entity);
              } else if (entity.type === Types.EntityTypes.NODE) {
                game.removeEntity(entity);
              }
              entity.clean();
            }
      };


      // data - time, mapIndex, entityId, orientation, state, moveSpeed, x, y.
      proto.onEntityMove = function(data)
      {
            const time = Number(data[0]),
                map = Number(data[1]),
                id = Number(data[2]),
                orientation = Number(data[3]),
                state = Number(data[4]),
                moveSpeed = Number(data[5]),
                x = Number(data[6]),
                y = Number(data[7]);

            if (game.mapStatus < 2 || game.mapIndex !== map ||
                map !== game.player.mapIndex)
              return;

            const entity = game.getEntityById(id);
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

            if (entity === game.player)
            {
              const p = entity;
              if(!p || p.isDying || p.isDead)
                return;

              if (!(p.x===x && p.y===y))
              {
                console.warn("PLAYER NOT IN CORRECT POSITION.");
                // Dirty hack to avoid sending a incorrect packet in forcestop.
                p.resetPosition(x,y);
                p.setFreeze(G_ROUNDTRIP);
                game.client.sendSyncTime(Date.now());
                // FIX: was a bare property reference (no-op); this is clearly meant to force a
                // redraw after resetPosition() corrects a desynced player position
                game.renderer.forceRedraw = true;
              }
              return;
            }

            entity.setMoveRate(moveSpeed);
            if (state)
              entity.move(time, orientation, false, x, y);
            entity.move(time, orientation, state, x, y);
      };


      // time, mapIndex, entityId, orientation, interrupted, moveSpeed, path.
      proto.onEntityMovePath = function(data)
      {
            const time = Number(data.shift()),
              map = Number(data.shift()),
              id = Number(data.shift()),
              orientation = Number(data.shift()),
              interrupted = !!data.shift(),
              moveSpeed = Number(data.shift());

            const path = data;

            if (game.mapStatus < 2 || game.mapIndex !== map ||
                map !== game.player.mapIndex)
              return;

            let entity = game.getEntityById(id);

            if(id === game.player.id) return;

            if (!entity)
            {
              game.unknownEntities.push(id);
              return;
            }

            if(entity.isDying || entity.isDead)
              return;

            if (entity === game.player)
              return;

            let lockStepTime = (G_LATENCY - (Utils.getWorldTime()-time) + G_UPDATE_INTERVAL);
            lockStepTime = Utils.clamp(0,G_LATENCY,lockStepTime);

            entity.forceStop();
            entity.setPosition(path[0][0], path[0][1]);

            const movePathFunc = function () {
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

              entity.movePath(path);
              entity = null;
            };

            if (lockStepTime === 0)
              movePathFunc();
            else
              setTimeout(movePathFunc, lockStepTime);
      };


      proto.onEntityDestroy = function(data) {
            const id = Number(data[0]);
            const entity = game.getEntityById(id);
            if(entity) {
                if(entity instanceof Item) {
                    game.removeItem(entity);
                } else {
                    game.removeEntity(entity);
                }
                log.debug("Entity was destroyed: "+entity.id);
            }
      };


      proto.onMapStatus = function(mapId, status)
      {
          log.info("mapStatus="+mapId+","+status);
          game.mapIndex = Number(mapId);
          game.mapStatus = Number(status);
      };


      proto.onSetSprite = function(data)
      {

          const entity = game.getEntityById(Number(data[0]));
          if (!entity) return;

          if (entity instanceof Player)
          {
            entity.setSpriteByIndex(0, Number(data[1]));
            entity.setSpriteByIndex(1, Number(data[2]));

            game.app.initPlayerBar();
          } else {
            const num = Number(data[1]);
            const sprite = game.sprites[AppearanceData[num].sprite];
            entity.setSprite(sprite);
          }

      };


      proto.onSetAnimation = function(data)
      {

          const entity = game.getEntityById(Number(data[0]));
          if (!entity) return;

          // TODO - Not yet implemented.
      };


      proto.onBlockModify = function(data) {
          const entityId = Number(data[0]);
          const type = Number(data[1]);
          const blockId = Number(data[2]);


          const entity = game.getEntityById(entityId);
          const block = game.getEntityById(blockId);
          if (!entity || !block)
            return;

          if (type === 0) {
            block.pickup(entity);
          }
          else if (type === 1) {
            block.place(entity);
            entity.holdingBlock = null;
          }
      };


      proto.onPlayerInfo = function(data) {
          game.statDialog.page.assign(data);
      };


      proto.onPlayer = function(data) {
            data.shift();
            data.shift();

            const p = game.player;

            p.id = Number(data.shift());
            p.name = data.shift();
            p.mapIndex = Number(data.shift());
            p.orientation = Types.Orientations.DOWN;
            p.x = Number(data.shift()), p.y = Number(data.shift());
            p.setPositionSpawn(p.x, p.y);

            p.setHpMax(Number(data.shift()));
            p.setEpMax(Number(data.shift()));

            p.stats.exp = {
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

            p.level = Types.getLevel(p.stats.exp.base);

            p.colors = [];
            p.colors[0] = parseInt(data.shift());
            p.colors[1] = parseInt(data.shift());

            p.gold = [];
            p.gold[0] = parseInt(data.shift()); // inventory gold.
            p.gold[1] = parseInt(data.shift()); // bank gold.
            p.gems = parseInt(data.shift());

            game.inventoryDialog.setCurrency(p.gold[0], p.gems);
            game.bankHandler.setGold(p.gold[1]);

            p.setMoveRate(500);

            p.stats.attack = parseInt(data.shift());
            p.stats.defense = parseInt(data.shift());
            p.stats.health = parseInt(data.shift());
            p.stats.energy = parseInt(data.shift());
            p.stats.luck = parseInt(data.shift());
            p.stats.free = parseInt(data.shift());

            // TODO fix item inits, and skill functions.
            // FIX (var cleanup): this method reuses `itemCount` as a scratch variable for three
            // separate item lists below (equipment/inventory/bank) via three sequential `var
            // itemCount = ...` redeclarations - legal for var (same function-scoped variable,
            // reassigned each time) but a SyntaxError if all three became `let`/`const` at this
            // same scope level. Declared once here with `let`; the other two occurrences below
            // are now plain reassignments.
            let itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              const items = [];
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              const itemArray = Utils.ArrayParseInt(data.splice(0,(itemCount*6)));
              for(let i=0; i < itemCount; ++i)
              {
                const index = i*6;
                const itemRoom = new ItemRoom(
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

            const aid = parseInt(data.shift());
            const wid = parseInt(data.shift());

            const aSprite = game.sprites[AppearanceData[aid].sprite];
            const wSprite = game.sprites[AppearanceData[wid].sprite];

            p.setSprite(aSprite, 0);
            p.setSprite(wSprite, 1);

            itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              const items = [];
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              const itemArray = Utils.ArrayParseInt(data.splice(0,(itemCount*6)));
              for(let i=0; i < itemCount; ++i)
              {
                const index = i*6;
                const itemRoom = new ItemRoom(
                  itemArray[index+0],
                  itemArray[index+1],
                  itemArray[index+2],
                  itemArray[index+3],
                  itemArray[index+4],
                  itemArray[index+5],
                );
                items.push(itemRoom);
              }
              game.inventory.initInventory(items);
            }
            p.setRange();

            itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              const items = [];
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              const itemArray = Utils.ArrayParseInt(data.splice(0,(itemCount*6)));
              for(let i=0; i < itemCount; ++i)
              {
                  const index = i*6;
                  const itemRoom = new ItemRoom(
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
            const questCount = parseInt(data.shift());
            if (questCount > 0)
            {
              // FIX: `questArray.parseInt();` called the old
              // Array.prototype.parseInt monkey-patch (since removed)
              // without capturing its return value -- it was a no-op even
              // when the method existed, since Quest.update() (called via
              // `new Quest(...)` below) already runs its own
              // Utils.ArrayParseInt() on the raw slice. Removed rather than
              // converted, since keeping a discarded-result call around is
              // just dead code.
              const questArray = data.splice(0,(questCount*13));
              for(let i=0; i < questCount; ++i)
              {
                const index = i*13;
                p.quests[questArray[index]] = new Quest(questArray.slice(index,index+13));
              }
            }

            p.achievements = [];
            const achieveCount = parseInt(data.shift());
            if (achieveCount > 0)
            {
              // FIX: `achieveArray.parseInt();` called the old
              // Array.prototype.parseInt monkey-patch (since removed)
              // without capturing its return value -- it was a no-op even
              // when the method existed, since Achievement.update() (called
              // via `new Achievement(...)` below) already runs its own
              // Utils.ArrayParseInt() on the raw slice. Removed rather than
              // converted, since keeping a discarded-result call around is
              // just dead code.
              const achieveArray = data.splice(0,(achieveCount*7));
              let achievement = null;
              for(let i=0; i < achieveCount; ++i)
              {
                const index = i*7;
                achievement = new Achievement(achieveArray.slice(index,index+7));
                p.achievements.push(achievement);
              }
              game.achievementHandler.achievementReloadLog();
            }

            // FIX: `self` was never declared in this scope, so it resolved to the global
            // `window.self`, not the intended `game` object - every sibling handler in this
            // file is constructed with `game` directly
            p.skillHandler = new SkillHandler(game);

            const skillCount = parseInt(data.shift());
            // FIX: `skillExps.parseInt();` called the old
            // Array.prototype.parseInt monkey-patch without capturing its
            // return value, so skillExps was never actually converted to
            // numbers (unlike questArray/achieveArray above, nothing
            // downstream re-parses this -- Skill level math in
            // SkillHandler/skilldialog.js just divides these values, which
            // happens to coerce strings fine, but this was clearly meant to
            // parse before use). Fixed to capture the parsed result.
            const skillExps = Utils.ArrayParseInt(data.splice(0,skillCount));
            p.setSkills(skillExps);
            game.skillDialog.page.setSkills(skillExps);


            const shortcutCount = parseInt(data.shift());
            if (shortcutCount > 0)
            {
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              let shortcutArray = data.splice(0,(shortcutCount*3));
              shortcutArray = Utils.ArrayParseInt(shortcutArray);
              const shortcuts = [];
              for(let i=0; i < shortcutCount; ++i)
              {
                const index = i*3;
                shortcuts.push(shortcutArray.slice(index,index+3));
              }
              game.shortcuts.installAll(shortcuts);
            }

            game.onPlayerLoad(p);
      };

}
