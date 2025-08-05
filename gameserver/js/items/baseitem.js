var cls = require("../lib/class");

module.exports = BaseItem = cls.Class.extend({
    init: function(arr){
        if (Array.isArray(arr))
          this.set(arr);
    },

    assign: function (item) {
      this.set([Number(item.itemKind),
        Number(item.itemNumber),
        Number(item.itemDurability),
        Number(item.itemDurabilityMax),
        Number(item.itemExperience)]);
    },

    set: function(arr){
        var itemKind = Number(arr[0]);
        this.itemKind = itemKind;
        this.itemNumber = Number(arr[1]);
        this.itemDurability = arr[2] ? Number(arr[2]) : ((ItemTypes.isConsumableItem(itemKind) || ItemTypes.isCraftItem(itemKind)) ? 0 : 900);
        this.itemDurabilityMax = arr[3] ? Number(arr[3]) : ((ItemTypes.isConsumableItem(itemKind) || ItemTypes.isCraftItem(itemKind)) ? 0 : 900);
        this.itemExperience = Number(arr[4]) || 0;
    },

    addNumber: function(number){
        this.itemNumber += Number(number);
    },

    save: function()
    {
      return this.toArray().join(",");
    },

    toArray: function ()
    {
      var cols = [
        this.itemKind,
        this.itemNumber,
        this.itemDurability,
        this.itemDurabilityMax,
        this.itemExperience];
      return cols;
    }
});
