// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Character from './entity/character.js';
import Timer from './timer.js';
import Player from './entity/player.js';
import EntityMoving from './entity/entitymoving.js';

/* global Types */

export default class Updater {
        constructor(game) {
            this.game = game;
            this.performanceTime = 0;
            //this.tick = 5;
            this.lastUpdateTime = Date.now();
        }

        // FIX (maintainability): checkStopDanger/charPath*/charKey*/playerKey*/playerPath*/
        // stopTransition used to be assigned as closures inside the constructor
        // (`this.charPath = function (c, x, y) {...}`, capturing a local `self`/`game` alias)
        // instead of being real class methods. That pattern is very likely there to dodge a
        // `this`-binding problem: these get passed around and invoked as bare function
        // references (see Transition.start()/step() in transition.js, which stores whatever's
        // passed as `this.updateFunction` and later calls it as `this.updateFunction(this.object,
        // mod)` - a plain method with no `this` context supplied). A normal prototype method
        // passed the same way (e.g. `transition.start(this.charPathXF, ...)`) would lose its
        // `this` binding when called that way and throw.
        //
        // Class-field arrow functions get the same "always bound to this instance" behavior
        // (arrow functions close over the lexical `this` of the class instance, same as the old
        // `self` closures did) while making them real, discoverable members of the class instead
        // of logic buried in the constructor body. Updater is only ever instantiated once per
        // game session, so this has no effect on allocation frequency either way - it's purely
        // about the code being readable/navigable.
        checkStopDanger = (c) => {
          const o = c.orientation;
          let res=false;

          if (c.ex === -1 && c.ey === -1)
          {
            return false;
          }
          if (c.x === c.ex && c.y === c.ey)
          {
            log.info("checkStopDanger - coordinates equal");
            res = true;
          }

          const x = c.x, y = c.y;

          if (o === Types.Orientations.LEFT && c.x < c.ex)
          {
            return true;
          }
          else if (o === Types.Orientations.RIGHT && c.x > c.ex)
          {
            return true;
          }
          else if (o === Types.Orientations.UP && c.y < c.ey)
          {
            return true;
          }
          else if (o === Types.Orientations.DOWN && c.y > c.ey)
          {
            return true;
          }
          if (res) {
            c.setPosition(c.ex, c.ey);
            log.info("WARN - PLAYER "+c.id+" not stopping.");
            log.info("x :"+x+",y :"+y);
            log.info("ex:"+c.ex+",ey:"+c.ey);
          }
          return res;
        };

        charPath = (c, x, y) => {
          if (c.hasChangedItsPath())
          {
            return true;
          }
          // FIX: `c.map` is never set anywhere on Entity/Character (only game.mapContainer
          // exists), so this mid-path collision guard was permanently dead code - NPC/mob
          // movement never actually re-checked collision here. Also dropped the leftover
          // debug try/throw/console.error trace scaffold that sat in the dead branch.
          if (this.game.mapContainer && this.game.mapContainer.isColliding(x, y)) {
            return true;
          }
          c.setPosition(x, y);
          return c.nextStep();
        };

        charPathXF = (c, m) => {
          const x = c.x + m, y = c.y;
          return this.charPath(c, x, y);
        };

        charPathYF = (c, m) => {
          const x = c.x, y = c.y + m;
          return this.charPath(c, x, y);
        };

        charKey = (c, x, y) => {
          if (this.checkStopDanger(c))
          {
            c.forceStop();
            return true;
          }
          const res = this.game.moveCharacter(c, x, y);
          if (res) {
            c.setPosition(x, y);
          } else {
            c.forceStop();
          }
          return false;
        };

        charKeyXF = (c, m) => {
          const x = c.x + m;
          const y = c.y;
          return this.charKey(c, x, y);
        };

        charKeyYF = (c, m) => {
          const x = c.x;
          const y = c.y + m;
          return this.charKey(c, x, y);
        };

