// Extracted from updater.js's Updater class: the low-level per-character/per-player
// movement-step primitives (checkStopDanger/charPath*/charKey*/playerKey*/playerPath*/
// stopTransition) plus the four per-tick dispatchers that wire them up
// (updateCharacterPathMovement/updateCharacterKeyMovement/updatePlayerPathMovement/
// updatePlayerKeyMovement).
//
// NOTE on `self` vs `this`: the movement-step primitives were originally declared as class
// FIELD arrow functions (`checkStopDanger = (c) => {...}`), not regular prototype methods -
// deliberately, to survive being invoked as bare function references. Transition.start()/
// step() (transition.js) stores whatever's passed as `this.updateFunction` and later calls it
// as `this.updateFunction(this.object, mod)`, i.e. as a method of the Transition instance, not
// of Updater - an ordinary function assigned the same way would have `this` rebound to
// Transition and throw. Arrow functions ignore call-site `this` entirely and always close over
// whatever `this` was lexically in scope when they were defined, which is why the original
// code used them.
//
// Moved out here as an instance-installer (same pattern as gamepad/gamepadbuttons.js /
// entity/playerlocalmovement.js), the arrow functions no longer have a `this` to close over
// automatically - `installUpdaterMovement(self)` takes the Updater instance explicitly and
// every function below closes over that `self` parameter instead of `this`, giving
// the exact same "always the right instance, regardless of how it's later called" behavior.
// The four dispatcher methods keep their original `const self = this;` internal aliasing,
// since they're only ever called via ordinary method-call syntax (`self.updateXxx(entity)`
// from updateCharacters() in updater.js), which binds `this` correctly on its own.

/* global Types */

