
module.exports = Transition = Class.extend({
  init: function(object) {
      this.startValue = 0;
      this.endValue = 0;
      this.duration = 0;
      this.inProgress = false;
      //this.currentValue = 0;
      this.modValue = 0;
      this.object = object;
  },

  start: function(updateFunction, stopFunction, modValue) {
      this.updateFunction = updateFunction;
      this.stopFunction = stopFunction;
      this.modValue = modValue;
      this.inProgress = true;
  },

  step: function() {
      if(this.inProgress) {
          var inc = this.modValue;

          if (inc == 0) return;

          var j = 0;
          if(this.updateFunction) {
            var itCount = Math.abs(inc);

            var start=0;
            var mod = (inc > 0) ? 1 : -1;
            for (var it=0; it < itCount; ++it)
            {
              if (this.updateFunction(this.object, mod))
              {
                  this.stop(this.object);
                  return;
              }
            }
          }
      }
  },

  /*restart: function(currentTime, startValue, endValue) {
      this.start(currentTime, this.updateFunction, this.stopFunction, this.startValue, this.endValue, this.duration);
      this.step(currentTime);
  },*/

  stop: function() {
    if (this.stopFunction)
      this.stopFunction(this.object);

    this.inProgress = false;
  }
});
