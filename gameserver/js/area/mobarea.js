// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import EntityArea from './entityarea.js';
import _ from 'underscore';
import Messages from '../message.js';
import Utils from '../utils.js';
import MobData from '../data/mobdata.js';
import { G_TILESIZE } from '../constants.js';

class MobArea extends EntityArea {
    constructor(
        map,
        id,
        nb,
        minLevel,
        maxLevel,
        x,
        y,
        width,
        height,
        include,
        exclude,
        definite,
        elipse,
        excludeId,
        bonusDrop,
        kindWeight,
        levelWeight
    ) {
        super(map, id, x, y, width, height, elipse, excludeId);
        this.nb = nb;
        // Drop-rate multiplier for every mob spawned here (map "bonusDrop"
        // property; see MobRespawn.setDrops). Missing/invalid -> 1 (normal).
        this.bonusDrop = Number(bonusDrop) > 0 ? Number(bonusDrop) : 1;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        this.respawns = [];

        this.include = [];
        if (include) {
            if (Array.isArray(include)) this.include = include.slice();
            else if (typeof include === 'string' && include.indexOf(',') >= 0)
                this.include = include.split(',');
            else {
                this.include = [include];
            }
        }
        this.exclude = [];
        if (exclude) {
            if (typeof exclude === 'string' && exclude.indexOf(',') >= 0)
                this.exclude = exclude.split(',');
            else {
                this.exclude = [exclude];
            }
        }

        // kindWeight: how often each include kind spawns, in include order ("4,2,1" with include
        // "9,12,11": kind 9 four times and kind 12 twice as often as kind 11). levelWeight: how often each
        // level of minLevel..maxLevel is picked. Without kindWeight (or with the wrong number of values)
        // every include kind gets 1 -- include "1,2" -> kindWeight "1,1", an equal chance each; areas without
        // an include (kinds picked by level) use the kinds' own spawnChance (shared/data/mobs.json).
        // Without levelWeight (or with the wrong number of values) every level of the range gets 1 --
        // minLevel 10, maxLevel 12 -> levelWeight "1,1,1", each level equally often.
        const numbers = (v) => {
            if (v === undefined || v === null || v === '') return [];
            if (Array.isArray(v)) return v.map(Number);
            return String(v).split(',').map(Number).filter((n) => !Number.isNaN(n));
        };
        this.kindWeight = numbers(kindWeight);
        this.levelWeight = numbers(levelWeight);
        const levels = Math.max(1, this.maxLevel - this.minLevel + 1);
        if (this.levelWeight.length !== levels) {
            if (this.levelWeight.length > 0)
                console.warn(
                    `mobarea ${id}: levelWeight has ${this.levelWeight.length} values for levels ${this.minLevel}-${this.maxLevel} (expected ${levels}); using 1 for each.`
                );
            this.levelWeight = new Array(levels).fill(1);
        }

        this.setNumberOfEntities(this.nb);

        //console.info(JSON.stringify(this.mobs));

        // Definite mobs: when set, the area spawns ONLY these mob kinds
        // (addMobs() skips the level-range lookup and include/exclude).
        // Accepts an array of kinds ([1, 2]) from code, or the same
        // comma-separated string as include/exclude ("1" or "1,2") from a
        // map file's mobarea "definite" property. Empty -> normal selection.
        this.definite = null;
        if (Array.isArray(definite)) {
            this.definite = definite.map(Number);
        } else if (typeof definite === 'string' && definite.trim() !== '') {
            this.definite = definite.split(',').map(Number);
        } else if (typeof definite === 'number') {
            this.definite = [definite];
        }
        if (this.definite) {
            this.definite = this.definite.filter((k) => MobData.Kinds[k]);
            if (this.definite.length === 0) this.definite = null;
        }
    }

