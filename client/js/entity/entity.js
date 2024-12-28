
define(['../timer'], function(Timer) {

    var Entity = Class.extend({
        init: function(id, type, mapIndex, kind) {
            this.id = id;
            this.type = type;
            this.mapIndex = mapIndex;
            this.kind = kind;

            // Renderer
            this.sprite = null;
            this.flipSpriteX = false;
            this.flipSpriteY = false;
            this.pjsSprite = null;
            this.animations = null;
            this.currentAnimation = null;

            // Modes
            this.isLoaded = false;
            this.visible = true;
            this.isFading = false;

            this.prevOrientation=null;
            this.name = "";

            this.fadingTime = 1000;
            this.fadingTimer = new Timer(this.fadingTime, getTime());
            this.lockfadeIn = false;

            this.spriteChanged = true;

            this.x = 0;
            this.y = 0;
            //this.gx = 0;
            //this.gy = 0;
            //this.pgx = 0;
            //this.pgy = 0;
        },

        hasAnimation: function (type) {
          if (!this.currentAnimation)
            return false;
          return this.currentAnimation.name.indexOf(type) == 0;
        },

        animate: function(animation, speed, count, onEndCount) {
            var oriented = ['atk', 'walk', 'idle'],
                o = this.orientation || Types.Orientations.DOWN;

            this.flipSpriteX = false;
            this.flipSpriteY = false;

            if(_.indexOf(oriented, animation) >= 0) {
                animation += "_" + (o === Types.Orientations.LEFT ? "right" : Types.getOrientationAsString(o));
                this.flipSpriteX = (this.orientation === Types.Orientations.LEFT) ? true : false;
            }

            if (this.type == 10)
              console.info("animation: "+animation+", speed:"+speed+", count:"+count+", onEndCount:"+onEndCount);
            this.setAnimation(animation, speed, count, onEndCount);
        },

        onRemove: function(callback) {
          this.remove_callback = callback;
        },

        setName: function(name) {
            this.name = name;
        },

        _setPosition: function(x, y) {
            var ts = G_TILESIZE;

            this.x = x;
            this.y = y;

            var gx = (x >> 4);
            var gy = (y >> 4);

            if (x % ts == 0) {
              this.gx = gx;
            }
            if (y % ts == 0) {
              this.gy = gy;
            }

        },

        setPosition: function (x, y) {
          this._setPosition(x,y);
        },

        setPositionGrid: function(x, y) {
            var ts = game.tilesize;

            this.x = x;
            this.y = y;

            var gx = (x >> 4);
            var gy = (y >> 4);

            this.gx = gx;
            this.gy = gy;
            /*if (x % ts == 0) {
              this.gx = gx;
            }
            if (y % ts == 0) {
              this.gy = gy;
            }*/
        },

        getPositionGridPrev: function () {
          var gx = this.gx; //(this.x >> 4);
          var gy = this.gy; //(this.y >> 4);

          /*switch(this.orientation) {
            case Types.Orientations.UP:
              gy++;
              break;
            case Types.Orientations.DOWN:
              gy--;
              break;
            case Types.Orientations.LEFT:
              gx++;
              break;
            case Types.Orientations.RIGHT:
              gx--;
              break;
          }*/
          return {gx: gx, gy: gy};
        },

        setPositionSpawn: function(x, y) {
            log.info("setPositionSpawn - x:"+x+"y:"+y);

            this.x = x;
            this.y = y;

            var gx = this.gx = (x >> 4);
            var gy = this.gy = (y >> 4);

            this.spawnGx = gx;
            this.spawnGy = gy;
        },

        setSprite: function(sprite) {
            if(!sprite) {
                log.error(this.id + " : sprite is null", true);
                throw "Sprite error";
            }

            if(this.sprite && this.sprite.name === sprite.name) {
                return;
            }

            if (!this.pjsSprite)
              this.pjsSprite = game.renderer.createSprite(sprite);
            else
              game.renderer.changeSprite(sprite, this.pjsSprite);
            this.oldSprite = this.sprite;
            this.sprite = sprite;
            this.animations = sprite.createAnimations();

            this.isLoaded = true;
            if(this.ready_func) {
                this.ready_func();
            }
        },

        getSprite: function() {
            return this.sprite;
        },

        getSpriteName: function() {
            return this.spriteName;
        },

        getAnimationByName: function(name) {
            var animation = null;

            if(name in this.animations) {
                animation = this.animations[name];
            }
            else {
                var e = new Error();
                log.error(e.stack);
                log.info("No animation called "+ name);
                return null;
            }
            return animation;
        },

        setAnimation: function(name, speed, count, onEndCount) {
            var self = this;

            if(this.isLoaded) {
                if(this.currentAnimation && this.currentAnimation.name === name) {
                    return;
                }

                if ((this.isDying || this.isDead) && this.currentAnimation.name == "death")
                  return;

                var s = this.sprite,
                    a = this.getAnimationByName(name);

                if(a) {
                    this.currentAnimation = a;
                    if(name.indexOf("atk") === 0) {
                        this.currentAnimation.reset();
                    }
                    this.currentAnimation.setSpeed(speed);
                    this.currentAnimation.setCount(count ? count : 0, onEndCount || function() {
                        self.idle(self.orientation);
                    });
                }
            }
            else {
                this.log_error("Not ready for animation");
            }
        },

        ready: function(f) {
            this.ready_func = f;
        },

        clean: function() {
        },

        log_info: function(message) {
            log.info("["+this.id+"] " + message);
        },

        log_error: function(message) {
            log.error("["+this.id+"] " + message);
        },

        setVisible: function(value) {
            this.visible = value;
        },

        isVisible: function() {
            return this.visible;
        },

        toggleVisibility: function() {
            if(this.visible) {
                this.setVisible(false);
            } else {
                this.setVisible(true);
            }
        },

        fadeInEntity: function(time) {
            if (this.lockfadeIn == true)
              return;

            this.isFading = true;
            this.fadingTime.lastTime = time;
        },

        getFadeRatio: function(time) {
          if (this.lockfadeIn == true)
            return 1.0;

          if (this.fadingTimer.isOver(time))
          {
            this.isFading = false;
            this.lockfadeIn = true;
            return 1.0;
          }
          return this.fadingTimer.getRatio(time);
        },
/*
        isNextToo: function (x,y,dist) {
          dist = dist || G_TILESIZE;
          return (Math.abs(this.x-x) <= dist && Math.abs(this.y-y) <= dist);
        },

        isNextTooEntity: function (entity) {
            return this.isNextToo(entity.x, entity.y);
        },

        isWithin: function (entity) {
          return this.isNextToo(entity.x,entity.y, (G_TILESIZE >> 1));
        },

        isTouching: function (entity) {
          return this.isNextToo(entity.x,entity.y, (G_TILESIZE));
        },

        isOver: function (x, y) {
            return this.isNextToo(x, y, (G_TILESIZE >> 1));
        },
*/
        isWithinDist: function (x,y,dist) {
          dist = dist || G_TILESIZE;
          var dx = Math.abs(this.x-x);
          var dy = Math.abs(this.y-y);
          return (dx <= dist && dy <= dist);
        },

        isNextTooEntity: function (entity) {
            return this.isWithinDist(entity.x, entity.y, G_TILESIZE);
        },

        isNextTooPosition: function (x, y) {
            return this.isWithinDist(x, y, G_TILESIZE);
        },

        isOverEntity: function (entity) {
            return this.isWithinDist(entity.x, entity.y, (G_TILESIZE >> 1));
        },

        isOverPosition: function (x, y) {
            return this.isWithinDist(x, y, (G_TILESIZE >> 1));
        },

        isOverlappingEntity: function (entity) {
          return this.isWithinDist(entity.x,entity.y, G_TILESIZE-1);
        },

    });

    return Entity;
});
