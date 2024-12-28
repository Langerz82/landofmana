var BaseItem = require("./baseitem");

module.exports = ItemRoom = BaseItem.extend({
    init: function(arr){
        this.slot = -1;
        this._super(arr);
    },

    toRedis: function()
    {
      return this.toArray().join(",");
    },

    toArray: function ()
    {
      var cols = [parseInt(this.slot)].concat(this._super());
      return cols;
    },

    toArrayNoSlot: function ()
    {
      var arr = this.toArray();
      arr.shift();
      return arr;
    }

});
