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

// A minimal zip writer (deflate, no zip64) with an archive comment, and a reader
// for that comment -- enough for shared/shared.zip (clientdata.js), with no
// dependency beyond Node's own zlib. tools/sharedzip/make.mjs writes the same
// format by hand.

import zlib from 'zlib';

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

// A zip of [{ name, data: Buffer, mtime: Date }], with `comment` (a short
// string) as its archive comment.
export function makeZip(entries, comment) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const e of entries) {
        const name = Buffer.from(e.name, 'utf8');
        const packed = zlib.deflateRawSync(e.data, { level: 9 });
        const crc = crc32(e.data);
        const d = e.mtime || new Date();
        const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
        const dosDate = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0x0800, 6); // utf-8 names
        local.writeUInt16LE(8, 8); // deflate
        local.writeUInt16LE(dosTime, 10);
        local.writeUInt16LE(dosDate, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(e.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        parts.push(local, name, packed);

        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0);
        cen.writeUInt16LE(20, 4); // version made by
        cen.writeUInt16LE(20, 6); // version needed
        cen.writeUInt16LE(0x0800, 8);
        cen.writeUInt16LE(8, 10);
        cen.writeUInt16LE(dosTime, 12);
        cen.writeUInt16LE(dosDate, 14);
        cen.writeUInt32LE(crc, 16);
        cen.writeUInt32LE(packed.length, 20);
        cen.writeUInt32LE(e.data.length, 24);
        cen.writeUInt16LE(name.length, 28);
        cen.writeUInt32LE(offset, 42);
        central.push(cen, name);

        offset += local.length + name.length + packed.length;
    }
    const note = Buffer.from(comment || '', 'utf8').subarray(0, 0xffff);
    const cenSize = central.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cenSize, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(note.length, 20);
    return Buffer.concat(parts.concat(central, [end, note]));
}

// The archive comment of zip bytes, or null if there's no end-of-central-
// directory record (not a zip).
export function readZipComment(buf) {
    for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
        if (buf.readUInt32LE(i) !== 0x06054b50) continue;
        const len = buf.readUInt16LE(i + 20);
        if (i + 22 + len !== buf.length) continue;
        return buf.toString('utf8', i + 22, i + 22 + len);
    }
    return null;
}
