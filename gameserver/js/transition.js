class Transition {
  constructor(object) {
      this.startValue = 0;
      this.endValue = 0;
      this.duration = 0;
      this.inProgress = false;
      //this.currentValue = 0;
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
      if(this.inProgress) {
          var inc = this.modValue;

          if (inc === 0) return;

          var j = 0;
          if(this.updateFunction) {
            var itCount = Math.abs(inc);

            var start=0;
            var mod = (inc > 0) ? 1 : -1;
            for (var it=0; it < itCount; ++it)
            {
              if (!this.inProgress)
              {
                  this.stop(this.object);
                  return;
              }

              if (this.updateFunction(this.object, mod))
              {
                  this.stop(this.object);
                  return;
              }
            }
          }
      }
  }

  /*restart(currentTime, startValue, endValue) {
      this.start(currentTime, this.updateFunction, this.stopFunction, this.startValue, this.endValue, this.duration);
      this.step(currentTime);
  },*/

  stop() {
    //try { throw new Error(); } catch (e) { console.error(e.stack); }
    if (this.stopFunction)
      this.stopFunction(this.object);

    this.inProgress = false;
  }
}

export default Transition;
