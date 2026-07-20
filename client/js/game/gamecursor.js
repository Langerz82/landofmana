// Mixin extracted from game.js: Cursor state: sprite cursors, hover-driven cursor logic, mouse->grid position helpers.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Player from './entity/player.js';
/* global Container, G_TILESIZE, log */

export function installGameCursor(proto) {
        proto.initCursors = function() {
            const sprite = this.sprites["cursors"];
            const target = this.sprites["target"];

            sprite.container = Container.HUD;
            target.container = Container.HUD;
            const pjsSprite = this.renderer.createSprite(sprite);
            sprite.pjsSprite = pjsSprite;
            target.pjsSprite = pjsSprite;

            this.cursorAnim = sprite.createAnimations();
            this.targetAnim = target.createAnimations();

            this.cursors["hand"] = sprite;
            this.cursors["sword"] = sprite;
            this.cursors["loot"] = sprite;
            this.cursors["arrow"] = sprite;
            this.cursors["talk"] = sprite;
            this.cursors["join"] = sprite;

            this.cursors["target"] = target;
        };

        proto.setCursor = function(name, orientation) {
            if(name in this.cursors) {
                this.currentCursor = this.cursors[name];
                this.currentCursor.setAnimation(name);
                this.currentCursorOrientation = orientation;
            } else {
                log.error("Unknown cursor name :"+name);
            }
        };

        proto.updateCursorLogic = function() {

        	  if(this.hoveringCollidingTile && this.started) {
                this.targetColor = "rgba(255, 50, 50, 0.5)";
            }
            else {
                this.targetColor = "rgba(255, 255, 255, 0.5)";
            }

            if(this.hoveringPlayer && this.started && this.player) {
                if(this.player.pvpFlag || (this.namedEntity && this.namedEntity instanceof Player && this.namedEntity.isWanted)) {
                    this.setCursor("sword");
                } else {
                    this.setCursor("hand");
                }
                this.hoveringTarget = false;
                this.hoveringMob = false;
            } else if(this.hoveringMob && this.started) { // Obscure Mimic.
                this.setCursor("sword");
                this.hoveringTarget = false;
                this.hoveringPlayer = false;
            }
            else if(this.hoveringNpc && this.started) {
                this.setCursor("talk");
                this.hoveringTarget = false;
            }
            else if((this.hoveringItem || this.hoveringChest) && this.started) {
                this.setCursor("loot");
                this.hoveringTarget = false;
            }
            else if (this.currentCursor.currentAnimation.name !== "hand") {
                this.setCursor("hand");
                this.hoveringTarget = false;
                this.hoveringPlayer = false;
            }
        };

        /**
         * Converts the current mouse position on the screen to world grid coordinates.
         * @returns {Object} An object containing x and y properties.
         */
        proto.getMouseGridPosition = function() {
            return {x: this.mouse.gx, y: this.mouse.gy};
        };

        proto.getMousePosition = function() {
            const r = this.renderer;
            const c = this.camera;
            let mx = this.mouse.x;
            let my = this.mouse.y;

            mx = (mx + c.x);
            my = (my + c.y);

            this.mouse.gx = Math.floor(mx / G_TILESIZE);
            this.mouse.gy = Math.floor(my / G_TILESIZE);

            return { x: mx, y: my};
        };

        /**
         *
         */
        proto.movecursor = function() {
            const pos = this.getMousePosition();
            const x = pos.x, y = pos.y;

            this.cursorVisible = true;

            if (!this.mapContainer)
              return;

            if(this.mapContainer.gridReady && this.player && !this.renderer.mobile && !this.renderer.tablet) {
                this.hoveringMob = this.isMobAt(x, y);
                this.hoveringPlayer = this.isPlayerAt(x, y);
                this.hoveringItem = this.isItemAt(x, y);
                this.hoveringNpc = this.isNpcAt(x, y);
                this.hoveringOtherPlayer = this.isPlayerAt(x, y);
                this.hoveringChest = this.isChestAt(x, y);
                this.hoveringEntity = this.getEntityAt(x, y);

                if((this.hoveringMob || this.hoveringPlayer || this.hoveringNpc || this.hoveringChest || this.hoveringOtherPlayer || this.hoveringItem) && !this.player.hasTarget()) {
                    const entity = this.getEntityAt(x, y);
                    if (!entity) return;

                    this.player.showTarget(entity);
                    this.lastHovered = entity;
                }
            }
        };

        /**
         * Fake a mouse move event in order to update the cursor.
         *
         * For instance, to get rid of the sword cursor in case the mouse is still hovering over a dying mob.
         * Also useful when the mouse is hovering a tile where an item is appearing.
         */
        proto.updateCursor = function() {
            this.movecursor();
            this.updateCursorLogic();
        };

}
