// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Timer from './timer.js';

class Bubble {
    constructor(id, entity, content, time) {
        this.id = id;
        this.entity = entity;
        this.content = content;
        this.timer = new Timer(5000, time);

        game.renderer.drawBubble(this);
    }
    isOver(time) {
        if(this.timer.isOver(time)) {
            return true;
        }
        return false;
    }
    destroy() {
        game.renderer.removeBubble(this);
    }
    reset(time) {
        this.timer.lastTime = time;
    }
}

export default class BubbleManager {
    constructor() {
        this.bubbles = {};
    }

    getBubbleById(id) {
        if(id in this.bubbles) {
            return this.bubbles[id];
        }
        return null;
    }

    create(entity, content, time) {
        if (content === undefined || content === "") return;

        const id=entity.id;
        var time = time || Date.now();
        const bubble = this.bubbles[id] = new Bubble(id, entity, content, time);
    }

    update(time) {
        const self = this,
            bubblesToDelete = [];

        _.each(this.bubbles, function(bubble) {
            if(bubble.isOver(time)) {
                bubble.destroy();
                bubblesToDelete.push(bubble.id);
            }
        });

        _.each(bubblesToDelete, function(id) {
            delete self.bubbles[id];
        });
    }

    clean() {
        const self = this,
            bubblesToDelete = [];

        _.each(this.bubbles, function(bubble) {
            bubble.destroy();
            bubblesToDelete.push(bubble.id);
        });

        _.each(bubblesToDelete, function(id) {
            delete self.bubbles[id];
        });

        this.bubbles = {};
    }

    destroyBubble(id) {
        const bubble = this.getBubbleById(id);

        if(bubble) {
            bubble.destroy();
            delete this.bubbles[id];
        }
    }

    destroyEntityBubbles(entity) {
        const self = this;

        _.each(this.bubbles, function(bubble) {
            if (bubble.entity === entity)
            {
              bubble.destroy();
              delete self.bubbles[bubble.id];
            }
        });
    }

    forEachBubble(callback) {
        _.each(this.bubbles, function(bubble) {
            callback(bubble);
        });
    }
}
