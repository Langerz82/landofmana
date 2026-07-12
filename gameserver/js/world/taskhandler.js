import EntityMoving from '../entity/entitymoving.js';
import Messages from '../message.js';
import AchievementJson from '../../shared/data/achievements.json' with { type: 'json' };
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

//   {"type": 1, "rank": 1, "objectType": 2, "objectKind": 0, "count": 10},
class TaskHandler {
    constructor() {
        const i=0;
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

        for (const achievement of player.achievements) {
            this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
                return (achievement.data.type === Types.EventType.KILLMOB &&
                    (achievement.data.objectKind === 0 || achievement.data.objectKind === event.object.kind));
            }, 2);
            this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
                return (achievement.data.type === Types.EventType.LOOTITEM && event.object.hasOwnProperty("enemyDrop"));
            }, 5);
            this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
                return (achievement.data.type === Types.EventType.DAMAGE);
            }, 0.02);
            this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
                if (achievement.data.type === Types.EventType.USE_NODE) {
                    const wtype = event.object.weaponType;
                    return (player.items.hasWeaponType(wtype) && wtype === achievement.data.data1);
                }
                return false;
            }, 5);
            this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
                if (achievement.data.type === Types.EventType.HARVEST) {
                    const wtype = event.object.weaponType;
                    return (player.items.hasWeaponType(wtype) && wtype === "axe");
                }
                return false;
            }, 5);
            this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
                if (achievement.data.type === Types.EventType.USE_NODE) {
                    const wtype = event.object.weaponType;
                    return (player.items.hasWeaponType(wtype) && wtype === achievement.data.data1);
                }
                return false;
            }, 5);

        }
    }

    processAchievement(player, event, achievement, condition, expMultiplier) {
        if (event.eventType !== achievement.data.type)
            return;

        if (!condition(achievement, event))
            return;

        const ti = player.achievements.indexOf(achievement);
        if (ti < 0 || ti >= achievement.data.objectCount.length)
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
