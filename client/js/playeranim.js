// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, _ */
import Sprite from './sprite.js';
import Animation from './animation.js';
import Timer from './timer.js';

export default class PlayerAnim {
    constructor() {
        this.flipSpriteX = false;
        this.flipSpriteY = false;
        this.pjsSprite = null;
        this.animations = null;
        this.currentAnimation = null;
        this.isLoaded = false;
        this.visible = true;

        this.sprites = [];
        this.animations = [];

        this.speeds = {
            attack: 100,
            move: 50,
            walk: 150,
            idle: 500
        };
    }

    loadAnimations(sprite) {
        const animations = sprite.createAnimations();
        for (let id in animations) {
            if (!this.animations[id]) this.animations[id] = animations[id];
        }

        this.isLoaded = true;
        if (this.ready_func) {
            this.ready_func();
        }
    }

    addSprite(sprite) {
        if (!sprite) {
            log.error(this.id + ' : sprite is null', true);
            throw 'Sprite error';
        }

        this.sprites.push(sprite);

        this.loadAnimations(sprite);
    }

    ready(f) {
        this.ready_func = f;
    }

    getSprite(index) {
        return this.sprites[index]; // FIX (carried over): was this.sprite (undefined); array is this.sprites (set in constructor/addSprite)
    }

    getSpriteName(index) {
        return this.sprites[index].name; // FIX (carried over): was this.sprite (undefined); array is this.sprites (set in constructor/addSprite)
    }

    getAnimationByName(name) {
        let animation = null;

        if (name in this.animations) {
            animation = this.animations[name];
        } else {
            const e = new Error();
            log.error(e.stack);
            log.info('No animation called ' + name);
            return null;
        }
        return animation;
    }

    setAnimation(name, speed, count, onEndCount) {
        const self = this;

        if (this.isLoaded) {
            if (this.currentAnimation && this.currentAnimation.name === name) {
                return;
            }

            const a = this.getAnimationByName(name);

            if (a) {
                this.currentAnimation = a;
                if (name.indexOf('atk') === 0) {
                    this.currentAnimation.reset();
                }
                this.currentAnimation.setSpeed(speed);
                this.currentAnimation.setCount(
                    count ? count : 0,
                    onEndCount ||
                        function () {
                            self.idle();
                        }
                );
            }
        } else {
            // FIX: this.log_error doesn't exist anywhere on PlayerAnim/Entity - the
            // codebase's convention is the global `log.error(...)` (see lib/log.js).
            // Calling this branch threw a TypeError instead of logging the warning.
            log.error('Not ready for animation');
        }
    }

    idle(orientation) {
        this.orientation = orientation;
        this.animate('idle', this.speeds.idle);
    }

    hit(orientation) {
        this.orientation = orientation;
        this.animate('atk', this.speeds.attack, 1);
    }

    walk(orientation) {
        this.orientation = orientation;
        this.animate('walk', this.speeds.walk);
    }

    animate(animation, speed, count, onEndCount) {
        const oriented = ['atk', 'walk', 'idle'],
            o = this.orientation || Types.Orientations.DOWN;

        this.flipSpriteX = false;
        this.flipSpriteY = false;

        if (oriented.includes(animation)) {
            animation +=
                '_' +
                (o === Types.Orientations.LEFT
                    ? 'right'
                    : Types.getOrientationAsString(o));
            this.flipSpriteX = this.orientation === Types.Orientations.LEFT;
        }

        this.setAnimation(animation, speed, count, onEndCount);
    }

    setHTML(html) {
        this.html = html;
    }

    show() {
        const animName = this.currentAnimation.name,
            s = game.renderer.gameScale;

        let i = 0;
        const types = ['armor', 'weapon'];
        for (const sprite of this.sprites) {
            const anim = this.currentAnimation;
            const frame = anim.currentFrame;
            const div = $(this.html[i]);
            const w = sprite.width * s;
            const h = sprite.height * s;
            const x = frame.i * w;
            const y = frame.j * h;

            div.css('width', w + 'px');
            div.css('height', h + 'px');
            div.css(
                'background-image',
                "url('img/2/sprites/" + sprite.name + ".png')"
            );
            div.css('background-size', w * 5 + 'px ' + h * 9 + 'px ');
            div.css('background-position', '-' + x + 'px -' + y + 'px');
            i++;
        }
    }

    showHTML(jqRoot, gameScale, scale) {
        let wmax = 0,
            hmax = 0;
        const dimensions = [];
        for (const sprite of this.sprites) {
            const w = sprite ? sprite.width * scale : 0;
            const h = sprite ? sprite.height * scale : 0;
            dimensions.push([w, h]);
            if (w > wmax) wmax = w;
            if (h > hmax) hmax = h;
        }

        $(jqRoot).css({
            'margin-left': '-' + parseInt(wmax / 2) + 'px',
            'margin-top': '-' + parseInt(hmax / 2) + 'px',
            width: wmax + 'px',
            height: hmax + 'px'
        });

        let i = 0;
        for (const html of this.html) {
            $(html).css('left', parseInt((wmax - dimensions[i][0]) / 2) + 'px'); // FIX: was indexing dimensions[i][1] (height) for the horizontal centering offset instead of dimensions[i][0] (width); copy-paste from the 'top' line below
            $(html).css('top', parseInt((hmax - dimensions[i][1]) / 2) + 'px');
            i++;
        }
    }
}
