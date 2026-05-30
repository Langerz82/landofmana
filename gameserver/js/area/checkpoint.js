//var cls = require('./lib/class');
var Utils = require('../utils');
var Area = require('./area');

var Checkpoint = Area.extend({
    init: function(map, id, x, y, width, height) {
        this._super(map, id, x, y, width, height);
    },

    isValidPosition: function(x, y) {
        return this.map && this.map.isValidPosition(x, y);
    },

});

module.exports = Checkpoint;
