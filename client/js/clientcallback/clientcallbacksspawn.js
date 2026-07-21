// Mixin extracted from clientcallbacks.js: entity spawn/despawn/destroy
// (onSpawnItem, spawnEntity, onSpawnCharacter, onDespawnEntity, onEntityDestroy).
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Entity from '../entity/entity.js';
import EntityMoving from '../entity/entitymoving/entitymoving.js';
import Item from '../entity/item.js';
import ItemLoot from '../data/itemlootdata.js';
import Mob from '../entity/mob.js';
import NpcStatic from '../entity/npcstatic.js';
import NpcMove from '../entity/npcmove.js';
import NpcData from '../data/npcdata.js';
import Character from '../entity/character/character.js';
import Block from '../entity/block.js';
import MobData from '../data/mobdata.js';
/* global Types, ItemTypes, log, game */

export function installClientCallbacksSpawn(proto) {

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

}
