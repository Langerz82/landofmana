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
// The files are every .json under the shared folder's data/ and maps/ folders
// (shared/data/lang.json, shared/maps/maplist.json, shared/maps/map4/map4_0_0.json,
// ...), named by their path inside the shared folder ("data/lang.json",
// "maps/map4/map4_0_0.json"). They have one version: config.json's
// "client_data"."shared_version" (falling back to config.json's "version") --
// bump it whenever any of them changes.
//
// Client -> server, CW_CLIENTDATA:
//   [0, version]       hello, sent before the login: the version of the files the
//                      client has
//   [1, path]          one file, when the zip couldn't be used ("data/lang.json",
//                      "maps/map4/map4_0_0.json")
//
// Server -> client, WC_CLIENTDATA:
//   [0, version, { path: sha1 }, base64 zip]   every file, pushed in reply to the hello
//                      when the client's version differs from this server's. The zip
//                      is shared/shared.zip; "" when there is none.
//   [1, version, path, text]                   one file
//   [2, version, path]                         that file can't be served
//
// shared/shared.zip carries the shared_version it was made for in its archive
// comment ("shared_version=114"). At start-up this server rebuilds it from the
// files when it's missing or was made for another version, so bumping
// shared_version is all a data or map change needs; `node tools/sharedzip/make.mjs`
// builds the same zip by hand. While the version stays the same the zip is left
// alone, even if the files change.
//
// The sha1 of every file (read from the files themselves, not the zip) comes with
// the zip so the client can check what it got -- a zip that wasn't remade after a
// change fails that check -- and, if the zip can't be used, tell which files it
// needs to ask for one by one.
//
// Files are read from disk on demand and kept in memory (the zip too); a
// changed file (size or modification time) is picked up on the next request, at
// most every RESCAN_INTERVAL ms, without a restart.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Types } from './common.js';
import { makeZip, readZipComment } from './lib/zipwriter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOLDERS = ['data', 'maps'];
const ZIP_FILE = 'shared.zip';
// shared.zip's archive comment: the shared_version it was made for
const zipComment = (version) => 'shared_version=' + version;
const RESCAN_INTERVAL = 2000;
// CW_CLIENTDATA packets one connection may send (a hello, then the files it
// needs one by one); anything past this is ignored.
const MAX_REQUESTS = 200;

// ---------------------------------------------------------------- the files

// Every .json file under dir, as paths relative to base ("maps/map4/map4_0_0.json").
function listJsonFiles(base, dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(base, dir), { withFileTypes: true });
    } catch (err) {
        return out;
    }
    for (const d of entries) {
        const rel = dir + '/' + d.name;
        if (d.isDirectory()) listJsonFiles(base, rel, out);
        else if (d.isFile() && d.name.toLowerCase().endsWith('.json')) out.push(rel);
    }
    return out;
}

function toNumber(v, fallback) {
    const n = Number(v);
    return v !== undefined && v !== null && v !== '' && Number.isFinite(n) ? n : fallback;
}

class ClientData {
    constructor(config) {
        const cd = (config && config.client_data) || {};
        this.sharedDir = path.resolve(ROOT, cd.shared_dir || 'shared');
        this.version = toNumber(cd.shared_version, toNumber(config && config.version, 0));

        this.files = new Map(); // "data/lang.json" -> { path, data, mtime, sha1 }
        this.hashes = {}; // path -> sha1
        this.zip = null; // base64 of shared/shared.zip, read on first use ('' if there is none)
        this.signature = '';
        this.checkedAt = 0;

        this._refresh(true);
        this._ensureZip();
        console.info(
            'ClientData: ' + this.files.size + ' files (version ' + this.version + ') from ' + this.sharedDir
        );
    }

