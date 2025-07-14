
define(['hoveringinfo'], function(HoveringInfo) {

    var InfoManager = Class.extend({
        init: function(game) {
            this.game = game;
            this.infos = {};
            this.destroyQueue = [];
            this.infoQueue = [];
            this.index = 1;
            var self = this;


            setInterval(function ()
            {
            	if (self.infoQueue.length > 0)
            	{
            		var time = self.game.currentTime;
            		var info = self.infoQueue[0];
            		if (!info.showTime) info.showTime = time;
            		self.infos[info.id] = info;
            		if (info.isTimeToShow(time))
            		{
            			self.infoQueue.shift();
            		}
            	}
        	},50);
        },

        addDamageInfo: function(value, x, y, type, duration) {
            this.index = (this.index >= Number.MAX_SAFE_INTEGER) ? 1 : this.index+1;
            var time = this.game.currentTime,
                id = this.index;
                self = this,
                info = new HoveringInfo(id, value, x, y, (duration)?duration:1000, type);

            		info.onDestroy(function(id) {
                    if (!id || !self.destroyQueue) return;
            		    self.destroyQueue.push(id);
            		});

            			if (info.interval > 0) {
            				self.infoQueue.push(info);
            			}
            			else
            			{
            				info.showTime = time;
            				self.infos[id] = info;
            			}
        },

        addInfo: function(info) {
            var time = this.game.currentTime,
                self = this;

        		info.onDestroy(function(id) {
                id = id || this.id;
                if (!id || !self.destroyQueue) return;
        		    self.destroyQueue.push(id);
        		});

      			if (info.interval > 0) {
      				self.infoQueue.push(info);
      			}
      			else
      			{
      				info.showTime = time;
      				self.infos[info.id] = info;
      			}
        },

        forEachInfo: function(callback) {
            var self = this;

            _.each(this.infos, function(info, id) {
                callback(info);
            });
        },

        update: function(time) {
            var self = this;

            this.forEachInfo(function(info) {
            	//if (info.isTimeToShow(time)) {
            		info.update(time);
                //}
            });

            _.each(this.destroyQueue, function(id) {
                game.renderer.removeSprite(Container.HUD, "ci_"+id);
                delete self.infos[id];
            });
            this.destroyQueue = [];
        }
    });

    return InfoManager;
});
