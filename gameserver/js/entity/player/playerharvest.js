import Messages from '../../message.js';
import Utils from '../../utils.js';
// FIX: onHarvest()'s completion callback below calls ItemTypes.getData(...)
// but ItemTypes was never imported here (only Types was) -- threw
// ReferenceError every time a basic tile-harvest completed successfully.
import { GameTypes, ItemTypes } from '../../common.js';
import Item from '../item.js';
import ItemRoom from '../../items/itemroom.js';
import { PlayerEvent } from '../../world/taskhandler.js';
import Scheduler from '../../scheduler.js';

/* global EventType */

class PlayerHarvest {
    constructor(player) {
        this.player = player;
    }

    // FIX: `_harvest()` had no idea what weapon type (if any) the entity
    // being harvested actually requires -- both its own up-front check
    // (_checkHarvest()) and its completion check below called
    // `p.items.hasWeaponType()` with no argument at all, which skips the
    // `type === 'any'` short-circuit and falls straight to "does the player
    // have *some* harvest-capable weapon equipped" (see PlayerItems.
    // hasWeaponType()). That's correct for tile-harvesting (onHarvest()
    // below never had a fixed "required type" to check against; the
    // already-equipped weapon's type is what's being harvested with in that
    // case), but wrong for onHarvestEntity(): an entity like a chest with
    // `weaponType: 'any'` is supposed to mean "no tool required at all", yet
    // a player with nothing equipped got rejected here even though
    // onHarvestEntity()'s own up-front check (which *does* pass the real
    // `entity.weaponType`) had just approved them -- the harvest looked like
    // it started, then failed with the generic "cannot use this" abort
    // message the moment this ran. Threading the entity's actual required
    // type through as `weaponType` (left `undefined` by onHarvest()'s
    // tile-harvest call site, preserving its existing generic-check
    // behavior exactly) lets `hasWeaponType()`'s `'any'` short-circuit
    // actually take effect here too.
    _harvest(x, y, callback, duration, weaponType) {
        const p = this.player;

        const valid = this._checkHarvest(x, y, weaponType);
        if (!valid) {
            this._abortHarvest(x, y);
            return;
        }

        const px = p.x,
            py = p.y;
        // NOTE: this `type` is the player's own currently-equipped weapon
        // type (used below only to decide logging vs. mining exp) -- a
        // separate concern from `weaponType` (the entity's *required* type,
        // checked via _checkHarvest() above and again in the completion
        // callback below).
        const type = p.items.getWeaponType();

        p.isHarvesting = true;

        let exp = p.stats.exp.logging;
        if (type === 'hammer') exp = p.stats.exp.mining;

        const durationMod = Utils.clamp(
            0.1,
            1,
            1 - GameTypes.getSkillLevel(exp) / 20
        );
        duration = ~~(duration * durationMod);
        // PERF: was clearTimeout()/setTimeout() per harvest attempt; routed
        // through the shared Scheduler (gameserver/js/scheduler.js) instead
        // of a live Node timer per call. Scheduler.cancel() is a safe no-op
        // for an already-fired/never-set token, exactly like clearTimeout()
        // was on an invalid id.
        Scheduler.cancel(p.harvestTimeout);
        // FIX: was `Scheduler.schedule(function () {...})` -- a plain
        // function expression. Scheduler invokes scheduled callbacks as a
        // bare `entry.callback()` (scheduler.js), so in strict-mode ES
        // modules `this` inside a plain function called that way is
        // `undefined`, not the PlayerHarvest instance. `this._abortHarvest`
        // below threw a TypeError every time a harvest was interrupted
        // before completing (player moved, swapped weapon, or got attacked
        // mid-harvest -- packethandler.js clears `isHarvesting` on attack)
        // -- i.e. on the normal "walked away mid-chop" path, not just a
        // rare edge case. An arrow function closes over the enclosing
        // `this` lexically instead of depending on how it's invoked.
        p.harvestTimeout = Scheduler.schedule(() => {
            let complete = true;

            if (!p.isHarvesting) complete = false;

            if (!(p.x === px && p.y === py)) complete = false;

            if (!p.items.hasWeaponType(weaponType)) complete = false;

            if (!complete) {
                this._abortHarvest(x, y);
                return;
            }

            if (callback) callback(p);

            p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 2, x, y));
        }, duration);

        p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 1, x, y), p);
        p.sendPlayer(new Messages.Harvest(p, 1, x, y, duration));
    }

    _checkHarvest(x, y, weaponType) {
        const p = this.player;
        if (!p.isNextTooPosition(x, y)) return false;

        if (!p.items.hasWeaponType(weaponType)) return false;

        return true;
    }

    onHarvestEntity(entity) {
        const p = this.player;

        // Guard against re-triggering an entity that's already been
        // harvested/opened and is just waiting on its area to respawn it --
        // die() doesn't remove it from the map, so it's still reachable via
        // getEntityById in that window. Without this, spamming CW_USE_NODE
        // on the same id let a player pull multiple drops out of one
        // chest/node before it visually respawned.
        if (entity.isDead) {
            this._abortHarvest(entity.x, entity.y);
            return;
        }

        const type = entity.weaponType;
        const x = entity.x,
            y = entity.y;

        if (!p.items.hasWeaponType(type)) {
            // FIX: `this` is the PlayerHarvest component, which has no
            // sendPlayer() -- only the Player instance (`p`) does. Threw a
            // TypeError on every harvest attempt with the wrong tool
            // equipped, before ever reaching the _abortHarvest() cleanup
            // below.
            p.sendPlayer(
                new Messages.Notify('CHAT', 'HARVEST_WRONG_TYPE', type)
            );
            // FIX: this used to fall through into the shared `_abortHarvest`
            // call below instead of returning here -- so a wrong-tool
            // attempt showed HARVEST_WRONG_TYPE *and* the generic
            // HARVEST_INVALID ("cannot use this") notify back-to-back,
            // making the real reason easy to miss under a second, vaguer
            // message. Return immediately; there's nothing left to abort
            // that this notify doesn't already cover.
            return;
        }

        // Chest nodes (Node.CHEST_KIND) open quickly and don't scale with
        // level like a real harvest -- everything else keeps the original
        // level-scaled duration.
        const duration =
            entity.harvestDuration !== undefined
                ? entity.harvestDuration
                : 5000 + entity.level * 1000;
        this._harvest(
            x,
            y,
            function (p) {
                p.world.taskHandler.processEvent(
                    p,
                    PlayerEvent(GameTypes.EventType.USE_NODE, entity, 1)
                );

                if (type === 'hammer') p.stats.exp.mining += 10;

                // Re-roll the drop table right before it's consumed -- matters
                // most for chests, whose setDrops() is randomized by level.
                entity.setDrops(p);
                entity.die();
                const item = p.world.loot.getDrop(p, entity, false);
                if (item && item instanceof Item) {
                    item.x = x;
                    item.y = y;
                    p.world.loot.handleItemDespawn(item);
                }
                return;
            },
            duration,
            type
        );
    }

    _abortHarvest(x, y) {
        const p = this.player;
        p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 2, x, y));
        p.sendPlayer(new Messages.Notify('CHAT', 'HARVEST_INVALID'));
    }

    onHarvest(x, y) {
        const p = this.player;
        const gp = Utils.getGridPosition(x, y);

        // NOTE: `time` was a bare (undeclared) assignment in the original CommonJS
        // source, which created an implicit global there; declared with `var` here
        // since ES modules are always strict mode and forbid implicit globals. This
        // is local-only in both versions in practice (no other file reads it).
        const time = p.map.entities.harvest[gp.gx + '_' + gp.gy];

        let res = true;
        // FIX: getWeaponType() is defined on PlayerItems (p.items), not on
        // Player itself -- as correctly called elsewhere in this same file
        // (_checkHarvest/_harvest use p.items.getWeaponType()/hasWeaponType()).
        // Calling p.getWeaponType() threw "not a function", breaking the
        // harvesting flow entirely.
        const type = p.items.getWeaponType();
        if (!type) {
            res = false;
        }
        if (res && !p.map.isHarvestTile(gp, type)) {
            p.sendPlayer(
                new Messages.Notify('CHAT', 'HARVEST_WRONG_TYPE', type)
            );
            res = false;
        }

        if (res && time && Date.now() - time < 60000) {
            res = false;
        }

        if (!res) {
            this._abortHarvest(x, y);
            return;
        }

        // FIX: was `p._harvest(...)` -- `_harvest` is defined on
        // PlayerHarvest (this class), not on Player (`p`). This threw a
        // TypeError immediately, before the completion callback below ever
        // ran, which is exactly the symptom the old "TODO CHECK WHY NOT
        // ADDING ITEM AND NOT NOTIFYING CLIENT" comment above was
        // describing -- basic tile harvesting never actually completed.
        const duration = 6000;
        this._harvest(
            x,
            y,
            function (p) {
                p.world.taskHandler.processEvent(
                    p,
                    PlayerEvent(GameTypes.EventType.HARVEST, p, 1)
                );
                // FIX: same p.getWeaponType() -> p.items.getWeaponType() mismatch
                // as above; both call sites here would throw and abort this
                // harvest-completion callback before rewarding the player.
                if (p.items.getWeaponType() === 'axe')
                    p.stats.exp.logging += 10;
                p.map.entities.harvest[gp.gx + '_' + gp.gy] = Date.now();
                if (p.items.inventory.hasRoom()) {
                    // NOTE: `kind` is only ever set for "axe" -- a "hammer"
                    // (mining) harvest reaching here would create an ItemRoom
                    // with itemKind=undefined (BaseItem.set()'s Number(undefined)
                    // -> NaN), which ItemData.Kinds[item.itemKind] below has no
                    // entry for and .name would throw on. Currently unreachable
                    // in practice: map.js's isHarvestTile() only defines a tile
                    // set for type "axe" (types.hammer doesn't exist there), so
                    // onHarvest() can never actually complete for a "hammer"
                    // weapon today -- tile-based mining just isn't wired up yet
                    // (mining via Node entities/onHarvestEntity() above is a
                    // separate, already-working path). Flagging so whoever adds
                    // minable tiles to isHarvestTile() also fills in the ore
                    // item kind here.
                    let kind;
                    if (p.items.getWeaponType() === 'axe') kind = 320;
                    const item = new ItemRoom([kind, 1, 0, 0]);
                    if (p.items.inventory.putItem(item) === -1) return;
                    const data = ItemTypes.getData(item.itemKind);
                    p.sendPlayer(
                        new Messages.Notify('CHAT', 'HARVEST_ADDED', data.name)
                    );
                }
            },
            duration
        );
    }
}

export default PlayerHarvest;
