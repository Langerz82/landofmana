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

// The shared files the game server pushes to its clients (clientdata.js): every
// .json file under the shared folder's data/ and maps/, named by its path inside
// the shared folder ("data/lang.json", "maps/map2/map2_0_0.json").
//
// The set is identified by one hash, its "shared hash": the sha1 of every file's
// "<path>:<sha1>\n" line, in path order. Clients compare it with the hash of the
// files they have instead of a version number.
//
// Two files are made from the set, next to data/ and maps/:
//   shared.zip      every file; its archive comment is "shared_hash=<hash>"
//   manifest.json   { "hash": "<hash>", "files": { "<path>": "<sha1>", ... } } --
//                   ships with each client build so the client knows the hash of
//                   its own copies (client/js/clientdata.js, Godot ClientData)
//
// Used by the game server (once, at start-up) and by
// tools/sharedzip/make.mjs (by hand).

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { makeZip, readZipComment } from './zipwriter.js';

export const FOLDERS = ['data', 'maps'];
export const ZIP_FILE = 'shared.zip';
export const MANIFEST_FILE = 'manifest.json';

const sha1Hex = (data) => crypto.createHash('sha1').update(data).digest('hex');

function listJson(sharedDir, dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(sharedDir, dir), { withFileTypes: true });
    } catch (err) {
        return out;
    }
    for (const d of entries) {
        const rel = dir + '/' + d.name;
        if (d.isDirectory()) listJson(sharedDir, rel, out);
        else if (d.isFile() && d.name.toLowerCase().endsWith('.json')) out.push(rel);
    }
    return out;
}

// The paths of the set, sorted ("data/craft.json", ...).
export function listSharedPaths(sharedDir) {
    const out = [];
    for (const f of FOLDERS) listJson(sharedDir, f, out);
    return out.sort();
}

// Reads the set: [{ path, data, mtime, sha1 }], in path order.
export function readSharedFiles(sharedDir, paths) {
    const files = [];
    for (const rel of paths || listSharedPaths(sharedDir)) {
        const abs = path.join(sharedDir, rel);
        try {
            const data = fs.readFileSync(abs);
            files.push({ path: rel, data, mtime: fs.statSync(abs).mtime, sha1: sha1Hex(data) });
        } catch (err) {
            /* vanished between listing and reading: skip */
        }
    }
    return files;
}

// The shared hash of the set ({ path: sha1 } or [{ path, sha1 }]).
export function sharedHash(files) {
    const list = Array.isArray(files) ? files.map((f) => [f.path, f.sha1]) : Object.entries(files);
    list.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return sha1Hex(list.map(([p, h]) => p + ':' + h + '\n').join(''));
}

export function zipComment(hash) {
    return 'shared_hash=' + hash;
}

// Makes sure shared.zip and manifest.json are those of `files` (read with
// readSharedFiles()), rewriting whichever isn't. Returns { hash, zip (Buffer),
// zipBuilt, manifestBuilt }; `zip` is the zip that matches the files even if it
// couldn't be written. Throws only if nothing can be built at all.
export function writeSharedOutputs(sharedDir, files) {
    const hashes = {};
    for (const f of files) hashes[f.path] = f.sha1;
    const hash = sharedHash(files);
    const zipPath = path.join(sharedDir, ZIP_FILE);
    const manifestPath = path.join(sharedDir, MANIFEST_FILE);
    const result = { hash, zip: null, zipBuilt: false, manifestBuilt: false, errors: [] };

    let current = null;
    try {
        current = fs.readFileSync(zipPath);
    } catch (err) {
        /* none yet */
    }
    if (current && readZipComment(current) === zipComment(hash)) {
        result.zip = current;
    } else {
        result.zip = makeZip(
            files.map((f) => ({ name: f.path, data: f.data, mtime: f.mtime })),
            zipComment(hash)
        );
        try {
            fs.writeFileSync(zipPath + '.tmp', result.zip);
            fs.renameSync(zipPath + '.tmp', zipPath);
            result.zipBuilt = true;
        } catch (err) {
            result.errors.push(zipPath + ': ' + err.message);
        }
    }

    const manifest = JSON.stringify({ hash, files: hashes }, null, 1) + '\n';
    let currentManifest = null;
    try {
        currentManifest = fs.readFileSync(manifestPath, 'utf8');
    } catch (err) {
        /* none yet */
    }
    if (currentManifest !== manifest) {
        try {
            fs.writeFileSync(manifestPath + '.tmp', manifest);
            fs.renameSync(manifestPath + '.tmp', manifestPath);
            result.manifestBuilt = true;
        } catch (err) {
            result.errors.push(manifestPath + ': ' + err.message);
        }
    }
    return result;
}
