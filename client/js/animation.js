// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class Animation {
    constructor(name, length, col, row, width, height) {
        this.name = name;
        this.length = length;
        this.col = col;
        this.row = row;
        this.width = width;
        this.height = height;

        this.reset();
    }

    tick() {
        let i = this.currentFrame.index;

        i = (i + 1) % this.length;
        //i = (i < this.length - 1) ? i + 1 : 0;

        if (this.count > 0) {
            if (i === 0) {
                this.count -= 1;
                if (this.count === 0) {
                    this.currentFrame.index = 0;
                    this.endcount_callback();
                    return;
                }
            }
        }

        const cf = this.currentFrame;
        cf.x = this.width * (i + this.col);
        cf.y = this.height * this.row;
        cf.i = (i + this.col);
        cf.j = this.row;

        cf.index = i;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    setCount(count, onEndCount) {
        this.count = count;
        this.endcount_callback = onEndCount;
    }

    isTimeToAnimate(time) {
        return (time - this.lastTime) > this.speed;
    }

    update(time) {
        if (this.lastTime === 0 && this.name.substr(0, 3) === "atk") {
            this.lastTime = time;
        }

        if (this.isTimeToAnimate(time)) {
            this.lastTime = time;
            this.tick();
            return true;
        } else {
            return false;
        }
    }

    reset() {
        this.lastTime = 0;
        this.currentFrame = { index: 0, x: this.col * this.width, y: this.row * this.height, i: this.col, j: this.row};
    }
}
