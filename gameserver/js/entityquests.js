import Quest, { getQuestObject } from './quest.js';
import Messages from './message.js';
import { Types, ItemTypes } from './common.js';
import Utils from './utils.js';
import MobData from './data/mobdata.js';
import ItemData from './data/itemdata.js';
import ItemLootData from './data/itemlootdata.js';
import ItemRoom from './items/itemroom.js';
import QuestData from './data/questdata.js';

// FIX: MobData, ItemData, ItemLootData, and ItemRoom were all used throughout
// this file (getMobObject, createQuestItemKind, giveReward) but never
// imported -- the stale `/* global ... */` comment below was a leftover from
// the CommonJS version where these really were implicit globals. Uncaught
// ReferenceErrors here broke dynamic quest generation and reward-giving
// entirely. Utils was also referenced (getMobObject/createQuestItemKind) but
// commented out above; uncommented and switched to a real import.
/* global log */

class EntityQuests {
    constructor(entity) {
        this.entity = entity;

        this.questsCount = 0;
        this.quests = {};
    }

    acceptQuest(player, questId) {
        if (!this.quests.hasOwnProperty(questId)) return;

        const quest = this.quests[questId];

        let pQuest = player.quests.getQuestById(parseInt(questId));
        if (pQuest) {
            if (pQuest.status < Types.QuestStatus.COMPLETE) {
                // FIX: this player's copy of the quest can predate the
                // npcQuestId format change (or simply be stale) and still be
                // carrying QuestData's shared, kind-based npcQuestId (see the
                // FIX below on the fresh-accept path for why that breaks
                // client-side quest speech). Re-stamping it here too means a
                // simple re-sync (re-talking to the NPC while the quest is
                // already in progress) self-heals it, not just a brand new
                // accept.
                pQuest.npcQuestId = this.entity.npcQuestId;
                pQuest.status = Types.QuestStatus.INPROGRESS;
                player.quests.progressQuest(pQuest);
                return;
            }
        }

        pQuest = Object.assign(new Quest(), quest);
        pQuest.data = quest.data;
        // FIX: `quest` here is QuestData.Data[questId] -- one shared object
        // reused by every NPC instance and every player that's ever offered
        // this authored quest -- and its npcQuestId is `data.npcKind`
        // (questdata.js), an NPC *kind*, not an NPC instance. That's fine
        // server-side (EntityQuests.ownsQuest() never consults npcQuestId
        // for authored quests -- it checks `this.quests` membership
        // instead), but this same npcQuestId also rides along to the client
        // on every Quest message (quest.toClient(), message.js's
        // Messages.Quest), and the client uses exactly that field to find
        // which on-screen NPC a quest's dialogue/bubble belongs to
        // (client/js/game/gameentityqueries.js's getNpcByQuestKind(), called
        // from clientcallbacksquest.js's onQuest()/questSpeech() --
        // `entity.npcQuestId === quest.npcQuestId`). Since NPC instances now
        // report a globally-unique per-instance npcQuestId of their own (see
        // entity/npcstatic.js / entity/npcmove.js), leaving this at the
        // shared kind value means it can never match the accepting NPC's own
        // npcQuestId again -- getNpcByQuestKind() always returns null, and
        // quest-accept/progress/complete speech silently stops appearing for
        // every authored quest. Stamping the accepting NPC's own npcQuestId
        // onto this player's copy (not the shared QuestData template) is
        // what makes the two line back up.
        pQuest.npcQuestId = this.entity.npcQuestId;
        player.quests.foundQuest(pQuest);
    }

    rejectQuest(player, questId) {}

    // FIX: matching used to be "this.entity.npcQuestId === quest.npcQuestId",
    // i.e. purely by NPC *kind*. Since npcQuestId is just entity.kind, any
    // NPC sharing that kind -- not only the one map spawn entry that was
    // actually given this quest via setQuests() -- would satisfy the check,
    // letting the player progress/complete/collect a reward for a quest
    // from the wrong NPC instance. Authored quests (present in QuestData,
    // the shared/data/quests.json set) are now owned exclusively by the NPC
    // instance(s) whose spawn entry listed this exact quest id (tracked in
    // this.quests via setQuests()). Procedurally generated quests
    // (createQuestItemKind/createQuestKillMobKind) are never registered in
    // this.quests and have no single owning spawn entry, so they keep the
    // kind-based fallback -- that ambiguity is intentional for them. That
    // fallback also now requires the player to still be on this NPC's map:
    // kind alone doesn't rule out a same-kind NPC on a different map, and
    // player.map can briefly disagree with the map an entity actually lives
    // on during teleport/map-transition (see the door.tmap/mapId handling
    // in map.js and movementhandler.js), so this guards that window too.
    ownsQuest(player, quest) {
        if (this.quests.hasOwnProperty(quest.id)) return true;

        if (!QuestData.Data.hasOwnProperty(quest.id)) {
            return (
                this.entity.npcQuestId === quest.npcQuestId &&
                this.entity.map.id === player.map.id
            );
        }

        return false;
    }

