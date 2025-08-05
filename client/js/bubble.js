define(['timer'], function(Timer) {
    var Bubble = Class.extend({
        init: function(id, entity, content, time) {
            this.id = id;
            this.entity = entity;
            this.content = content;
            this.timer = new Timer(5000, time);

            game.renderer.drawBubble(this);
        },
        isOver: function(time) {
            if(this.timer.isOver(time)) {
                return true;
            }
            return false;
        },
        destroy: function() {
            game.renderer.removeBubble(this);
        },
        reset: function(time) {
            this.timer.lastTime = time;
        }
    });

    var BubbleManager = Class.extend({
        init: function() {
            this.bubbles = {};
        },

        getBubbleById: function(id) {
            if(id in this.bubbles) {
                return this.bubbles[id];
            }
            return null;
        },

        create: function(entity, content, time) {
            if (content === undefined || content === "") return;

            var id=entity.id;
            var time = time || Date.now();
            var bubble = this.bubbles[id] = new Bubble(id, entity, content, time);
        },

        update: function(time) {
            var self = this,
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
        },

        clean: function() {
            var self = this,
                bubblesToDelete = [];

            _.each(this.bubbles, function(bubble) {
                bubble.destroy();
                bubblesToDelete.push(bubble.id);
            });

            _.each(bubblesToDelete, function(id) {
                delete self.bubbles[id];
            });

            this.bubbles = {};
        },

        destroyBubble: function(id) {
            var bubble = this.getBubbleById(id);

            if(bubble) {
                bubble.destroy();
                delete this.bubbles[id];
            }
        },

        destroyEntityBubbles: function(entity) {
            var self = this;

            _.each(this.bubbles, function(bubble) {
                if (bubble.entity === entity)
                {
                  bubble.destroy();
                  delete self.bubbles[bubble.id];
                }
            });
        },

        forEachBubble: function(callback) {
            _.each(this.bubbles, function(bubble) {
                callback(bubble);
            });
        }
    });

    return BubbleManager;
});