    addMobs() {
        this.mobs = [];
        if (Array.isArray(this.definite)) {
            for (const i of this.definite) {
                this.mobs.push(MobData.Kinds[i]);
            }
            return;
        }

        // NOTE: `levelMobs` was a bare (undeclared) assignment in the original
        // CommonJS source, which created an implicit global there; declared with
        // `var` here since ES modules are always strict mode and forbid implicit
        // globals.
        // `include` (a map file's comma-separated mobarea property, e.g.
        // "1,2") lists the mob kinds this area spawns: when it names any
        // valid kind, ONLY those kinds spawn, at the area's levels. Was
        // "add these kinds on top of every mob whose level range overlaps
        // the area's", which stopped meaning anything once every mob in
        // shared/data/mobs.json covered levels 1-99. An empty include keeps
        // the level-range lookup. `exclude` below still applies either way.
        // the kindWeight of each include kind (kind -> weight), in include order; 1 each by default
        this.kindWeights = new Map();
        if (Array.isArray(this.include) && this.include.length > 0) {
            let w = this.kindWeight;
            if (w.length !== this.include.length) {
                if (w.length > 0)
                    console.warn(
                        `mobarea ${this.id}: kindWeight has ${w.length} values for ${this.include.length} include kinds (${this.include.join(',')}); using 1 for each.`
                    );
                w = this.include.map(() => 1);
            }
            this.include.forEach((k, i) => {
                const m = MobData.Kinds[String(k).trim()];
                if (m) this.kindWeights.set(m.kind, w[i]);
            });
        }

        const included = Array.isArray(this.include)
            ? this.include
                  .map((i) => MobData.Kinds[String(i).trim()])
                  .filter((m) => m)
            : [];
        if (included.length > 0) {
            this.mobs = this.mobs.concat(included);
        } else {
            const levelMobs = MobData.getByLevelRange(
                this.minLevel,
                this.maxLevel
            );
            this.mobs = this.mobs.concat(levelMobs);
        }

        if (Array.isArray(this.exclude)) {
            let i = this.mobs.length;
            while (--i >= 0) {
                for (const j of this.exclude) {
                    // FIX: `this.mobs[i].kind` is numeric (see MobData's
                    // Kinds table -- `kind: value.kind`), but `this.exclude`
                    // entries are always strings whenever `exclude` arrives
                    // as the documented CSV format (the constructor above
                    // does `exclude.split(',')`, same as `include`). The `===`
                    // comparison here never coerces, so a configured exclude
                    // list (single value or CSV) silently never removed
                    // anything -- excluded mob kinds stayed eligible to
                    // spawn regardless. Coerce `j` to a number for the
                    // comparison so both the CSV-string and real-array/
                    // number forms of `exclude` work.
                    if (this.mobs[i].kind === Number(j)) {
                        this.mobs.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }

    spawnMobs() {
        //console.info("spawnMobs - nb: "+this.nb);
        for (let i = 0; i < this.nb; ++i) {
            this.addToArea(this._createRandomMobInsideArea(), this.exclude);
        }
    }

    _createMob(kind) {
        const self = this;

        //console.info("_createMob:"+kind);
        // PERF: see the PERF comment on Area#getNearbyEntities() (area.js)
        // -- narrows spaceEntityRandomApart()'s overlap-check scope down to
        // entities actually near this mob area (used for both initial
        // spawn, via spawnMobs() above, and every later respawn, via
        // entity/mob/mobrespawn.js) instead of the full map-entities
        // default.
        const pos = self.map.entities.spaceEntityRandomApart(
            2,
            self._getRandomPositionInsideArea.bind(self, 100),
            self.getNearbyEntities(2)
        );
        if (!pos) {
            console.warn('mobarea, _createMob: no position');
            return null;
        }

        //console.info("pos-x:"+pos.x+", pos-y:"+pos.y+", kind="+kind);
        const mob = self.map.entities.addMob(kind, pos.x, pos.y, this);

        //self.addToArea(mob);

        return mob;
    }

    _createRandomMobInsideArea() {
        const randomMob = 0;
        //console.info("_createRandomMobInsideArea");

        //console.info(JSON.stringify(this.mobs));
        if (!this.mobs || this.mobs.length === 0) return null;

        if (this.mobs.length === 1) {
            //console.info("kind_first: "+this.mobs[0].kind);
            return this._createMob(this.mobs[0].kind);
        }
        // FIX/PERF: this used to also build a `mobRatio` array here (one
        // entry per unit of spawnChance, for every mob in this area) as an
        // alternate way to pick a weighted-random kind by direct index. That
        // approach was superseded by the cumulative-weight loop below (`for
        // (let i=0; i < this.mobs.length; ++i) { ... if (r < sc) ... }`,
        // see its own FIX comment a few lines down) -- mobRatio was left
        // populated but never read again (the one place that used it,
        // `kind = mobRatio[randNum];` below, has been commented out for a
        // while). Building it cost an O(sum of every mob's spawnChance)
        // loop -- with enough mob kinds/weights configured for an area,
        // potentially a lot of wasted array writes on every single mob
        // spawn -- purely to compute mobRatioTotal, which a plain sum does
        // just as well without the throwaway array.
        let mobRatioTotal = 0;
        const l = this.mobs.length;
        if (l === 0) {
            console.warn('mobs length === 0 aborting create.');
            return null;
        }

        // an include kind's kindWeight (1 each by default); kinds picked by level: their own spawnChance (mobs.json)
        const chance = (m) =>
            this.kindWeights && this.kindWeights.has(m.kind) ? this.kindWeights.get(m.kind) : m.spawnChance;
        for (let i = 0; i < l; ++i) {
            mobRatioTotal += chance(this.mobs[i]);
        }
        if (!(mobRatioTotal > 0)) return null;     // every kind weighted 0

        // NOTE: this used to be a second `var kind = 0;` -- harmless under
        // `var` (function-scoped, redeclaration is a no-op) but a
        // SyntaxError under `let`/`const` (block-scoped, redeclaration in
        // the same scope throws). The first declaration above was never
        // read before this point, so this is the only live one; converted
        // to `let` since `kind` is reassigned in the loop below.
        let kind = 0;
        const randNum = Utils.randomInt(mobRatioTotal - 1);
        //console.info("randNum="+randNum);
        let r = randNum;
        let sc = 0;
        // FIX: was `r <= sc` -- for cumulative-weight selection over
        // `r` in [0, total-1], the correct boundary is `r < sc`; `<=` let
        // each mob's slot "steal" one extra value from the next mob's
        // range, which both skewed the distribution toward earlier mobs in
        // the list and could make the last mob in the list unreachable
        // entirely (e.g. 3 equal-weight mobs, total=3, r in {0,1,2}: mob0
        // matched both r=0 and r=1, mob1 only matched r=2, mob2 never
        // matched anything).
        for (let i = 0; i < this.mobs.length; ++i) {
            sc = chance(this.mobs[i]);
            if (r < sc) {
                kind = this.mobs[i].kind;
                break;
            }
            r -= sc;
        }
        if (kind === 0) {
            console.info('this.mobs=' + JSON.stringify(this.mobs));
            console.warn('mob kind === 0 aborting create.');
            return null;
        }
        return this._createMob(kind);
    }

    // Picks a level in [min, max] (the intersection of a mob kind's own
    // level range and this area's level range -- see mob.js). If this area
    // has a valid `levelWeight` array, the pick is weighted per-level using it
    // (this.levelWeight[level - this.minLevel]); levels outside the array's
    // range, or with a non-positive weight, are excluded. Falls back to a
    // uniform pick across [min, max] when there's no usable weight data.
    getRandomLevel(min, max) {
        // levelWeight: 1 per level unless the area sets it (see the constructor)
        const lw = this.levelWeight;
        if (Array.isArray(lw) && lw.length > 0) {
            let total = 0;
            const levels = [];
            const weights = [];
            for (let lvl = min; lvl <= max; ++lvl) {
                const w = Number(lw[lvl - this.minLevel]);
                if (!(w > 0)) continue;
                levels.push(lvl);
                weights.push(w);
                total += w;
            }

            if (levels.length > 0) {
                // Same cumulative-weight pattern as the mob-kind selection
                // above: r uniform in [0, total-1], walk the running sum
                // and stop at the first weight that r falls under.
                let r = Utils.randomInt(total - 1);
                for (let i = 0; i < levels.length; ++i) {
                    if (r < weights[i]) return levels[i];
                    r -= weights[i];
                }
                return levels[levels.length - 1];
            }
        }

        return Utils.randomRangeInt(min, max);
    }

    isNextTooEntity(entity, dist) {
        dist = dist || G_TILESIZE;
        for (const en of this.entities) {
            if (
                Math.abs(entity.x - en.x) <= dist &&
                Math.abs(entity.y - en.y) <= dist
            )
                return true;
        }
        return false;
    }
}

export default MobArea;
