
define(['animation'], function(Animation) {

    var Sprite = Class.extend({
        init: function(data, scale, container) {
            this.name = data.id;
            this.file = data.file;
            this.scale = scale;
            this.container = container;
            this.isLoaded = false;
            this.offsetX = 0;
            this.offsetY = 0;
            this.data = data;

            this.loadJSON(data);

            this.whiteSprite = {
                isLoaded: true,
            };
            this.silhouetteSprite = {
                isLoaded: true,
            };
            this.rsprite = null;
        },

        loadJSON: function(data) {
            this.id = data.id;

            if (this.file)
              this.filepath = "img/" + this.scale + "/sprites/" + this.file;
            else if (data.file)
              this.filepath = "img/" + this.scale + "/sprites/" + data.file;
            else
              this.filepath = "img/" + this.scale + "/sprites/" + this.id + ".png";

            this.animationData = data.animations;
            this.width = data.width;
            this.height = data.height;
            this.offsetX = (data.offset_x !== undefined) ? data.offset_x : -16;
            this.offsetY = (data.offset_y !== undefined) ? data.offset_y : -16;
        },

        createAnimations: function() {
            this.animations = {};

            for(var name in this.animationData) {
                var a = this.animationData[name];
                if (!a.hasOwnProperty('col')) a.col = 0;
                this.animations[name] = new Animation(name, a.length, a.col, a.row, this.width, this.height);
            }

            return this.animations;
        },

        getAnimationByName: function(name) {
            var animation = null;

            if(name in this.animations) {
                animation = this.animations[name];
            }
            else {
                var e = new Error();
                log.error(e.stack);
                log.error("No animation called "+ name);
            }
            return animation;
        },

        setAnimation: function(name, speed, count, onEndCount) {
            var self = this;

            if(this.currentAnimation && this.currentAnimation.name === name) {
                return;
            }

            var s = this.sprite,
                a = this.getAnimationByName(name);

            if(a) {
                this.currentAnimation = a;
                this.currentAnimation.setSpeed(speed);
                this.currentAnimation.setCount(count ? count : 0, onEndCount);
            }

        },
    });
    return Sprite;
});
