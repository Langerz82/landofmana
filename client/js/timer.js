// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// Was: define(function() { var Timer = Class.extend({ init: ..., ... }); return Timer; });
export default class Timer {
    constructor(duration, startTime) {
        this.restart(startTime);

        this.duration = duration;
    }

    restart(startTime) {
        this.lastTime = startTime;
        if (isNaN(startTime) || startTime === null || startTime === 0) {
            this.lastTime = Date.now();
        }
    }

    isOver(time) {
        let over = false;

        if (isNaN(time) || time === null || time === 0) {
            time = Date.now();
        }

        //log.info("Timer.isOver - lasttime: "+this.lastTime+", duration: "+(time - this.lastTime));
        if (this.lastTime === 0 || (time - this.lastTime) > this.duration) {
            over = true;
            this.lastTime = time;
        }
        return over;
    }

    getRatio(time) {
        const ratio = ((time - this.lastTime) / this.duration);
        if (ratio >= 1.0)
            return 1.0;
        return ratio;
    }
}
