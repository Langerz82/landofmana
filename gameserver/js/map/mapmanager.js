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

// Map list: ./maps/maplist.json names every map by index ({"maps": ["map0", "map1", "map2", ...]}).
// Maps 0-2 are set up by hand below; every further map in the list (e.g. map4's sections and its
// interiors, written by tools/maps/generator/map4gen/split4.py) is loaded from ./maps/<name>.json
// and set up the same way as map2. Without the file only maps 0-2 are loaded, as before.
const MAP_LIST_FILE = './maps/maplist.json';
const FIXED_MAPS = 3;

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
         * Map Loading
         */

        this.maps[0] = new Map(server, 0, 'map0', './maps/map0.json', '');
        this.maps[0].ready(function () {
            const map = self.maps[0];

            map.entities = new MapEntities(
                self.id,
                self.server,
                map,
                self.server.database
            );
            map.entities.mapready();

            // NPCs and other placed entities spawn BEFORE the mob/entity
            // areas: entity ids come from a per-map counter in spawn order,
            // and the areas spawn a varying number of entities each start
            // (a spot can't always be found), so anything spawned after them
            // got a different id on every restart. Spawned first, an NPC's
            // id only depends on the map file / entity.json order -- the
            // id (with the map index) that its npcQuestId and its lang.json
            // NO_MORE_QUESTS line are keyed on.
            map.entities.spawnEntities(map);
            // Entities from data/maps/<map name>/entity.json (including
            // ones admins placed with /spawn).
            self.loadSavedEntities(map);

            // FIX: was `map.initMobAreas(thismap.mobAreas)` called eagerly
            // inside Map.initMap(), before `map.entities` existed -- see the
            // FIX comment in map.js's initMap(). Deferred to here, now that
            // `map.entities` is assigned above.
            map.initMobAreas(map.mobAreasData);
            map.initEntityAreas(map.entityAreasData);

            map.enterCallback = function (player) {
                const pos = map.getRandomStartingPosition();
                return pos;
            };
            self.MapsReady();
        });

        self.maps[1] = new Map(server, 1, 'map1', './maps/map1.json', '');
        self.maps[1].ready(function () {
            const map = self.maps[1];

            map.entities = new MapEntities(
                self.id,
                self.server,
                map,
                self.server.database
            );
            map.entities.mapready();

            // map1's spiral of rings around the Old Man used to be built
            // here in code. All of it now lives in data files, like every
            // other map:
            // - mob areas (the centre area plus, per ring, a 40-tile
            //   area, a tougher 20-tile area and a 10-tile boss area, each
            //   spawning the mob kind for its level) and entity areas (ore
            //   nodes and chests): the mobareas/entityareas layers of
            //   tools/maps/data/map1.json -> maps/map1.json;
            // - the walking NPCs (the Old Man and one per ring, with their
            //   quests): data/maps/map1/entity.json, loaded by
            //   loadSavedEntities(); their "no more quests, head <dir> and
            //   look for <next NPC>" lines are in lang.json's
            //   NO_MORE_QUESTS, under map index 1 and their entity ids
            //   (1 = the Old Man, 2-57 = rings 1-56).
            // map.entities.spawnEntities() stays off for map1, as before:
            // maps/map1.json's own entities list only has an old,
            // superseded copy of the Old Man.
            // NPCs and other placed entities spawn BEFORE the mob/entity
            // areas: entity ids come from a per-map counter in spawn order,
            // and the areas spawn a varying number of entities each start
            // (a spot can't always be found), so anything spawned after them
            // got a different id on every restart. Spawned first, an NPC's
            // id only depends on the map file / entity.json order -- the
            // id (with the map index) that its npcQuestId and its lang.json
            // NO_MORE_QUESTS line are keyed on.
            self.loadSavedEntities(map);

            map.initMobAreas(map.mobAreasData);
            map.initEntityAreas(map.entityAreasData);

            map.enterCallback = function (player) {
                const pos = map.getRandomStartingPosition();
                return pos;
            };
            self.MapsReady();
        });

        this.maps[2] = new Map(server, 2, 'map2', './maps/map2.json', '');
        this.maps[2].ready(function () {
            const map = self.maps[2];

            map.entities = new MapEntities(
                self.id,
                self.server,
                map,
                self.server.database
            );
            map.entities.mapready();

            //map.entities.spawnEntities(map);
            // FIX: see the matching FIX comment on map.maps[0]'s ready()
            // callback above -- this used to fire too early, inside
            // Map.initMap(), before `map.entities` existed.
            // NPCs and other placed entities spawn BEFORE the mob/entity
            // areas: entity ids come from a per-map counter in spawn order,
            // and the areas spawn a varying number of entities each start
            // (a spot can't always be found), so anything spawned after them
            // got a different id on every restart. Spawned first, an NPC's
            // id only depends on the map file / entity.json order -- the
            // id (with the map index) that its npcQuestId and its lang.json
            // NO_MORE_QUESTS line are keyed on.
            map.entities.spawnEntities(map);
            // Entities from data/maps/<map name>/entity.json (including
            // ones admins placed with /spawn).
            self.loadSavedEntities(map);
            map.initMobAreas(map.mobAreasData);
            map.initEntityAreas(map.entityAreasData);

            map.enterCallback = function (player) {
                const pos = map.getRandomStartingPosition();
                return pos;
            };
            self.MapsReady();
        });

        // every further map in maps/maplist.json (all registered before any map finishes
        // loading, so isMapsReady() waits for them too)
        const list = readMapList();
        list.maps.forEach(function (name, id) {
            if (id < FIXED_MAPS || !name) return;
            self.addListedMap(id, name);
        });

    }

    // A map from maps/maplist.json, set up like map2: its own entities, the mob/entity areas
    // from its JSON, its spawns, admin-placed entities and random start positions.
    addListedMap(id, name) {
        const self = this;
        this.maps[id] = new Map(this.server, id, name, './maps/' + name + '.json', '');
        this.maps[id].ready(function () {
            const map = self.maps[id];
            map.entities = new MapEntities(
                self.id,
                self.server,
                map,
                self.server.database
            );
            map.entities.mapready();
            // NPCs/entities first, for stable entity ids (see map0 above).
            map.entities.spawnEntities(map);
            self.loadSavedEntities(map);
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