    giveReward(player, quest) {
        const pquest = player.quests.completeQuests[quest.id];
        if (!pquest) return false;

        if (!pquest.hasOwnProperty('reward')) {
            const count = player.items.inventory.hasRoomCount();
            if (quest.reward.length > 0 && count < quest.reward.length) {
                player.sendPlayer(
                    new Messages.Notify('INVENTORY', 'INVENTORY_FULL')
                );
                return false;
            }

            // NOTE: `msg` is reused/reassigned inside the reward loop below
            // (each rewarded item sends its own "ITEM_ADDED" notify through
            // the same binding), so it stays `let`; the loop's own
            // `var msg = ...` is now a plain reassignment instead of a second
            // declaration.
            let msg = new Messages.Dialogue(this.entity, 'QUESTS_REWARD', [
                this.entity.name
            ]);
            player.sendPlayer(msg);

            if (quest.gold > 0)
                player.items.modifyGold(parseInt(quest.gold, 10));

            for (const reward of quest.reward) {
                // FIX: `parseInt(reward.itemDurability, 10) || 0` sends `0`
                // whenever the field is simply absent (parseInt(undefined) is
                // NaN, and `NaN || 0` is `0`) -- and every reward entry actually
                // defined right now (shared/data/quests.json's one reward,
                // {"itemKind": 100}, a "Leather Chest 1" armor piece) omits
                // itemDurability entirely. items/baseitem.js's set() treats `0`
                // as a real, explicit value (`arr[2] != null` is true for 0, so
                // it uses `Number(0)` instead of falling back to its own
                // 900-durability default for equipment) -- so `|| 0` here handed
                // out that reward as a broken, 0-durability item every time,
                // instead of a fresh one. `|| null` has the same "field missing
                // vs. explicit 0" collapsing problem in the other direction (an
                // intentionally-0-durability reward would get silently repaired
                // to full instead) -- checking for NaN specifically distinguishes
                // "not a number" (field absent -> let baseitem.js apply its
                // default) from "the number zero" (field present and really is
                // 0 -> keep it 0).
                const durability = parseInt(reward.itemDurability, 10);
                const durabilityMax = parseInt(reward.itemDurabilityMax, 10);
                const item = new ItemRoom([
                    parseInt(reward.itemKind, 10),
                    parseInt(reward.itemNumber, 10) || 1,
                    Number.isNaN(durability) ? null : durability,
                    Number.isNaN(durabilityMax) ? null : durabilityMax,
                    parseInt(reward.itemExperience, 10) || 0
                ]);

                if (ItemTypes.isEquipment(item.itemKind)) {
                    if (!item.itemDurability) item.itemDurability = 900;
                    if (!item.itemDurabilityMax) item.itemDurabilityMax = 900;
                }

                player.items.inventory.putItem(item);
                msg = new Messages.Notify('CHAT', 'ITEM_ADDED', [
                    ItemData.Kinds[item.itemKind].name
                ]);
                player.sendPlayer(msg);
            }
            pquest.reward = 1;
            return true;
        }
        return false;
    }

    hasQuest(player) {
        for (const quest of player.quests.quests) {
            if (this.ownsQuest(player, quest)) {
                // FIX: this is the actual "already in progress, re-talk to
                // the NPC" path -- separate from acceptQuest()'s first-accept
                // path (see the FIX comment there for the full npcQuestId/
                // client "quest speech" story). A quest can reach this loop
                // still carrying a stale npcQuestId that predates that fix
                // entirely: one accepted under the old code and never
                // re-synced since, or one reloaded straight from a Redis
                // save written before this fix existed (handleLoadPlayerQuests
                // reconstructs the Quest verbatim from whatever was
                // persisted, npcQuestId included). ownsQuest() having just
                // confirmed this NPC instance really does own the quest
                // means this.entity.npcQuestId is the authoritative value
                // regardless of what's currently stored on it, so stamp it
                // here too -- every re-sync self-heals a stale value instead
                // of only fixing it going forward from a fresh accept.
                quest.npcQuestId = this.entity.npcQuestId;
                /*if (player.quests.hasNpcCompleteQuest(quest.npcQuestId)) {
            continue;
          }*/
                player.quests.progressQuest(quest);
                return true;
            }
        }

        for (const id in this.quests) {
            const quest = this.quests[id];

            // FIX: was player.quests.hasNpcCompleteQuest(quest.npcQuestId),
            // a kind-based check -- any completed quest from any same-kind
            // NPC would satisfy it, handing out this NPC's reward for a
            // different NPC's completed quest. giveReward() itself already
            // keys strictly off quest.id, so the gate here should too.
            if (player.quests.completeQuests.hasOwnProperty(quest.id)) {
                if (this.giveReward(player, quest)) {
                    return true;
                }
            }
        }
        return false;
    }

