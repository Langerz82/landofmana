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
        return this.timer.isOver(time);
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
        if (id in this.bubbles) {
            return this.bubbles[id];
        }
        return null;
    }

    create(entity, content, time) {
        if (content === undefined || content === '') return;

        const id = entity.id;
        // FIX (var cleanup): was `var time = time || ...`, redeclaring the `time` parameter
        // with var (legal, a no-op reassignment) - let/const can't redeclare a parameter name.
        time = time || Date.now();
        this.bubbles[id] = new Bubble(id, entity, content, time);
    }

    update(time) {
        for (const bubble of Object.values(this.bubbles)) {
            if (bubble.isOver(time)) {
                bubble.destroy();
                delete this.bubbles[bubble.id];
            }
        }
    }

    clean() {
        for (const bubble of Object.values(this.bubbles)) {
            bubble.destroy();
        }
        this.bubbles = {};
    }

    destroyBubble(id) {
        const bubble = this.getBubbleById(id);

        if (bubble) {
            bubble.destroy();
            delete this.bubbles[id];
        }
    }

    destroyEntityBubbles(entity) {
        for (const bubble of Object.values(this.bubbles)) {
            if (bubble.entity === entity) {
                bubble.destroy();
                delete this.bubbles[bubble.id];
            }
        }
    }

    forEachBubble(callback) {
        Object.values(this.bubbles).forEach(callback);
    }
}
