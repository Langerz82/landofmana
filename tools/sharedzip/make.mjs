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

// Builds shared/shared.zip: every .json file under shared/data and shared/maps,
// named by its path inside shared/ ("data/lang.json", "maps/maplist.json",
// "maps/map4/map4_0_0.json"). The game server pushes this zip to clients whose
// files are another version (gameserver/js/clientdata.js).
//
// The game server rebuilds this zip itself at start-up whenever
// "client_data"."shared_version" in gameserver/config.json changes, so bumping
// that number is enough. Run this to build it by hand (e.g. to commit it):
//
//     node tools/sharedzip/make.mjs
//
// The zip's archive comment records the shared_version it was made for
// ("shared_version=114", read from gameserver/config.json), which is how the
// game server tells whether it needs rebuilding.
//
// No dependencies: Node's own zlib does the deflating.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const SHARED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../shared');
const OUT = path.join(SHARED, 'shared.zip');
const CONFIG = path.resolve(SHARED, '../gameserver/config.json');

function sharedVersion() {
    try {
        const c = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
        const v = c.client_data && c.client_data.shared_version !== undefined ? c.client_data.shared_version : c.version;
        return Number.isFinite(Number(v)) ? Number(v) : 0;
    } catch (err) {
        console.warn('Could not read ' + CONFIG + ' (' + err.message + '): no version in the zip.');
        return null;
    }
}
const FOLDERS = ['data', 'maps'];

const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function listJson(dir, out) {
    for (const d of fs.readdirSync(path.join(SHARED, dir), { withFileTypes: true })) {
        const rel = dir + '/' + d.name;
        if (d.isDirectory()) listJson(rel, out);
        else if (d.isFile() && d.name.toLowerCase().endsWith('.json')) out.push(rel);
    }
    return out;
}

const files = [];
for (const f of FOLDERS) listJson(f, files);
files.sort();

const parts = [];
const central = [];
let offset = 0;
for (const rel of files) {
    const data = fs.readFileSync(path.join(SHARED, rel));
    const d = fs.statSync(path.join(SHARED, rel)).mtime;
    const name = Buffer.from(rel, 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // utf-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, packed);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(packed.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + packed.length;
}
const version = sharedVersion();
const note = Buffer.from(version === null ? '' : 'shared_version=' + version, 'utf8');
const cenSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenSize, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(note.length, 20);
const zip = Buffer.concat(parts.concat(central, [end, note]));
fs.writeFileSync(OUT + '.tmp', zip);
fs.renameSync(OUT + '.tmp', OUT);
console.info('Wrote ' + OUT + ': ' + files.length + ' files, ' + Math.round(zip.length / 1024) + ' KB, ' + (version === null ? 'no version' : 'shared_version ' + version));
