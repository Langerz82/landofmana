var cls = require("./lib/class");

module.exports = Timer = cls.Class.extend({
        init: function(duration, startTime) {
            this.restart(startTime);

            this.duration = duration;
        },

        restart: function (startTime)
        {
          this.lastTime = startTime;
          if (isNaN(startTime) || startTime === null || startTime === 0)
          {
            this.lastTime = Date.now();
          }
        },

        isOver: function(time) {
            var over = false;

            if (isNaN(time) || time === null || time === 0)
            {
              time = Date.now();
            }

            //console.info("time="+time);
            //console.info("this.lastTime="+this.lastTime);
            //console.info("this.durationTime="+(time - this.lastTime));

            if((time - this.lastTime) > this.duration)
            {
                //console.info("this.lastTime="+this.lastTime);
                //console.info("time="+time);
                //console.info("this.duration="+this.duration);
                over = true;
                this.lastTime = time;
            }
            return over;
        },
        /*isOverLatency: function(time, latency) {
            var over = false;

            if((time - this.lastTime) > (this.duration - latency)) {
                over = true;
                this.lastTime = time;
            }
            return over;
        }*/

});
