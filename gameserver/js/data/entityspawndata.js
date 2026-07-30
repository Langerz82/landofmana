import _ from 'underscore';
import SpawnJson from '../../data/entity_spawn.json' with { type: 'json' };
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// FIX: saveSpawns() below used to call fs.writeFile('../../data/entity_
// spawn.json', ...) -- a plain relative path, which Node's fs functions
// resolve against process.cwd(), NOT the importing module's directory
// (unlike the ES module `import` above, whose relative specifier IS always
// resolved against this file's own location). This server is normally
// launched from the gameserver/ root (cwd = gameserver/, per package.json's
// "main": "js/main.js"), so '../../data/entity_spawn.json' relative to cwd
// resolves two directories above gameserver/ entirely -- outside the repo,
// not the gameserver/data/entity_spawn.json the matching `import` above
// correctly reads from. Resolving explicitly off this module's own
// location (mirroring main.js's __dirname setup) makes the write always
// land next to the file the import reads, regardless of launch directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPAWN_DATA_PATH = path.join(__dirname, '../../data/entity_spawn.json');

const EntitySpawnData = [];

let i = 0;
//console.info(QuestsJson);
_.each(SpawnJson, function (value, key) {
    EntitySpawnData[i++] = value;
});

export function addSpawn(id, x, y) {
    //console.info("addSpawn");
    EntitySpawnData.push({ id: id, x: x, y: y });
}

export function saveSpawns() {
    //console.info(JSON.stringify(EntitySpawnData));
    fs.writeFile(
        SPAWN_DATA_PATH,
        JSON.stringify(EntitySpawnData),
        function (err, data) {
            if (err) {
                return console.info(err);
            }
            //console.info(data);
        }
    );
}

//console.info(QuestData);
export { EntitySpawnData };
export default { EntitySpawnData, addSpawn, saveSpawns };
