import _ from 'underscore';
import Player from '../player/player.js';
import Timer from '../../timer.js';
import { mobState, G_DEBUG } from '../../constants.js';

/* global _, Player */

// Split out of entity/mob.js -- hate-list tracking and the aggro decision
// it feeds (who a mob is currently mad at, and picking/attacking its most-
// hated target) was one of the largest self-contained clusters directly on
// the Mob class body. Same constructor(entity) convention as the other
// entity/components/*.js files. A few of these methods reach across into
// the respawn/spawn-lifecycle and AI-state clusters (forgetPlayer ->
// returnToSpawn, handleMobHate/aggroPlayer -> setAiState) -- those go
// through entity.X(...) (Mob's own thin delegates), same as any other
// cross-component call in this codebase, rather than importing those
// components directly.
class MobAggro {
    constructor(entity) {
        this.entity = entity;
    }

    hates(target) {
        const entity = this.entity;
        return _.any(entity.hatelist, function (obj) {
            return obj.entity === target;
        });
    }

    // PERF: this used to call this.hates(entity) (a linear scan of
    // hatelist) and then, when it returned true, run a second linear scan
    // via _.detect() to find that same entry. hatelist is small (bounded by
    // however many characters are currently attacking this one mob) so this
    // was never a hot-path emergency, but there's no reason to scan it
    // twice for one lookup -- a single _.detect() covers both the "does it
    // exist" and "get the entry" cases.
    increaseHateFor(target, points) {
        const entity = this.entity;
        const existing = _.detect(entity.hatelist, function (obj) {
            return obj.entity === target;
        });
        if (existing) {
            existing.hate += points;
        } else {
            entity.hatelist.push({ entity: target, hate: points });
        }

        if (entity.returnTimeout) {
            // Prevent the mob from returning to its spawning position
            // since it has aggroed a new player
            clearTimeout(entity.returnTimeout);
            entity.returnTimeout = null;
        }
    }

    // FIX: _.sortBy sorts ascending, so sorted[0] was the LEAST-hated
    // entity, not the most-hated one -- the opposite of what this method's
    // name and its only caller (handleMobHate, picking an aggro target)
    // need. Every mob was consistently attacking the weakest-threat player
    // instead of whoever had actually generated the most hate. Taking the
    // last element of the ascending sort gives the highest-hate entry.
    // NOTE: was `getMostHated(hateRank)` with unused `i`/`playerId`/`size`
    // locals -- `hateRank` has never had a caller (the only call site,
    // handleMobHate() below, always calls this with no argument), and
    // `i`/`playerId`/`size` were never read anywhere in the body.
    // PERF: this only ever needs the single highest-hate entry but was
    // allocating a new array and doing a full O(n log n) sort to get it.
    // Called from handleMobHate() -- i.e. on every hit landed on an
    // aggro'd mob. A single O(n) scan for the max is equivalent and
    // avoids the allocation + sort on that hot path.
    getMostHated() {
        const entity = this.entity;
        let best = null;
        for (const obj of entity.hatelist) {
            if (!best || obj.hate > best.hate) best = obj;
        }
        return best ? best.entity : null;
    }

    forgetPlayer(playerId) {
        const entity = this.entity;
        entity.hatelist = _.reject(entity.hatelist, function (obj) {
            return obj.entity.id === playerId;
        });
        //this.tankerlist = _.reject(this.tankerlist, function(obj) { return obj.id === playerId; });

        if (entity.hatelist.length === 0 /*|| this.tankerlist === 0*/) {
            entity.returnToSpawn();
        }
    }

    forgetEveryone() {
        const entity = this.entity;
        entity.hatelist = [];
        entity.damageCount = {};
        entity.dealtCount = {};
        entity.clearAttackerRefs();
        entity.removeAttackers();
    }

    setAggroRate(duration) {
        this.entity.aggroCooldown = new Timer(duration);
    }

    canAggro() {
        return this.entity.aggroCooldown.isOver();
    }

    resetAggro(time) {
        this.entity.aggroCooldown.lastTime = time;
    }

    handleMobHate(tEntity, hatePoints) {
        const entity = this.entity;
        // PERF: fires on every successful hit landed on any mob -- the
        // single highest-frequency combat event in the game. Every other
        // per-hit log site in this codebase is gated behind G_DEBUG for
        // exactly this reason; this one was missed.
        if (G_DEBUG) console.info('handleMobHate');
        if (tEntity && tEntity instanceof Player) {
            entity.increaseHateFor(tEntity, hatePoints);

            if (entity.stats.hp > 0) {
                const hEntity = entity.getMostHated();
                if (hEntity) entity.createAttackLink(hEntity);
            }
        }
    }

    aggroPlayer(player, dmg) {
        const entity = this.entity;
        dmg = dmg || 1;

        entity.resetAggro(0);
        entity.attackingMode = true;
        entity.handleMobHate(player, 1);
        entity.setAiState(mobState.AGGRO);
        entity.attackTimer = Date.now();
        entity.freeze = false;
    }
}

export default MobAggro;
