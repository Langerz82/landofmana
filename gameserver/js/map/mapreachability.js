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

// Unreachable ground inside mob and entity areas.
//
// Pathfinding (map/pathfindingservice.js) only works on this map's static
// collision grid, 4-way, one map part at a time. Walkable tiles that no path
// from a door or checkpoint can reach -- the floor of a crater ring or lava
// basin, the empty space round an interior room -- still pass every spawn and
// roam check (Map.getRandomPositionArea() only asks isColliding()), so a mob or
// a resource node can be placed there, and mobs then can't path out (or others
// keep trying to path in): "findPath - Error while finding the path to x, y".
//
// sealUnreachableAreaGround() runs when a map loads, before its areas spawn
// anything (MapManager.addListedMap -> Map.sealAreaPockets()), and again for an
// area an admin adds. In every area it finds the walkable regions (4-connected,
// as findPath walks) and:
//   - a region no door, edge door or checkpoint is in (players can't get there)
//     has its tiles inside the area turned into collision on the server's grid
//     (map.grid and the pathing entitygrid), so nothing spawns or roams there;
//   - a region that does lead out to ground players can traverse (a door, edge
//     door or checkpoint is in it -- e.g. a strip cut off from the rest of its
//     area by a split map's section edge, reached through the edge door) is
//     left as it is and not reported;
//   - an area with no reachable ground at all keeps its biggest region open and
//     is reported.
// sealUnreachableMapGround() does the same for the whole map part, before
// anything spawns on it (MapManager, once every map has loaded): every walkable
// section that can't be reached on foot from a door, edge door or checkpoint,
// nor by teleporting (no door of any map lands in it -- MapManager.arrivals),
// is turned into collision.
// Every change is logged with its tiles, so the map file can be fixed
// (tools/maps/generator/common/ladders.py gives cliff pockets a ladder).
// The map files themselves are never changed.
import { G_TILESIZE } from '../constants.js';

const MAX_LISTED = 8;                 // pockets listed per area in the log (the rest are counted)

// Labels every walkable tile of the map's collision grid by its 4-connected
// region (as findPath walks). Cached on the map: the grid never changes after
// load. Returns { labels: Int32Array(w*h) (0 = blocked), sizes: [0, n1, n2, ...] }.
export function walkableRegions(map) {
    if (map._walkRegions) return map._walkRegions;
    const w = map.width;
    const h = map.height;
    const grid = map.grid;
    const labels = new Int32Array(w * h);
    const sizes = [0];
    const queue = new Int32Array(w * h);
    let next = 0;
    for (let y = 0; y < h; ++y) {
        const row = grid[y];
        for (let x = 0; x < w; ++x) {
            const s = y * w + x;
            if (row[x] === 1 || labels[s] !== 0) continue;
            const id = ++next;
            let head = 0;
            let tail = 0;
            queue[tail++] = s;
            labels[s] = id;
            while (head < tail) {
                const p = queue[head++];
                const px = p % w;
                const py = (p - px) / w;
                if (px > 0 && labels[p - 1] === 0 && grid[py][px - 1] !== 1) { labels[p - 1] = id; queue[tail++] = p - 1; }
                if (px < w - 1 && labels[p + 1] === 0 && grid[py][px + 1] !== 1) { labels[p + 1] = id; queue[tail++] = p + 1; }
                if (py > 0 && labels[p - w] === 0 && grid[py - 1][px] !== 1) { labels[p - w] = id; queue[tail++] = p - w; }
                if (py < h - 1 && labels[p + w] === 0 && grid[py + 1][px] !== 1) { labels[p + w] = id; queue[tail++] = p + w; }
            }
            sizes.push(tail);
        }
    }
    map._walkRegions = { labels, sizes };
    return map._walkRegions;
}

// The tiles (by tile-centre) an area covers, cut to the map.
function areaTileBox(area, map) {
    const ts = G_TILESIZE;
    let x0, y0, x1, y1;
    if (area.elipse) {
        x0 = area.x - area.width / 2; y0 = area.y - area.height / 2;
        x1 = area.x + area.width / 2; y1 = area.y + area.height / 2;
    } else {
        x0 = area.x; y0 = area.y; x1 = area.x + area.width; y1 = area.y + area.height;
    }
    if (area.clip) {
        x0 = Math.max(x0, area.clip.x); y0 = Math.max(y0, area.clip.y);
        x1 = Math.min(x1, area.clip.x + area.clip.w); y1 = Math.min(y1, area.clip.y + area.clip.h);
    }
    return {
        tx0: Math.max(0, Math.floor(x0 / ts)), ty0: Math.max(0, Math.floor(y0 / ts)),
        tx1: Math.min(map.width - 1, Math.ceil(x1 / ts)), ty1: Math.min(map.height - 1, Math.ceil(y1 / ts))
    };
}

