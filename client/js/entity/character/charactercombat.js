// Mixin extracted from entity/character.js: attack/aggro/attacker-tracking behavior
// (Character's own "Combat Functions" section). Applied onto Character.prototype via
// installCharacterCombat(...) call in character.js; not a standalone class.
import Timer from '../../timer.js';

export function installCharacterCombat(proto) {

        proto.hit = function(orientation) {
            const self = this;
            this.setOrientation(orientation || this.orientation);
            this.fsm = "ATTACK";
            this.animate("atk", this.atkSpeed, 1, function() {
                self.fsm = "IDLE";
                self.idle(self.orientation);
            });
            // FIX: hit() never returned a value, but Player.makeAttack() gates on
            // `if (this.hit() && this.hasTarget())`. Since this always succeeds once called
            // (no failure branch above), it should report success - otherwise makeAttack()
            // always falls through to "attack_aborted" and the server is never told about
            // the attack, even though the attack animation plays locally.
            return true;
        };

        proto.onAggro = function(callback) {
            this.aggro_callback = callback;
        };

        proto.onCheckAggro = function(callback) {
            this.checkaggro_callback = callback;
        };

        proto.checkAggro = function() {
            if (this.checkaggro_callback) {
                this.checkaggro_callback();
            }
        };

        proto.aggro = function(character) {
            if (this.aggro_callback) {
                this.aggro_callback(character);
            }
        };

        proto.onDeath = function(callback) {
            this.death_callback = callback;
        };

        proto.hurt = function() {
            const self = this;

            this.stopHurting();
            this.sprite = this.hurtSprite;
            this.hurting = setTimeout(this.stopHurting.bind(this), 75);
        };

        proto.stopHurting = function() {
            this.sprite = this.normalSprite;
            clearTimeout(this.hurting);
        };

        proto.engage = function(character) {
            this.attackingMode = true;
            this.setTarget(character);
        };

        proto.disengage = function() {
            this.attackingMode = false;
            this.removeTarget();
        };

        proto.isAttacking = function() {
            return this.attackingMode;
        };

        proto.isAttackedBy = function(character) {
            if (Object.keys(this.attackers).length === 0) {
                return false;
            }
            return this.attackers.hasOwnProperty(character.id) &&
                this.attackers[character.id] === character;
        };

        proto.isAttacked = function() {
            return Object.keys(this.attackers).length > 0;
        };

        proto.addAttacker = function(character) {
            if (!this.isAttackedBy(character)) {
                this.attackers[character.id] = character;
            }
        };

        proto.removeAttacker = function(character) {
            if (!this.isAttacked()) {
                return;
            }
            delete this.attackers[character.id];
        };

        proto.removeAttackers = function() {
            this.attackers = {};
        };

        proto.clearAttackerRefs = function() {
            const self = this;
            this.forEachAttacker(function(c) {
                c.removeAttacker(self);
            });
        };

        proto.forEachAttacker = function(callback) {
            Object.values(this.attackers).forEach(callback);
        };

        proto.waitToAttack = function(character) {
            this.unconfirmedTarget = character;
        };

        proto.isWaitingToAttack = function(character) {
            return (this.unconfirmedTarget === character);
        };

        proto.canAttack = function() {
            return !this.isDead && this.attackCooldown.isOver();
        };

        proto.setAttackRate = function(rate) {
            this.attackCooldown = new Timer(rate);
        };

        proto.createAttackLink = function(target) {
            if (this.hasTarget()) {
                this.removeTarget();
            }
            this.setTarget(target);

            target.addAttacker(this);
            this.addAttacker(target);
        };

        proto.followAttack = function(entity) {
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

}
