// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Animation from './animation.js';

export default class Sprite {
    constructor(data, scale, container) {
        this.name = data.id;
        this.file = data.file;
        this.scale = scale;
        this.container = container;
        this.offsetX = 0;
        this.offsetY = 0;
        this.data = data;

        this.loadJSON(data);

        this.createAnimations();
    }

    loadJSON(data) {
        this.id = data.id;

        if (this.file || data.file)
            this.filepath = 'img/' + this.scale + '/sprites/' + this.file;
        else
            this.filepath =
                'img/' + this.scale + '/sprites/' + this.id + '.png';

        this.animationData = data.animations;
        this.width = data.width;
        this.height = data.height;
        this.offsetX = data.offset_x ?? -16;
        this.offsetY = data.offset_y ?? -16;
    }

    createAnimations() {
        this.animations = {};

        for (let name in this.animationData) {
            const a = this.animationData[name];
            if (!a.hasOwnProperty('col')) a.col = 0;
            if (!a.hasOwnProperty('row')) a.row = 0;
            this.animations[name] = new Animation(
                name,
                a.length,
                a.col,
                a.row,
                this.width,
                this.height
            );
        }

        return this.animations;
    }

    getAnimationByName(name) {
        let animation = null;

        if (name in this.animations) {
            animation = this.animations[name];
        } else {
            const e = new Error();
            log.error(e.stack);
            log.error('No animation called ' + name);
        }
        return animation;
    }

    setAnimation(name, speed, count, onEndCount) {
        const self = this;

        if (this.currentAnimation && this.currentAnimation.name === name) {
            return;
        }

        const a = this.getAnimationByName(name);

        if (a) {
            this.currentAnimation = a;
            this.currentAnimation.setSpeed(speed);
            this.currentAnimation.setCount(count ? count : 0, onEndCount);
        }
    }
}
