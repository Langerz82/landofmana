import _ from 'underscore';
import NPCsJSON from "../../shared/data/npcs.json" with { type: 'json' };
import NPCnames from "../../shared/data/npc_names_eng.json" with { type: 'json' };

const Properties = {};
const Kinds = NPCsJSON;
_.each( Kinds, function( value, key ) {
	Properties[value.uid] = {
		uid: value.uid,
		kind: key,
		name: value.name ? value.name : value.uid
	};
});

const isNpc = function(kind){

    return Kinds[kind] ? true : false;
};

export { Properties, Kinds, isNpc, NPCnames };
export default { Properties, Kinds, isNpc, NPCnames };