        playerKey = (c, x, y) => {
          const res = this.game.moveCharacter(c, x, y);
          if (res) {
            c.setPosition(x, y);
          } else {
            c.keyMove = true;
            c.forceStop();
          }
          return !res;
        };

        playerKeyXF = (c, m) => {
          const x = c.x + m;
          const y = c.y;
          return this.playerKey(c, x, y);
        };

        playerKeyYF = (c, m) => {
          const x = c.x;
          const y = c.y + m;
          return this.playerKey(c, x, y);
        };

        playerPath = (c, x, y) => {
          c.setPosition(x, y);
          return c.nextStep();
        };

        playerPathXF = (c, m) => {
          const x = c.x + m;
          const y = c.y;
          return this.playerPath(c,x,y);
        };

        playerPathYF = (c, m) => {
          const x = c.x;
          const y = c.y + m;
          return this.playerPath(c,x,y);
        };

        stopTransition = (c) => {
        }

        update() {
            if (game.mapStatus < 2)
            	return;

            this.looping = true;

            this.updateCharacters();
            this.updateTransitions();

            this.updateAnimations();
            //this.updateAnimatedTiles();
            this.updateChatBubbles();
            this.updateInfos();
            this.looping = false;
            this.lastUpdateTime = Date.now();
        }

        updateCharacters() {
            const self = this;
            const mc = game.mapContainer;

				// TODO - Optimization not working.
            // This code is intensive.
            //var frames = Math.max(1, ~~((Date.now() - this.lastUpdateTime) / G_UPDATE_INTERVAL));
            //console.warn("uc ticks="+ticks);
            game.forEachEntity(function(entity) {
                self.game.updateCameraEntity(entity.id, entity);
                if (!(entity instanceof EntityMoving))
                  return;

                entity.tickFrames = 0;
                if (entity.tick > 0) {
                  entity.tickFrames = entity.tick;
                  //console.warn("entity.tickFrames:"+entity.tickFrames);
                }
                if (entity instanceof Player)
                {
                  if (entity === game.player) {
                    self.updatePlayerPathMovement(entity);
                    self.updatePlayerKeyMovement(entity);
                  }
                  else {
                    self.updateCharacterKeyMovement(entity);
                    self.updateCharacterPathMovement(entity);
                  }
                }
                else if (entity instanceof Character) {
                  self.updateCharacterPathMovement(entity);
                }
            });
        }

        updateTransitions() {
            let self = this,
                m = null;

            game.forEachEntity(function(entity) {
            		if (!entity || entity.freeze || entity.isDead || entity.isDying)
            			return;

                m = entity.movement;
                if(m && m.inProgress) {
                    m.step();
                }
            });
        }

        updateCharacterPathMovement(c) {
            const self = this;

            //var ts = game.tilesize;
            const tick = c.tickFrames;
            //console.warn("tick="+tick);
            //var speed = c.moveSpeed;
            //var time = this.game.currentTime;
            const o = c.orientation;

            if (c.freeze || c.isStunned || c.isDying || c.isDead)
            {
              return;
            }

// TODO - Fix character stuttering thats corrupting the map display and collision.

            const canMove = c.movement.inProgress === false && c.isMovingPath();
            if(canMove) {
              if(o === Types.Orientations.LEFT) {
                c.movement.start(self.charPathXF,
                   self.stopTransition,
                   -tick);
              }
              else if(o === Types.Orientations.RIGHT) {
                c.movement.start(self.charPathXF,
                   self.stopTransition,
                   tick);
              }
              else if(o === Types.Orientations.UP) {
                c.movement.start(self.charPathYF,
                   self.stopTransition,
                   -tick);
              }
              else if(o === Types.Orientations.DOWN) {
                c.movement.start(self.charPathYF,
                   self.stopTransition,
                   tick);
              }
            }

        }

