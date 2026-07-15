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
          const inc = this.modValue;

          if (inc === 0) return;

          // NOTE: was `const j = 0;` here, unused -- dead code (nothing in
          // this method ever reads it; same pattern already cleaned up in a
          // handful of other files across this codebase, e.g.
          // area/mobarea.js, world/taskhandler.js, data/skilldata.js,
          // map/mapmanager.js).
          if(this.updateFunction) {
            const itCount = Math.abs(inc);

            // NOTE: was `const start=0;` here too, unused -- same dead-code
            // pattern as `j` above.
            const mod = (inc > 0) ? 1 : -1;
            for (let it=0; it < itCount; ++it)
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
