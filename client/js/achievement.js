// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */

var getSummary = function (summary, data) {
  var repl = {};
  if (data.length > 0)
  {
    for (var i=0; i < data.length; ++i)
      repl["%"+(i)] = data[i];
    summary = summary.replace(/%\d+/g, function(all) {
       return repl[all] || all;
    });
  }
  return summary;
};

export default class Achievement {
    constructor(arr) {
       this.update(arr);
    }

    update(arr) {
      var arr = arr.parseInt();

      this.index = arr[0];
      this.type = arr[1];
      this.rank = arr[2] || 0;
      this.objectType = arr[3] || 0;
      this.objectKind = arr[4] || 0;
      this.count = arr[5] || 0;
      this.objectCount = arr[6] || 0;
      var objectCount = this.objectCount;
      objectCount = Utils.getNumShortHand(objectCount, 0);
      this.summary = lang.data["ACHIEVEMENTS_"+this.index].format(objectCount);
    }
}
