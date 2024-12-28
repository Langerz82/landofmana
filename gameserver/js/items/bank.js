/* global databaseHandler, log */

var ItemRoomStore = require("./itemroomstore");
var Messages = require("../message");

module.exports = Bank = ItemRoomStore.extend({
    init: function(owner, number, items){
        this._super(owner, number, items);

        this.typeIndex = 1;
        this.maxNumber = 96;
        this.fullMessage = new Messages.Notify("BANK", "BANK_FULL");
    }
});
