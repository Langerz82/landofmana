// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
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

// MAP GROUPS: a map split into several files (tools/maps/generator/split.py) keeps ONE set of data
// files for the whole map, in full-map pixel coordinates:
//
//     gameserver/data/maps/<map>/entity.json       (map/mapentitystore.js)
//     gameserver/data/maps/<map>/entityarea.json   (map/map.js)
//
// e.g. data/maps/map1/entity.json for every part of map1 (map1/map1_0_0, ..., map1/map1_int).
// Each part takes the records that lie inside its own area of the full map -- its file's worldX/
// worldY (in tiles, written by split.py and passed on by the converter) and its size -- and moves
// them to its own coordinates when it loads. So re-splitting a map (another section size) changes
// nothing in these files.
//
// A map that isn't split ("map0") is a group of one, at worldX/worldY 0: its files are
// data/maps/map0/entity.json etc., exactly as before.
//
// The group's base index (map number x MAP_INDEX_STRIDE: 100 for map1) is the map index quest ids
// are built from (questid.js), so they don't change when the map is split differently either, and
// saved player positions are stored as (base index, full-map position) -- see toSavedPosition().
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const MAP_INDEX_STRIDE = 100; // most files one map can have (sub-indexes 0-99)

export const MAPS_DATA_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../data/maps'
);

// "map1/map1_0_0" -> "map1"; "map0" -> "map0".
export function mapGroupName(name) {
    return String(name || '').split('/')[0];
}

// 107 -> 100, 300 -> 300.
export function mapBaseIndex(index) {
    return Math.floor(Number(index) / MAP_INDEX_STRIDE) * MAP_INDEX_STRIDE;
}

// data/maps/<map>/<file> for a map part.
export function mapDataFile(mapName, file) {
    return path.join(MAPS_DATA_DIR, mapGroupName(mapName), file);
}

// Does full-map pixel point (wx, wy) lie in this part? (map.offsetX/offsetY/width/height, map.js)
export function partHasPoint(map, wx, wy) {
    const ts = map.tilesize;
    return (
        wx >= map.offsetX &&
        wy >= map.offsetY &&
        wx < map.offsetX + map.width * ts &&
        wy < map.offsetY + map.height * ts
    );
}

// Every split map's parts, in pixels, in map-list order: { "map1": [{ name, x, y, w, h }, ...] }.
// From maps/maplist.json "areas" ([worldX, worldY, width, height] in tiles, written by the
// converter), set by MapManager before any map loads, so a part knows its neighbours when it
// shares out an area's count (localizeArea()). A map without any is a part on its own.
const partRects = {};

export function setPartRects(names, areas, tilesize) {
    for (const k of Object.keys(partRects)) delete partRects[k];
    for (const name of Object.values(names || {})) {
        const a = areas && areas[name];
        if (!Array.isArray(a) || a.length < 4) continue;
        const g = mapGroupName(name);
        (partRects[g] = partRects[g] || []).push({
            name,
            x: a[0] * tilesize,
            y: a[1] * tilesize,
            w: a[2] * tilesize,
            h: a[3] * tilesize
        });
    }
}

// This map's parts (just itself when the map list doesn't place it).
function partsOf(map) {
    const list = partRects[map.groupName] || [];
    if (list.some((r) => r.name === map.name)) return list;
    return [{ name: map.name, x: map.offsetX, y: map.offsetY, w: map.width * map.tilesize, h: map.height * map.tilesize }];
}

