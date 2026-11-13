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

// Map list: ./maps/maplist.json groups every map's files under the map's name, in sub-index order:
//   {"maps": {"map0": ["map0"], "map1": ["map1/map1_0_0", ..., "map1/map1_int"], "map3": ["map3"], ...}}
// (split maps' sections and interiors are written by tools/maps/generator/split.py). A file's map
// index is its map's number x 100 + its sub-index: map1/map1_3_0 (map1's 4th file) is 103, map3 is
// 300, map0 is 0. Doors (tmap) and teleports use that index. Quest ids (questid.js) and saved player
// positions use the map's base index (its number x 100: 100 for every part of map1) and full-map
// positions instead, so they don't change when a map is split differently (map/mapgroup.js). Every file
// is loaded from ./maps/<name>.json and set up the same way (addListedMap()). Without the list file,
// map0 and map3 are loaded.
const MAP_LIST_FILE = './maps/maplist.json';
import { MAP_INDEX_STRIDE } from './mapgroup.js';   // most files one map can have (sub-indexes 0-99)
export { MAP_INDEX_STRIDE };
const DEFAULT_MAPS = { map0: ['map0'], map3: ['map3'] };

// A map list's "maps" -> { index: file name }. Also takes the older flat list (["map0", "map1", ...],
// index = position).
export function flattenMapList(maps) {
    const out = {};
    if (Array.isArray(maps)) {
        maps.forEach(function (name, i) {
            if (name) out[i] = name;
        });
        return out;
    }
    for (const group in maps || {}) {
        const m = /^map(\d+)$/.exec(group);
        const files = maps[group];
        if (!m || !Array.isArray(files)) {
            console.error('MapManager: map list group "' + group + '" is not "map<number>": [files]; skipped.');
            continue;
        }
        if (files.length > MAP_INDEX_STRIDE)
            console.error('MapManager: ' + group + ' has ' + files.length + ' files; only the first ' + MAP_INDEX_STRIDE + ' get an index.');
        files.slice(0, MAP_INDEX_STRIDE).forEach(function (name, sub) {
            if (name) out[Number(m[1]) * MAP_INDEX_STRIDE + sub] = name;
        });
    }
    return out;
}

// "warps" (optional): the map that "/warp <name>" (admins only) goes to for a split map, e.g. "/warp map2".
function readMapList() {
    try {
        const json = JSON.parse(fs.readFileSync(MAP_LIST_FILE, 'utf8'));
        return {
            maps: flattenMapList(json.maps),
            warps: Array.isArray(json.warps) ? json.warps : []
        };
    } catch (err) {
        if (err.code !== 'ENOENT')
            console.error('MapManager: could not read ' + MAP_LIST_FILE + ': ' + err.message);
        return { maps: {}, warps: [] };
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
        const names = Object.keys(list.maps).length > 0 ? list.maps : flattenMapList(DEFAULT_MAPS);
        this.mapNames = names;   // { index: file name }
        this.warps = list.warps;
        for (const id in names) self.addListedMap(Number(id), names[id]);

    }

    // A map from maps/maplist.json: its own entities, the entities from its JSON and from
    // data/maps/<map>/entity.json (NPCs, admin-placed entities), then its mob and entity areas
    // (data/maps/<map>/entityarea.json). A split map's parts share one of each, in full-map
    // coordinates, and each part takes what lies inside it (map/mapgroup.js). Then random start
    // positions. (map3's Old Man and ring NPCs -- the map at index 1, formerly map1 -- are in data/maps/map3/entity.json; its JSON's own
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
            // data/maps/<map>/entity.json first: each of its records has a fixed "id" and is
            // spawned with exactly that entity id (MapEntityStore.load()), the id (with the map's
            // base index) that an NPC's npcQuestId and its lang.json NO_MORE_QUESTS line are keyed on.
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

    // The index of the map named by a config setting such as "start_map": a map index (107 or "107"),
    // a map's name from maplist.json with or without its folder ("map1/map1_3_1" or "map1_3_1"), or a
    // split map as a whole ("map1"), which means its warp point -- the section holding the map's start
    // checkpoint, i.e. its start town (see tools/maps/generator/split.py). -1 if nothing matches.
    resolveMapIndex(spec) {
        const names = this.mapNames || {};
        if (spec === undefined || spec === null || spec === '') return -1;
        const want = String(spec).trim();
        if (/^[0-9]+$/.test(want)) {
            const i = parseInt(want, 10);
            return names[i] ? i : -1;
        }
        const ids = Object.keys(names).map(Number).sort(function (a, b) {
            return a - b;
        });
        const find = function (test) {
            const id = ids.find(function (i) {
                return test(names[i]);
            });
            return id === undefined ? -1 : id;
        };
        let i = find(function (n) {
            return n === want;
        });
        if (i >= 0) return i;
        i = find(function (n) {
            return n.split('/').pop() === want;
        });
        if (i >= 0) return i;
        const prefix = want + '/';
        const warp = (this.warps || []).find(function (n) {
            return n.startsWith(prefix);
        });
        if (warp) {
            i = find(function (n) {
                return n === warp;
            });
            if (i >= 0) return i;
        }
        return find(function (n) {
            return n.startsWith(prefix);
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
