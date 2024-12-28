var Utils = require("../utils"),
    Quest = require("../quest"),
    QuestsJson = require("../../shared/data/quests.json");

var QuestData = {};
var QuestNpcData = {};

for (var id in QuestsJson) {
  var data = QuestsJson[id];
  console.info("data:"+JSON.stringify(data));
  var quest = {};
  quest.id = id;
  quest.npcQuestId = data.npcKind;
  quest.raw = data;
  quest.npcKind = data.npcKind;
  quest.type = data.type;
  quest.level = data.level;
  quest.data1 = data.data1 || 0;
  quest.data2 = data.data2 || 0;
  quest.count = 0;
  quest.status = 0;
  if (data.object) {
    quest.object = getQuestObject([data.object.type, data.object.kind,
      data.object.count || 0,
      data.object.chance || 0,
      data.object.level || [0,99]]);
  }
  if (data.object2) {
    quest.object2 = getQuestObject([data.object2.type, data.object2.kind,
      data.object2.count || 0,
      data.object2.chance || 0,
      data.object2.level || [0,99]]);
  }

  var questObject = Object.assign(new Quest, quest);
  //questObject.assign(quest);

  QuestData[quest.id] = questObject;

  if (!QuestNpcData[quest.npcKind])
    QuestNpcData[quest.npcKind] = [];
  QuestNpcData[quest.npcKind].push(questObject);
}

console.info(JSON.stringify(QuestNpcData));
//console.info(QuestData);
module.exports.Data = QuestData;
module.exports.NpcData = QuestNpcData;
