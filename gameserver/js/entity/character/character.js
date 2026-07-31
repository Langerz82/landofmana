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
import { G_DEBUG } from '../../constants.js';

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

        // PERF: Character.die() is the shared death path for both players
        // and mobs -- with continuous combat across hundreds of mobs, this
        // was an unconditional, high-frequency log. Gated behind G_DEBUG
        // like equivalent per-event logging elsewhere.
        if (G_DEBUG) console.info('character, die: called.');
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

    // FIX: was `for (const skilleffect of this.activeEffects)` -- iterating
    // the live array directly. skilleffect.endEffects() (skilleffect.js)
    // calls applyEffects('end', 0) -> applyEffect(), which splices `this`
    // SkillEffect back out of EVERY one of its targets' own activeEffects
    // array once its 'end' phase runs -- and this character is always one
    // of those targets (that's the only way its SkillEffect instance could
    // have ended up in `this.activeEffects` to begin with). So each loop
    // iteration was mutating the very array the for...of loop was reading
    // from: removing the current element shifts every later element down
    // one index, and the loop's next step then reads whatever shifted into
    // the just-vacated slot -- silently skipping the effect that used to be
    // two positions ahead. With 2+ simultaneously active effects (routine
    // in real combat -- multiple DOTs/buffs/debuffs stacking from different
    // sources), roughly every other effect never got its own endEffects()
    // called: its interval-tick Scheduler token was never cancelled (kept
    // firing every 2000ms against a now-dead/removed entity), it was never
    // removed from its caster's SkillEffectHandler.skillEffects list (a
    // permanent per-skipped-effect leak for the life of the process), and
    // for an AOE effect, any OTHER target it's still active on never got
    // this specific instance's 'end' phase applied by this cleanup path.
    // This runs on every death (die(), above) AND every disconnect/removal
    // (mob.js's destroy(), player.js's destroy()), so it's not a rare edge
    // case. Iterating a snapshot (slice()) instead means the live-array
    // splicing inside the loop body can no longer affect which elements
    // this loop still has left to visit -- every effect present at the
    // start of the call gets its endEffects() invoked exactly once, same
    // as the final `this.activeEffects = []` reset below already assumed
    // was happening.
    endEffects() {
        for (const skilleffect of this.activeEffects.slice()) {
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

    // FIX: removed a duplicate `onRemove(callback) { this.remove_callback =
    // callback; }` that was identical to entity/entity.js's base
    // implementation (Character extends EntityMoving extends Entity), so it
    // was dead redundant code shadowing the inherited one with an identical
    // body -- no behavior change from removing it.

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