// Regions holding a door (edge doors too), a checkpoint, or a spot a door of
// any map teleports players to (map.arrivals, set by MapManager): where
// players come into this map part, so ground they can stand on.
export function entryRegions(map) {
    const { labels } = walkableRegions(map);
    const ts = G_TILESIZE;
    const w = map.width;
    const out = new Set();
    // `ring`: when no tile of the rect is walkable (a landing spot on a wall
    // tile), the walkable tiles right round it count instead
    const addRect = (x, y, rw, rh, ring) => {
        if (!(rw > 0) || !(rh > 0)) return;
        let tx0 = Math.max(0, Math.floor(x / ts)), ty0 = Math.max(0, Math.floor(y / ts));
        let tx1 = Math.min(map.width - 1, Math.floor((x + rw - 1) / ts));
        let ty1 = Math.min(map.height - 1, Math.floor((y + rh - 1) / ts));
        let hit = false;
        for (let ty = ty0; ty <= ty1; ++ty)
            for (let tx = tx0; tx <= tx1; ++tx) {
                const r = labels[ty * w + tx];
                if (r) { out.add(r); hit = true; }
            }
        if (!hit && ring) {
            tx0 = Math.max(0, tx0 - 1); ty0 = Math.max(0, ty0 - 1);
            tx1 = Math.min(map.width - 1, tx1 + 1); ty1 = Math.min(map.height - 1, ty1 + 1);
            for (let ty = ty0; ty <= ty1; ++ty)
                for (let tx = tx0; tx <= tx1; ++tx) {
                    const r = labels[ty * w + tx];
                    if (r) out.add(r);
                }
        }
    };
    for (const d of map.doors || []) addRect(d.x, d.y, d.width, d.height);
    const cps = map.checkpoints || {};
    for (const k of Object.keys(cps)) {
        const c = cps[k];
        addRect(c.x, c.y, c.width, c.height);
    }
    for (const a of map.arrivals || []) addRect(a.x, a.y, a.w, a.h, true);
    return out;
}

// Walkable tiles of one area by region: Map region -> { tiles: [tile index], x, y } (x/y: its first tile).
function areaRegions(map, area) {
    const { labels } = walkableRegions(map);
    const ts = G_TILESIZE;
    const half = ts >> 1;
    const w = map.width;
    const box = areaTileBox(area, map);
    const regions = new Map();
    for (let ty = box.ty0; ty <= box.ty1; ++ty) {
        for (let tx = box.tx0; tx <= box.tx1; ++tx) {
            const s = ty * w + tx;
            const r = labels[s];
            if (r === 0) continue;
            if (!area.contains(tx * ts + half, ty * ts + half, 0)) continue;
            const c = regions.get(r);
            if (c) c.tiles.push(s);
            else regions.set(r, { tiles: [s], x: tx, y: ty });
        }
    }
    return regions;
}

// The region an area's ground is: the one with most of its tiles among those
// players can reach, or the one with most of its tiles when none can be.
function homeRegion(regions, entry) {
    let home = 0, best = -1, homeAny = 0, bestAny = -1;
    for (const [r, c] of regions) {
        if (c.tiles.length > bestAny) { bestAny = c.tiles.length; homeAny = r; }
        if (entry.has(r) && c.tiles.length > best) { best = c.tiles.length; home = r; }
    }
    return home ? { region: home, reachable: true } : { region: homeAny, reachable: false };
}

