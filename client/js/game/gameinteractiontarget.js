// Mixin extracted from game.js/gameinteraction.js: targeting and the tryInteract* chain
// (makePlayerInteractNextTo, tryInteractFacedEntity/AdjacentEntity/HarvestTiles/
// ExistingTarget/ClosestEntity, playerInteract, makeNpcTalk, playerTargetClosestEntity,
// entityTargetClosestEntity, updateCameraEntity).
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import Player from '../entity/player/player.js';
import NpcMove from '../entity/npcmove.js';
import NpcStatic from '../entity/npcstatic.js';
import Node from '../entity/node.js';
import Item from '../entity/item.js';
import Block from '../entity/block.js';
import Character from '../entity/character/character.js';
import Mob from '../entity/mob.js';
import NpcData from '../data/npcdata.js';
/* global Types, Utils, log, game */
const InventoryMode = Types.InventoryMode;

export function installGameInteractionTarget(proto) {

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

        proto.tryInteractClosestEntity = function() {
          const p = this.player;
          const prevTarget = p.target;
          p.targetIndex = 0;
          this.playerTargetClosestEntity(0);
          if (prevTarget !== p.target && !p.canReachTarget())
            return false;

          return this.processTarget();
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
