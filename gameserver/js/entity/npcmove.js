import Character from './character.js';
import Messages from '../message.js';
import EntityQuests from '../entityquests.js';
import Utils from '../utils.js';
import { Types } from '../common.js';
import QuestData from '../data/questdata.js';
import NPCnames from '../../data/npc_names.json' with { type: 'json' };

class NpcMove extends Character {
    constructor(id, kind, x, y, map) {
        super(id, Types.EntityTypes.NPCMOVE, kind, x, y, map);

        this.armor = 0;
        this.weapon = 0;

        this.gender = kind % 2;
        this.setMoveRate(350);

        this.name = NPCnames[kind%NPCnames.length];

        const callbacks = this.map.entities.world.npcMoveCallback;
        callbacks.setCallbacks(this);

        this.entityQuests = new EntityQuests(this);
        this.npcQuestId = this.kind;

        //this.scriptQuests = false;

        if (QuestData.NpcData.hasOwnProperty(this.kind)) {
            const qData = QuestData.NpcData[this.kind];
            if (qData && qData.length > 0)
            {
                const newQuest = null;
                const pQuest = null;
                for (const q of qData)
                {
                    this.entityQuests.quests[q.id] = q;
                }
            }
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
        player.quests.forQuestsType(Types.QuestType.GETITEMKIND, function (q) {
            if (q.npcQuestId === self.npcQuestId) {
                if (self_player.quests.questAboutItemComplete(q, null))
                    res = true;
            }
        });
        if (res)
            return;

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

            const langcode = "QUESTS_"+newQid;
            const msg = new Messages.Dialogue(this, langcode);
            player.sendPlayer(msg);
        }
    }

    randomMove() {
        if(!this.hasTarget() && !this.isDead && !this.isMoving()) {
            const canRoam = (Utils.randomRangeInt(0,100) === 1);
            if(!canRoam || this.map.entities.getPlayerAroundCount(this,20) === 0)
                return;
            const	pos = this.map.entities.getRandomPosition(this, 2);
            if (pos && !(pos.x === this.x && pos.y === this.y))
            {
                //if (this.map.entities.isCharacterAt(pos.x,pos.y))
                //   return;
                this.go(pos.x, pos.y);
                //this.nextStep();
            }
        }
    }

    checkMove(time) {
        if (this.isDead)
            return;

        if (!this.freeze && this.isMoving() && this.canMove())
        {
            this.nextStep();
        }
    }
}

export default NpcMove;
