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

      //if(sprite.name in this.sprites) {
      //    return;
      //}

      //if (!sprite.pjsSprite)
      //  sprite.pjsSprite = game.renderer.createSprite(sprite);
      //else
      //  game.renderer.changeSprite(sprite, sprite.pjsSprite);

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

/*
for (var sprite of this.sprites) {
  var anim = sprite.currentAnimation = sprite.animations[name];

  //anim.reset();

  this.currentAnimation = anim;
  if(name.indexOf("atk") === 0) {
      anim.reset();
  }
  anim.setSpeed(speed);
  anim.setCount(count ? count : 0, onEndCount || function() {
      self.idle();
  });

}
*/
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

  });
  return PlayerAnim;
});
