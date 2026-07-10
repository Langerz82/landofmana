// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Utils */
import EntityMoving from './entitymoving.js';
import Transition from '../transition.js';
import Timer from '../timer.js';

export default class Character extends EntityMoving {
    constructor(id, type, mapIndex, kind) {
        super(id, type, mapIndex, kind);

        this.orientation = Types.Orientations.DOWN;

        // Speeds
        this.atkSpeed = 64;

        this.setAttackRate(64);

        // Combat
        this.target = null;
        this.unconfirmedTarget = null;
        this.attackers = {};

        // Health
        this.stats = {};
        this.stats.hp = 0;
        this.stats.hpMax = 0;
        this.stats.ep = 0;
        this.stats.epMax = 0;

        // Modes
        this.isDying = false;
        this.isDead = false;
        this.attackingMode = false;
        this.inspecting = null;
        this.isStunned = false;

        this.freeze = false;
    }

    /*******************************************************************************
     * BEGIN - Stat Functions.
     ******************************************************************************/
    getHpMax() {
        return (this.stats) ? this.stats.hpMax : 0;
    }

    getEpMax() {
        return (this.stats) ? this.stats.epMax : 0;
    }

    resetHp() {
        const max = this.getHpMax();
        this.stats.hpMax = max;
        this.stats.hp = max;
    }

    resetEp() {
        const max = this.getEpMax();
        this.stats.epMax = max;
        this.stats.ep = max;
    }

    setHp(val) {
        val = val || this.getHpMax();
        this.stats.hp = val;
    }

    setEp(val) {
        val = val || this.getEpMax();
        this.stats.ep = val;
    }

    setHpMax(val) {
        val = val || this.getHpMax();
        this.stats.hpMax = val;
        this.stats.hp = val;
    }

    setEpMax(val) {
        val = val || this.getEpMax();
        this.stats.epMax = val;
        this.stats.ep = val;
    }

    hasFullHealth() {
        return this.stats.hp === this.stats.hpMax;
    }

    hasFullEnergy() {
        return this.stats.ep === this.stats.epMax;
    }

    setAttackRange(range) {
        this.attackRange = range;
    }

    modHp(val) {
        const prev = this._modHp(val);

        if (this.stats.hp == 0) {
            this.die();
        }
        return (typeof game !== 'undefined') ? prev : this.changePoints(prev, 0);
    }

    modEp(val) {
        const prev = this._modEp(val);
        return (typeof game !== 'undefined') ? prev : this.changePoints(0, prev);
    }

    _modHp(val) {
        const hp = this.stats.hp,
            max = this.stats.hpMax;

        let prev = hp;
        this.stats.hp = Utils.clamp(0, max, hp + val);
        prev -= this.stats.hp;
        return prev;
    }

    _modEp(val) {
        const ep = this.stats.ep,
            max = this.stats.epMax;

        let prev = ep;
        this.stats.ep = Utils.clamp(0, max, ep + val);
        prev -= this.stats.ep;
        return prev;
    }

    /*******************************************************************************
     * END - Stat Functions.
     ******************************************************************************/

    /*******************************************************************************
     * BEGIN - Combat Functions.
     ******************************************************************************/

    hit(orientation) {
        const self = this;
        this.setOrientation(orientation || this.orientation);
        this.fsm = "ATTACK";
        //this.freeze = true;
        this.animate("atk", this.atkSpeed, 1, function() {
            self.fsm = "IDLE";
            //self.freeze = false;
            self.idle(self.orientation);
        });
        // FIX: hit() never returned a value, but Player.makeAttack() gates on
        // `if (this.hit() && this.hasTarget())`. Since this always succeeds once called
        // (no failure branch above), it should report success - otherwise makeAttack()
        // always falls through to "attack_aborted" and the server is never told about
        // the attack, even though the attack animation plays locally.
        return true;
    }

    onAggro(callback) {
        this.aggro_callback = callback;
    }

    onCheckAggro(callback) {
        this.checkaggro_callback = callback;
    }

    checkAggro() {
        if (this.checkaggro_callback) {
            this.checkaggro_callback();
        }
    }

    aggro(character) {
        if (this.aggro_callback) {
            this.aggro_callback(character);
        }
    }

    onDeath(callback) {
        this.death_callback = callback;
    }

    hurt() {
        const self = this;

        this.stopHurting();
        this.sprite = this.hurtSprite;
        this.hurting = setTimeout(this.stopHurting.bind(this), 75);
    }

    stopHurting() {
        this.sprite = this.normalSprite;
        clearTimeout(this.hurting);
    }

    /**
     * Makes the character attack another character. Same as Character.follow but with an auto-attacking behavior.
     * @see Character.follow
     */
    engage(character) {
        this.attackingMode = true;
        this.setTarget(character);
        //this.follow(character);
    }

    disengage() {
        this.attackingMode = false;
        this.removeTarget();
    }

    /**
     * Returns true if the character is currently attacking.
     */
    isAttacking() {
        return this.attackingMode;
    }

    /**
     * Returns true if this character is currently attacked by a given character.
     * @param {Character} character The attacking character.
     * @returns {Boolean} Whether this is an attacker of this character.
     */
    isAttackedBy(character) {
        if (Object.keys(this.attackers).length === 0) {
            return false;
        }
        return this.attackers.hasOwnProperty(character.id) &&
            this.attackers[character.id] === character;
    }

    isAttacked() {
        return !(Object.keys(this.attackers).length === 0);
    }