// areas: [{ area, kind ('mob' | 'entity'), caption, check }] -- every area on
// the map part; those with `check: false` (already running) are only used so
// their own ground is never closed. Closes the unreachable ground of the
// checked areas and logs what it did. Returns the number of tiles closed.
export function sealUnreachableAreaGround(map, areas, log = console.warn) {
    const ts = G_TILESIZE;
    const w = map.width;
    const ox = Math.round((map.offsetX || 0) / ts);
    const oy = Math.round((map.offsetY || 0) / ts);
    const where = (x, y) => x + ',' + y + (ox || oy ? ' (full map ' + (x + ox) + ',' + (y + oy) + ')' : '');
    const { sizes } = walkableRegions(map);
    const entry = entryRegions(map);

    // every area's own ground, so one area never closes another's
    const info = areas.map((a) => {
        const regions = areaRegions(map, a.area);
        return Object.assign({ regions, home: homeRegion(regions, entry) }, a);
    });
    const homes = new Set(info.filter((a) => a.home.region).map((a) => a.home.region));

    const close = new Set();                 // tile indexes to turn into collision
    let reportedAreas = 0;
    const name = (a) => a.kind + ' area ' + a.area.id + (a.caption ? ' (' + a.caption + ')' : '');
    const listOf = (items) => {
        const l = items.slice(0, MAX_LISTED).map((p) => 'tile ' + where(p.x, p.y) + ': ' + p.n + ' tile' + (p.n === 1 ? '' : 's'));
        if (items.length > MAX_LISTED) l.push('... ' + (items.length - MAX_LISTED) + ' more');
        return l.join('; ');
    };
    for (const a of info) {
        if (a.check === false || a.regions.size === 0) continue;
        const sealed = [];
        for (const [r, c] of a.regions) {
            if (r === a.home.region) continue;
            // leads out to traversable ground (or is another area's own ground): left alone, not reported
            if (entry.has(r) || homes.has(r)) continue;
            for (const s of c.tiles) close.add(s);
            sealed.push({ x: c.x, y: c.y, n: c.tiles.length });
        }
        sealed.sort((p, q) => q.n - p.n);
        if (!a.home.reachable) {
            const c = a.regions.get(a.home.region);
            log('Map ' + map.name + ': ' + name(a) + ': no door or checkpoint leads to its ground (' + c.tiles.length +
                ' walkable tiles from tile ' + where(c.x, c.y) + ', ' + sizes[a.home.region] + ' in that region) -- ' +
                'left open, but players can\'t reach what spawns there.');
        }
        if (sealed.length) {
            const n = sealed.reduce((s, p) => s + p.n, 0);
            log('Map ' + map.name + ': ' + name(a) + ' had ' + n + ' walkable tile' + (n === 1 ? '' : 's') + ' in ' +
                sealed.length + ' part' + (sealed.length === 1 ? '' : 's') + ' nothing can reach -- turned into ' +
                'collision so nothing spawns or roams there (fix the map file): ' + listOf(sealed));
        }
        if (sealed.length || !a.home.reachable) reportedAreas++;
    }

    if (close.size > 0) {
        const grid = map.grid;
        const egrid = map.entities && map.entities.entitygrid;
        for (const s of close) {
            const x = s % w, y = (s - x) / w;
            grid[y][x] = 1;
            if (egrid && egrid[y]) egrid[y][x] = 1;
        }
        map._walkRegions = null;             // the regions changed
    }
    if (reportedAreas > 0) {
        log('Map ' + map.name + ': ' + reportedAreas + ' area' + (reportedAreas === 1 ? '' : 's') + ' with unreachable ' +
            'ground; ' + close.size + ' tile' + (close.size === 1 ? '' : 's') + ' turned into collision on the server ' +
            '(map/mapreachability.js). Fix the map to stop this (tools/maps/generator/common/ladders.py for cliff pockets).');
    }
    return close.size;
}

// The whole map part: every walkable section that no door, edge door,
// checkpoint or teleport arrival (map.arrivals) is in -- nobody can walk or
// teleport there -- is turned into collision (map.grid and the pathing
// entitygrid) and reported. Run before anything spawns on the map. A map with
// no doors, checkpoints or arrivals at all is left alone. Returns the number
// of tiles closed.
export function sealUnreachableMapGround(map, log = console.warn) {
    const ts = G_TILESIZE;
    const w = map.width;
    const ox = Math.round((map.offsetX || 0) / ts);
    const oy = Math.round((map.offsetY || 0) / ts);
    const where = (x, y) => x + ',' + y + (ox || oy ? ' (full map ' + (x + ox) + ',' + (y + oy) + ')' : '');
    const { labels, sizes } = walkableRegions(map);
    const entry = entryRegions(map);
    if (entry.size === 0) {
        console.info('Map ' + map.name + ': no doors, checkpoints or teleport arrivals -- unreachable ground not checked.');
        return 0;
    }
    const closedRegions = [];
    for (let r = 1; r < sizes.length; ++r) {
        if (!entry.has(r)) closedRegions.push({ r, n: sizes[r], x: -1, y: -1 });
    }
    if (closedRegions.length === 0) return 0;
    const byRegion = new Map(closedRegions.map((c) => [c.r, c]));
    const grid = map.grid;
    const egrid = map.entities && map.entities.entitygrid;
    let total = 0;
    for (let s = 0; s < labels.length; ++s) {
        const c = byRegion.get(labels[s]);
        if (!c) continue;
        const x = s % w, y = (s - x) / w;
        if (c.x < 0) { c.x = x; c.y = y; }
        grid[y][x] = 1;
        if (egrid && egrid[y]) egrid[y][x] = 1;
        total++;
    }
    map._walkRegions = null;                 // the regions changed
    closedRegions.sort((a, b) => b.n - a.n);
    const list = closedRegions.slice(0, MAX_LISTED).map((c) =>
        'tile ' + where(c.x, c.y) + ': ' + c.n + ' tile' + (c.n === 1 ? '' : 's'));
    if (closedRegions.length > MAX_LISTED) list.push('... ' + (closedRegions.length - MAX_LISTED) + ' more');
    log('Map ' + map.name + ': ' + closedRegions.length + ' closed-off section' + (closedRegions.length === 1 ? '' : 's') +
        ' (' + total + ' walkable tile' + (total === 1 ? '' : 's') + ') that no one can walk or teleport into -- no ' +
        'door, edge door, checkpoint or door destination is in ' + (closedRegions.length === 1 ? 'it' : 'them') +
        ' -- turned into collision on the server. Fix the map file (converting it again with ' +
        'tools/maps/converter closes these): ' + list.join('; '));
    return total;
}
