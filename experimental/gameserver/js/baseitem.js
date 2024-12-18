var cls = require("./lib/class"),
    Types = require("../shared/js/gametypes"),
    ItemTypes = require("../shared/js/itemtypes");

module.exports = BaseItem = cls.Class.extend({
    init: function(arr){
        this.set(arr);
    },

    assign: function (itemRoom) {
      this.set([itemRoom.itemKind,
        itemRoom.itemNumber,
        itemRoom.itemDurability,
        itemRoom.itemDurabilityMax,
        itemRoom.itemExperience]);
    },

    set: function(arr){
        var itemKind = arr[0];
        this.itemKind = arr[0];
        this.itemNumber = arr[1];
        this.itemDurability = arr[2] ? arr[2] : ((ItemTypes.isConsumableItem(itemKind) || ItemTypes.isCraftItem(itemKind)) ? 0 : 900);
        this.itemDurabilityMax = arr[3] ? arr[3] : ((ItemTypes.isConsumableItem(itemKind) || ItemTypes.isCraftItem(itemKind)) ? 0 : 900);
        this.itemExperience = arr[4] || 0;
    },

    addNumber: function(number){
        this.itemNumber += number;
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
