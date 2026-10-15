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

import Entity from './entity.js';
import { Types } from '../common.js';
import ItemData from '../data/itemdata.js';
import Scheduler from '../scheduler.js';

// PERF: every dropped/looted item used to get its own pair of chained
// setTimeout calls (blink after beforeBlinkDelay, then despawn after
// blinkingDuration -- see handleDespawn() below), and static items got
// their own respawn setTimeout (scheduleRespawn() below). Loot volume
// scales directly with combat activity (every mob kill by every player can
// drop an item), so this was one of the highest-churn timer sources in the
// codebase under real play. Routed through the shared Scheduler
// (gameserver/js/scheduler.js) instead -- see that file for the full
// rationale (one shared low-res tick over a flat pending-deadline list,
// instead of a timer per call).
// TODO Make Item inherit from ItemRoom.
class Item extends Entity {
    constructor(type, id, itemRoom, x, y, map) {
        const kind = itemRoom.itemKind;
        super(id, type, kind, x, y, map);
        this.isStatic = false;
        this.orientation = Types.Orientations.DOWN;
        this.experience = 0;
        this.data = ItemData.Kinds[kind];
        this.room = itemRoom;
    }

    handleDespawn(params) {
        // PERF: was `this.blinkTimeout = setTimeout(...)`. Scheduled through
        // the shared Scheduler instead -- see the comment at the top of this
        // file. blinkToken/despawnToken are cancelled in destroy() below,
        // exactly like the old blinkTimeout/despawnTimeout setTimeout
        // handles were.
        this.blinkToken = Scheduler.schedule(() => {
            params.blinkCallback();
            this.despawnToken = Scheduler.schedule(
                params.despawnCallback,
                params.blinkingDuration
            );
        }, params.beforeBlinkDelay);
    }

    destroy() {
        // PERF: cancel this item's pending blink/despawn tokens -- equivalent
        // to the old clearTimeout(this.blinkTimeout)/
        // clearTimeout(this.despawnTimeout) pair. Scheduler.cancel() is a
        // safe no-op for an already-fired/never-set token (null/undefined),
        // exactly like clearTimeout() was, so this is safe to call
        // unconditionally -- including when destroy() is itself being
        // called *from* the despawn callback (the token was already removed
        // from the pending list before that callback ran; see scheduler.js).
        Scheduler.cancel(this.blinkToken);
        Scheduler.cancel(this.despawnToken);
        this.blinkToken = null;
        this.despawnToken = null;

        if (this.isStatic) {
            this.scheduleRespawn(30000);
        }
    }

    scheduleRespawn(delay) {
        // PERF: was its own setTimeout; routed through the shared Scheduler.
        // Static-item respawns are bounded by the map's fixed static-item
        // spawn count (not player-driven), so this one was never a scaling
        // concern on its own -- moved anyway now that Scheduler exists, for
        // one less bespoke timer pattern in this file rather than for a
        // measurable win.
        Scheduler.schedule(() => {
            if (this.respawnCallback) {
                this.respawnCallback();
            }
        }, delay);
    }

    onRespawn(callback) {
        this.respawnCallback = callback;
    }

    getState() {
        return [
            parseInt(this.id, 10),
            parseInt(this.type),
            parseInt(this.room.itemKind),
            this.data && this.data.hasOwnProperty('name') ? this.data.name : '',
            parseInt(this.map.index),
            parseInt(this.x),
            parseInt(this.y),
            parseInt(this.orientation),
            parseInt(this.room.itemNumber)
        ];
    }

    getName() {
        return this.data.name;
    }

    toString() {
        return (
            this.room.itemKind +
            ' ' +
            this.room.itemNumber +
            ' ' +
            this.room.itemDurability +
            ' ' +
            this.room.itemDurabilityMax +
            ' ' +
            this.room.itemExperience +
            ' ' +
            this.x +
            ' ' +
            this.y
        );
    }
}

export default Item;
