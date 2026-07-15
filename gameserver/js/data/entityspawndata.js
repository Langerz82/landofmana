import _ from 'underscore';
import SpawnJson from "../../data/entity_spawn.json" with { type: 'json' };
import fs from 'fs';


const EntitySpawnData = [];

let i=0;
//console.info(QuestsJson);
_.each( SpawnJson, function( value, key ) {
	EntitySpawnData[i++] = value;
});

export function addSpawn(id, x, y) {
    //console.info("addSpawn");
    EntitySpawnData.push({"id": id, "x": x, "y": y});
};

export function saveSpawns() {
	//console.info(JSON.stringify(EntitySpawnData));
	fs.writeFile("../../data/entity_spawn.json", JSON.stringify(EntitySpawnData), function (err,data) {
		if (err) {
			return console.info(err);
		}
		//console.info(data);
	});
};


//console.info(QuestData);
export { EntitySpawnData };
export default { EntitySpawnData, addSpawn, saveSpawns };
