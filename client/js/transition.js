// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class Transition {
    constructor(object) {
        this.startValue = 0;
        this.endValue = 0;
        this.duration = 0;
        this.inProgress = false;
        this.modValue = 0;
        this.object = object;
    }

    start(updateFunction, stopFunction, modValue) {
        this.updateFunction = updateFunction;
        this.stopFunction = stopFunction;
        this.modValue = modValue;
        this.inProgress = true;
    }

    step() {
        if (this.inProgress) {
            const inc = this.modValue;

            if (inc === 0) return;

            if (this.updateFunction) {
                let it;
                const itCount = Math.abs(inc);
                const mod = (inc > 0) ? 1 : -1;
                for (it = 0; it < itCount; ++it) {
                    if (!this.inProgress) {
                        this.stop(this.object);
                        break;
                    }

                    if (this.updateFunction(this.object, mod)) {
                        this.stop(this.object);
                        break;
                    }
                }
            }
        }
    }

    stop() {
        if (this.stopFunction)
            this.stopFunction(this.object);

        this.inProgress = false;
    }
}
