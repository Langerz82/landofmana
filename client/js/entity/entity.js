// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// Was: define(['../timer'], function(Timer) { var Entity = Class.extend({ init: ..., ... }); return Entity; });
//
// NOTE ON GLOBALS: Utils, Types, _, log, game, G_TILESIZE and AppearanceData are still
// legacy globals provided by not-yet-converted scripts (util.js, data/*.js, main.js, etc).
// They are read here but never assigned, so they're safe under ES module strict mode.
import Timer from '../timer.js';

export default class Entity {
    constructor(id, type, mapIndex, kind) {
        this.id = id;
        this.type = type;
        this.mapIndex = mapIndex;
        this.kind = kind;

        // Renderer
        this.sprites = [null];
        this.oldSprites = [null];
        this.pjsSprites = [null];

        this.flipSpriteX = false;
        this.flipSpriteY = false;
        this.animations = null;
        this.currentAnimation = null;

        // Modes
        this.isLoaded = false;
        this.visible = true;
        this.isFading = false;

        this.prevOrientation = null;
        this.name = "";

        this.fadingTime = 1000;
        this.fadingTimer = new Timer(this.fadingTime, Utils.getTime());
        this.lockfadeIn = false;

        this.x = 0;
        this.y = 0;
        this.gx = 0;
        this.gy = 0;

        this.orientation = 2;
    }

    /* Sprite and Animation - START */
    hasAnimation(type) {
        if (!this.currentAnimation)
            return false;
        return this.currentAnimation.name.indexOf(type) === 0;
    }

    animate(animation, speed, count, onEndCount) {
        var oriented = ['atk', 'walk', 'idle'],
            o = this.orientation || Types.Orientations.DOWN;

        this.flipSpriteX = false;
        this.flipSpriteY = false;

        if (_.indexOf(oriented, animation) >= 0) {
            animation += "_" + (o === Types.Orientations.LEFT ? "right" : Types.getOrientationAsString(o));
            this.flipSpriteX = (this.orientation === Types.Orientations.LEFT) ? true : false;
        }

        this.setAnimation(animation, speed, count, onEndCount);
    }

    setSprite(sprite, index) {
        index = index || 0;
        if (!sprite) {
            log.error(this.id + " : sprite is null", true);
            throw "Sprite error";
        }

        if (sprite == this.sprites[index])
            return;

        this.oldSprites[index] = this.sprites[index];

        this.sprites[index] = sprite;

        var pjsSprite = this.pjsSprites[index];
        if (!pjsSprite)
            this.pjsSprites[index] = game.renderer.createSprite(sprite);
        else
            this.pjsSprites[index] = game.renderer.changeSprite(this.sprites[index], pjsSprite);

        // The main sprite Animations are used only.
        if (index == 0)
            this.animations = sprite.animations;

        this.isLoaded = true;
        if (this.ready_func) {
            this.ready_func();
        }
    }

    restoreSprite(index) {
        index = index || 0;
        var tmp = this.oldSprites[index];
        if (tmp)
            this.setSprite(tmp, index);
    }

    getSprite(index) {
        index = index || 0;
        return this.sprites[index];
    }

    getAnimationByName(name) {
        var animation = null;

        if (name in this.animations) {
            animation = this.animations[name];
        }
        else {
            var e = new Error();
            log.error(e.stack);
            log.info("No animation called " + name);
            return null;
        }
        return animation;
    }

    setAnimation(name, speed, count, onEndCount) {
        var self = this;

        if (this.isLoaded) {
            if (this.currentAnimation && this.currentAnimation.name === name) {
                return;
            }

            if ((this.isDying || this.isDead) && this.currentAnimation.name === "death")
                return;

            var a = this.getAnimationByName(name);

            if (a) {
                this.currentAnimation = a;
                //if(name.indexOf("atk") === 0) {
                this.currentAnimation.reset();
                //}
                this.currentAnimation.setSpeed(speed);
                this.currentAnimation.setCount(count ? count : 0, onEndCount || function() {
                    self.idle(self.orientation);
                });
            }
        }
        else {
            this.log_error("Not ready for animation");
        }
    }

    getSpriteName(spriteNum) {
        return AppearanceData.getSpriteByID(spriteNum);
    }

    setVisible(value) {
        this.visible = value;
    }

    isVisible() {
        return this.visible;
    }

    toggleVisibility() {
        if (this.visible) {
            this.setVisible(false);
        } else {
            this.setVisible(true);
        }
    }

