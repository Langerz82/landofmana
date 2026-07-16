import EntityMoving from '../entity/entitymoving.js';
import Messages from '../message.js';
import AchievementJson from '../../data/achievements.json' with { type: 'json' };
import { Types } from '../common.js';
// FIX: processAchievement() below calls Utils.getNumShortHand() but Utils
// was never imported -- threw ReferenceError every time a player completed
// an achievement rank.
import Utils from '../utils.js';

/* global log */

//var AchievementData = AchievementJson;

export function getAchievementObject(arr) {
    const self = {};
    self.toArray = function (obj) {
        return [
            obj.index,
            obj.data.type,
            obj.rank,
            obj.data.objectType,
            obj.data.objectKind,
            obj.count,
            obj.data.objectCount[obj.rank]];
    };
    self.toClient = function (obj) {
        return obj.toArray(obj);
    };
    self.toRedis = function (obj) {
        return [obj.index, obj.rank, obj.count];
    };

    if (!arr) return self;
    self.index = parseInt(arr[0]);
    self.rank = parseInt(arr[1]);
    self.count = parseInt(arr[2]);
    self.data = arr[3];
    return self;
}

// NOTE: `data` was a bare (undeclared) assignment in the original CommonJS
// source, which created an implicit global there; declared with `var` here
// since ES modules are always strict mode and forbid implicit globals.
export function getSavedAchievement(arr) {
    const data = [arr[0], arr[1], arr[2], AchievementJson[arr[0]]];
    const achievement = Object.assign(getAchievementObject(data), null);
    return achievement;
}

// NOTE: `data` was a bare (undeclared) assignment in the original CommonJS
// source, which created an implicit global there; declared with `var` here
// since ES modules are always strict mode and forbid implicit globals.
export function getInitAchievements() {
    const achievements = [];
    const len = AchievementJson.length;
    for (let i=0; i < len; ++i)
    {
        const data = [i, 0, 0, AchievementJson[i]];
        const achievement = Object.assign(getAchievementObject(data), null);
        achievements.push(achievement);
    }
    console.info("achievements: "+JSON.stringify(achievements));
    return achievements;
}

export function PlayerEvent(eventType, object, count) {
    const playerEvent = {};
    playerEvent.eventType = eventType;
    playerEvent.object = object;
    playerEvent.count = count;
    return playerEvent;
}

// PERF: these 5 condition checks used to be anonymous closures allocated
// fresh on every single processEvent() call (once per KILLMOB/DAMAGE/
// LOOTITEM/USE_NODE/HARVEST event -- see callbacks/mobcallback.js's
// per-kill calls, and per-loot/per-harvest elsewhere), regardless of
// whether any achievement in the player's list actually matched. None of
// them close over anything but their own (achievement, event) parameters
// plus `player` (only used by the USE_NODE/HARVEST checks, for
// hasWeaponType), so they're hoisted here to module scope and built once,
// with `player` passed in as an explicit third argument instead of being
// captured.
const isKillMobAchievement = (achievement, event) =>
    (achievement.data.type === Types.EventType.KILLMOB &&
        (achievement.data.objectKind === 0 || achievement.data.objectKind === event.object.kind));

const isLootItemAchievement = (achievement, event) =>
    (achievement.data.type === Types.EventType.LOOTITEM && event.object.hasOwnProperty("enemyDrop"));

const isDamageAchievement = (achievement, event) =>
    (achievement.data.type === Types.EventType.DAMAGE);

const isUseNodeWeaponAchievement = (achievement, event, player) => {
    if (achievement.data.type === Types.EventType.USE_NODE) {
        const wtype = event.object.weaponType;
        return (player.items.hasWeaponType(wtype) && wtype === achievement.data.data1);
    }
    return false;
};

const isHarvestAxeAchievement = (achievement, event, player) => {
    if (achievement.data.type === Types.EventType.HARVEST) {
        const wtype = event.object.weaponType;
        return (player.items.hasWeaponType(wtype) && wtype === "axe");
    }
    return false;
};

//   {"type": 1, "rank": 1, "objectType": 2, "objectKind": 0, "count": 10},
class TaskHandler {
    // NOTE: was `const i=0;` here, unused -- dead even under the old `var i=0;`
    // this was ported from (nothing in the constructor ever read it).
    constructor() {
        this.data = AchievementJson;
    }

