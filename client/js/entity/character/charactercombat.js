// Mixin extracted from entity/character.js: attack/aggro/attacker-tracking behavior
// (Character's own "Combat Functions" section). Applied onto Character.prototype via
// installCharacterCombat(...) call in character.js; not a standalone class.
import Timer from '../../timer.js';

export function installCharacterCombat(proto) {
    proto.hit = function (orientation) {
        const self = this;
        this.setOrientation(orientation || this.orientation);
        this.fsm = 'ATTACK';
        this.animate('atk', this.atkSpeed, 1, function () {
            self.fsm = 'IDLE';
            self.idle(self.orientation);
        });
        // FIX: hit() never returned a value, but Player.makeAttack() gates on
        // `if (this.hit() && this.hasTarget())`. Since this always succeeds once called
        // (no failure branch above), it should report success - otherwise makeAttack()
        // always falls through to "attack_aborted" and the server is never told about
        // the attack, even though the attack animation plays locally.
        return true;
    };

    proto.onAggro = function (callback) {
        this.aggro_callback = callback;
    };

    proto.onCheckAggro = function (callback) {
        this.checkaggro_callback = callback;
    };

    proto.checkAggro = function () {
        if (this.checkaggro_callback) {
            this.checkaggro_callback();
        }
    };

    proto.aggro = function (character) {
        if (this.aggro_callback) {
            this.aggro_callback(character);
        }
    };

    proto.onDeath = function (callback) {
        this.death_callback = callback;
    };

    proto.hurt = function () {
        const self = this;

        this.stopHurting();
        this.sprite = this.hurtSprite;
        this.hurting = setTimeout(this.stopHurting.bind(this), 75);
    };

    proto.stopHurting = function () {
        this.sprite = this.normalSprite;
        clearTimeout(this.hurting);
    };

    /**
     * Makes the character attack another character. Same as Character.follow but with an auto-attacking behavior.
     * @see Character.follow
     */
    proto.engage = function (character) {
        this.attackingMode = true;
        this.setTarget(character);
    };

    proto.disengage = function () {
        this.attackingMode = false;
        this.removeTarget();
    };

    /**
     * Returns true if the character is currently attacking.
     */
    proto.isAttacking = function () {
        return this.attackingMode;
    };

    /**
     * Returns true if this character is currently attacked by a given character.
     * @param {Character} character The attacking character.
     * @returns {Boolean} Whether this is an attacker of this character.
     */
    // PERF: `attackers` is a Map (see character.js constructor) -- has()+get()
    // identity check below are both O(1) with no allocation, same as the
    // array-allocation-free behavior this PERF fix originally established
    // when `attackers` was still a plain object.
    proto.isAttackedBy = function (character) {
        return (
            this.attackers.has(character.id) &&
            this.attackers.get(character.id) === character
        );
    };

    proto.isAttacked = function () {
        return this.attackers.size !== 0;
    };

    /**
     * Registers a character as a current attacker of this one.
     * @param {Character} character The attacking character.
     */
    proto.addAttacker = function (character) {
        if (!this.isAttackedBy(character)) {
            this.attackers.set(character.id, character);
        }
    };

    /**
     * Unregisters a character as a current attacker of this one.
     * @param {Character} character The attacking character.
     */
    proto.removeAttacker = function (character) {
        if (!this.isAttacked()) {
            return;
        }
        this.attackers.delete(character.id);
    };

    proto.removeAttackers = function () {
        this.attackers.clear();
    };

    proto.clearAttackerRefs = function () {
        const self = this;
        this.forEachAttacker(function (c) {
            c.removeAttacker(self);
        });
    };

    /**
     * Loops through all the characters currently attacking this one.
     * @param {Function} callback Function which must accept one character argument.
     */
    proto.forEachAttacker = function (callback) {
        for (const attacker of this.attackers.values()) {
            callback(attacker);
        }
    };

    /**
     * Marks this character as waiting to attack a target.
     * By sending an "attack" message, the server will later confirm (or not)
     * that this character is allowed to acquire this target.
     *
     * @param {Character} character The target character
     */
    proto.waitToAttack = function (character) {
        this.unconfirmedTarget = character;
    };

    /**
     * Returns true if this character is currently waiting to attack the target character.
     * @param {Character} character The target character.
     * @returns {Boolean} Whether this character is waiting to attack.
     */
    proto.isWaitingToAttack = function (character) {
        return this.unconfirmedTarget === character;
    };

    proto.canAttack = function () {
        return !this.isDead && this.attackCooldown.isOver();
    };

    proto.setAttackRate = function (rate) {
        this.attackCooldown = new Timer(rate);
    };

    proto.createAttackLink = function (target) {
        if (this.hasTarget()) {
            this.removeTarget();
        }
        this.setTarget(target);

        target.addAttacker(this);
        this.addAttacker(target);
    };

    proto.followAttack = function (entity) {
        const spot = this.getClosestSpot(entity, 1, this.attackRange);

        // FIX: this never returned a value, but its only caller, Player.makeAttack(), branches
        // on the return value (`if (!this.followAttack(entity)) return "attack_toofar"; else
        // return "attack_moving";`) - so makeAttack() always reported "attack_toofar" even when
        // a valid spot was found and movement started. Return true/false like the analogous
        // EntityMoving.follow().
        if (spot && spot.x && spot.y) {
            this.moveTo_(spot.x, spot.y);
            return true;
        }
        return false;
    };

    /*******************************************************************************
     * END - Combat Functions.
     ******************************************************************************/
}
