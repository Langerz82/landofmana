// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, ItemTypes, Utils */

// TODO - Make Death Sprite seperate instead of changing Armor Sprite.
const STATE_IDLE = 0,
    STATE_MOVING = 1,
    STATE_ATTACKING = 2;

import Entity from './entity.js';
import Character from './character.js';
import PlayerCombat from './components/playercombat.js';
import PlayerItems from './components/playeritems.js';
import AppearanceData from '../data/appearancedata.js';

export default class Player extends Character {
    constructor(id, type, map, kind, name) {
        super(id, type, map, kind);
        const self = this;

        this.name = name;

        this.rights = 0;

        this.moveSpeed = 500;
        this.setMoveRate(this.moveSpeed);

        this.atkSpeed = 64;
        this.setAttackRate(64);

        //this.exp = {};
        this.level = 0;
        //this.levels = {};

        this.stats = {
            exp: {}
        };

        this.orientation = Types.Orientations.DOWN;
        this.keyMove = false;
        this.pendingKeyOrientation = null;

        this.fsm = "IDLE";
        this.sprites = [null, null];
        this.pjsSprites = [null, null];
        this.oldSprites = [null, null];

        this.items = new PlayerItems(this);
        this.combat = new PlayerCombat(this);
    }

    isMovingAll() {
        return !this.freeze && (this.isMoving() || this.orientation !== Types.Orientations.NONE);
        //return true;
    }

    setSkill(index, exp) {
        this.skillHandler.add(index, exp);
    }

    setSkills(skillExps) {
        this.skillHandler.addAll(skillExps);
    }

    getArmorSprite() {
        return this.sprites[0];
    }

    getWeaponSprite() {
        return this.sprites[1];
    }

    isArcher() {
        const weapon = this.items.getWeapon();
        if (weapon && ItemTypes.isArcherWeapon(weapon.itemKind)) {
            return true;
        }
        return false;
    }

    setRange() {
        this.setAttackRange(1);
        if (this.isArcher()) {
            this.setAttackRange(10);
        }
    }

    canKeyMove() {
        let x = this.x, y = this.y;

        switch (this.orientation) {
            case 1:
                y--;
                break;
            case 2:
                y++;
                break;
            case 3:
                x--;
                break;
            case 4:
                x++;
                break;
        }
        const ov = game.isOverlapping(this, x, y);
        if (ov)
            log.info("isOverlapping.")
        const ic = game.mapContainer.isColliding(x, y);
        if (ic)
            log.info("isColliding.")
        return !(ov || ic);
    }

    move(time, orientation, state, x, y) {
        const self = this;

        this.setOrientation(orientation);
        if (state === 1 && orientation !== Types.Orientations.NONE) {
            let lockStepTime = (G_LATENCY - (Utils.getWorldTime() - time));
            lockStepTime = lockStepTime.clamp(G_UPDATE_INTERVAL, G_LATENCY);
            console.warn("lockStepTime=" + lockStepTime);

            lockStepTime += G_LATENCY;
            clearTimeout(this.moving_callback)
            this.moving_callback = setTimeout(function() {
                self.forceStop();
                self.setPosition(x, y);
                self.ex = -1;
                self.ey = -1;
                self.moving_callback = null;
                self.walk(orientation);
                self.freeze = false;
                self.keyMove = true;
            }, lockStepTime);
        }
        else if (state === 0 || orientation === Types.Orientations.NONE) {
            this.ex = x;
            this.ey = y;
            if (!this.movement.inProgress || this.moving_callback) {
                this.forceStop();
                this.setPosition(x, y);
                clearTimeout(this.moving_callback);
                this.moving_callback = null;
            }
        }
        else if (state === 2 && orientation !== Types.Orientations.NONE) {
            this.forceStop();
            this.setPosition(x, y);
            this.ex = -1;
            this.ey = -1;
            clearTimeout(this.moving_callback);
            this.moving_callback = null;
        }
    }

    onKeyMove(callback) {
        this.key_move_callback = callback;
    }

    hit(orientation) {
        this.fsm = "ATTACK";
        this.forceStop();
        super.hit(orientation);
    }

