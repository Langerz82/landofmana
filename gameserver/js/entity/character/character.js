// Split (see charactercombat.js/charactertargeting.js): this file used to
// implement the "Stat Functions"/"Combat Functions"/"Target Functions"
// sections directly in the class body (it had grown to ~560 lines). Those
// three sections are now installed onto Character.prototype from sibling
// files via the same installXxx(proto) mixin pattern used elsewhere in this
// codebase (see e.g. mob.js's component wiring) -- external behavior and the
// `character.setTarget(...)`/`character.onDamage(...)`-style call sites
// throughout mob.js/player.js/mobai.js/packets/* are unchanged. Only the
// constructor, "State Functions", and "Misc Functions" sections remain here.
import EntityMoving from '../entitymoving/entitymoving.js';
import Utils from '../../utils.js';
import { installCharacterCombat } from './charactercombat.js';
import { installCharacterTargeting } from './charactertargeting.js';

class Character extends EntityMoving {
    constructor(id, type, kind, x, y, map) {
        super(id, type, kind, x, y, map);
        const self = this;

        //this.orientation = Types.Orientations.DOWN;

        // Speeds
        this.atkSpeed = 100;
        this.moveSpeed = 100;
        this.setMoveRate(this.moveSpeed);
        this.walkSpeed = 150;
        this.idleSpeed = Utils.randomInt(750, 1000);
        this.setAttackRate(1024);

        // Combat
        this.target = null;
        this.unconfirmedTarget = null;
        // SIMPLIFY/PERF: was a plain object keyed by attacker id, accessed via
        // hasOwnProperty()/delete/_.each -- switched to a Map so isAttackedBy()/
        // isAttacked()/removeAttacker()/forEachAttacker() below can use
        // Map#has/#size/#delete/native iteration instead, and this file no
        // longer needs underscore just for this one loop.
        this.attackers = new Map();

        // Health
        this.stats = {};
        this.stats.hp = 0;
        this.stats.hpMax = 0;
        this.stats.ep = 0;
        this.stats.epMax = 0;

        // Modes
        //    this.isDying = false;
        this.isDead = false;
        this.attackingMode = false;

        this.step = 0;

        this.orientation = 2;

        this.attackCooldown = null;
        this.moveCooldown = null;

        this.freeze = false;

        this.activeEffects = [];
        this.effects = {};
        this.invincible = false;

        this.mod = {
            accuracy: 1,
            damage: 1,
            defence: 1,
            attack: 1,
            attackTime: 1,
            crit: 1,
            dot: 0,
            dr: 0,
            time: 0,
            daze: 0,
            hate: 0
        };
    }

    /*******************************************************************************
     * BEGIN - State Functions.
     ******************************************************************************/

    hasWeapon() {
        return false;
    }

    /**
     *
     */
    /*dead() {
    this.isDead = true;
    this.isDying = false;
    this.forceStop();
    this.freeze = true;
  },*/

    die(attacker) {
        const self = this;

        console.info('character, die: called.');
        this.forceStop();
        //try { throw new Error(); } catch(err) { console.info(err.stack); }
        this.removeTarget();
        //this.isDying = true;
        this.isDead = true;
        this.freeze = true;
        clearTimeout(this.moveTimeout);

        this.removeAttackers();
        this.endEffects();

        if (this.death_callback) {
            this.death_callback(attacker);
        }
    }

    endEffects() {
        for (const skilleffect of this.activeEffects) {
            skilleffect.endEffects();
        }
        this.activeEffects = [];
    }

    /*dying() {
    this.isDead = false;
    this.isDying = true;
  },*/

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

    /*******************************************************************************
     * END - Misc Function.
     ******************************************************************************/
}

installCharacterCombat(Character.prototype);
installCharacterTargeting(Character.prototype);

export default Character;
