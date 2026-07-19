// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types */
import fetchJsonSync from '../lib/fetchjsonsync.js';

const padding = (val, size) => String(val).padStart(size, "0");

const QuestData = {};
const data = fetchJsonSync('shared/data/quests.json');

let i = 0;
Object.values(data).forEach((quest) => {
    const id = padding(quest.type, 2) + padding(quest.npcId, 4) + padding(i, 3);
    QuestData[id] = quest;
    QuestData[id].id = id;
    QuestData[id].objectId = quest.objectId || 0;
    QuestData[id].objectCount = quest.objectCount || 0;
    i++;
});

export default QuestData;
