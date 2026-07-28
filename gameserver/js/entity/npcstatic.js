import Entity from './entity.js';
import Messages from '../message.js';
import EntityQuests from '../entityquests.js';
import Utils from '../utils.js';
import { Types } from '../common.js';
import QuestData from '../data/questdata.js';
import { G_NPC_QUEST_ID_MAP_OFFSET } from '../constants.js';
import NPCnames from '../../data/npc_names.json' with { type: 'json' };

class NpcStatic extends Entity {
    constructor(id, kind, x, y, map) {
        super(id, Types.EntityTypes.NPCSTATIC, kind, x, y, map);

        this.armor = 0;
        this.weapon = 0;

        this.gender = kind % 2;

        this.name = NPCnames[kind % NPCnames.length];

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

    // FIX: NpcStatic had no getState() override, so it fell back to
    // Entity.getState() (just _getBaseState(), 8 fields) and never sent
    // npcQuestId over the wire at all -- unlike NpcMove, which appends it
    // as field 8 here. That's why the client's clientcallbacksspawn.js
    // could set entity.npcQuestId / register the entity in game.npc for a
    // spawned NpcMove but not for a spawned NpcStatic, which meant
    // game.getNpcByQuestKind() (used by onQuest -> questSpeech to show the
    // "quest in progress" dialogue automatically) could never resolve a
    // static NPC and silently never showed anything for it, even though
    // this.npcQuestId was already being computed correctly in the
    // constructor above for both classes.
    getState() {
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

            const langcode = 'QUESTS_' + newQid;
            const msg = new Messages.Dialogue(this, langcode);
            player.sendPlayer(msg);
        }
    }

}

export default NpcStatic;
