// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
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

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Utils */
import Entity from './entity.js';

export default class Node extends Entity {
    constructor(id, map, kind) {
        super(id, Types.EntityTypes.NODE, map, kind);
        this.level = 0;
        this.stats = {};
        this.idleSpeed = 150 + Utils.random(150);
    }

    resetHP() {
        this.stats.hp = this.stats.hpMax;
    }

    setHP(val) {
        val = val || this.stats.hpMax;
        this.stats.hp = val;
    }

    setMaxHP(hp) {
        this.stats.hpMax = hp;
        this.stats.hp = hp;
    }

    die() {
        if (this.death_callback) this.death_callback();
    }

    onDeath(callback) {
        this.death_callback = callback;
    }

    // FIX: this override was declared with no parameter and looked up
    // `this.name` instead - but `this.name` is the node's own display/log
    // label (set from the spawn payload as `entity.name = data[3]` in
    // clientcallbacksspawn.js, e.g. "node2"), not an animation key. The
    // actual animation name (e.g. the server's per-state animName, data[10]
    // at spawn, or whatever setAnimation()'s `this.getAnimationByName(name)`
    // call is really asking for afterwards) was silently discarded every
    // time. Spawning happened to work because entity.animate(animName, ...)
    // sets currentAnimation directly through setAnimation() the first time
    // regardless (setSprite() runs first, but the very next animation
    // lookup already goes through this override) - any animation change
    // after that (idle loop restart, harvest, re-orientation, etc.) asked
    // for the wrong key, failed the `name in this.animations` check in
    // Entity.getAnimationByName(), logged "No animation called <node name>",
    // and left the node's sprite stuck/not updating. Accept and forward the
    // real requested name; only the dying case is special-cased to 'death'.
    getAnimationByName(name) {
        if (this.isDying) return super.getAnimationByName('death');

        return super.getAnimationByName(name);
    }
}

// Reserved Node "kind" that identifies a chest. Must match the server's
// Node.CHEST_KIND (gameserver/js/entity/node.js) since it's transmitted
// as-is over the wire (the `kind` field of every spawn message).
Node.CHEST_KIND = 99;