    getNextQuestId(player) {
        for (const qid in this.quests) {
            if (player.quests.completeQuests[qid]) continue;

            const pq = player.quests.getQuestById(qid);
            if (pq) continue;
            return qid;
        }
        return null;
    }

    sendNoQuest(player) {
        const entity = this.entity;
        if (entity.nextNpcDir) {
            const msg = new Messages.Dialogue(entity, 'QUESTS_NONE', [
                entity.nextNpcDir,
                entity.nextNpcName,
                entity.name
            ]);
            player.sendPlayer(msg);
        }
        else {
            const msg = new Messages.Dialogue(entity, 'QUESTS_NONE_2', [entity.name]);
            player.sendPlayer(msg);
        }
    }

    dynamicQuests(player) {
        if (this.hasQuest(player)) return;

        this.createQuest(player);
        return;
    }

    // FIX: `self` was referenced here without ever being declared/assigned
    // in this method -- a ReferenceError on every call. `this.entity` (used
    // consistently elsewhere in this class) is what was meant.
    getMobObject() {
        let entities = this.entity.map.entities.getMobsAround(this.entity, 35);
        if (entities.length === 0) return;

        const entitycount = Utils.GetGroupCountArray(entities, 'kind');
        console.warn('entitycount=' + JSON.stringify(entitycount));
        if (entitycount.length === 0) return null;
        log.info('entitycount=' + JSON.stringify(entitycount));
        entitycount.sort(function (a, b) {
            return b[1] - a[1];
        });
        log.info('entitycount=' + JSON.stringify(entitycount));
        const kind = parseInt(entitycount[0][0], 10);

        entities = entities.filter(function (entity) {
            return entity.kind === kind;
        });
        const minLevel = Utils.minProp(entities, 'level').level;

        const mobCount = parseInt(entitycount[0][1], 10);
        if (mobCount <= 0) return null;
        if (!MobData.Kinds[kind]) return null;

        return getQuestObject([
            Types.EntityTypes.MOB,
            kind,
            mobCount,
            0,
            minLevel,
            100
        ]);
    }

    createQuest(player) {
        const qTypes = [1, 2];
        //var qTypes = [2];
        const questType = qTypes[Utils.randomInt(qTypes.length - 1)];

        const pLvl = player.level;

        // TODO - FIX UP QUESTS FOR NEW STRUCTURE.
        if (questType === Types.QuestType.GETITEMKIND) {
            this.createQuestItemKind(player);
        }
        if (questType === Types.QuestType.KILLMOBKIND) {
            this.createQuestKillMobKind(player);
        }
    }

    createQuestItemKind(player) {
        console.info('GETITEMKIND');

        const itemKind = Utils.randomInt(ItemLootData.ItemLoot.length - 1);
        const id =
            '02' +
            Utils.pad(this.entity.kind, 6) +
            Utils.pad(this.questsCount++, 4);
        let quest = player.quests.getQuestById(id);
        if (!quest) {
            const mobObject = this.getMobObject();
            if (!mobObject) return;
            mobObject.count = 0;

            const itemCount = Utils.randomRangeInt(1, 5);
            const itemChance = (30 * itemCount) / (player.level + 2);
            const itemObject = getQuestObject([
                Types.EntityTypes.ITEMLOOT,
                itemKind,
                itemCount,
                itemChance
            ]);

            quest = new Quest([
                id,
                Types.QuestType.GETITEMKIND,
                this.entity.npcQuestId,
                0,
                0,
                0,
                0,
                mobObject,
                itemObject
            ]);
            //quest.entityId = this.entity.id;
            player.quests.foundQuest(quest);
        } else {
            quest.status = Types.QuestStatus.INPROGRESS;
            player.quests.questAboutItem(quest);
        }
    }

    createQuestKillMobKind(player) {
        console.info('KILLMOBKIND');

        const id =
            '01' +
            Utils.pad(this.entity.kind, 6) +
            Utils.pad(this.questsCount++, 4);
        let quest = player.quests.getQuestById(id);
        if (!quest) {
            const mobObject = this.getMobObject();
            if (!mobObject) return;
            const lw = 5;
            const lh = Math.max(player.level - 10, 10);
            //log.info("KILLMOBKIND - lh="+lh);
            mobObject.count = Utils.clamp(lw, lh, mobObject.count / 2);
            mobObject.count = Math.ceil(mobObject.count / 5) * 5;

            quest = new Quest([
                id,
                Types.QuestType.KILLMOBKIND,
                this.entity.npcQuestId,
                0,
                0,
                0,
                0,
                mobObject
            ]);
            //quest.entityId = this.entity.id;
            player.quests.foundQuest(quest);
        } else {
            quest.status = Types.QuestStatus.INPROGRESS;
            player.quests.progressQuest(quest);
        }
    }
}

export default EntityQuests;
