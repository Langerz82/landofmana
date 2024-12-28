
define(function() {

    var Timer = Class.extend({
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

            //log.info("Timer.isOver - lasttime: "+this.lastTime+", duration: "+(time - this.lastTime));
            if(this.lastTime == 0 || (time - this.lastTime) > this.duration) {
                over = true;
                this.lastTime = time;
            }
            return over;
        },

        getRatio: function (time) {
          var ratio = ((time - this.lastTime) / this.duration);
          if (ratio >= 1.0)
            return 1.0;
          return ratio;
        },
    });

    return Timer;
});
