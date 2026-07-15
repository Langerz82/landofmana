// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types, _ */
import fetchJsonSync from '../lib/fetchjsonsync.js';

const padding = function(val, size) {
    let s = val + "";
    while (s.length < size) s = "0" + s;
    return s;
}

const QuestData = {};
const data = fetchJsonSync('shared/data/quests.json');

let i = 0;
_.each(data, function(quest, key) {
    const id = padding(quest.type, 2) + padding(quest.npcId, 4) + padding(i, 3);
    QuestData[id] = quest;
    QuestData[id].id = id;
    QuestData[id].objectId = quest.objectId || 0;
    QuestData[id].objectCount = quest.objectCount || 0;
    i++;
});

export default QuestData;
