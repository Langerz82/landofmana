// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// Was: define(['../timer'], function(Timer) { var Entity = Class.extend({ init: ..., ... }); return Entity; });
//
// NOTE ON GLOBALS: Utils, Types, _, log, game, G_TILESIZE and AppearanceData are still
// legacy globals provided by not-yet-converted scripts (utils.js, data/*.js, main.js, etc).
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
        const oriented = ['atk', 'walk', 'idle'],
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

        if (sprite === this.sprites[index])
            return;

        this.oldSprites[index] = this.sprites[index];

        this.sprites[index] = sprite;

        const pjsSprite = this.pjsSprites[index];
        if (!pjsSprite)
            this.pjsSprites[index] = game.renderer.createSprite(sprite);
        else
            this.pjsSprites[index] = game.renderer.changeSprite(this.sprites[index], pjsSprite);

        // The main sprite Animations are used only.
        if (index === 0)
            this.animations = sprite.animations;

        this.isLoaded = true;
        if (this.ready_func) {
            this.ready_func();
        }
    }

    restoreSprite(index) {
        index = index || 0;
        const tmp = this.oldSprites[index];
        if (tmp)
            this.setSprite(tmp, index);
    }

    getSprite(index) {
        index = index || 0;
        return this.sprites[index];
    }

    getAnimationByName(name) {
        let animation = null;

        if (name in this.animations) {
            animation = this.animations[name];
        }
        else {
            const e = new Error();
            log.error(e.stack);
            log.info("No animation called " + name);
            return null;
        }
        return animation;
    }

    setAnimation(name, speed, count, onEndCount) {
        const self = this;

        if (this.isLoaded) {
            const alreadyPlaying = this.currentAnimation && this.currentAnimation.name === name;

            // FIX: one-shot animations (count > 0, e.g. "atk") must be re-armed once their
            // current cycle has actually finished, even when an animation with the same name
            // is already playing - otherwise a second attack in the same direction would be
            // silently dropped (stale callback governing completion forever). BUT while the
            // one-shot animation is still mid-cycle (currentAnimation.count > 0, i.e. it
            // hasn't reached its last frame yet), do NOT re-arm it: something upstream (e.g.
            // a cooldown timer that races real time slightly ahead of the animation's own
            // frame ticks) can call hit()/animate("atk"...) again before the swing has
            // visually finished, and re-arming here would reset() the animation back to
            // frame 0, aborting/restarting the in-progress swing. Looping animations
            // (count === 0, idle/walk) still short-circuit to avoid needlessly restarting
            // them every frame.
            if (alreadyPlaying && (!count || this.currentAnimation.count > 0)) {
                return;
            }

            if ((this.isDying || this.isDead) && this.currentAnimation && this.currentAnimation.name === "death")
                return;

            // FIX: this is the one choke point every animation switch passes through
            // (idle()/walk()/hit() all end up here). If something abandons an in-progress
            // "atk" animation before it finishes its cycle - e.g. forceStop() or lookAt()
            // forcing the character back to "idle" mid-swing - the attack animation's own
            // completion callback (the one that resets fsm from "ATTACK" back to "IDLE")
            // never gets to run, because updateAnimations() only ticks entity.currentAnimation
            // and we're about to point that somewhere else. Left alone, fsm stays stuck on
            // "ATTACK" forever and rejectMove()/move() refuse all further movement - the
            // "jammed after an attack" bug. Resync fsm right here, whenever we're really
            // swapping away from a still-running attack animation, so movement is guaranteed
            // to unblock even if the attack got cut short instead of completing normally.
            if (this.fsm === "ATTACK" && !alreadyPlaying &&
                this.currentAnimation && this.currentAnimation.name.indexOf("atk") === 0) {
                this.fsm = "IDLE";
            }

            const template = this.getAnimationByName(name);

            if (template) {
                // FIX: animation templates live on the shared Sprite (sprite.animations) and
                // are reused by every entity with that appearance. Assigning the template
                // directly as currentAnimation meant multiple entities mutated the SAME
                // count/currentFrame/endcount_callback - whichever entity called
                // setAnimation() last "won", and other entities sharing that animation object
                // never got their own completion callback fired (e.g. player.fsm stuck on
                // "ATTACK"). Clone so each entity tracks its own playback state.
                if (!alreadyPlaying) {
                    this.currentAnimation = template.clone();
                }
                this.currentAnimation.reset();
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

    // FIX (carried over): this method used to be defined twice in this class (a dead first
    // copy, silently shadowed by this one); the duplicate has been removed
    // FIX: was calling `AppearanceData.getSpriteByID(spriteNum)` - AppearanceData is a plain
    // array (see data/appearancedata.js) with no such method; every other call site in the
    // codebase (game.js, player.js, clientcallbacks.js, appearancedialog.js) indexes it directly
    // as `AppearanceData[idx].sprite`, so do the same here.
    getSpriteName(spriteNum) {
        const data = AppearanceData[spriteNum];
        return data ? data.sprite : null;
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
        // FIX (carried over): was setting this.fadingTime.lastTime (fadingTime is just the
        // duration number, 1000); the actual Timer instance is this.fadingTimer - assigning
        // to the wrong one meant fade timing never reset on respawn/teleport
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
        const ts = G_TILESIZE;

        this.x = x;
        this.y = y;

        const gx = ~~(x / ts);
        const gy = ~~(y / ts);

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
        const distX = Math.abs(entity.x - this.x),
            distY = Math.abs(entity.y - this.y);

        return (distX > distY) ? distX : distY;
    }

    /**
     * Returns true if the entity is adjacent to the given one.
     * @returns {Boolean} Whether these two entities are adjacent.
     */
    isAdjacent(entity) {
        let adjacent = false;

        if (entity) {
            adjacent = this.getDistanceToEntity(entity) > 1 ? false : true;
        }

        return adjacent;
    }

    /**
     *
     */
    isAdjacentNonDiagonal(entity) {
        let result = false;

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
        const x = this.x, y = this.y;

        const posArray = [];
        for (let i = min; i <= max; ++i) {
            posArray.push([x, y - i], [x, y + i], [x - i, y], [x + i, y]);
        }
        return posArray;
    }

    getTilePositionNextTo(orientation, dist) {
        orientation = orientation || this.orientation;
        dist = (dist || 1) * G_TILESIZE;

        const pos = [this.x, this.y];
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
        var rd = Utils.realDistance([this.x,this.y],[x,y]);
        return (rd <= dist);
    }

    isWithinDistEntity(entity, dist) {
        return this.isWithinDist(entity.x, entity.y, dist);
    }

    isNextTooEntity(entity) {
        return this.isWithinDist(entity.x, entity.y, (G_TILESIZE));
    }

    isNextTooTile(x, y) {
        var tileCenter = Utils.fixGridPosition(G_TILESIZE, x, y);
        return this.isWithinDist(tileCenter.x, tileCenter.y, (G_TILESIZE));
    }

    isNextTooPosition(x, y) {
        return this.isWithinDist(x, y, (G_TILESIZE));
    }

    isAdjacentEntity(entity, dist = G_TILESIZE) {
        const dx = Math.abs(this.x - entity.x);
        const dy = Math.abs(this.y - entity.y);
        return (dx + dy) <= dist;
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
        for (let entity of entities) {
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
