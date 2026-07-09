// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Class, _, questSerial */

export default class UserAlarm {
    constructor() {
      this.hideDelay = 5000; //How long the notification shows for.

      this.queue = [];
      this.jqAlarm = $('#useralarm');
      this.showing = false;
      this.disabled = false;
    }

    alarmQueue(str, delay) {
      var self = this;

      delay = delay || this.hideDelay;

      this.queue.push([str, delay]);

      if (!this.showing)
        this.showQueue();
    }

    hide() {
      this.jqAlarm.hide();
      this.disabled = true;
    }

    show() {
      this.disabled = false;

      if (!this.showing)
        this.showQueue();
    }

    showQueue() {
      var self = this;

      if (this.disabled) {
        setTimeout(function() {
          self.showQueue();
        }, 1000);
        return;
      }

      if (this.queue.length > 0) {
        this.showing = true;
        var msg = this.queue.pop();
        this.jqAlarm.html(msg[0]);
        this.jqAlarm.fadeIn();
        setTimeout(function() {
          self.jqAlarm.fadeOut(1500, function () {
            self.showQueue();
          });
        }, msg[1]);
      }
      else {
        this.showing = false;
      }
    }

    alarm(str, delay) {
      this.alarmQueue(str, delay);
    }
}