    processEvent(player, playerEvent) {
        const quests = player.quests;
        switch (playerEvent.eventType) {
        case Types.EventType.KILLMOB:
            const target = playerEvent.object;
            target.questDrops = {};
            quests.forQuestsType(Types.QuestType.KILLMOBKIND, function (quest) {
                quests.questAboutKill(target, quest);
            });
            quests.forQuestsType(Types.QuestType.GETITEMKIND, function (quest) {
                quests.questAboutItemCheck(target, quest);
            });
            break;
        case Types.EventType.LOOTITEM:
            quests.forQuestsType(Types.QuestType.GETITEMKIND, function (quest) {
                if (quest.object2.kind === (playerEvent.object.kind-1000)) {
                    quests.questAboutItem(quest);
                }
            });
            break;
        case Types.EventType.USE_NODE:
            quests.forQuestsType(Types.QuestType.USENODE, function (quest) {
                if (quest.object.kind === playerEvent.object.kind && quest.data1 === playerEvent.object.level)
                    quests.questAboutUseNode(quest);
            });
            break;
        }

        // PERF: was `for (const achievement of player.achievements)`, with
        // processAchievement() below recovering the achievement's index via
        // `player.achievements.indexOf(achievement)` -- an O(n) linear scan
        // repeated on every one of the 5 processAchievement() calls per
        // achievement per event (so O(n^2) overall across a player's whole
        // achievement list, up to achievementIndexMax=99 entries per
        // format.js). .entries() keeps the same for-of shape as the
        // original while handing back the index for free, same as a plain
        // indexed loop would.
        // FIX: isUseNodeWeaponAchievement was listed twice (identical args),
        // so every USE_NODE event double-processed that one achievement --
        // double-counting its progress and double-paying its XP reward.
        // Removed the duplicate call; only 5 distinct conditions are defined
        // above, so there was no missing 6th check to restore.
        for (const [ti, achievement] of player.achievements.entries()) {
            this.processAchievement(player, playerEvent, achievement, ti, isKillMobAchievement, 2);
            this.processAchievement(player, playerEvent, achievement, ti, isLootItemAchievement, 5);
            this.processAchievement(player, playerEvent, achievement, ti, isDamageAchievement, 0.02);
            this.processAchievement(player, playerEvent, achievement, ti, isUseNodeWeaponAchievement, 5);
            this.processAchievement(player, playerEvent, achievement, ti, isHarvestAxeAchievement, 5);
        }
    }

    processAchievement(player, event, achievement, ti, condition, expMultiplier) {
        if (event.eventType !== achievement.data.type)
            return;

        if (!condition(achievement, event, player))
            return;

        // FIX: was `ti < 0 || ti >= achievement.data.objectCount.length` --
        // `ti` is this achievement's index in the player's whole
        // achievement *list* (from the .entries() loop above), which has
        // nothing to do with `achievement.data.objectCount`, the per-rank
        // threshold array for this one achievement. The very next line
        // indexes that same array with `achievement.rank`, which is
        // clearly what this bounds check is meant to guard -- comparing
        // the unrelated `ti` instead only avoided throwing by coincidence
        // (every achievement so far happens to sit at a list index smaller
        // than its own objectCount.length). Any achievement added later
        // whose objectCount array is shorter than its position in the
        // list would have silently stopped processing forever; any
        // achievement whose `rank` legitimately reached objectCount.length
        // would throw here instead of being caught.
        if (achievement.rank < 0 || achievement.rank >= achievement.data.objectCount.length)
            return;

        let count = event.count;
        let objectCount = achievement.data.objectCount[achievement.rank];
        const rankCount = achievement.data.objectCount.length;

        if ((achievement.count + count) < objectCount) {
            achievement.count += count;
        }
        else {

            if (achievement.rank === (rankCount-1) && achievement.count === objectCount)
            {
                return;
            }

            while (count > 0) {
                objectCount = achievement.data.objectCount[achievement.rank];
                const prevCount = achievement.count;
                const diff = (achievement.count+count);
                achievement.count = Math.min(diff, objectCount);
                count -= (objectCount-prevCount);
                player.sendPlayer(new Messages.Achievement(achievement));

                const xp = ~~(objectCount * expMultiplier);
                const chatAchievement = "ACHIEVEMENTS_"+ti+"_COMPLETE";
                const objectCountFmt = Utils.getNumShortHand(objectCount, 0);

                player.incExp(xp);
                player.sendPlayer(new Messages.Notify("CHAT", chatAchievement, [objectCountFmt, xp]));
                if (achievement.rank === (rankCount-1) && achievement.count === objectCount)
                {
                    return;
                }

                achievement.rank++;
                if (count < objectCount) {
                    achievement.count = count;
                    count = 0;
                }
            }
        }
        player.sendPlayer(new Messages.Achievement(achievement));
    }
}

export default TaskHandler;
