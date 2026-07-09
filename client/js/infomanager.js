// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import HoveringInfo from './hoveringinfo.js';

export default class InfoManager {
        constructor(game) {
            this.game = game;
            this.infos = {};
            this.destroyQueue = [];
            this.infoQueue = [];
            this.index = 1;
            const self = this;


            setInterval(function ()
            {
            	if (self.infoQueue.length > 0)
            	{
            		const time = self.game.currentTime;
            		const info = self.infoQueue[0];
            		if (!info.showTime) info.showTime = time;
            		self.infos[info.id] = info;
            		if (info.isTimeToShow(time))
            		{
            			self.infoQueue.shift();
            		}
            	}
        	},50);
        }

        addDamageInfo(value, x, y, type, duration) {
            this.index = (this.index >= Number.MAX_SAFE_INTEGER) ? 1 : this.index+1;
            var time = this.game.currentTime,
                duration = (duration)? duration : 1000,
                id = this.index,
                self = this,
                info = new HoveringInfo(id, value, x, y, duration, type);

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
        }

        addInfo(info) {
            const time = this.game.currentTime,
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
        }

        forEachInfo(callback) {
            const self = this;

            _.each(this.infos, function(info, id) {
                callback(info);
            });
        }

        update(time) {
            const self = this;

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
}
