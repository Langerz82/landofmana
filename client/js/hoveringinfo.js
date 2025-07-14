
define(function() {
    var HoveringInfo = Class.extend({
        DURATION: 1000,

        init: function(id, value, x, y, duration, type) {
            this.id = id;
            this.value = value;
            this.duration = duration * 2;
            this.x = x;
            this.y = y;
            this.opacity = 1.0;
            this.lastTime = 0;
            this.speed = damageInfoData[type].speed;
            this.interval = damageInfoData[type].interval || 0;
            this.fillColor = damageInfoData[type].fill;
            this.strokeColor = damageInfoData[type].stroke;
            this.fontSize = damageInfoData[type].fontSize;
            //this.showTime = game.currentTime;
            this.angle = randomInt(20,160) / 180 * Math.PI;
            this.infoData = damageInfoData[type];
            this.effect = damageInfoData[type].effect || 0;
        },

        isTimeToAnimate: function(time) {
            return (time - this.lastTime) > this.speed;
        },

        isTimeToShow: function(time) {
            return (time - this.showTime) > this.interval;
        },

        isTimeToDestroy: function (time) {
        	return (time - this.showTime) > (this.interval + this.duration);
        },

        update: function(time) {
  				if(this.isTimeToAnimate(time)) {
  					this.lastTime = time;
  					this.tick(time);
  				}
        },

        tick: function(time) {
          if (this.effect == 0)
          {
            this.y -= 1;
          }
          else if (this.effect == 1)
          {
            this.y -= Math.sin(this.angle);
            this.x -= Math.cos(this.angle);
          }

  				this.opacity -= (100/this.duration);

  				if(this.isTimeToDestroy(time)) {
  					this.destroy();
  				}
        },

        onDestroy: function(callback) {
            this.destroy_callback = callback;
        },

        destroy: function() {
            if(this.destroy_callback) {
                this.destroy_callback(this.id);
            }
        }
    });

    var damageInfoData = {
        "levelUp": {
          fill: 0x00FFFF,
          stroke: 0x000000,
          fontSize: 10,
          speed: 100,
          effect: 0
        },
        "minorLevelUp": {
          fill: 0x00FFFF,
          stroke: 0x000000,
          fontSize: 8,
          speed: 100,
          effect: 0
        },
        "received": {
            fill: 0xFF4040,
            stroke: 0x000000,
            fontSize: 6,
            speed: 25,
            effect: 1
        },
        "inflicted": {
            fill: 0xFF4040,
            stroke: 0x000000,
            fontSize: 6,
            speed: 25,
            effect: 1
        },
        "healed": {
            fill: 0x60FF60,
            stroke: 0x000000,
            fontSize: 6,
            speed: 25,
            effect: 1
         },
        "health": {
            fill: 0xFFFFFF,
            stroke: 0x000000,
            fontSize: 6,
            speed: 25,
            effect: 1
        },
       "crit": {
            fill: 0xFFFF00,
            stroke: 0x000000,
            fontSize: 6,
            speed: 25,
            effect: 1
        },
        "experience": {
             fill: 0x00FFFF,
             stroke: 0x000000,
             fontSize: 6,
             speed: 50,
             effect: 0
         }

    };

    return HoveringInfo;
});
