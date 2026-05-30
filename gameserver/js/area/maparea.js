var cls = require('../lib/class');

var MapArea = cls.Class.extend({
	init: function(map, elipse, x, y, width, height) {
		this.map = map;
		this.elipse = elipse;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	},

	contains: function(entity) {
		if (!elipse)
		{
			if(entity) {
				return entity.x >= this.x
					&& entity.y >= this.y
					&& entity.x < this.x + this.width
					&& entity.y < this.y + this.height;
			} else {
				return false;
			}
		}
		if (elipse)
		{
			if(entity) {
				var cx = (this.x);
				var cy = (this.y);
				var d = Math.sqrt(
					Math.pow(entity.x - cx,2) + Math.pow(entity.y - cy,2)
				);
				var inElipse = (d < this.width/2 && d < this.height/2);

				console.log("this.elipseId="+this.elipseId);
				return inElipse;
			} else {
				return false;
			}
		}

	}
});

module.exports = MapArea;