// How much of an area lies in part rectangle r: pixels for a rectangle (none unless at least a
// tile each way), tiles for an ellipse (with Area.contains()'s own test, area/area.js
// insideEllipse()).
function shareIn(area, r, ts) {
    if (area.elipse) {
        const rx = area.w / 2;
        const ry = area.h / 2;
        let n = 0;
        const tx0 = Math.floor(Math.max(area.x - rx, r.x) / ts);
        const ty0 = Math.floor(Math.max(area.y - ry, r.y) / ts);
        const tx1 = Math.min(area.x + rx, r.x + r.w);
        const ty1 = Math.min(area.y + ry, r.y + r.h);
        for (let ty = ty0; ty * ts < ty1; ty++) {
            for (let tx = tx0; tx * ts < tx1; tx++) {
                const px = tx * ts + (ts >> 1);
                const py = ty * ts + (ts >> 1);
                if (px < r.x || py < r.y || px >= r.x + r.w || py >= r.y + r.h) continue;
                if (((px - area.x) / rx) ** 2 + ((py - area.y) / ry) ** 2 < 1) n++;
            }
        }
        return n;
    }
    const w = Math.min(area.x + area.w, r.x + r.w) - Math.max(area.x, r.x);
    const h = Math.min(area.y + area.h, r.y + r.h) - Math.max(area.y, r.y);
    return w >= ts && h >= ts ? w * h : 0;
}

// An area's "count" shared out over the parts it lies in: each gets its share rounded down, and
// what's left over goes to the part holding the biggest piece of the area (the first such in the
// map list), so the parts' counts always add up to the area's count. Returns this part's count.
function countHere(map, area) {
    const count = Number(area.count);
    const parts = partsOf(map);
    const shares = parts.map((r) => shareIn(area, r, map.tilesize));
    const total = shares.reduce((a, b) => a + b, 0);
    const me = parts.findIndex((r) => r.name === map.name);
    if (!(count > 0) || !total || me < 0) return area.count;
    let given = 0;
    let main = 0;
    const base = shares.map((s, i) => {
        let q = Math.floor((count * s) / total);
        if (q * total > count * s) q--;      // exact, whatever the float division rounded to
        given += q;
        if (s > shares[main]) main = i;
        return q;
    });
    return base[me] + (me === main ? count - given : 0);
}

// An area from entityarea.json (full-map pixels: x/y top-left, or the centre when `elipse`;
// w/h) -> the same area in this part's coordinates, or null if none of it is in this part (or
// none of its count falls to this part). Its id stays the file's id.
//   - A rectangle is cut to the part.
//   - An ellipse keeps its whole shape (its centre may then lie outside the part), plus a `clip`
//     rectangle {x, y, w, h}: the part of the part it may use (area/area.js keeps spawns and
//     roaming inside both).
// Either way, when the area lies in more than one part, its "count" is shared out between them
// (countHere(): rounded down by share, the leftover to the part with the biggest piece), so the
// map spawns exactly as many as it would unsplit.
export function localizeArea(map, area) {
    const ts = map.tilesize;
    const ox = map.offsetX;
    const oy = map.offsetY;
    const px1 = ox + map.width * ts;
    const py1 = oy + map.height * ts;
    const mine = { x: ox, y: oy, w: map.width * ts, h: map.height * ts };
    if (!shareIn(area, mine, ts)) return null;
    let out;
    if (area.elipse) {
        const ex0 = area.x - area.w / 2;
        const ey0 = area.y - area.h / 2;
        const ex1 = area.x + area.w / 2;
        const ey1 = area.y + area.h / 2;
        out = Object.assign({}, area, { x: area.x - ox, y: area.y - oy });
        delete out.clip;
        if (ex0 < ox || ey0 < oy || ex1 > px1 || ey1 > py1) {
            const cx0 = Math.max(ex0, ox);
            const cy0 = Math.max(ey0, oy);
            out.clip = {
                x: cx0 - ox,
                y: cy0 - oy,
                w: Math.min(ex1, px1) - cx0,
                h: Math.min(ey1, py1) - cy0
            };
        }
    } else {
        const x0 = Math.max(area.x, ox);
        const y0 = Math.max(area.y, oy);
        out = Object.assign({}, area, {
            x: x0 - ox,
            y: y0 - oy,
            w: Math.min(area.x + area.w, px1) - x0,
            h: Math.min(area.y + area.h, py1) - y0
        });
    }
    if (Number(area.count) > 0) {
        out.count = countHere(map, area);
        if (!(out.count > 0)) return null;   // a sliver too small to get any of it
    }
    return out;
}

// One shared copy of a group's entity.json (every part of the map uses the same object), so a
// part saving its records never writes over another part's. Records are in full-map pixels.
const entityFiles = new Map();

