/* global databaseHandler, log */

var ItemRoomStore = require("./itemroomstore");
var Messages = require("../message");

module.exports = Inventory = ItemRoomStore.extend({
    init: function(owner, number, items){
        this._super(owner, number, items);

        this.typeIndex = 0;
        this.maxNumber = 48;
        this.fullMessage = new Messages.Notify("INVENTORY", "INVENTORY_FULL");
    }
});
