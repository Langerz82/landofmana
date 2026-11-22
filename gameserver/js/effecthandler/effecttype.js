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

import { effectTotal } from '../entity/character/effectstats.js';

// Extracted from effecthandler.js: EffectType, the per-skill effect
// definition (one instance shared by every cast of a given skill -- see
// SkillData.Skills' construction in data/skilldata.js). Behavior unchanged.

// @entity Object reference to the owner of the effect.
// @isTarget false Self, true Target.
// @phase 0 start, 1 end, 2 interval, 3 beforehit, 4 onhit, 5 afterhit.
// @stat
// @modValue Fixed value adjustment per Level, if less than 1 its a % of val2.

export class EffectType {
    constructor(isTarget, phase, stat, modValue) {
        this.entity = null;
        this.isTarget = isTarget;
        this.phase = phase;
        this.stat = stat;
        this.modValue = parseFloat(modValue) || 0;
        this.active = false;
    }

    apply(skillEffect, target, phase, damage) {
        // FIX: was an unconditional `if (target.isDead) return;`, with no
        // exception for `phase === 'end'`. Character.die() (character.js)
        // sets `isDead = true` *before* calling `endEffects()`, which walks
        // every active SkillEffect and calls this method with phase='end' to
        // undo whatever a matching phase='start' application did
        // (applyStacking()/applyMoveSpeedStacking() below reverse
        // target.stats.mod/moveSpeedMod). Since `target.isDead` is already
        // true by the time that 'end' call arrives for the entity that just
        // died, this guard used to return before ever reaching the
        // reversal -- silently skipping it. Neither Player.respawn() nor
        // MobRespawn.respawn() reset stats.mod/moveSpeedMod themselves (both
        // assume die()'s endEffects() already did), so an entity killed
        // while buffed/debuffed/slowed came back from respawn permanently
        // carrying that modifier. Still block *new* start/interval
        // applications from landing on a dead target (a fresh heal/buff/DoT
        // tick on a corpse makes no sense), just not the 'end' phase that
        // exists specifically to clean one up.
        if (target.isDead && phase !== 'end') return;

        if (this.phase != phase) return;

        let val1 = 0,
            val2 = 0,
            statmax = 0;
        let runModDiff = true;
        switch (this.stat) {
            case 'hp':
                val1 = target.stats.hp;
                statmax = val2 = target.stats.hpMax;
                break;
            case 'ep':
                val1 = target.stats.ep;
                statmax = val2 = target.stats.epMax;
                break;
            // Percentages are of the stat itself (stats.attack, without
            // stats.mod), so two % buffs don't compound off each other.
            case 'attack':
                val2 = val1 = target.stats.attack;
                break;
            case 'defense':
                val2 = val1 = target.stats.defense;
                break;
            case 'slow':
                // FIX: "slow" used to skip this switch entirely (fell through to
                // `default: runModDiff = false`), so this.diff was never computed
                // for it and the bottom switch's `target.moveSpeed += this.modValue`
                // applied the raw, unscaled modValue directly instead of a
                // level-scaled diff. Treating "slow" like "attack"/"defense" here
                // (val1/val2 = the stat being modified, statmax = 0) lets
                // getModDiff() compute a proper per-level diff off the entity's
                // current moveSpeed, and lets applyMoveSpeedStacking() (below) use
                // that diff the same way applyStacking() uses attack/defense/damage
                // diffs.
                statmax = 0;
                val2 = val1 =
                    target.baseMoveSpeed !== undefined
                        ? target.baseMoveSpeed
                        : target.moveSpeed;
                break;
            case 'damage':
                // FIX: was `val1 = 0; val2 = damage;`. getModDiff() below only
                // ever reads its `stat` param (this case's val1) and `statmax`
                // (left at 0 here, same as the "attack"/"defense" cases just
                // above) -- `statmod` (val2) is accepted but never actually used
                // anywhere in getModDiff(). So a percentage-based "damage" effect
                // (modValue < 1, meant to scale off the incoming `damage` amount
                // the same way "attack"/"defense" percentage effects scale off
                // the caster's current stat) always multiplied against the
                // hardcoded 0 in getModDiff()'s `diff = Math.round(diff * stat)`
                // branch, and then `if (stat === 0) return diff;` short-circuited
                // to 0 immediately after -- silently no-op'ing the whole effect.
                // Setting val1 (and val2, mirroring the attack/defense pattern)
                // to the real `damage` baseline lets the percentage branch -- and
                // the "nothing to take a % of yet" guard -- work off the actual
                // value instead of an always-0 placeholder. Flat per-level damage
                // effects (modValue >= 1, e.g. the two currently-defined "damage"
                // skills) are unaffected -- that branch never reads `stat` at all.
                val1 = val2 = damage;
                break;
            default:
                runModDiff = false;
                break;
        }

        if (runModDiff)
            this.diff = this.getModDiff(skillEffect, val1, val2, statmax);

        switch (this.stat) {
            case 'hp':
                //var oldhp = target.stats.hp;
                //target.stats.hp += this.diff;
                // FIX: this used to always call target.modHp(this.diff) directly,
                // for both healing (diff > 0) and damage (diff < 0 -- e.g. a
                // poison/DoT-style skill's "interval" phase). modHp()/_modHp()
                // never checks target.invincible -- that guard lives solely in
                // onDamage() (character.js) -- so a DoT effect already ticking on
                // a target that becomes invincible mid-duration (e.g. a mob's
                // invuln window while returning to spawn, mob.js's
                // returnToSpawn()) kept dealing damage every interval tick
                // regardless of invincibility. Routing negative diffs (actual
                // damage) through onDamage() instead closes that bypass, and as a
                // side effect also makes a killing DoT tick correctly trigger
                // Mob.die()/attacker-tracking the same way a normal hit does
                // (modHp() alone never did either). Healing (diff >= 0) is left on
                // the modHp() path unchanged -- invincible was never meant to
                // block being healed.
                if (this.diff < 0)
                    target.onDamage(
                        skillEffect.source,
                        -this.diff,
                        0,
                        false,
                        0
                    );
                else target.modHp(this.diff);
                //target.stats.hp = Utils.clamp(0, target.stats.hpMax, target.stats.hp);
                //if (target instanceof Player)
                //target.sendChangePoints((target.stats.hp-oldhp),0);
                break;
            case 'ep':
                target.modEp(this.diff);
                break;
            // FIX: "attack"/"defense"/"damage" used to do a flat
            // `target.stats.mod.<stat> = this.diff` here -- a straight
            // overwrite, not additive. That's fine for a single skill acting
            // alone (the only case exercised by the current skill roster: one
            // skill per affected stat), but two concurrently active effects on
            // the same stat would stomp on each other -- the second cast's
            // "start" would silently discard the first cast's bonus, and
            // whichever effect's "end" fired first would zero out *both* (every
            // skill's "end" entry uses modValue 0, so the reset was always to a
            // flat 0, not "subtract what I added"). Routed through
            // applyStacking() below instead, which tracks each cast's own
            // contribution separately (keyed on the per-cast SkillEffect
            // instance + target + stat) and adds/removes exactly that amount,
            // so multiple concurrent buffs on the same stat stack correctly and
            // each one's "end" only undoes its own share.
            case 'attack':
                this.applyStacking(skillEffect, target, 'attack');
                break;
            case 'defense':
                this.applyStacking(skillEffect, target, 'defense');
                break;
            case 'damage':
                this.applyStacking(skillEffect, target, 'damage');
                break;
            // FIX: both branches read `this.modVal`, which is never assigned
            // anywhere on this class -- only `this.modValue` (constructor above)
            // is real. `this.modVal` was always `undefined`: "freeze" always took
            // the else branch (`undefined === 1` is false), silently no-op'ing --
            // or actively un-freezing -- every freeze/stun effect; "slow" did
            // `moveSpeed += undefined`, permanently corrupting that entity's
            // moveSpeed to NaN (serialized straight to the client in
            // message.js's Move/MovePath messages).
            //
            // FIX: on top of the this.modVal bug above, "freeze" was also a
            // flat `target.freeze = true/false` write with no per-cast
            // tracking at all -- unlike "attack"/"defense"/"damage"/"slow"
            // just above, which all went through a stacking helper for
            // exactly this reason. Two overlapping freeze/stun effects on
            // the same target (e.g. two different mobs each landing a stun,
            // or the "Daze" skill -- shared/data/skills2.json -- recast
            // before its first application wears off) meant whichever
            // effect's 'end' phase fired FIRST unconditionally set
            // `target.freeze = false`, prematurely un-freezing the target
            // even though a second stun's duration hadn't elapsed yet.
            // Routed through applyFreezeStacking() (below) instead, which
            // counts how many currently-active casts are holding this
            // target frozen (mirroring applyStacking()'s per-cast
            // bookkeeping) so freeze only actually clears once the last one
            // lets go. Note this only resolves stacking between concurrent
            // *skill-effect* freezes -- `target.freeze` is also written
            // directly by unrelated systems (entitymoving.js's own
            // per-step freeze/unfreeze, character.js's die(), mob
            // respawn/aggro resets); untangling those from the skill-effect
            // freeze counter is a larger change outside what this fix
            // covers.
            case 'freeze':
                this.applyFreezeStacking(skillEffect, target);
                break;
            // FIX: no skill in shared/data/skills2.json uses a "slow" effect yet
            // (grepped for it), so this branch was dead code, but it was broken
            // for whenever one gets added: unlike "attack"/"defense"/"damage"
            // above, this used to ADD modValue directly to moveSpeed with no
            // reversal on "end" (a "start"(+X)/"end"(+0) pair, the pattern every
            // other effect in skills2.json uses, would have permanently left the
            // target slowed) and wrote moveSpeed directly instead of through
            // setMoveRate() (entitymoving.js) -- which is what keeps
            // `walkSpeed`/`tick` in sync with it, and `tick` in particular feeds
            // packets/movevalidator.js's speed check. Now routed
            // through applyMoveSpeedStacking() (below), which mirrors
            // applyStacking()'s per-cast tracking (so concurrent slows stack and
            // each "end" only undoes its own share) but goes through
            // setMoveRate() against a saved base speed instead of writing
            // target.stats.mod, since moveSpeed isn't part of that object.
            case 'slow':
                this.applyMoveSpeedStacking(skillEffect, target);
                break;
        }
        return;
    }

