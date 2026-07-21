// Mixin extracted from game.js/gameinteraction.js: click/rightClick/processInput input
// entry points.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
/* global Utils, game */

export function installGameInteractionInput(proto) {

        proto.click = function() {
            const pos = this.getMousePosition();
            const p = game.player;

            if (this.joystick && this.joystick.isActive())
              return;

            if (p.dialogueEntity) {
              if (game.tryShowDialogue());
              return;
            }

            if (p.movement.inProgress)
              return;


            for (let dialog of this.dialogs) {
              if (dialog.visible)
                dialog.hide();
            }

            let entity = this.getEntityAt(pos.x, pos.y);
            if (!entity && this.renderer.mobile) {
              const entities = game.camera.getEntitiesAround(pos.x, pos.y, 16, [p]);
              if (entities && entities.length > 0)
              {
                entity = entities[0];
              }
            }

            if (entity) {
              if (p.isNextTooEntity(entity)) {
                p.setTarget(entity);
                p.lookAtEntity(entity);
                this.processInput(pos.x, pos.y);
                return;
              }
              if (!p.hasTarget()) {
                  p.setTarget(entity);
                  return;
              }
              else if (entity != p.target) {
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

        proto.rightClick = function() {
          // TODO Might have some use later.
        };

         proto.processInput = function(px, py) {
           const ts = this.tilesize;
           const p = this.player;


          if (!this.started || !this.player || this.player.isDead)
              return;

          px = Utils.clamp(0, this.mapContainer.widthX, px);
          py = Utils.clamp(0, this.mapContainer.heightY, py);


          let entity = p.hasTarget() ?
            p.target : this.getEntityAt(px, py);

          if (entity && !entity.isDying) {
            this.playerInteract(entity);
          }
          else
          {
            const type = p.items.getWeaponType();
            const gpos = Utils.getGridPosition(px, py);
            const colliding = this.mapContainer.isColliding(px,py);

            if (colliding && this.mapContainer.isHarvestTile(gpos, type) && p.isNextTooTile(px, py)) {
                this.makePlayerHarvest(tileCenter.x, tileCenter.y);
                return;
            }

            if (this.clickMove)
              this.clickMoveTo(px, py);
          }
        };

}
