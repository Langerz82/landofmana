// Extracted from character.js: the "Target Functions" section (set/remove/
// query the character's current attack target). Installed directly onto
// Character.prototype (see charactercombat.js's header comment for why a
// mixin rather than a composed sub-object -- callers use `character.setTarget(...)`
// directly, not `character.targeting.setTarget(...)`).
// NOTE: imports Character from character.js -- a circular import (character.js
// imports installCharacterTargeting from this file). Safe here because the
// only use (removeTarget()'s `instanceof Character` check below) is inside a
// function body invoked well after both modules have finished evaluating,
// not at module-eval time; ES module bindings are live, so by the time this
// runs the import is fully resolved.
import { G_TILESIZE } from '../../constants.js';
import Character from './character.js';

export function installCharacterTargeting(proto) {
    /*******************************************************************************
     * BEGIN - Target Functions.
     ******************************************************************************/

    /**
     * Sets this character's attack target. It can only have one target at any time.
     * @param {Character} character The target character.
     */
    proto.setTarget = function (character) {
        //try { throw new Error(); } catch(err) { console.error(err.stack); }
        if (character === null || character.isDying || character.isDead) {
            this.removeTarget();
            return;
        }
        if (this.target !== character) {
            // If it's not already set as the target
            if (this.hasTarget()) {
                this.removeTarget(); // Cleanly remove the previous one
            }
            this.target = character;
            if (this.settarget_callback) {
                this.settarget_callback(character, true);
            }
        } else {
            console.debug(
                character.id + ' is already the target of ' + this.id
            );
        }
    };

    proto.onSetTarget = function (callback) {
        this.settarget_callback = callback;
    };

    proto.showTarget = function (character) {
        if (this.inspecting !== character && character !== this) {
            this.inspecting = character;
            if (this.settarget_callback && this.target) {
                this.settarget_callback(character, true);
            }
        }
    };

    /**
     * Removes the current attack target.
     */
    // NOTE: was `const self = this;` here, unused -- nothing in this method
    // needed a captured reference to `this` (no nested callback loses binding
    // the way hurt()/setFreeze() elsewhere in this file do).
    proto.removeTarget = function () {
        if (this.target) {
            if (this.target instanceof Character) {
                this.target.removeAttacker(this);
            }
            if (this.removetarget_callback)
                this.removetarget_callback(this.target.id);
            this.target = null;
        }
    };
    proto.onRemoveTarget = function (callback) {
        this.removetarget_callback = callback;
    };

    /**
     * Returns true if this character has a current attack target.
     * @returns {Boolean} Whether this character has a target.
     */
    proto.hasTarget = function () {
        return !(this.target === null);
    };

    proto.canReachTarget = function () {
        return this.canReach(this.target);
    };

    proto.canInteract = function (entity) {
        return this.isNextTooEntity(entity) && this.isFacingEntity(entity);
    };

    proto.canReach = function (entity) {
        if (this.attackRange === 1)
            return this.isNextTooEntity(entity) && this.isFacingEntity(entity);

        if (this.attackRange > 1) {
            return this.isWithinDistEntity(
                entity,
                this.attackRange * G_TILESIZE
            );
        }
        return false;
    };

    proto.clearTarget = function () {
        this.target = null;
    };

    /*******************************************************************************
     * END - Target Functions.
     ******************************************************************************/
}