export function installUpdaterMovement(self) {
    self.checkStopDanger = (c) => {
        const o = c.orientation;
        let res = false;

        if (c.ex === -1 && c.ey === -1) {
            return false;
        }
        if (c.x === c.ex && c.y === c.ey) {
            log.info('checkStopDanger - coordinates equal');
            res = true;
        }

        const x = c.x,
            y = c.y;

        if (o === Types.Orientations.LEFT && c.x < c.ex) {
            return true;
        } else if (o === Types.Orientations.RIGHT && c.x > c.ex) {
            return true;
        } else if (o === Types.Orientations.UP && c.y < c.ey) {
            return true;
        } else if (o === Types.Orientations.DOWN && c.y > c.ey) {
            return true;
        }
        if (res) {
            c.setPosition(c.ex, c.ey);
            log.info('WARN - PLAYER ' + c.id + ' not stopping.');
            log.info('x :' + x + ',y :' + y);
            log.info('ex:' + c.ex + ',ey:' + c.ey);
        }
        return res;
    };

    self.charPath = (c, x, y) => {
        if (c.hasChangedItsPath()) {
            return true;
        }
        // FIX: `c.map` is never set anywhere on Entity/Character (only game.mapContainer
        // exists), so this mid-path collision guard was permanently dead code - NPC/mob
        // movement never actually re-checked collision here. Also dropped the leftover
        // debug try/throw/console.error trace scaffold that sat in the dead branch.
        if (
            self.game.mapContainer &&
            self.game.mapContainer.isColliding(x, y)
        ) {
            return true;
        }
        c.setPosition(x, y);
        return c.nextStep();
    };

    self.charPathXF = (c, m) => {
        const x = c.x + m,
            y = c.y;
        return self.charPath(c, x, y);
    };

    self.charPathYF = (c, m) => {
        const x = c.x,
            y = c.y + m;
        return self.charPath(c, x, y);
    };

    self.charKey = (c, x, y) => {
        if (self.checkStopDanger(c)) {
            c.forceStop();
            return true;
        }
        const res = self.game.moveCharacter(c, x, y);
        if (res) {
            c.setPosition(x, y);
        } else {
            c.forceStop();
        }
        return false;
    };

    self.charKeyXF = (c, m) => {
        const x = c.x + m;
        const y = c.y;
        return self.charKey(c, x, y);
    };

    self.charKeyYF = (c, m) => {
        const x = c.x;
        const y = c.y + m;
        return self.charKey(c, x, y);
    };

    self.playerKey = (c, x, y) => {
        const res = self.game.moveCharacter(c, x, y);
        if (res) {
            c.setPosition(x, y);
        } else {
            c.keyMove = true;
            c.forceStop();
        }
        return !res;
    };

    self.playerKeyXF = (c, m) => {
        const x = c.x + m;
        const y = c.y;
        return self.playerKey(c, x, y);
    };

    self.playerKeyYF = (c, m) => {
        const x = c.x;
        const y = c.y + m;
        return self.playerKey(c, x, y);
    };

    self.playerPath = (c, x, y) => {
        c.setPosition(x, y);
        return c.nextStep();
    };

    self.playerPathXF = (c, m) => {
        const x = c.x + m;
        const y = c.y;
        return self.playerPath(c, x, y);
    };

    self.playerPathYF = (c, m) => {
        const x = c.x;
        const y = c.y + m;
        return self.playerPath(c, x, y);
    };

    self.stopTransition = (c) => {};

    self.updateCharacterPathMovement = function (c) {
        const self = this;

        const tick = c.tickFrames;
        const o = c.orientation;

        if (c.freeze || c.isStunned || c.isDying || c.isDead) {
            return;
        }

        // TODO - Fix character stuttering thats corrupting the map display and collision.

        const canMove = c.movement.inProgress === false && c.isMovingPath();
        if (canMove) {
            if (o === Types.Orientations.LEFT) {
                c.movement.start(self.charPathXF, self.stopTransition, -tick);
            } else if (o === Types.Orientations.RIGHT) {
                c.movement.start(self.charPathXF, self.stopTransition, tick);
            } else if (o === Types.Orientations.UP) {
                c.movement.start(self.charPathYF, self.stopTransition, -tick);
            } else if (o === Types.Orientations.DOWN) {
                c.movement.start(self.charPathYF, self.stopTransition, tick);
            }
        }
    };

    self.updateCharacterKeyMovement = function (c) {
        if (c.freeze || c.isMovingPath() || c.isDying || c.isDead) {
            return;
        }

        const self = this;
        const tick = c.tickFrames;
        const o = c.orientation;

        const canMove = c.movement.inProgress === false && c.keyMove && o > 0;
        if (canMove) {
            if (o === Types.Orientations.LEFT) {
                c.movement.start(self.charKeyXF, null, -tick);
            } else if (o === Types.Orientations.RIGHT) {
                c.movement.start(self.charKeyXF, null, tick);
            } else if (o === Types.Orientations.UP) {
                c.movement.start(self.charKeyYF, null, -tick);
            } else if (o === Types.Orientations.DOWN) {
                c.movement.start(self.charKeyYF, null, tick);
            }
        }
    };

    self.updatePlayerPathMovement = function (c) {
        if (
            c.isDying ||
            c.isDead ||
            c.freeze ||
            c.isStunned ||
            c.keyMove ||
            !c.isMovingPath()
        ) {
            return;
        }

        const self = this;
        const tick = c.tickFrames;
        const o = c.orientation;

        // TODO - Fix character stuttering thats corrupting the map display and collision.

        const canMove = c.movement.inProgress === false;
        if (canMove) {
            c.updateMovement();
            if (o === Types.Orientations.LEFT) {
                c.movement.start(self.playerPathXF, null, -tick);
            } else if (o === Types.Orientations.RIGHT) {
                c.movement.start(self.playerPathXF, null, tick);
            } else if (o === Types.Orientations.UP) {
                c.movement.start(self.playerPathYF, null, -tick);
            } else if (o === Types.Orientations.DOWN) {
                c.movement.start(self.playerPathYF, null, tick);
            }
        }
    };

    self.updatePlayerKeyMovement = function (c) {
        if (!game.player) return;

        if (
            c.isDying ||
            c.isDead ||
            c.freeze ||
            c.isStunned ||
            c.isMovingPath()
        ) {
            return;
        }

        const self = this;
        const tick = c.tickFrames;
        const o = c.orientation;

        // STRICT alignment requirement for key movement
        const canMove = !c.movement.inProgress && c.keyMove && o > 0;

        if (canMove) {
            if (o === Types.Orientations.LEFT) {
                c.movement.start(self.playerKeyXF, null, -tick);
            } else if (o === Types.Orientations.RIGHT) {
                c.movement.start(self.playerKeyXF, null, tick);
            } else if (o === Types.Orientations.UP) {
                c.movement.start(self.playerKeyYF, null, -tick);
            } else if (o === Types.Orientations.DOWN) {
                c.movement.start(self.playerKeyYF, null, tick);
            }
        }
    };
}
