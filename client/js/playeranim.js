define(['sprite','animation','timer'], function(Sprite, Animation, Timer) {
  var PlayerAnim = Class.extend({
    init: function() {
      this.flipSpriteX = false;
      this.flipSpriteY = false;
      this.pjsSprite = null;
      this.animations = null;
      this.currentAnimation = null;
      this.isLoaded = false;
      this.visible = true;

      this.sprites = [];
      this.animations = [];

      this.speeds = {
        attack: 100,
        move: 50,
        walk: 150,
        idle: 500
      };
    },

    loadAnimations: function (sprite) {
      var animations = sprite.createAnimations();
      //sprite.animations = animations;
      for (var id in animations)
      {
        if (!this.animations[id])
          this.animations[id] = animations[id];
      }

      this.isLoaded = true;
      if(this.ready_func) {
          this.ready_func();
      }
    },

    addSprite: function (sprite)
    {
      if(!sprite) {
          log.error(this.id + " : sprite is null", true);
          throw "Sprite error";
      }

      this.sprites.push(sprite);

      this.loadAnimations(sprite);
    },

    ready: function(f) {
        this.ready_func = f;
    },

    getSprite: function(index) {
        return this.sprite[index];
    },

    getSpriteName: function(index) {
        return this.sprite[index].name;
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

            var s = this.sprite,
                a = this.getAnimationByName(name);

            if(a) {
                this.currentAnimation = a;
                if(name.indexOf("atk") === 0) {
                    this.currentAnimation.reset();
                }
                this.currentAnimation.setSpeed(speed);
                this.currentAnimation.setCount(count ? count : 0, onEndCount || function() {
                    self.idle();
                });
            }
        }
        else {
            this.log_error("Not ready for animation");
        }
    },

    idle: function(orientation) {
        this.orientation = orientation;
        this.animate("idle", this.speeds.idle);
    },

    hit: function(orientation) {
        this.orientation = orientation;
        this.animate("atk", this.speeds.attack, 1);
    },

    walk: function(orientation) {
        this.orientation = orientation;
        this.animate("walk", this.speeds.walk);
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

        this.setAnimation(animation, speed, count, onEndCount);
    },

    setHTML: function (html) {
      this.html = html;
    },

    show: function () {
      var animName = this.currentAnimation.name,
        s = game.renderer.gameScale;

      var i = 0;
      var types = ["armor", "weapon"];
      for (var sprite of this.sprites) {
        var anim = this.currentAnimation;
        var frame = anim.currentFrame;
        var div = $(this.html[i]);
        var w = (sprite.width * s);
        var h = (sprite.height * s);
        var x = frame.i * w;
        var y = frame.j * h;

        div.css('width', w+'px');
        div.css('height', h+'px');
        div.css('background-image', "url('img/2/sprites/"+sprite.name+".png')");
        div.css('background-size', (w*5)+'px '+(h*9)+'px ');
        div.css('background-position', '-'+x+'px -'+y+'px');
        i++;
      }
    },

    showHTML: function (jqRoot, gameScale, scale) {
      var wmax = 0, hmax = 0;
      var dimensions = [];
      for (var sprite of this.sprites)
      {
        var w = sprite ? sprite.width * scale : 0;
        var h = sprite ? sprite.height * scale : 0;
        dimensions.push([w,h]);
        if (w > wmax)
          wmax = w;
        if (h > hmax)
          hmax = h;
      }

      $(jqRoot).css({
        'margin-left': '-' + parseInt(wmax / 2) + 'px',
        'margin-top': '-' + parseInt(hmax / 2) + 'px',
        'width': wmax + 'px',
        'height': hmax + 'px'
      });

      var i=0;
      for (var html of this.html)
      {
        $(html).css('left', parseInt((wmax - dimensions[i][1]) / 2) + 'px');
        $(html).css('top', parseInt((hmax - dimensions[i][1]) / 2) + 'px');
        i++;
      }
    }
  });
  return PlayerAnim;
});