    fadeInEntity(time) {
        if (this.lockfadeIn === true)
            return;

        this.isFading = true;
        this.fadingTimer.lastTime = time;
    }

    getFadeRatio(time) {
        if (this.lockfadeIn === true)
            return 1.0;

        if (this.fadingTimer.isOver(time)) {
            this.isFading = false;
            this.lockfadeIn = true;
            return 1.0;
        }
        return this.fadingTimer.getRatio(time);
    }

    /* Sprite and Animation - END */

    setPosition(x, y) {
        this._setPosition(x, y);
    }

    _setPosition(x, y) {
        var ts = G_TILESIZE;

        this.x = x;
        this.y = y;

        var gx = ~~(x / ts);
        var gy = ~~(y / ts);

        this.gx = gx;
        this.gy = gy;
    }

    setPositionSpawn(x, y) {
        log.info("setPositionSpawn - x:" + x + "y:" + y);

        this.setPosition(x, y);

        this.spawnGx = this.gx;
        this.spawnGy = this.gy;
    }

    ready(f) {
        this.ready_func = f;
    }

    onRemove(callback) {
        this.remove_callback = callback;
    }

    /**
     *
     */
    getDistanceToEntity(entity) {
        var distX = Math.abs(entity.x - this.x),
            distY = Math.abs(entity.y - this.y);

        return (distX > distY) ? distX : distY;
    }

    /**
     * Returns true if the entity is adjacent to the given one.
     * @returns {Boolean} Whether these two entities are adjacent.
     */
    isAdjacent(entity) {
        var adjacent = false;

        if (entity) {
            adjacent = this.getDistanceToEntity(entity) > 1 ? false : true;
        }

        return adjacent;
    }

    /**
     *
     */
    isAdjacentNonDiagonal(entity) {
        var result = false;

        if (this.isAdjacent(entity) && !(this.x !== entity.x && this.y !== entity.y)) {
            result = true;
        }

        return result;
    }

    isDiagonallyAdjacent(entity) {
        return this.isAdjacent(entity) && !this.isAdjacentNonDiagonal(entity);
    }

    forEachAdjacentNonDiagonalPosition(callback, dist) {
        dist = dist || 1;
        callback(this.x - dist, this.y, 3);
        callback(this.x, this.y - dist, 1);
        callback(this.x + dist, this.y, 4);
        callback(this.x, this.y + dist, 2);
    }

    getAdjacentTiles(min, max) {
        min = min || 0;
        max = max || G_TILESIZE;
        var x = this.x, y = this.y;

        var posArray = [];
        for (var i = min; i <= max; ++i) {
            posArray.push([x, y - i], [x, y + i], [x - i, y], [x + i, y]);
        }
        return posArray;
    }

    getTilePositionNextTo(orientation, dist) {
        orientation = orientation || this.orientation;
        dist = (dist || 1) * G_TILESIZE;

        var pos = [this.x, this.y];
        switch (orientation) {
            case 3:
                pos[0] -= dist;
                break;
            case 4:
                pos[0] += dist;
                break;
            case 1:
                pos[1] -= dist;
                break;
            case 2:
                pos[1] += dist;
                break;
        }
        return pos;
    }

    isWithinDist(x, y, dist) {
        dist = dist || G_TILESIZE;
        var dx = Math.abs(this.x - x);
        var dy = Math.abs(this.y - y);
        return (dx <= dist && dy <= dist);
    }

    isWithinDistEntity(entity, dist) {
        return this.isWithinDist(entity.x, entity.y, dist);
    }

    isNextTooEntity(entity) {
        return this.isWithinDist(entity.x, entity.y, (G_TILESIZE));
    }

    isNextTooPosition(x, y) {
        return this.isWithinDist(x, y, (G_TILESIZE));
    }

    isOverEntity(entity) {
        return this.isWithinDist(entity.x, entity.y, (G_TILESIZE >> 1));
    }

    isOverPosition(x, y) {
        return this.isWithinDist(x, y, (G_TILESIZE >> 1));
    }

    isOverlappingEntity(entity) {
        return this.isWithinDist(entity.x, entity.y, G_TILESIZE - 1);
    }

    isOverlapping(entities) {
        for (var entity of entities) {
            if (!entity || this === entity)
                continue;
            if (this.isOverlappingEntity(entity)) {
                return true;
            }
        }
        return false;
    }

    clean() {
    }
}
