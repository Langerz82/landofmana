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
            // FIX (var cleanup): `duration` here was redeclaring the `duration` parameter via
            // var (legal, a no-op reassignment) inside the same multi-declaration statement as
            // genuinely new variables - let/const can't redeclare a parameter, so it's split out
            // into a plain reassignment below and the rest converted to const.
            duration = duration || 1000;
            const time = this.game.currentTime,
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
            Object.values(this.infos).forEach(callback);
        }

        update(time) {
            this.forEachInfo(function(info) {
                info.update(time);
            });

            this.destroyQueue.forEach((id) => {
                game.renderer.removeSprite(Container.HUD, "ci_"+id);
                delete this.infos[id];
            });
            this.destroyQueue = [];
        }
}
