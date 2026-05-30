
define(function() {

    var Area = Class.extend({
        init: function(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        },

        contains: function(entity) {
            //var ts = TILESIZE;
            if(entity) {
                return entity.x >= this.x
                    && entity.y >= this.y
                    && entity.x < this.x + this.width
                    && entity.y < this.y + this.height;
            } else {
                return false;
            }
        }
    });

    return Area;
});
