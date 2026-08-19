// Mixin extracted from game.js/gameinteraction.js: click/rightClick/processInput input
// entry points.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
/* global Utils, game */

export function installGameInteractionInput(proto) {
    proto.click = function () {
        const pos = this.getMousePosition();
        const p = game.player;

        if (this.joystick && this.joystick.isActive()) return;

        if (p.dialogueEntity) {
            // FIX: was `if (game.tryShowDialogue());` - a stray semicolon turned
            // the if-body into an empty statement, so the `return;` below ran
            // unconditionally regardless of tryShowDialogue()'s result. That
            // meant ANY click while p.dialogueEntity was set (which stays set
            // for the duration of a quest-NPC conversation - see
            // clientcallbacksquest.js/gamedialogue.js) was swallowed entirely,
            // even after walking away from the NPC, blocking all
            // targeting/attacking/looting until the dialogue was formally
            // closed. gameinteractiontarget.js's own tryShowDialogue() call
            // site (`if (this.tryShowDialogue()) return;`) shows the intended
            // form: only short-circuit the click when a dialogue was actually
            // shown; otherwise fall through to normal click handling below.
            if (game.tryShowDialogue()) return;
        }

        if (p.movement.inProgress) return;

        for (let dialog of this.dialogs) {
            if (dialog.visible) dialog.hide();
        }

        let entity = this.getEntityAt(pos.x, pos.y);
        if (!entity && this.isMobile) {
            const entities = game.camera.getEntitiesAround(pos.x, pos.y, 16, [
                p
            ]);
            if (entities && entities.length > 0) {
                entity = entities[0];
            }
        }

        if (entity) {
            if (this.isDesktop) {
                // Desktop: the mouse is already hovering (and, per
                // movecursor()/gamecursor.js, has already previewed and -- if
                // no target was set yet -- selected) whatever's under the
                // cursor. A click on it always sets it as the target and acts
                // on it immediately, in one step; there's no separate
                // "select, then click again to act" step to wait for like on
                // mobile below. lookAtEntity() is kept before processInput()
                // so the player is actually facing the target when the
                // interaction (attack/harvest/etc, gated on facing for melee
                // range - see canReach()/charactertargeting.js) fires.
                p.setTarget(entity);
                p.lookAtEntity(entity);
                this.processInput(pos.x, pos.y);
                return;
            }

            // Mobile: no hover, so tapping an entity already in reach acts on
            // it immediately, same as the desktop path above.
            if (p.isNextTooEntity(entity)) {
                p.setTarget(entity);
                p.lookAtEntity(entity);
                this.processInput(pos.x, pos.y);
                return;
            }
            // Otherwise the first tap just selects the entity as the target
            // (no processInput) -- a second tap landing back on it, handled
            // further below, is what actually acts on it.
            if (!p.hasTarget()) {
                p.setTarget(entity);
                return;
                // FIX: was `!=` - inconsistent with the strict `===` check for
                // the same comparison a few lines below (entity === p.target).
            } else if (entity !== p.target) {
                p.setTarget(entity);
                return;
            }
        } else {
            p.clearTarget();
        }

        // Second click landing back on the already-targeted entity ->
        // actually act on it, at the mouse's game/world coordinates
        // (pos.x/pos.y, already camera-adjusted by getMousePosition()
        // above -- not raw screen coordinates).
        if (entity && entity === p.target) {
            this.processInput(pos.x, pos.y);
            return;
        }

        this.clickMove = true;
        this.processInput(pos.x, pos.y);
        this.clickMove = false;
    };

    proto.rightClick = function () {
        // TODO Might have some use later.
    };

    proto.processInput = function (px, py) {
        const ts = this.tilesize;
        const p = this.player;

        if (!this.started || !this.player || this.player.isDead) return;

        px = Utils.clamp(0, this.mapContainer.widthX, px);
        py = Utils.clamp(0, this.mapContainer.heightY, py);

        let entity = p.hasTarget() ? p.target : this.getEntityAt(px, py);

        if (entity && !entity.isDying) {
            this.playerInteract(entity);
        } else {
            const type = p.items.getWeaponType();
            const gpos = Utils.getGridPosition(px, py);
            const colliding = this.mapContainer.isColliding(px, py);

            if (
                colliding &&
                this.mapContainer.isHarvestTile(gpos, type) &&
                p.isNextTooTile(px, py)
            ) {
                this.makePlayerHarvest(px, py);
                return;
            }

            if (this.clickMove) this.clickMoveTo(px, py);
        }
    };
}