    // attack / defense / damage: record what this cast applies to the
    // target on the cast itself (SkillEffect.setApplied()). stats.mod.attack
    // etc. are summed from those (entity/character/effectstats.js), so
    // there's no running mod total -- each cast's value simply stops counting
    // when it ends on the target, and a recast of the same skill replaces
    // the earlier one (SkillEffect.attach()) instead of stacking.
    applyStacking(skillEffect, target, stat) {
        skillEffect.setApplied(
            target,
            stat,
            this.phase === 'end' ? 0 : this.diff
        );
    }

    // slow: same per-cast record, then moveSpeed is set from the target's
    // never-modified base speed plus every active slow, through
    // setMoveRate() (keeps walkSpeed / tick -- movevalidator.js's speed
    // check -- in sync).
    applyMoveSpeedStacking(skillEffect, target) {
        if (target.baseMoveSpeed === undefined)
            target.baseMoveSpeed = target.moveSpeed;
        skillEffect.setApplied(
            target,
            'slow',
            this.phase === 'end' ? 0 : this.diff
        );
        target.setMoveRate(target.baseMoveSpeed + effectTotal(target, 'slow'));
    }

    // freeze: this cast holds the target frozen until its end; the target
    // stays frozen while any active effect still holds it (one stun ending
    // can't cut another one short).
    applyFreezeStacking(skillEffect, target) {
        skillEffect.setApplied(target, 'freeze', this.phase === 'end' ? 0 : 1);
        target.freeze = effectTotal(target, 'freeze') > 0;
    }

    getModDiff(skillEffect, stat, statmod, statmax) {
        let diff = this.modValue * skillEffect.level;
        if (this.modValue < 1) {
            if (statmax > 0) diff = Math.round(diff * statmax);
            else diff = Math.round(diff * stat);
        } else {
            diff = Math.round(diff);
        }

        if (stat === 0) return diff;

        if (diff > 0) {
            if (statmax > 0) {
                if (stat + diff > statmax) diff = statmax - stat;
            }
        } else if (diff < 0) {
            if (stat + diff < 0) diff = -stat;
        }
        return diff;
    }
}
