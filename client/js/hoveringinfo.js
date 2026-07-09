// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */

export default class HoveringInfo {
        constructor(id, value, x, y, duration, type) {
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
            this.angle = Utils.randomRangeInt(20,160) / 180 * Math.PI;
            this.infoData = damageInfoData[type];
            this.effect = damageInfoData[type].effect || 0;
        }

        isTimeToAnimate(time) {
            return (time - this.lastTime) > this.speed;
        }

        isTimeToShow(time) {
            return (time - this.showTime) > this.interval;
        }

        isTimeToDestroy(time) {
        	return (time - this.showTime) > (this.interval + this.duration);
        }

        update(time) {
  				if(this.isTimeToAnimate(time)) {
  					this.lastTime = time;
  					this.tick(time);
  				}
        }

        tick(time) {
          if (this.effect === 0)
          {
            this.y -= 1;
          }
          else if (this.effect === 1)
          {
            this.y -= Math.sin(this.angle);
            this.x -= Math.cos(this.angle);
          }

  				this.opacity -= (100/this.duration);

  				if(this.isTimeToDestroy(time)) {
  					this.destroy();
  				}
        }

        onDestroy(callback) {
            this.destroy_callback = callback;
        }

        destroy() {
            if(this.destroy_callback) {
                this.destroy_callback(this.id);
            }
        }
}

// DEFINE(this stays module-scope; HoveringInfo constructor references it at call time, after module init completes, so hoisting order is safe)
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