    // Lists the files and re-reads them if any was added, removed or changed
    // (size / mtime) since the last look. Cheap: only stat() calls unless
    // something changed.
    _refresh(force) {
        const now = Date.now();
        if (!force && now - this.checkedAt < RESCAN_INTERVAL) return;
        this.checkedAt = now;

        const found = [];
        for (const folder of FOLDERS) listJsonFiles(this.sharedDir, folder, found);
        found.sort();
        if (force && found.length === 0) console.warn('ClientData: no files found in ' + this.sharedDir);

        const stats = found.map((rel) => {
            try {
                const st = fs.statSync(path.join(this.sharedDir, rel));
                return [rel, st.size + ':' + st.mtimeMs, st.mtime];
            } catch (err) {
                return [rel, 'missing', null];
            }
        });
        let zipStat = 'none';
        try {
            const st = fs.statSync(path.join(this.sharedDir, ZIP_FILE));
            zipStat = st.size + ':' + st.mtimeMs;
        } catch (err) {
            /* no zip: clients get the files one by one */
        }
        const signature = zipStat + '|' + stats.map((s) => s[0] + ':' + s[1]).join('|');
        if (!force && signature === this.signature) return;
        this.signature = signature;

        const files = new Map();
        for (const [rel, , mtime] of stats) {
            if (!mtime) continue;
            let data;
            try {
                data = fs.readFileSync(path.join(this.sharedDir, rel));
            } catch (err) {
                continue;
            }
            const sha1 = crypto.createHash('sha1').update(data).digest('hex');
            files.set(rel, { path: rel, data, mtime, sha1 });
        }
        this.files = files;
        this.hashes = {};
        for (const f of files.values()) this.hashes[f.path] = f.sha1;
        this.zip = null;
    }

    // Rebuilds shared/shared.zip from the files when it's missing or its archive
    // comment names another shared_version (start-up only).
    _ensureZip() {
        const file = path.join(this.sharedDir, ZIP_FILE);
        const want = zipComment(this.version);
        let current = null;
        try {
            current = readZipComment(fs.readFileSync(file));
        } catch (err) {
            /* no zip yet */
        }
        if (current === want || this.files.size === 0) return;
        const entries = [];
        for (const f of this.files.values()) entries.push({ name: f.path, data: f.data, mtime: f.mtime });
        try {
            const zip = makeZip(entries, want);
            const tmp = file + '.tmp';
            fs.writeFileSync(tmp, zip);
            fs.renameSync(tmp, file);
            this.zip = null;
            console.info(
                'ClientData: ' + ZIP_FILE + ' ' +
                    (current === null ? 'was missing' : 'was made for ' + (current || 'no version')) +
                    ': rebuilt it for shared_version ' + this.version + ' (' + entries.length + ' files, ' +
                    Math.round(zip.length / 1024) + ' KB).'
            );
        } catch (err) {
            console.error('ClientData: could not rebuild ' + file + ' -- ' + err.message);
        }
    }

    _zipBase64() {
        if (this.zip === null) {
            try {
                this.zip = fs.readFileSync(path.join(this.sharedDir, ZIP_FILE)).toString('base64');
            } catch (err) {
                console.warn('ClientData: no ' + ZIP_FILE + ' in ' + this.sharedDir + ': clients will get the files one by one.');
                this.zip = '';
            }
        }
        return this.zip;
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
        this._refresh(false);

        if (type === 0) {
            // hello: push everything when the client's files aren't this version
            if (Number(message[1]) !== this.version && this.files.size > 0)
                conn.send([Types.Messages.WC_CLIENTDATA, 0, this.version, this.hashes, this._zipBase64()]);
            return;
        }

        const rel = String(message[1]);
        const f = this._servableFile(rel);
        if (f) conn.send([Types.Messages.WC_CLIENTDATA, 1, this.version, rel, f.data.toString('utf8')]);
        else conn.send([Types.Messages.WC_CLIENTDATA, 2, this.version, rel]);
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
    if (Number(message[0]) !== 0) conn.send([Types.Messages.WC_CLIENTDATA, 2, 0, String(message[1])]);
}