    revive() {
        this.isDead = false;
        this.isDying = false;
        this.freeze = false;
        this.stats.hp = this.stats.hpMax;
        this.stats.ep = this.stats.epMax;
        this.disengage();
    }

    respawn(died = false) {
        if (died) {
            this.restoreSprite(0);
            this.restoreSprite(1);
        }
        this.forceStop();
        this.setOrientation(Types.Orientations.DOWN);
        this.idle(this.orientation);
        this.fsm = "IDLE";
    }

    setPosition(x, y) {
        super.setPosition(x, y);
        this.keyMove = false;

        if (this.holdingBlock) {
            const pos = this.getTilePositionNextTo(this.orientation, 1);
            this.holdingBlock.setPosition(pos[0], pos[1]);
        }

        //log.info("setPosition, rx:"+(x % G_TILESIZE)+", ry:"+(y % G_TILESIZE));
    }
    /*
        followPath: function(path) {
          this._followPath(path);
        },

        _followPath: function(path) {
            if(path.length > 1) { // Length of 1 means the player has clicked on himself
                this.path = path;
                this.step = 1;

                if(this.start_pathing_callback) {
                    this.start_pathing_callback(path);
                    this.updateMovement();
                }
                if(this.before_move_callback) {
                    this.before_move_callback();
                }
            }
        },
    */
    harvestOn(type) {
        const self = this;
        const tmptype = type;
        const harvest = function() {
            self.setOrientation(self.orientation);
            self.fsm = "HARVEST";
            self.animate("atk", self.atkSpeed, 1, function() {
                self.idle(self.orientation);
            });
            if (tmptype === "any")
                self.hideWeapon = true;
        };
        harvest();
        clearInterval(this.harvestTimeout);
        this.harvestTimeout = setInterval(function() {
            if (!self.harvestTimeout) {
                self.forceStop();
                return;
            }
            if (self.target && !(self.target.type === Types.EntityTypes.NODE)) {
                self.forceStop();
                return;
            }
            harvest();
        }, 1000);
        this.startHarvestTime = Date.now();
    }

    harvestOff() {
        if (this.fsm === "HARVEST") {
            clearInterval(this.harvestTimeout);
            this.harvestTimeout = null;
            this.startHarvestTime = 0;
            this.hideWeapon = false;
        }
    }

    /**
     *
     */
    makeAttack(entity) {
        log.info("makeAttack " + entity.id);
        const time = game.currentTime;
        const skillId = (this.attackSkill) ? this.attackSkill.skillId : -1;

        if (this === entity || this.isDead || this.isDying) // sanity check.
            return null;

        if (entity && entity.isDead) {
            this.removeTarget();
            return null;
        }

        if (this.isMoving() || this.isMovingPath())
            return;

        this.setTarget(entity);

        this.lookAtEntity(entity);
        if (!this.canReach(entity)) {
            //this.setTarget(entity);
            if (!this.followAttack(entity))
                return "attack_toofar";
            else {
                return "attack_moving";
            }
        }
        log.info("CAN REACH TARGET!!");

        if (!this.canAttack(time)) {
            log.info("CANNOT ATTACK DUE TO TIME.");
            return "attack_outoftime";
        }

        if (this.hit() && this.hasTarget()) {
            if (this.attackSkill)
                this.attackSkill.activated = true;
            return "attack_ok";
        }

        return "attack_aborted";
    }

    resetPosition(x, y) {
        this.movement.stop();
        this.keyMove = false;
        this.forceStop();
        this.setPosition(x, y);
        this.fsm = "IDLE";
    }

    setSpriteByIndex(index, num) {
        const sprite = game.sprites[AppearanceData[num].sprite];
        this.setSprite(sprite, index);
    }

    nextStep() {
        return super.nextStep();
    }

    startKeyMovement(orientation) {
        if (this.isDying || this.isDead) return;

        this.resetMovementState();           // clean old state
        this.setOrientation(orientation);

        this.keyMove = true;
        this.stopKeyMove = false;
        this.moveOrientation = orientation;

        this.walk(orientation);
        if (this.key_move_callback) this.key_move_callback(1);

        this.movement.stop(); // ensure clean
    }
}
