// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import Map from './map.js';
import MapEntities from './mapentities.js';
import MapEntityStore from './mapentitystore.js';

//var BlockArea = require("../area/blockarea");
// NOTE: TrapArea/TrapGroup (area/traparea.js, entity/trapgroup.js,
// entity/trap.js) are intentionally left unwired -- nothing in this file or
// elsewhere instantiates TrapArea, so the whole trap-damage system is
// currently inert. Beyond just being unwired, entity/trap.js's on()/off()
// also depend on Messages.SwapSprite, which is commented out in message.js
// (see the NOTE there), so re-enabling this feature needs both this import
// restored *and* that message type implemented/uncommented -- not something
// to flip back on without deciding the trap system is actually meant to
// ship.
//var TrapArea = require("../area/traparea");
//var TrapGroup = require("../entity/trapgroup");
import fs from 'fs';

// Map list: ./maps/maplist.json names every map by index ({"maps": ["map0", "map1", "map2", ...]}),
// including split maps' sections and interiors (written by tools/maps/generator/split.py). Every
// map is loaded from ./maps/<name>.json and set up the same way (addListedMap()). Without the
// file, maps 0-2 are loaded, as before.
const MAP_LIST_FILE = './maps/maplist.json';
const DEFAULT_MAPS = ['map0', 'map1', 'map2'];

// "warps" (optional): the map that "/warp <name>" (admins only) goes to for a split map, e.g. "/warp map4".
function readMapList() {
    try {
        const json = JSON.parse(fs.readFileSync(MAP_LIST_FILE, 'utf8'));
        return {
            maps: Array.isArray(json.maps) ? json.maps : [],
            warps: Array.isArray(json.warps) ? json.warps : []
        };
    } catch (err) {
        if (err.code !== 'ENOENT')
            console.error('MapManager: could not read ' + MAP_LIST_FILE + ': ' + err.message);
        return { maps: [], warps: [] };
    }
}

class MapManager {
    constructor(server) {
        const self = this;

        this.server = server;
        this.maps = {};
        this.mapCount = 0;
        this.id = 0;
        this.mapInstances = {};
        this.loaded = false;

        /**
         * Map Loading: every map in maps/maplist.json, by index (all
         * registered before any map finishes loading, so isMapsReady()
         * waits for them all).
         */
        const list = readMapList();
        const names = list.maps.length > 0 ? list.maps : DEFAULT_MAPS;
        names.forEach(function (name, id) {
            if (!name) return;
            self.addListedMap(id, name);
        });

    }

    // A map from maps/maplist.json: its own entities, the entities from its JSON and from
    // data/maps/<name>/entity.json (NPCs, admin-placed entities), then its mob and entity areas
    // (data/maps/<name>/entityarea.json, written by the map converter), and random start
    // positions. (map1's Old Man and ring NPCs are in data/maps/map1/entity.json; its JSON's own
    // entities list only holds an old type-0 Old Man, which createEntity() ignores.)
    addListedMap(id, name) {
        const self = this;
        this.maps[id] = new Map(this.server, id, name, './maps/' + name + '.json', '');
        this.maps[id].ready(function () {
            const map = self.maps[id];
            map.entities = new MapEntities(
                self.id,
                self.server,
                map
            );
            map.entities.mapready();
            // data/maps/<name>/entity.json first: each of its records has a fixed "id" and is
            // spawned with exactly that entity id (MapEntityStore.load()), the id (with the map
            // index) that an NPC's npcQuestId and its lang.json NO_MORE_QUESTS line are keyed on.
            // Then the map file's own entities and the mob/entity areas, numbered on from the
            // highest fixed id.
            self.loadSavedEntities(map);
            map.entities.spawnEntities(map);
            map.initMobAreas(map.mobAreasData);
            map.initEntityAreas(map.entityAreasData);
            map.enterCallback = function (player) {
                return map.getRandomStartingPosition();
            };
            self.MapsReady();
        });
    }

    loadSavedEntities(map) {
        map.entityStore = new MapEntityStore(map);
        map.entityStore.load();
    }

    MapsReady() {
        this.mapCount++;
        console.info('mapCount=' + this.mapCount);
        if (this.isMapsReady() && !this.loaded) {
            //console.info(JSON.stringify(this.maps));
            console.info('maps ready');
            this.readyFunc();
            this.loaded = true;
        }
    }

    isMapsReady() {
        console.info('Maps Length: ' + Object.keys(this.maps).length);
        return this.mapCount === Object.keys(this.maps).length;
    }

    onMapsReady(readyFunc) {
        this.readyFunc = readyFunc;
    }
}

export default MapManager;
