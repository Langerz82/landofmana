var _ = require('underscore'),
		NPCsJSON = require("../../shared/data/npcs.json"),
		NPCspeak = require("../../shared/data/npc_english.json"),
		NPCnames = require("../../shared/data/npc_names_eng.json");

var Properties = {};
var Kinds = NPCsJSON;
_.each( Kinds, function( value, key ) {
	Properties[value.uid] = {
		uid: value.uid,
		kind: key,
		name: value.name ? value.name : value.uid
	};
});

var isNpc = function(kind){

    return Kinds[kind] ? true : false;
};

module.exports.Properties = Properties;
module.exports.Kinds = Kinds;
module.exports.isNpc = isNpc;

module.exports.NPCnames = NPCnames;
