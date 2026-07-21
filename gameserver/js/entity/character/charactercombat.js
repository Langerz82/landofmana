// Extracted from character.js: the "Stat Functions" and "Combat Functions"
// sections (hp/ep get/set/mod, damage application, attacker tracking, attack
// rate/range, engage/disengage). Installed directly onto Character.prototype
// (not composed as a sub-object) so every existing call site
// (`character.setHp(...)`, `character.onDamage(...)`, etc., throughout
// mob.js/player.js/mobai.js/packets/*) keeps working unchanged -- Player and
// Mob both extend Character, so this is inherited exactly as if it were
// still written directly in the class body.
import Messages from '../../message.js';
import Timer from '../../timer.js';
import Utils from '../../utils.js';
import Scheduler from '../../scheduler.js';

export function installCharacterCombat(proto) {
    /*******************************************************************************
     * BEGIN - Stat Functions.
     ******************************************************************************/
    proto.getHpMax = function () {
        return this.stats ? this.stats.hpMax : 0;
    };

    proto.getEpMax = function () {
        return this.stats ? this.stats.epMax : 0;
    };

    proto.resetHp = function () {
        const max = this.getHpMax();
        this.stats.hpMax = max;
        const diff = max - this.stats.hp;
        this.stats.hp = max;
        //try { throw new Error(); } catch(err) { console.info(err.stack); }
        const msg = new Messages.ChangePoints(this, diff, 0);
        this.map.entities.sendNeighbours(this, msg);
    };

    proto.resetEp = function () {
        const max = this.getEpMax();
        this.stats.epMax = max;
        this.stats.ep = max;
    };

    // FIX: these four used `val = val || default`, which treats an explicit
    // 0 the same as "no argument passed" and silently substitutes the max
    // instead. Every current call site only ever calls these with no
    // argument (entity/player.js, packets/packethandler.js), where falling
    // back to the max is exactly the intended default, so this was never hit
    // in practice -- but it's a live trap for the next caller that needs
    // e.g. setHp(0) (an instant-kill effect), which would silently full-heal
    // instead. Checking for null/undefined instead of falsiness preserves
    // the "no argument -> default to max" behavior while letting an explicit
    // 0 through.
    proto.setHp = function (val) {
        val = val == null ? this.getHpMax() : val;
        this.stats.hp = val;
    };

    proto.setEp = function (val) {
        val = val == null ? this.getEpMax() : val;
        this.stats.ep = val;
    };

    proto.setHpMax = function (val) {
        val = val == null ? this.getHpMax() : val;
        this.stats.hpMax = val;
        this.stats.hp = val;
    };

    proto.setEpMax = function (val) {
        val = val == null ? this.getEpMax() : val;
        this.stats.epMax = val;
        this.stats.ep = val;
    };

    proto.hasFullHealth = function () {
        return this.stats.hp === this.stats.hpMax;
    };

    proto.hasFullEnergy = function () {
        return this.stats.ep === this.stats.epMax;
    };

    proto.setAttackRange = function (range) {
        this.attackRange = range;
    };

    proto.modHp = function (val) {
        const prev = this._modHp(val);
        return typeof game !== 'undefined' ? prev : this.changePoints(prev, 0);
    };

    proto.modEp = function (val) {
        const prev = this._modEp(val);
        return typeof game !== 'undefined' ? prev : this.changePoints(0, prev);
    };

    proto._modHp = function (val) {
        const hp = this.stats.hp,
            max = this.stats.hpMax;

        let prev = hp;
        this.stats.hp = Utils.clamp(0, max, hp + val);
        prev -= this.stats.hp;
        return prev;
    };

    proto._modEp = function (val) {
        const ep = this.stats.ep,
            max = this.stats.epMax;

        let prev = ep;
        this.stats.ep = Utils.clamp(0, max, ep + val);
        prev -= this.stats.ep;
        return prev;
    };

    proto.changePoints = function (modhp, modep) {
        return new Messages.ChangePoints(this, modhp, modep);
    };

    proto.onDamage = function (attacker, hpMod, epMod, crit, effects) {
        hpMod = hpMod || 0;
        epMod = epMod || 0;
        crit = crit || 0;
        effects = effects || 0;

        if (this.invincible) return;

        const hpDiff = this._modHp(-hpMod);
        const epDiff = this._modEp(-epMod);

        if (hpMod > 0) this.addAttacker(attacker);

        const msg = new Messages.Damage([
            attacker,
            this,
            -hpDiff,
            -epDiff,
            crit,
            effects
        ]);
        this.map.entities.sendNeighbours(attacker, msg);
    };

    /*******************************************************************************
     * END - Stat Functions.
     ******************************************************************************/

    /*******************************************************************************
     * BEGIN - Combat Functions.
     ******************************************************************************/

    proto.hit = function (orientation) {
        this.setOrientation(orientation);
        this.stop();
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

    // PERF: hurt() fires on every single hit landed, by every player/mob in
    // combat -- the highest-frequency of the codebase's one-shot timer sites.
    // Was its own setTimeout per hit; routed through the shared Scheduler
    // (gameserver/js/scheduler.js) instead of a live Node timer per hit.
    proto.hurt = function () {
        const self = this;

        this.stopHurting();
        this.sprite = this.hurtSprite;
        this.hurting = Scheduler.schedule(function () {
            self.stopHurting();
        }, 75);
    };

    proto.stopHurting = function () {
        this.sprite = this.normalSprite;
        // Scheduler.cancel() is a safe no-op for an already-fired/never-set
        // token, exactly like clearTimeout() was -- see scheduler.js.
        Scheduler.cancel(this.hurting);
        this.hurting = null;
    };

    /**
     * Makes the character attack another character. Same as Character.follow but with an auto-attacking behavior.
     * @see Character.follow
     */
    proto.engage = function (character) {
        this.attackingMode = true;
        this.setTarget(character);
        //this.follow(character);
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
    // PERF: `attackers` is a Map (see constructor) -- has()+get() identity
    // check below are both O(1) with no allocation, same as the array-
    // allocation-free behavior this PERF fix originally established when
    // `attackers` was still a plain object.
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
        if (this.isDead === false && this.attackCooldown.isOver()) {
            return true;
        }
        return false;
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
        const found = false;

        const spot = this.getClosestSpot(entity, 1, this.attackRange);

        if (spot && spot.x && spot.y) this.moveTo_(spot.x, spot.y);
    };

    /*******************************************************************************
     * END - Combat Functions.
     ******************************************************************************/
}
