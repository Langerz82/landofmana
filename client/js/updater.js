
define(['entity/character', 'timer', 'entity/player', 'entity/entitymoving'], function(Character, Timer, Player, EntityMoving) {

    var Updater = Class.extend({
        init: function(game) {
            var self = this;
            this.game = game;
            this.performanceTime = 0;
            //this.tick = 5;
            this.lastUpdateTime = Date.now();

            this.checkStopDanger = function (c)
            {
              var o = c.orientation;
              var res=false;

              if (c.ex == -1 && c.ey == -1)
              {
                return false;
              }
              if (c.x == c.ex && c.y == c.ey)
              {
                log.info("checkStopDanger - coordinates equal");
                res = true;
              }


              var x = c.x, y = c.y;

              if (o == Types.Orientations.LEFT && c.x < c.ex)
              {
                return true;
              }
              else if (o == Types.Orientations.RIGHT && c.x > c.ex)
              {
                return true;
              }
              else if (o == Types.Orientations.UP && c.y < c.ey)
              {
                return true;
              }
              else if (o == Types.Orientations.DOWN && c.y > c.ey)
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

            this.charPathXF = function(c, m) {
              var x = c.x + m;
              if (c.hasChangedItsPath())
              {
                return false;
              }
              c.setPosition(x, c.y);
              return c.nextStep();
            };

            this.charPathYF = function(c, m) {
              var y = c.y + m;
              if (c.hasChangedItsPath())
              {
                return false;
              }
              c.setPosition(c.x, y);
              return c.nextStep();
            };

            this.charKeyXF = function(c, m) {
              var x = c.x + m;
              if (x == c.ex || self.checkStopDanger(c))
              {
                c.forceStop();
                return true;
              }
              c.setPosition(x, c.y);
              return false;
            };

            this.charKeyYF = function(c, m) {
              var y = c.y + m;
              if (y == c.ey || self.checkStopDanger(c))
              {
                c.forceStop();
                return true;
              }
              c.setPosition(c.x, y);
              return false;
            };

            this.playerKeyXF = function(c, m) {
              var x = c.x + m;
              var res = game.moveCharacter(c, x, c.y);
              if (res) {
                c.setPosition(x, c.y);
                if (x % G_TILESIZE === 0)
                {
                  game.mapContainer.moveGrid();
                }
              } else {
                c.forceStop();
              }
              return !res;
            };

            this.playerKeyYF = function(c, m) {
              var y = c.y + m;
              var res = game.moveCharacter(c, c.x, y);
              if (res) {
                c.setPosition(c.x, y);
                if (y % G_TILESIZE === 0)
                {
                  game.mapContainer.moveGrid();
                }
              } else {
                c.forceStop();
              }
              return !res;
            };

            this.playerPathXF = function(c, m) {
              var x = c.x + m;
              c.setPosition(x, c.y);
              if (x % G_TILESIZE === 0)
              {
                game.mapContainer.moveGrid();
              }
              return c.nextStep();
            };

            this.playerPathYF = function(c, m) {
              var y = c.y + m;
              c.setPosition(c.x, y);
              if (y % G_TILESIZE === 0)
              {
                game.mapContainer.moveGrid();
              }
              return c.nextStep();
            };

            this.stopTransition = function (c) {
              //if (c.movement.inProgress)
                //c.forceStop();
            }

        },

        update: function() {
            var ts = game.tilesize;

            //log.info("Updater.update() called");
            //if (game.client)
              //setTimeout(game.client.packetProcFunc,8);
            //game.client.packetProcFunc();

            if (game.mapStatus < 2)
            	return;

            //game.camera.setRealCoords();
            //

            //this.updateRan = false;
            this.looping = true;

            this.updateCharacters();
            this.updateTransitions();

            this.updateAnimations();
            //this.updateAnimatedTiles();
            this.updateChatBubbles();
            this.updateInfos();
// TODO - Re-enable after testing.
            //this.updatePerformance();
            this.looping = false;
            //this.updateRan = true;
            this.lastUpdateTime = Date.now();
        },

        updateCharacters: function() {
            var self = this;
            var mc = game.mapContainer;

			// TODO - Optimization not working.
            // This code is intensive.
            var frames = Math.max(1, ~~((Date.now() - this.lastUpdateTime) / G_UPDATE_INTERVAL));
            //console.warn("uc ticks="+ticks);
            game.forEachEntity(function(entity) {
                self.game.updateCameraEntity(entity.id, entity);
                if (!(entity instanceof EntityMoving))
                  return;

                entity.tickFrames = 0;
                if (entity.tick > 0) {
                  entity.tickFrames = entity.tick * frames;
                  //console.warn("entity.tickFrames:"+entity.tickFrames);
                }
                if (entity instanceof Player)
                {
                  if (entity == game.player) {
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
        },

        updateTransitions: function() {
            var self = this,
                m = null;

            game.forEachEntity(function(entity) {
            		if (!entity || entity.freeze || entity.isDead || entity.isDying)
            			return;

                m = entity.movement;
                if(m && m.inProgress) {
                    m.step();
                }
            });
        },

        updateCharacterPathMovement: function(c) {
            var self = this;

            //var ts = game.tilesize;
            var tick = c.tickFrames;
            //console.warn("tick="+tick);
            //var speed = c.moveSpeed;
            //var time = this.game.currentTime;
            var o = c.orientation;

            if (c.freeze || c.isStunned || c.isDying || c.isDead)
            {
              return;
            }

// TODO - Fix character stuttering thats corrupting the map display and collision.

            var canMove = c.movement.inProgress === false && c.isMovingPath();
            if(canMove) {
              if(o == Types.Orientations.LEFT) {
                c.movement.start(self.charPathXF,
                   self.stopTransition,
                   -tick);
              }
              else if(o == Types.Orientations.RIGHT) {
                c.movement.start(self.charPathXF,
                   self.stopTransition,
                   tick);
              }
              else if(o == Types.Orientations.UP) {
                c.movement.start(self.charPathYF,
                   self.stopTransition,
                   -tick);
              }
              else if(o == Types.Orientations.DOWN) {
                c.movement.start(self.charPathYF,
                   self.stopTransition,
                   tick);
              }
            }

        },

        updateCharacterKeyMovement: function(c)
        {
          var self = this;
          var tick = c.tickFrames;
          //var speed = c.moveSpeed;
          //var time = this.game.currentTime;
          var o = c.orientation;

          if (c.freeze || c.isMovingPath() || c.isDying || c.isDead) {
            //log.info("character is frozen.")
            return;
          }

          var canMove = c.movement.inProgress === false  && c.keyMove && o > 0;
          if(canMove) {
            if(o == Types.Orientations.LEFT) {
              c.movement.start(self.charKeyXF,
                               null,
                               -tick);
            }
            else if(o == Types.Orientations.RIGHT) {
              c.movement.start(self.charKeyXF,
                               null,
                               tick);
            }
            else if(o == Types.Orientations.UP) {
              c.movement.start(self.charKeyYF,
                               null,
                               -tick);
            }
            else if(o == Types.Orientations.DOWN) {
              c.movement.start(
                               self.charKeyYF,
                               null,
                               tick);
            }
          }
        },

        updatePlayerPathMovement: function(c) {
            var self = this;

            //var time = game.currentTime;
            //var ts = game.tilesize;
            var tick = c.tickFrames;
            //var speed = c.moveSpeed;
            var o = c.orientation;

            if (c.isDying || c.isDead || c.freeze || c.isStunned || c.keyMove || !c.isMovingPath())
            {
              return;
            }

// TODO - Fix character stuttering thats corrupting the map display and collision.


            var canMove = c.movement.inProgress === false;
            if(canMove) {
              if(o == Types.Orientations.LEFT) {
                c.movement.start(self.playerPathXF,
                   null,
                   -tick);
              }
              else if(o == Types.Orientations.RIGHT) {
                c.movement.start(self.playerPathXF,
                   null,
                   tick);
              }
              else if(o == Types.Orientations.UP) {
                c.movement.start(self.playerPathYF,
                   null,
                   -tick);
              }
              else if(o == Types.Orientations.DOWN) {
                c.movement.start(self.playerPathYF,
                   null,
                   tick);
              }
            }

        },

        updatePlayerKeyMovement: function(c)
        {
            var self = this;

            if(!game.player)
                return;

            //var time = game.currentTime;
            var tick = c.tickFrames;
            //var ts = game.tilesize;
            //var speed = c.moveSpeed;
            //var gc = game.camera;
            var o = c.orientation;



            if (game.joystick && game.usejoystick)
            {
              if (!game.joystick.isActive())
              {
                 c.move(c.orientation, false);
              }
             if (game.joystick.right())
             {
               //c.move(c.orientation, false);
                 c.move(Types.Orientations.RIGHT, true);
             }
             else if (game.joystick.left())
             {
               //c.move(c.orientation, false);
                 c.move(Types.Orientations.LEFT, true);
             }
             else if (game.joystick.up())
             {
               //c.move(c.orientation, false);
                 c.move(Types.Orientations.UP, true);
             }
             else if (game.joystick.down())
             {
                 //c.move(c.orientation, false);
                 c.move(Types.Orientations.DOWN, true);
             }
             /*else {
               c.move(Types.Orientations.NONE, false);
             }*/
          }

          if (game.joystick && game.joystick.isActive())
          {
            clearInterval(game.autotalk);
          }

          if (c.isDying || c.isDead || c.freeze || c.isStunned || c.isMovingPath())
          {
            return;
          }

// TODO - Skip Move needs FIXING to fix scrolling!!!!!!!!!!!!!!!!!!!!!!


          var canMove = c.movement.inProgress === false && c.keyMove;
          if(canMove) {
            if(o == Types.Orientations.LEFT) {
              c.movement.start(self.playerKeyXF,
                               null,
                               -tick);
            }
            else if(o == Types.Orientations.RIGHT) {
              c.movement.start(self.playerKeyXF,
                               null,
                               tick);
            }
            else if(o == Types.Orientations.UP) {
              c.movement.start(self.playerKeyYF,
                               null,
                               -tick);
            }
            else if(o == Types.Orientations.DOWN) {
              c.movement.start(self.playerKeyYF,
                               null,
                               tick);
            }
          }

        },

        updateAnimations: function() {
            var t = game.currentTime;

            game.camera.forEachInScreen(function(entity) {
                if (!entity)
                	return;

            	var anim = entity.currentAnimation;

                if(anim && !entity.isStun) {
                    if(anim.update(t)) {
                        //entity.setDirty();
                    }
                }
            });

            var target = this.game.targetAnimation;
            if(target) {
                target.update(t);
            }

            if (game.appearanceDialog.visible)
            {
              var pa = game.appearanceDialog.playerAnim;
              if (pa.currentAnimation) {
                var animName = pa.currentAnimation.name;
                pa.currentAnimation.update(t);
                //for (var sprite of pa.sprites)
                  //sprite.currentAnimation.update(t);
                pa.show();
              }
            }
        },

        updateAnimatedTiles: function() {
            var self = this,
                t = game.currentTime;

            game.forEachAnimatedTile(function (tile) {
                tile.animate(t);
            });
        },

        updateChatBubbles: function() {
            var t = this.game.currentTime;
            game.bubbleManager.update(t);
        },

        updateInfos: function() {
            var t = this.game.currentTime;

            this.game.infoManager.update(t);
        }
    });

    return Updater;
});
