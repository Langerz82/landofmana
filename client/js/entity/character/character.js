// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Utils */
import EntityMoving from '../entitymoving/entitymoving.js';
import Transition from '../../transition.js';
// FIX (maintainability): Character had grown large mixing constructor/stats with combat
// (attack/aggro/attacker-tracking) and targeting (setTarget/removeTarget/canReach) behavior.
// Split those two sections into sibling mixin files, same pattern used throughout this
// codebase (see entitymoving.js, gameinteraction.js, etc.) - installed onto Character.prototype
// right after the class declaration below. (Timer moved to charactercombat.js - it was only
// used by setAttackRate, which lives there now.)
import { installCharacterCombat } from './charactercombat.js';
import { installCharacterTargeting } from './charactertargeting.js';

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
        return this.stats ? this.stats.hpMax : 0;
    }

    getEpMax() {
        return this.stats ? this.stats.epMax : 0;
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

        if (this.stats.hp === 0) {
            this.die();
        }
        // NOTE: the `typeof game !== 'undefined'` branch below calls `this.changePoints(...)`,
        // which doesn't exist anywhere in this client codebase - it would throw if ever reached.
        // In the browser client `game` is always defined by the time any Character exists, so
        // this branch is unreachable dead code here (this class file looks shared with a
        // server-side counterpart where `game` is undefined and `changePoints` presumably lives).
        // Left as-is since there's no client-side implementation to fix it to.
        return typeof game !== 'undefined' ? prev : this.changePoints(prev, 0);
    }

    modEp(val) {
        const prev = this._modEp(val);
        return typeof game !== 'undefined' ? prev : this.changePoints(0, prev);
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
        return !this.isDead && this.moveCooldown.isOver();
    }

    clean() {
        this.forEachAttacker(function (attacker) {
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

installCharacterCombat(Character.prototype);
installCharacterTargeting(Character.prototype);
