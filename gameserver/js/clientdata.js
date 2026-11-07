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

// Shared data and client map updates, pushed by this game server to its game
// clients over their game connection (CW_CLIENTDATA / WC_CLIENTDATA, see
// shared/js/gametypes.js), so a client gets this server's files without a new
// client build.
//
// The files are every .json under the shared folder's data/ and maps/ folders,
// named by their path inside it ("data/lang.json", "maps/map4/map4_0_0.json"),
// and identified as a set by their shared hash (lib/shareddata.js). No version
// numbers: a client whose files hash differently gets this server's.
//
// Client -> server, CW_CLIENTDATA:
//   [0, hash]          hello, sent before the login: the shared hash of the files
//                      the client has ("" if it doesn't know)
//   [1, path]          one file, when the zip couldn't be used ("data/lang.json",
//                      "maps/map4/map4_0_0.json")
//
// Server -> client, WC_CLIENTDATA:
//   [0, hash, { path: sha1 }, base64 zip]   every file, pushed in reply to the hello
//                      when the client's hash differs from this server's
//   [1, hash, path, text]                   one file
//   [2, hash, path]                         that file can't be served
//
// The files are read and hashed once, at start-up: this server then brings
// shared/shared.zip and shared/manifest.json up to date with them if they aren't,
// and serves what it read from memory until it's restarted -- so restart it after
// changing any of the files. `node tools/sharedzip/make.mjs` brings the zip and
// manifest up to date by hand. The sha1 of every file comes with the zip so the client can
// check what it got and, if the zip can't be used, tell which files it needs to
// ask for one by one.

import path from 'path';
import { fileURLToPath } from 'url';
import { Types } from './common.js';
import {
    FOLDERS,
    ZIP_FILE,
    MANIFEST_FILE,
    listSharedPaths,
    readSharedFiles,
    writeSharedOutputs
} from './lib/shareddata.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// CW_CLIENTDATA packets one connection may send (a hello, then the files it
// needs one by one); anything past this is ignored.
const MAX_REQUESTS = 200;

class ClientData {
    constructor(config) {
        const cd = (config && config.client_data) || {};
        this.sharedDir = path.resolve(ROOT, cd.shared_dir || 'shared');

        this.files = new Map(); // "data/lang.json" -> { path, data, mtime, sha1 }
        this.hashes = {}; // path -> sha1
        this.hash = ''; // the shared hash of the files
        this.zip = ''; // base64 of the zip of the files ('' if there are none)

        this._load();
    }

    // Reads and hashes the files (start-up only) and brings shared.zip and
    // manifest.json up to date with them.
    _load() {
        const files = readSharedFiles(this.sharedDir, listSharedPaths(this.sharedDir));
        this.files = new Map(files.map((f) => [f.path, f]));
        this.hashes = {};
        for (const f of files) this.hashes[f.path] = f.sha1;
        if (files.length === 0) {
            console.warn('ClientData: no files in ' + path.join(this.sharedDir, '{' + FOLDERS.join(',') + '}'));
            this.hash = '';
            this.zip = '';
            return;
        }

        const out = writeSharedOutputs(this.sharedDir, files);
        this.hash = out.hash;
        this.zip = out.zip.toString('base64');
        const made = [out.zipBuilt && ZIP_FILE, out.manifestBuilt && MANIFEST_FILE].filter(Boolean);
        console.info(
            'ClientData: ' + files.length + ' files, shared hash ' + this.hash +
                (made.length ? ' (rebuilt ' + made.join(' and ') + ')' : '')
        );
        for (const e of out.errors)
            console.error('ClientData: could not write ' + e + ' -- clients still get the files from memory.');
    }

    // The file a single-file request may get: a .json file inside the shared
    // folder's data/ or maps/ (format.js already allows only plain relative .json
    // paths), and one of the files listed from disk -- else null. The checks are
    // repeated here so a path can never reach anything else, whatever let it in.
    _servableFile(rel) {
        if (typeof rel !== 'string' || !rel.toLowerCase().endsWith('.json')) return null;
        if (rel.includes('\\') || rel.includes('\0') || path.isAbsolute(rel)) return null;
        const parts = rel.split('/');
        if (!FOLDERS.includes(parts[0]) || parts.some((p) => p === '' || p === '.' || p === '..')) return null;
        const abs = path.resolve(this.sharedDir, rel);
        if (!abs.startsWith(this.sharedDir + path.sep)) return null;
        return this.files.get(rel) || null;
    }

    // Handles a CW_CLIENTDATA packet (already format-checked; the message type
    // shifted off). Requests are counted per connection so a client can't use
    // this to pull data endlessly.
    handlePacket(conn, message) {
        const type = Number(message[0]);
        conn.clientDataRequests = (conn.clientDataRequests || 0) + 1;
        if (conn.clientDataRequests > MAX_REQUESTS) {
            if (conn.clientDataRequests === MAX_REQUESTS + 1)
                console.warn('ClientData: too many requests on connection ' + conn.id + ', ignoring the rest.');
            return;
        }
        if (type === 0) {
            // hello: push everything when the client's files aren't this server's
            if (String(message[1]) !== this.hash && this.files.size > 0)
                conn.send([Types.Messages.WC_CLIENTDATA, 0, this.hash, this.hashes, this.zip]);
            return;
        }

        const rel = String(message[1]);
        const f = this._servableFile(rel);
        if (f) conn.send([Types.Messages.WC_CLIENTDATA, 1, this.hash, rel, f.data.toString('utf8')]);
        else conn.send([Types.Messages.WC_CLIENTDATA, 2, this.hash, rel]);
    }
}

let instance = null;

// Created once at start-up (main.js); null if it couldn't be set up.
export function initClientData(config) {
    try {
        instance = new ClientData(config);
    } catch (err) {
        console.error('ClientData: client data updates disabled -- ' + ((err && err.stack) || err));
        instance = null;
    }
    return instance;
}

// A CW_CLIENTDATA packet from the connection `conn` (before or after login).
export function handleClientDataPacket(conn, message) {
    if (instance) {
        instance.handlePacket(conn, message);
        return;
    }
    if (Number(message[0]) !== 0) conn.send([Types.Messages.WC_CLIENTDATA, 2, '', String(message[1])]);
}
