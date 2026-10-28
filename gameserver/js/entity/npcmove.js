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

import Character from './character/character.js';
import EntityQuests from '../entityquests.js';
import Utils from '../utils.js';
import { Types } from '../common.js';
import QuestData from '../data/questdata.js';
import { G_NPC_QUEST_ID_MAP_OFFSET } from '../constants.js';
import NPCnames from '../../data/npc_names.json' with { type: 'json' };

class NpcMove extends Character {
    constructor(id, kind, x, y, map) {
        super(id, Types.EntityTypes.NPCMOVE, kind, x, y, map);

        this.armor = 0;
        this.weapon = 0;

        this.gender = kind % 2;
        this.setMoveRate(350);

        this.name = NPCnames[kind % NPCnames.length];

        const callbacks = this.map.entities.world.npcMoveCallback;
        callbacks.setCallbacks(this);

        this.entityQuests = new EntityQuests(this);
        // FIX: was `this.kind` -- shared by every NPC of the same species,
        // which is exactly what let a same-kind NPC stand in for the one a
        // quest was actually assigned to (see EntityQuests.ownsQuest).
        // mapIndex/id are both fixed by static map order and this map's own
        // single-threaded spawn sequence (see the G_NPC_QUEST_ID_MAP_OFFSET
        // comment in constants.js), so this is unique to this NPC instance,
        // ascending, and reproducible on every server start regardless of
        // which map finishes its async load first.
        this.npcQuestId = this.mapIndex * G_NPC_QUEST_ID_MAP_OFFSET + this.id;
    }

    setQuests(quests) {
        this.entityQuests.quests = {};
        for (const qid of quests) {
            this.entityQuests.quests[qid] = QuestData.Data[qid];
        }
    }

    getState() {
        // DANGER - if questhandler variable changes so should this.
        // TODO
        return this._getBaseState().concat(this.npcQuestId);
    }

    talk(player) {
        const self = this;
        const self_player = player;

        let res = false;
        // FIX: was matching on `q.npcQuestId === self.npcQuestId` (NPC
        // kind), so any NPC of the same kind could complete another NPC
        // instance's item-turn-in quest. self.entityQuests.ownsQuest()
        // scopes this to the NPC instance the quest was actually assigned
        // to (see EntityQuests.ownsQuest for the full rationale).
        player.quests.forQuestsType(Types.QuestType.GETITEMKIND, function (q) {
            if (self.entityQuests.ownsQuest(self_player, q)) {
                // FIX: self-heal a stale/shared npcQuestId on this quest
                // before completing it, same reasoning as the FIX comments
                // on EntityQuests.acceptQuest()/hasQuest() -- ownsQuest()
                // just confirmed `self` really is the NPC this quest
                // belongs to, so its npcQuestId is authoritative regardless
                // of what q.npcQuestId currently holds. Without this, the
                // COMPLETE-status Quest message this turn-in sends can
                // still carry an npcQuestId the client's
                // getNpcByQuestKind() can't match to any on-screen NPC,
                // silently dropping the completion's quest speech.
                q.npcQuestId = self.npcQuestId;
                if (self_player.quests.questAboutItemComplete(q, null))
                    res = true;
            }
        });
        if (res) return;

        if (Object.keys(this.entityQuests.quests).length === 0) {
            this.entityQuests.dynamicQuests(player);
        } else {
            if (this.entityQuests.hasQuest(player)) {
                return;
            }

            // NOTE: this used to be declared twice with `var newQid` (a
            // no-op `= -1` initializer above that nothing ever read, since
            // every path between it and here either returns or overwrites
            // it) -- harmless under `var`'s redeclaration rules but a
            // SyntaxError under `let`/`const`. Consolidated to the one
            // live declaration.
            const newQid = this.entityQuests.getNextQuestId(player);

            if (!newQid) {
                this.entityQuests.sendNoQuest(player);
                return;
            }

            this.entityQuests.offerQuest(player, newQid);
        }
    }

    randomMove() {
        if (!this.hasTarget() && !this.isDead && !this.isMoving()) {
            const canRoam = Utils.randomRangeInt(0, 100) === 1;
            if (
                !canRoam ||
                this.map.entities.getPlayerAroundCount(this, 20) === 0
            )
                return;
            // FIX: was `this.map.entities.getRandomPosition(this, 2)` --
            // getRandomPosition() only exists on Map (zero-arg), not on
            // MapEntities, so this threw on every roam attempt and broke
            // ambient NPC wandering entirely. Matches the pattern used in
            // mapentities.js's own NPC-spawn code.
            const pos = this.map.getRandomPosition();
            if (pos && !(pos.x === this.x && pos.y === this.y)) {
                //if (this.map.entities.isCharacterAt(pos.x,pos.y))
                //   return;
                this.go(pos.x, pos.y);
                //this.nextStep();
            }
        }
    }

    checkMove(time) {
        if (this.isDead) return;

        if (!this.freeze && this.isMoving() && this.canMove()) {
            this.nextStep();
        }
    }
}

export default NpcMove;