    /**
     * Registers a character as a current attacker of this one.
     * @param {Character} character The attacking character.
     */
    addAttacker(character) {
        if (!this.isAttackedBy(character)) {
            this.attackers[character.id] = character;
        }
    }

    /**
     * Unregisters a character as a current attacker of this one.
     * @param {Character} character The attacking character.
     */
    removeAttacker(character) {
        if (!this.isAttacked()) {
            return;
        }
        delete this.attackers[character.id];
    }

    removeAttackers() {
        this.attackers = {};
    }

    clearAttackerRefs() {
        const self = this;
        this.forEachAttacker(function(c) {
            c.removeAttacker(self);
        });
    }

    /**
     * Loops through all the characters currently attacking this one.
     * @param {Function} callback Function which must accept one character argument.
     */
    forEachAttacker(callback) {
        _.each(this.attackers, function(attacker) {
            callback(attacker);
        });
    }

    /**
     * Marks this character as waiting to attack a target.
     * By sending an "attack" message, the server will later confirm (or not)
     * that this character is allowed to acquire this target.
     *
     * @param {Character} character The target character
     */
    waitToAttack(character) {
        this.unconfirmedTarget = character;
    }

    /**
     * Returns true if this character is currently waiting to attack the target character.
     * @param {Character} character The target character.
     * @returns {Boolean} Whether this character is waiting to attack.
     */
    isWaitingToAttack(character) {
        return (this.unconfirmedTarget === character);
    }

    canAttack() {
        if (this.isDead === false && this.attackCooldown.isOver()) {
            return true;
        }
        return false;
    }

    setAttackRate(rate) {
        this.attackCooldown = new Timer(rate);
    }

    createAttackLink(target) {
        if (this.hasTarget()) {
            this.removeTarget();
        }
        this.setTarget(target);

        target.addAttacker(this);
        this.addAttacker(target);
    }

    followAttack(entity) {
        const found = false;

        const spot = this.getClosestSpot(entity, 1, this.attackRange);

        if (spot && spot.x && spot.y)
            this.moveTo_(spot.x, spot.y);
    }

    /*******************************************************************************
     * END - Combat Functions.
     ******************************************************************************/

    /*******************************************************************************
     * BEGIN - Target Functions.
     ******************************************************************************/

    /**
     * Sets this character's attack target. It can only have one target at any time.
     * @param {Character} character The target character.
     */
    setTarget(character) {
        //try { throw new Error(); } catch(err) { console.error(err.stack); }
        if (character === null || character.isDying || character.isDead) {
            this.removeTarget();
            return;
        }
        if (this.target !== character) { // If it's not already set as the target
            if (this.hasTarget()) {
                this.removeTarget(); // Cleanly remove the previous one
            }
            this.target = character;
            if (this.settarget_callback) {
                this.settarget_callback(character, true);
            }
        } else {
            console.debug(character.id + " is already the target of " + this.id);
        }
    }

    onSetTarget(callback) {
        this.settarget_callback = callback;
    }

    showTarget(character) {
        if (this.inspecting !== character && character !== this) {
            this.inspecting = character;
            if (this.settarget_callback && this.target) {
                this.settarget_callback(character, true);
            }
        }
    }

    /**
     * Removes the current attack target.
     */
    removeTarget() {
        const self = this;

        if (this.target) {
            if (this.target instanceof Character) {
                this.target.removeAttacker(this);
            }
            if (this.removetarget_callback) this.removetarget_callback(this.target.id);
            this.target = null;
        }
    }

    onRemoveTarget(callback) {
        this.removetarget_callback = callback;
    }

    /**
     * Returns true if this character has a current attack target.
     * @returns {Boolean} Whether this character has a target.
     */
    hasTarget() {
        return !(this.target === null);
    }

    canReachTarget() {
        return this.canReach(this.target);
    }

    canInteract(entity) {
        return this.isInReach(entity.x, entity.y);
    }

    canReach(entity) {
        const ts = G_TILESIZE;

        if (this.attackRange === 1)
            return this.isInReach(entity.x, entity.y, this.orientation);

        if (this.attackRange > 1) {
            const range = ~~(Utils.realDistance([entity.x, entity.y], [this.x, this.y]) / ts);
            return range <= this.attackRange;
        }
        return false;
    }

    clearTarget() {
        this.target = null;
    }

    /*******************************************************************************
     * END - Target Functions.
     ******************************************************************************/

    /*******************************************************************************
     * BEGIN - State Function.
     ******************************************************************************/

    hasWeapon() {
        return false;
    }

    /**
     *
     */
    dead() {
        this.isDead = true;
        this.isDying = false;
        this.forceStop();
        this.freeze = true;
    }

    die(attacker) {
        this.forceStop();
        this.removeTarget();
        this.isDying = true;
        this.freeze = true;
        clearTimeout(this.moveTimeout);

        if (this.death_callback) {
            this.death_callback(attacker);
        }
    }

    /*******************************************************************************
     * END - State Functions.
     ******************************************************************************/

    /*******************************************************************************
     * BEGIN - Misc Functions.
     ******************************************************************************/

    onRemove(callback) {
        this.remove_callback = callback;
    }

    canMove() {
        if (this.isDead === false && this.moveCooldown.isOver()) {
            return true;
        }
        return false;
    }

    clean() {
        this.forEachAttacker(function(attacker) {
            attacker.disengage();
            attacker.idle();
        });
    }

    forceStop() {
        this._forceStop();
        if (!this.isDying && !this.isDead && !this.hasAnimation('atk'))
            this.idle();
    }

    /*******************************************************************************
     * END - Misc Function.
     ******************************************************************************/
}
