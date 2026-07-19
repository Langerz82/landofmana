// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */

export default class HoveringInfo {
        constructor(id, value, x, y, duration, type) {
            this.id = id;
            this.value = value;
            this.duration = duration;
            this.x = x;
            this.y = y;
            this.opacity = 1.0;
            this.lastTime = 0;
            this.speed = damageInfoData[type].speed;
            this.interval = damageInfoData[type].interval || 0;
            this.fillColor = damageInfoData[type].fill;
            this.strokeColor = damageInfoData[type].stroke;
            this.fontSize = damageInfoData[type].fontSize;
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
  					// FIX: capture the real elapsed gap before overwriting lastTime, and hand it to
  					// tick() so opacity can decay by actual elapsed time instead of the nominal
  					// `speed` value. Real tick spacing is quantized by the ~16ms game loop that
  					// gates isTimeToAnimate() (e.g. speed:50 actually lands ~every 64ms), so using
  					// the nominal speed for the decrement under-counts elapsed time and leaves
  					// opacity still partially visible when isTimeToDestroy() fires.
  					const delta = this.lastTime ? (time - this.lastTime) : 0; // FIX: this.lastTime starts at 0 (not a real timestamp); without this guard the very first tick computed delta as the full epoch time (~1.7e12 ms), instantly driving opacity hugely negative and making the info invisible from frame one.
  					this.lastTime = time;
  					this.tick(time, delta);
  				}
        }

        tick(time, delta) {
          if (this.effect === 0)
          {
            this.y -= 1;
          }
          else if (this.effect === 1)
          {
            var speed = this.speed / 100;
            this.y -= speed * Math.sin(this.angle);
            this.x -= speed * Math.cos(this.angle);
          }

  				// FIX: was `100/this.duration` (and later `this.speed/this.duration`), both of
  				// which assume a fixed tick period that doesn't match the real, loop-quantized gap
  				// between ticks. Decrementing by the actual measured `delta` over `duration` makes
  				// the total fade sum to exactly 1.0 by the time `duration` ms have really elapsed,
  				// regardless of tick timing/jitter - so opacity reaches 0 right as the info is
  				// destroyed instead of fading too fast, too slow, or incompletely.
  				this.opacity -= (delta/this.duration);

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
const damageInfoData = {
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
