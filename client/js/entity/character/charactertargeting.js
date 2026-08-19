// Extracted from character.js: the "Target Functions" section (set/remove/
// query the character's current attack target). Installed directly onto
// Character.prototype (see charactercombat.js's header comment for why a
// mixin rather than a composed sub-object -- callers use `character.setTarget(...)`
// directly, not `character.targeting.setTarget(...)`).
// NOTE: circular import back to character.js is intentional and safe here - Character is
// only referenced inside removeTarget()'s function body (for an `instanceof` check), never
// at module-evaluation time, so by the time removeTarget() actually runs the Character
// binding is fully initialized. `G_TILESIZE` is an established bare global (see main.js).
import Character from './character.js';

/* global G_TILESIZE */

export function installCharacterTargeting(proto) {
    /*******************************************************************************
     * BEGIN - Target Functions.
     ******************************************************************************/

    /**
     * Sets this character's attack target. It can only have one target at any time.
     * @param {Character} character The target character.
     */
    proto.setTarget = function (character) {
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
            // FIX: was `if (this.settarget_callback && this.target)` -- requiring
            // this.target to already be set meant this callback (which
            // initTargetHud()/appui.js registers to populate and fade in the
            // hover-info GUI window) could only ever fire while a target already
            // existed. showTarget() is specifically the hover-preview path used
            // when the player hovers an entity (see gamecursor.js's movecursor())
            // while an existing target is NOT touched/overwritten -- it should
            // preview any hovered entity in the GUI regardless of whether a
            // target happens to be set, without assigning this.target itself.
            if (this.settarget_callback) {
                this.settarget_callback(character, true);
            }
        }
    };

    /**
     * Hides the hover-preview info shown by showTarget(), without touching
     * this.target -- the counterpart to removeTarget() below, but for
     * this.inspecting instead of this.target. Callers (gamecursor.js's
     * movecursor(), when the mouse hovers off an entity) are responsible for
     * only calling this while there's no real target set, so it never hides
     * the GUI panel out from under an actual (click/attack-set) target.
     */
    proto.hideTarget = function () {
        if (this.inspecting) {
            const id = this.inspecting.id;
            this.inspecting = null;
            if (this.removetarget_callback) {
                this.removetarget_callback(id);
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
        return this.target !== null;
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
