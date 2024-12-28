var cls = require("./lib/class"),
  EntityMoving = require("./entity/entitymoving"),
  Messages = require("./message"),
  AchievementJson = require("../shared/data/achievements.json");

//var AchievementData = AchievementJson;

module.exports.getAchievementObject = getAchievementObject = function(arr) {
  var self = {};
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
};

module.exports.getSavedAchievement = getSavedAchievement = function (arr) {
  data = [arr[0], arr[1], arr[2], AchievementJson[arr[0]]];
  var achievement = Object.assign(getAchievementObject(data), null);
  return achievement;
};

module.exports.getInitAchievements = getInitAchievements = function () {
  var achievements = [];
  var len = AchievementJson.length;
  for (var i=0; i < len; ++i)
  {
    data = [i, 0, 0, AchievementJson[i]];
    var achievement = Object.assign(getAchievementObject(data), null);
    achievements.push(achievement);
  }
  log.info("achievements: "+JSON.stringify(achievements));
  return achievements;
};

module.exports.PlayerEvent = PlayerEvent = function (eventType, object, count) {
    var playerEvent = {};
    playerEvent.eventType = eventType;
    playerEvent.object = object;
    playerEvent.count = count;
    return playerEvent;
};

//   {"type": 1, "rank": 1, "objectType": 2, "objectKind": 0, "count": 10},
module.exports = TaskHandler = cls.Class.extend({
  init: function() {
    var i=0;
    this.data = AchievementJson;
  },

  processEvent: function(player, playerEvent) {
    switch (playerEvent.eventType) {
      case EventType.KILLMOB:
        var target = playerEvent.object;
        target.questDrops = {};
        for (var quest of player.quests) {
          player.questAboutKill(target, quest);

          if (quest.type == QuestType.GETITEMKIND) {
            var lootKind = quest.object2.kind+1000;
            if (quest.object2.type == Types.EntityTypes.ITEMLOOT &&
                quest.object.type == Types.EntityTypes.MOB &&
                quest.object.kind == target.kind &&
                quest.status != QuestStatus.COMPLETE &&
                (quest.count < quest.object2.count || player.inventory.hasItemCount(lootKind) < quest.object2.count))
            {
                target.questDrops[lootKind] = parseInt(quest.object2.chance*10);
                quest.object2.chance += 1;
            }
          }
        }
        break;
      case EventType.LOOTITEM:
        for (var quest of player.quests) {
          //var quest = player.quests[q];
          if (quest.type == QuestType.GETITEMKIND && quest.object2.kind == (playerEvent.object.kind-1000)) {
            player.questAboutItem(quest);
          }
        }
        break;
      case EventType.USE_NODE:
        for (var quest of player.quests) {
          //var quest = player.quests[q];
          if (quest.type == QuestType.USENODE && quest.object.kind == playerEvent.object.kind && quest.data1 == playerEvent.object.level)
            player.questAboutUseNode(quest);
        }
        break;
    }

    for (var achievement of player.achievements) {
      this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
        return (achievement.data.type == EventType.KILLMOB &&
            (achievement.data.objectKind == 0 || achievement.data.objectKind == event.object.kind));
      }, 15);
      this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
        return (achievement.data.type == EventType.LOOTITEM && event.object.hasOwnProperty("enemyDrop"));
      }, 25);
      this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
        return (achievement.data.type == EventType.DAMAGE);
      }, 0.25);
      this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
        if (achievement.data.type == EventType.USE_NODE) {
          var wtype = event.object.weaponType;
          return (player.hasWeaponType(wtype) && wtype == achievement.data.data1);
        }
        return false;
      }, 10);
      this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
        if (achievement.data.type == EventType.HARVEST) {
          var wtype = event.object.weaponType;
          return (player.hasWeaponType(wtype) && wtype == "axe");
        }
        return false;
      }, 10);
      this.processAchievement(player, playerEvent, achievement, function (achievement, event) {
        if (achievement.data.type == EventType.USE_NODE) {
          var wtype = event.object.weaponType;
          return (player.hasWeaponType(wtype) && wtype == achievement.data.data1);
        }
        return false;
      }, 10);

    }
  },

  processAchievement: function (player, event, achievement, condition, expMultiplier) {
    if (event.eventType != achievement.data.type)
      return;

    if (!condition(achievement, event))
      return;

    var ti = player.achievements.indexOf(achievement);
    if (ti < 0 || ti >= achievement.data.objectCount.length)
      return;

    var count = event.count;
    var objectCount = achievement.data.objectCount[achievement.rank];
    var rankCount = achievement.data.objectCount.length;

    if ((achievement.count + count) < objectCount) {
      achievement.count += count;
    }
    else {

      if (achievement.rank == (rankCount-1) && achievement.count == objectCount)
      {
        return;
      }

      while (count > 0) {
        objectCount = achievement.data.objectCount[achievement.rank];
        var prevCount = achievement.count;
        var diff = (achievement.count+count);
        achievement.count = Math.min(diff, objectCount);
        count -= (objectCount-prevCount);
        player.map.entities.pushToPlayer(player, new Messages.Achievement(achievement));

        var xp = ~~(objectCount * expMultiplier);
        var chatAchievement = "ACHIEVEMENTS_"+ti+"_COMPLETE";
        var objectCountFmt = objectCount;
        if (objectCount >= 1000000)
          objectCountFmt = Number(objectCount / 1000000).toFixed(1).replace(/[.,]0$/, "")+"M";
        else if (objectCount >= 1000)
          objectCountFmt = Number(objectCount / 1000).toFixed(1).replace(/[.,]0$/, "")+"K";
        player.map.entities.pushToPlayer(player, new Messages.Notify("CHAT", chatAchievement, [objectCountFmt, xp]));
        if (achievement.rank == (rankCount-1) && achievement.count == objectCount)
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
    player.map.entities.pushToPlayer(player, new Messages.Achievement(achievement));
  },


});
