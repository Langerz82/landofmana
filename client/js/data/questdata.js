// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types, _ */
import fetchJsonSync from './fetchjsonsync.js';

var padding = function(val, size) {
    var s = val + "";
    while (s.length < size) s = "0" + s;
    return s;
}

var QuestData = {};
var data = fetchJsonSync('shared/data/quests.json');

var i = 0;
_.each(data, function(quest, key) {
    var id = padding(quest.type, 2) + padding(quest.npcId, 4) + padding(i, 3);
    QuestData[id] = quest;
    QuestData[id].id = id;
    QuestData[id].objectId = quest.objectId || 0;
    QuestData[id].objectCount = quest.objectCount || 0;
    i++;
});

export default QuestData;
