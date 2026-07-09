// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global Types */
import fetchJsonSync from './fetchjsonsync.js';

var NpcData = {};
NpcData.npcSpeak = fetchJsonSync('shared/data/npc_english.json');

NpcData.Properties = {};
NpcData.Kinds = fetchJsonSync('shared/data/npcs.json');
NpcData.Kinds.forEach(function(value, key) {
    value.title = value.name || value.uid;
    NpcData.Properties[value.uid] = value;
});

NpcData.isNpc = function(kind) {
    return NpcData.Kinds[kind] ? true : false;
};

export default NpcData;