export class GroupEntityFile {
    static get(mapName) {
        const file = mapDataFile(mapName, 'entity.json');
        let g = entityFiles.get(file);
        if (!g) {
            g = new GroupEntityFile(file);
            entityFiles.set(file, g);
        }
        return g;
    }

    constructor(file) {
        this.filePath = file;
        this.records = null; // null until read
        this.writeChain = Promise.resolve();
    }

    // Reads the file once (synchronously: maps load at startup). Returns the raw list ([] if
    // the file is missing or unreadable).
    read() {
        if (this.records) return this.records;
        this.records = [];
        let raw;
        try {
            raw = fs.readFileSync(this.filePath, 'utf8');
        } catch (err) {
            if (err.code !== 'ENOENT')
                console.error('GroupEntityFile: failed to read ' + this.filePath + ': ' + err.message);
            return this.records;
        }
        try {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) this.records = list;
            else console.error('GroupEntityFile: ' + this.filePath + ' is not a JSON array.');
        } catch (err) {
            console.error('GroupEntityFile: failed to parse ' + this.filePath + ': ' + err.message);
        }
        return this.records;
    }

    // Highest valid fixed id in the whole file.
    maxId() {
        let m = 0;
        for (const r of this.read()) {
            const id = r && Number(r.id);
            if (Number.isInteger(id) && id > m) m = id;
        }
        return m;
    }

    // Saves the file, sorted by id (records without a usable id last).
    save() {
        const key = (r) => (r && Number.isInteger(Number(r.id)) ? Number(r.id) : Infinity);
        this.read().sort((a, b) => key(a) - key(b));
        const json = JSON.stringify(this.read(), null, 2) + '\n';
        const file = this.filePath;
        const tmp = file + '.tmp';
        this.writeChain = this.writeChain
            .then(async () => {
                await fs.promises.mkdir(path.dirname(file), { recursive: true });
                // Write-then-rename so a crash mid-write can't leave a truncated file behind.
                await fs.promises.writeFile(tmp, json, 'utf8');
                await fs.promises.rename(tmp, file);
            })
            .catch((err) => {
                console.error('GroupEntityFile: failed to save ' + file + ': ' + err.message);
            });
        return this.writeChain;
    }
}

// entityarea.json of a map group: { mobAreas, entityAreas } in full-map pixels, or null if there
// is none (or it can't be read).
export function readGroupAreas(mapName) {
    const file = mapDataFile(mapName, 'entityarea.json');
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Map: failed to read ' + file + ': ' + err.message);
        return null;
    }
    try {
        const data = JSON.parse(raw);
        data.mobAreas = data.mobAreas || [];
        data.entityAreas = data.entityAreas || [];
        return data;
    } catch (err) {
        console.error('Map: failed to parse ' + file + ': ' + err.message);
        return null;
    }
}

// Writes a map group's entityarea.json, each list sorted by id.
export function writeGroupAreas(mapName, data) {
    for (const k of ['mobAreas', 'entityAreas'])
        (data[k] || []).sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    const file = mapDataFile(mapName, 'entityarea.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
}

// A player's position for saving: [base index, full-map x, full-map y] -- the same whatever
// section size the map is split into. (Saves from before this change hold a part's own index and
// coordinates; fromSavedPosition() still reads those.)
export function toSavedPosition(map, x, y) {
    return [map.baseIndex, x + map.offsetX, y + map.offsetY];
}

// A saved [map index, x, y] -> { map, x, y } in that part's coordinates, or null if no loaded map
// holds it. `maps` is World.maps ({ index: Map }).
export function fromSavedPosition(maps, index, x, y) {
    index = Number(index);
    x = Number(x);
    y = Number(y);
    if (!Number.isFinite(index) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (index === mapBaseIndex(index)) {
        // the base index: a full-map position -- find the part that holds it
        for (const id in maps) {
            const m = maps[id];
            if (!m || m.baseIndex !== index || !m.isLoaded) continue;
            if (partHasPoint(m, x, y)) return { map: m, x: x - m.offsetX, y: y - m.offsetY };
        }
    }
    // an older save: that part's own coordinates
    const m = maps[index];
    return m ? { map: m, x, y } : null;
}
