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

// An area from entityarea.json (full-map pixels: x/y top-left, or the centre when `elipse`;
// w/h) -> the same area in this part's coordinates, or null if no part of it is in this part.
// Its id stays the file's id.
//   - A rectangle is cut to the part.
//   - An ellipse keeps its whole shape (its centre may then lie outside the part), plus a `clip`
//     rectangle {x, y, w, h}: the part of the part it may use (area/area.js keeps spawns and
//     roaming inside both).
// Either way, when only some of the area is in this part, its "count" is scaled to the share in
// it (at least 1), so an area crossing a section edge spawns on both sides about as many as it
// would unsplit.
export function localizeArea(map, area) {
    const ts = map.tilesize;
    const ox = map.offsetX;
    const oy = map.offsetY;
    const px1 = ox + map.width * ts;
    const py1 = oy + map.height * ts;
    if (area.elipse) {
        const ex0 = area.x - area.w / 2;
        const ey0 = area.y - area.h / 2;
        const ex1 = area.x + area.w / 2;
        const ey1 = area.y + area.h / 2;
        const cx0 = Math.max(ex0, ox);
        const cy0 = Math.max(ey0, oy);
        const cx1 = Math.min(ex1, px1);
        const cy1 = Math.min(ey1, py1);
        if (cx1 - cx0 < ts || cy1 - cy0 < ts) return null;
        const out = Object.assign({}, area, { x: area.x - ox, y: area.y - oy });
        delete out.clip;
        if (cx0 === ex0 && cy0 === ey0 && cx1 === ex1 && cy1 === ey1) return out; // all of it is here
        // the share of the ellipse's tiles in this part, with Area.contains()'s own test
        // (area/area.js insideEllipse())
        const rx = area.w / 2;
        const ry = area.h / 2;
        let all = 0;
        let mine = 0;
        for (let ty = Math.floor(ey0 / ts); ty * ts < ey1; ty++) {
            for (let tx = Math.floor(ex0 / ts); tx * ts < ex1; tx++) {
                const px = tx * ts + (ts >> 1);
                const py = ty * ts + (ts >> 1);
                if (((px - area.x) / rx) ** 2 + ((py - area.y) / ry) ** 2 >= 1) continue;
                all++;
                if (px >= ox && py >= oy && px < px1 && py < py1) mine++;
            }
        }
        if (!mine) return null;
        out.clip = { x: cx0 - ox, y: cy0 - oy, w: cx1 - cx0, h: cy1 - cy0 };
        if (mine < all && Number(area.count) > 0)
            out.count = Math.max(1, Math.round((Number(area.count) * mine) / all));
        return out;
    }
    const x0 = Math.max(area.x, ox);
    const y0 = Math.max(area.y, oy);
    const x1 = Math.min(area.x + area.w, px1);
    const y1 = Math.min(area.y + area.h, py1);
    if (x1 - x0 < ts || y1 - y0 < ts) return null;
    const out = Object.assign({}, area, { x: x0 - ox, y: y0 - oy, w: x1 - x0, h: y1 - y0 });
    const whole = area.w * area.h;
    const kept = (x1 - x0) * (y1 - y0);
    if (kept < whole && Number(area.count) > 0)
        out.count = Math.max(1, Math.round((Number(area.count) * kept) / whole));
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

    save() {
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

export function writeGroupAreas(mapName, data) {
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
