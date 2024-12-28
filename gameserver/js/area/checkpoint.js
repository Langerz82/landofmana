//var cls = require('./lib/class');
var Utils = require('../utils');
var Area = require('./area');

var Checkpoint = Area.extend({
    init: function(id, x, y, width, height, map) {
        this._super(id, x, y, width, height, map);
    },

    /*getRandomPosition: function () {
        var pos = {};
        var valid = true;

        //console.info("pos.x: "+this.x+",pos.y:"+this.y);
        while (valid) {
        	pos.x = this.x + Utils.randomInt(this.width - 1);
        	pos.y = this.y + Utils.randomInt(this.height - 1);
        	//console.info("pos2.x: "+pos.x+",pos2.y:"+pos.y);

			    valid = this.map.isColliding(pos.x, pos.y);
          //console.error(JSON.stringify(valid));
        }
        return pos;
    },*/

    isValidPosition: function(x, y) {
        return this.map && this.map.isValidPosition(x, y);
    },

});

module.exports = Checkpoint;
