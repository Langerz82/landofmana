class Timer {
    constructor(duration, startTime) {
        this.lastTime = startTime;

        if (isNaN(startTime) || startTime === null || startTime === 0) {
            this.lastTime = Date.now();
        }

        this.duration = duration;
    }

    isOver(time) {
        let over = false;

        if (isNaN(time) || time === null || time === 0) {
            time = Date.now();
        }

        if ((time - this.lastTime) > this.duration) {
            over = true;
            this.lastTime = time;
        }

        return over;
    }

    // isOverLatency method (uncomment if needed)
    /*
    isOverLatency(time, latency) {
        let over = false;

        if ((time - this.lastTime) > (this.duration - latency)) {
            over = true;
            this.lastTime = time;
        }

        return over;
    }
    */
}

module.exports = Timer;
