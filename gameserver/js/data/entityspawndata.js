var SpawnJson = require("../../shared/data/entity_spawn.json"),
    fs = require('fs');


var EntitySpawnData = [];

var i=0;
//console.info(QuestsJson);
_.each( SpawnJson, function( value, key ) {
	EntitySpawnData[i++] = value;
});

var addSpawn = function (id, x, y) {
    //console.info("addSpawn");
    EntitySpawnData.push({"id": id, "x": x, "y": y});
};

var saveSpawns = function() {
	//console.info(JSON.stringify(EntitySpawnData));
	fs.writeFile("./shared/data/entity_spawn.json", JSON.stringify(EntitySpawnData), function (err,data) {
		if (err) {
			return console.info(err);
		}
		//console.info(data);
	});
};


//console.info(QuestData);
module.exports.EntitySpawnData = EntitySpawnData;
module.exports.addSpawn = addSpawn;
module.exports.saveSpawns = saveSpawns;
