// Mixin extracted from game.js: Targeting/interaction/combat: the tryInteract* chain, click/rightClick/processInput, playerInteract, attack + harvest.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Player from './entity/player.js';
import NpcMove from './entity/npcmove.js';
import NpcStatic from './entity/npcstatic.js';
import Node from './entity/node.js';
import Item from './entity/item.js';
import Block from './entity/block.js';
import Character from './entity/character.js';
import NpcData from './data/npcdata.js';
/* global Types, ATTACK_MAX, Utils, log, game */
const InventoryMode = Types.InventoryMode;

export function installGameInteraction(proto) {
        /**
         * Entry point: player pressed interact. Tries, in priority order: showing
         * queued dialogue, targeting/acting on whatever entity the player is
         * currently facing and in reach of, interacting with an adjacent entity,
         * interacting with a harvestable tile, re-engaging the current target,
         * then falling back to the closest interactable entity.
         */
        proto.makePlayerInteractNextTo = function()
        {
          const p = this.player;

          if (p.isDying || p.isDead)
            return;

          if (this.tryShowDialogue())
            return;

          log.info("makePlayerInteractNextTo");

          // Before any other target logic: if the player is facing an entity
          // (the tile directly ahead of them in their current orientation)
          // and it's isNextTooEntity(), target it and process it
          // (processTarget -> processInput -> move/attack) immediately, in
          // this one call - regardless of whether a different entity was
          // already targeted.
          if (this.tryInteractFacedEntity())
            return;

          this.ignorePlayer = true;

          this.tryInteractAdjacentEntity() ||
            this.tryInteractHarvestTiles() ||
            this.tryInteractExistingTarget() ||
            this.tryInteractClosestEntity();

          this.ignorePlayer = false;
        };

        /**
         * Looks at the tile the player is currently facing for an entity. If
         * one is there, isn't dying/dead, and is next to the player, targets
         * it and calls processTarget() in this same call.
         *
         * player.move() (user.js) now keeps p.orientation live at all times,
         * including mid-attack - only the animation/movement itself stays
         * deferred while attacking, not the logical facing - so this can
         * just read p.orientation directly via nextTile()'s default. (It
         * used to fall back to p.moveOrientation for this because
         * p.orientation went stale during attacks, but moveOrientation gets
         * cleared to 0 on key release, so a quick tap-and-release turn
         * mid-swing left both fields wrong. See user.js for the real fix.)
         */
        proto.tryInteractFacedEntity = function() {
          const p = this.player;
          const pos = p.nextTile();
          const entity = this.getEntityAt(pos[0], pos[1]);

          if (!entity || entity.isDying || entity.isDead) return false;
          if (!(p.isAdjacentEntity(entity) && p.isFacingEntity(entity))) return false;

          p.setTarget(entity);
          p.lookAtEntity(entity);
          return this.processTarget();
        };

        proto.isEntityDead = function(entity) {
          return entity && (entity.isDying || entity.isDead);
        };

        /**
         * Interacts with (or moves toward) the player's current target, using the
         * tile the player is currently facing.
         */
        proto.processTarget = function() {
          const p = this.player;
          const pos = p.nextTile();
          if (this.isEntityDead(p.target)) {
            p.clearTarget();
            return false;
          }

          game.processInput(pos[0], pos[1], true);
          return true;
        };

        proto.tryShowDialogue = function() {
          const p = this.player;
          const entity = p.dialogueEntity;
          if (entity && p.isNextTooEntity(entity) && p.isFacingEntity(entity)) {
            game.showDialogue();
            return true;
          }
          return false;
        };

        /**
         * Fallback for when tryInteractFacedEntity() finds nothing exactly on the
         * faced tile (e.g. an entity that's in reach but slightly off-grid or
         * diagonal). Scans all on-screen entities within isInReach() of the player,
         * picks the closest, and targets + processTarget()s it immediately in this
         * one call, regardless of whether a different entity was already targeted.
         */
        proto.tryInteractAdjacentEntity = function() {
          const p = this.player;

          const candidates = this.camera.forEachInScreenArray(p)
            .filter(e => e && !e.isDying && !e.isDead && p.isInReach(e.x, e.y));

          if (candidates.length === 0) return false;

          candidates.sort((a, b) => Utils.realDistanceXY(p, a) - Utils.realDistanceXY(p, b));
          const entity = candidates[0];

          p.setTarget(entity);
          p.lookAtEntity(entity);
          return this.processTarget();
        };

        /**
         * If the player is next to and facing a Harvest Tile, interacts with it.
         */
        proto.tryInteractHarvestTiles = function() {
          const p = this.player;

          if (p.hasTarget())
            return false;

          const type = p.items.getWeaponType();
          if (type === null) return false;

          // FIX: was a plain (non-arrow) function expression, called bare
          // below (fnProcessTile(...), not this.fnProcessTile(...)) -- in a
          // class method under strict mode (always true for ES modules/class
          // bodies), a bare function call has `this === undefined`, so
          // `this.mapContainer` threw a TypeError on every single
          // invocation. That broke both call sites below equally (the
          // direct facing-tile check via p.nextTile() and the surrounding-
          // tiles fallback loop), and since nothing here catches the
          // exception, it unwound straight out of tryInteractHarvestTiles()
          // and past its caller's `this.ignorePlayer = true`/`= false` pair
          // (makePlayerInteractNextTo()), skipping the reset. An arrow
          // function closes over the enclosing tryInteractHarvestTiles()'s
          // `this` (the game instance) lexically instead, matching the
          // `game.processInput` call just below it.
          //
          // FIX: this used to call game.processInput(x, y, true) once a tile
          // was confirmed harvestable -- but processInput() (below in this
          // file) doesn't act on the (x, y) it's given at all when the
          // player currently has a target: `entity = p.hasTarget() ?
          // p.target : this.getEntityAt(px, py)` re-interacts with whatever
          // p.target already is and never reaches its own isHarvestTile()
          // branch. makePlayerInteractNextTo() -> tryInteractHarvestTiles()
          // is reached from onStopPathing() specifically inside its
          // `if (p.hasTarget())` block, so in exactly the scenario that
          // drives this whole chain, p.hasTarget() is true - meaning this
          // never actually harvested the tile it just found, for either the
          // faced tile or the surrounding ones; it silently re-triggered the
          // player's existing target instead, while still returning `true`
          // here (only isHarvestTile() was checked, not what processInput()
          // did with it) as if it had succeeded. The third `true` argument
          // never did anything either - processInput(px, py) only declares
          // two parameters. Calling makePlayerHarvest() directly (it
          // re-validates weapon/tile itself and doesn't consult p.target at
          // all) actually harvests the tile regardless of current target.
          // (Dropped the p.lookAt(x, y) call that used to sit here, too --
          // makePlayerHarvest() already calls p.lookAtTile(px, py) itself
          // right before starting the harvest, immediately overwriting
          // whatever orientation this would have set.)
          const fnProcessTile = (x, y) => {
            const gpos = Utils.getGridPosition(x, y);
            if (game.mapContainer.isHarvestTile(gpos, type)) {
              game.makePlayerHarvest(x, y);
              return true;
            }
            return false;
          };

          const pos = p.nextTile();
          if (fnProcessTile(pos[0],pos[1]))
            return true;

          const spots = p.getSpotsAround(p, 1);
          for (const spot of spots) {
            if (pos[0] === spot.x && pos[1] === spot.y)
              continue;
            if (fnProcessTile(spot.x,spot.y))
              return true;
          }

          return false;
        };

        /**
         * Re-engages the player's already-set target if it's still visible and
         * within reach (covers diagonal adjacency the cardinal scan above misses).
         */
        proto.tryInteractExistingTarget = function() {
          const p = this.player;
          const target = p.target;
          if (!target) return false;

          if (!game.camera.isVisible(target)) {
            p.clearTarget();
            return false;
          }

          // FIX: this used to check p.isNextTooEntity(target), which is a hardcoded
          // 1-tile melee check (isWithinDist(G_TILESIZE)) - it ignores attackRange
          // entirely. For a ranged weapon (attackRange > 1) a target sitting well
          // within range but more than 1 tile away failed this check, so this
          // function always returned false for it. That sent every re-run of the
          // interact chain (onStopPathing, attack retries, the interact
          // shortcut/key) straight through to tryInteractClosestEntity(), whose
          // playerTargetClosestEntity(0) call unconditionally overwrites p.target
          // with whatever on-screen entity is physically nearest - clobbering the
          // ranged target the player actually clicked, even though it was already
          // valid and attackable. Use canReachTarget() instead, which defers to
          // canReach()/attackRange and is true for melee-adjacent targets as well
          // as ranged targets within attackRange, so a valid target of any range
          // is re-engaged here before the closest-entity fallback ever runs.
          if (p.canReachTarget()) {
            if (!p.isMoving())
              p.lookAtEntity(target);
            return this.processTarget();
          }
          return false;
        };

        /**
         * Fallback: auto-target the closest interactable entity, but only act if
         * targeting didn't just change (avoids acting on a brand new target the
         * same frame it was acquired) - unless the newly acquired target is
         * already within reach, in which case there's nothing to "walk into"
         * first and it's safe to act on it immediately.
         */
        proto.tryInteractClosestEntity = function() {
          const p = this.player;
          const prevTarget = p.target;
          p.targetIndex = 0;
          this.playerTargetClosestEntity(0);
          if (prevTarget !== p.target && !p.canReachTarget())
            return false;

          return this.processTarget();
        };

        proto.makePlayerAttack = function(entity) {
          const p = this.player;
          const time = this.currentTime;
          const res = p.makeAttack(entity);

          switch (res) {
            case "attack_ok": {
              const skillId = (p.attackSkill) ? p.attackSkill.skillId : -1;
              this.client.sendAttack(p, p.target, skillId);
              if (skillId !== -1)
                p.attackSkill = null;

              this.audioManager.playSound("hit" + Math.floor(Math.random() * 2 + 1));

              p.attackCooldown.duration = 1000;
              p.attackCooldown.lastTime = time;

              this.scheduleAttackRetry(ATTACK_MAX);
              return true;
            }

            case "attack_outoftime":
              // Switching targets mid-cooldown retargets immediately (see makeAttack() in
              // player.js), but the attack itself has to wait out whatever's left of the
              // shared, server-enforced cooldown from the *previous* target. Retry once it
              // clears instead of requiring another interact press.
              log.info("CANNOT ATTACK DUE TO TIME.");
              this.scheduleAttackRetry(p.attackCooldown.duration - (time - p.attackCooldown.lastTime));
              return false;

            // FIX: attack_toofar/attack_aborted used to fall into the default branch below,
            // which schedules nothing - so a temporary pathfinding block (followAttack() in
            // character.js failing to find a spot, attack_toofar) or a same-tick target-death
            // race (hasTarget() flipping false between setTarget() and the hit() check,
            // attack_aborted) silently ended the auto-attack loop until the player pressed
            // interact again, even though the obstruction was often gone a moment later.
            // attack_moving doesn't need this - it already self-heals via onStopPathing() ->
            // makePlayerInteractNextTo() once the player finishes walking in. Keep probing
            // here too as long as there's still a target; it stops on its own once the target
            // is cleared or dies (p.hasTarget() goes false).
            case "attack_toofar":
            case "attack_aborted":
              if (p.hasTarget())
                this.scheduleAttackRetry(ATTACK_MAX);
              return false;

            default: // null/undefined, "attack_moving", "attack_notfacing"
              if (!res) log.info("CANNOT ATTACK.");
              return false;
          }
        };

        /**
         * Schedules a single retry of makePlayerAttack() after `delay` ms - covers both
         * "keep auto-attacking the same target" (delay = ATTACK_MAX, after a hit lands) and
         * "retry a target switch that got blocked by the previous target's cooldown" (delay =
         * whatever's left on it).
         *
         * Reads p.target fresh when it fires rather than closing over a specific entity, so
         * there's no stale value to compare against and no dead end where the loop could give
         * up: tryInteractFacedEntity() gets first shot at whatever the player is now facing,
         * and this otherwise just falls back to attacking whatever p.target currently is.
         */
        proto.scheduleAttackRetry = function(delay) {
          const p = this.player;

          clearTimeout(p.attackInterval);
          // Small buffer so canAttack()'s strict `>` comparison has definitely cleared by the
          // time this fires, rather than racing it by a millisecond.
          p.attackInterval = setTimeout(() => {
            if (p.isDead || p.isDying) return;

            if (this.tryInteractFacedEntity())
              return;

            if (p.hasTarget())
              this.makePlayerAttack(p.target);
          }, Math.max(0, delay) + 16);
        };

        /**
         *
         */
        proto.makeNpcTalk = function(npc) {
        	let msg;

          if (!npc) return;

          if (!game.player.isNextTooEntity(npc)) {
            game.player.follow(npc);
            return;
          }

          if (npc.type === Types.EntityTypes.NPCMOVE) {
            this.client.sendTalkToNPC(npc.type, npc.id);
            return;
          }

          // FIX/PERF: was re-computing `NpcData.Kinds[npc.kind].title` (an array index + object
          // property read) on every branch of this chain instead of once. Cached here.
          //
          // NOTE: the "Craft" check below is intentionally left as a standalone `if`, not folded
          // into the `if/else if` chain that follows it (as it was before this refactor) - a
          // Craft-titled NPC's title never matches "Beginner shop"/"Bank"/etc., so it always also
          // falls through into the default `else` branch at the bottom (destroy bubble / run
          // questhandler.talkToNPC / play npc sound) in addition to opening the craft dialog.
          // That looks like it could be a copy-paste bug (every other dialog-opening branch is
          // exclusive), but changing it would change live NPC-interaction behavior, so it's
          // preserved as-is here rather than silently "fixed" - worth a deliberate decision by
          // whoever owns the NPC/quest design.
          const title = NpcData.Kinds[npc.kind].title;

          // FIX: `this.gamepad.isActive() && this.gamepad.dialogNavigate()` was duplicated
          // inside every dialog-opening branch below (Craft/Beginner shop/Bank/Enchant/Repair/
          // Auction all mutually exclusive on `title`, so at most one ever fired anyway).
          // Replaced with a single flag checked once after the chain.
          let openedDialog = false;

          if (title === "Craft")
      		{
  		    	this.craftDialog.show(1,100);
            openedDialog = true;
          }
          if (title === "Beginner shop")
      		{
  		    	this.storeDialog.show(1,100);
            openedDialog = true;
          } else if (title === "Bank") {
          	this.bankDialog.show();
            openedDialog = true;
          } else if (title === "Enchant") {
            game.inventoryMode = InventoryMode.MODE_ENCHANT;
          	this.inventoryDialog.showInventory();
            openedDialog = true;
          } else if (title === "Repair") {
            game.inventoryMode = InventoryMode.MODE_REPAIR;
          	this.inventoryDialog.showInventory();
            openedDialog = true;
          } else if (title === "Auction") {
          	this.auctionDialog.show();
            openedDialog = true;
          } else if (title === "Looks") {
          	this.appearanceDialog.show();
          } else {
          	  this.bubbleManager.destroyBubble(npc.id);
              msg = this.questhandler.talkToNPC(npc);
              this.previousClickPosition = {};
              if (msg) {
                  this.bubbleManager.create(npc, msg);
                  this.audioManager.playSound("npc");
              }
          }

          if (openedDialog && this.gamepad.isActive())
            this.gamepad.dialogNavigate();

          this.player.removeTarget();
        };

        proto.playerTargetClosestEntity = function(inc) {
          const p = this.player;
          if (!p.hasOwnProperty("targetIndex"))
            p.targetIndex = 0;

          let excludeTypes = [Types.EntityTypes.NODE, Types.EntityTypes.PLAYER];
          if (game.mapContainer.mapIndex !== 0)
          {
            excludeTypes = excludeTypes.concat([Types.EntityTypes.NPCMOVE, Types.EntityTypes.NPCSTATIC]);
          }
          const entity = this.entityTargetClosestEntity(p, inc, p.targetIndex, excludeTypes);
          if (!entity)
            return false;

          p.setTarget(entity);
          return true;
        };

        proto.entityTargetClosestEntity = function(entity, inc, index, excludeTypes) {

          index = index || 0;

          let entities = this.camera.forEachInScreenArray(entity);
          entities = entities.filter(entity => !(excludeTypes.includes(entity.type) || entity.isDying || entity.isDead));

          for (let entity2 of entities) {
            entity2.playerDistance = Utils.realDistanceXY(entity,entity2);
          }

          if (entities.length === 0) {
            entity.targetIndex = 0;
            return null;
          }
          if (entities.length === 1) {
            entity.targetIndex = 0;
            return entities[0];
          }

          entities.sort(function (a,b) { return (a.playerDistance > b.playerDistance) ? 1 : -1; });

          index = (index+entities.length) % entities.length;
          entity.targetIndex = (index+entities.length+inc) % entities.length;
          return entities[index];
        };

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

        /**
         * Processes game logic when the user triggers a click/touch event during the game.
         */
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

        proto.playerInteract = function(entity)
        {
          const p = this.player;
          if (!entity)
            return;

          if (entity && !p.hasTarget() && !entity.isDying )
          {
            p.setTarget(entity);
          }
          if (p.isNextTooEntity(entity) && !p.movement.inProgress) {
            p.lookAtEntity(entity);
          }
          // FIX: p.target stays null when the entity was skipped above (already had a target,
          // or entity.isDying was true), so this unconditional p.target.id threw a TypeError
          if (p.target) {
            log.info("player target: "+p.target.id);
          }

          if (entity instanceof Block && p.isNextTooEntity(entity) &&
            p.isFacingEntity(entity))
          {
            const block = entity;
            if (block === p.holdingBlock) {
              block.place(p);
              p.holdingBlock = null;
            } else {
              block.pickup(p);
            }
            return;
          }
          if (entity instanceof Item)
          {
            this.makePlayerGoToItem(entity);
            return;
          }
          else if (entity instanceof NpcStatic || entity instanceof NpcMove)
          {
            this.makeNpcTalk(entity);
            return;
          }

          if(entity instanceof Player && entity !== this.player)
          {
              this.makePlayerAttack(entity);
          }
          else if(entity instanceof Mob ||
                  (entity instanceof Player && entity !== this.player && this.player.pvpTarget === entity))
          {
              log.info("makePlayerAttack!");
              this.makePlayerAttack(entity);
              return;
          }
          else if (entity instanceof Node) {
              // Chests are Node.CHEST_KIND nodes, so this one branch already
              // covers both ore/tree nodes and chests.
              this.makePlayerHarvestEntity(entity);
          }

        };

        proto.makePlayerHarvestEntity = function(entity) {
          const p = this.player;

          if (!p.isNextTooEntity(entity)) {
            p.follow(entity);
            return;
          }

          if (!p.items.hasHarvestWeapon(entity.weaponType)) {
            game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", entity.weaponType]);
            return;
          }

          p.lookAtEntity(entity);
          p.harvestOn(entity.weaponType);

          if (entity.kind === Node.CHEST_KIND) {
              this.audioManager.playSound("chest");
          }

          this.client.sendHarvestEntity(entity);
        };

        proto.makePlayerHarvest = function(px, py) {
          const p = this.player;

          if (!p.items.hasHarvestWeapon()) {
            game.showNotification(["CHAT", "HARVEST_NO_WEAPON"]);
            return;
          }

          const type = p.items.getWeaponType();
          if (type === null) {
            game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
            return;
          }

          const gpos = Utils.getGridPosition(px, py);
          if (!this.mapContainer.isHarvestTile(gpos, type)) {
            game.showNotification(["CHAT", "HARVEST_WRONG_TYPE", type]);
            return;
          }

          p.lookAtTile(px, py);
          p.harvestOn(type);

          this.client.sendHarvest(px, py);
        };

        proto.updateCameraEntity = function(id, entity)
        {
          const self = this;
          if (!self.camera) return;

          if (!entity || (entity instanceof Character && entity.isDead))
          {

            self.camera.entities[id] = null;
            self.camera.outEntities[id] = null;

            delete self.camera.entities[id];
            delete self.camera.outEntities[id];
            return;
          }

          if (!self.camera.entities[id] && self.camera.isVisible(entity, 1))
          {
              self.camera.entities[id] = entity;
              self.camera.outEntities[id] = entity;
              return;
          }

          if (!self.camera.outEntities[id] && self.camera.isVisible(entity, 10))
          {
              self.camera.outEntities[id] = entity;
              return;
          }

        };

}