        updateCharacterKeyMovement(c)
        {
          if (c.freeze || c.isMovingPath() || c.isDying || c.isDead) {
            //log.info("character is frozen.")
            return;
          }

          const self = this;
          const tick = c.tickFrames;
          const o = c.orientation;

          const canMove = c.movement.inProgress === false  && c.keyMove && o > 0;
          if(canMove) {
            if(o === Types.Orientations.LEFT) {
              c.movement.start(self.charKeyXF,
                               null,
                               -tick);
            }
            else if(o === Types.Orientations.RIGHT) {
              c.movement.start(self.charKeyXF,
                               null,
                               tick);
            }
            else if(o === Types.Orientations.UP) {
              c.movement.start(self.charKeyYF,
                               null,
                               -tick);
            }
            else if(o === Types.Orientations.DOWN) {
              c.movement.start(
                               self.charKeyYF,
                               null,
                               tick);
            }
          }
        }

        updatePlayerPathMovement(c) {
          if (c.isDying || c.isDead || c.freeze || c.isStunned || c.keyMove || !c.isMovingPath()) {
                  return;
          }

          const self = this;
          const tick = c.tickFrames;
          const o = c.orientation;

// TODO - Fix character stuttering thats corrupting the map display and collision.

          const canMove = c.movement.inProgress === false;
          if(canMove) {
            c.updateMovement();
            if(o === Types.Orientations.LEFT) {
              c.movement.start(self.playerPathXF,
                 null,
                 -tick);
            }
            else if(o === Types.Orientations.RIGHT) {
              c.movement.start(self.playerPathXF,
                 null,
                 tick);
            }
            else if(o === Types.Orientations.UP) {
              c.movement.start(self.playerPathYF,
                 null,
                 -tick);
            }
            else if(o === Types.Orientations.DOWN) {
              c.movement.start(self.playerPathYF,
                 null,
                 tick);
            }
          }

        }

        updatePlayerKeyMovement(c)
        {
          if(!game.player)
              return;

          if (c.isDying || c.isDead || c.freeze || c.isStunned || c.isMovingPath())
          {
            return;
          }

          const self = this;
          const tick = c.tickFrames;
          const o = c.orientation;

          // STRICT alignment requirement for key movement
          const canMove = !c.movement.inProgress &&
                        c.keyMove &&
                        o > 0;

          if(canMove) {
            if(o === Types.Orientations.LEFT) {
              c.movement.start(self.playerKeyXF,
                               null,
                               -tick);
            }
            else if(o === Types.Orientations.RIGHT) {
              c.movement.start(self.playerKeyXF,
                               null,
                               tick);
            }
            else if(o === Types.Orientations.UP) {
              c.movement.start(self.playerKeyYF,
                               null,
                               -tick);
            }
            else if(o === Types.Orientations.DOWN) {
              c.movement.start(self.playerKeyYF,
                               null,
                               tick);
            }
          }

        }

        updateAnimations() {
            const t = game.currentTime;

            game.camera.forEachInScreen(function(entity) {
                if (!entity)
                	return;

            	const anim = entity.currentAnimation;

                if(anim && !entity.isStun) {
                    if(anim.update(t)) {
                        //entity.setDirty();
                    }
                }
            });

            const target = this.game.targetAnimation;
            if(target) {
                target.update(t);
            }

            if (game.appearanceDialog.visible)
            {
              const pa = game.appearanceDialog.playerAnim;
              if (pa.currentAnimation) {
                const animName = pa.currentAnimation.name;
                pa.currentAnimation.update(t);
                //for (var sprite of pa.sprites)
                  //sprite.currentAnimation.update(t);
                pa.show();
              }
            }
        }

        updateAnimatedTiles() {
            const self = this,
                t = game.currentTime;

            game.forEachAnimatedTile(function (tile) {
                tile.animate(t);
            });
        }

        updateChatBubbles() {
            const t = this.game.currentTime;
            game.bubbleManager.update(t);
        }

        updateInfos() {
            const t = this.game.currentTime;

            this.game.infoManager.update(t);
        }
}
