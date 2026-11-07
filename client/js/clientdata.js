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

// Shared data and map updates pushed by the game server (gameserver/js/
// clientdata.js has the protocol). The files are the shared folder's data/ and
// maps/ json files ("data/lang.json", "maps/maplist.json",
// "maps/map4/map4_0_0.json"), all under one version: this build's is
// config_build.json's "shared_version" (falling back to its "version").
//
// The game client sends that version in a hello just before its login
// (gameclient.js onConnected()). When the game server's version differs it pushes
// every file in one zip; they're kept here -- data/*.json and maps/maplist.json in
// localStorage (read synchronously at start-up through fetchJsonSync(), see
// cachedSharedJson()), the map files in IndexedDB (read as each map loads, see
// loadMapText()). If the zip can't be used, the start-up files that need it are
// asked for one by one straight away, and each map file only when that map is
// about to load. The start-up files are already loaded by then, so when they
// change the page reloads to pick them up (the player logs in again); a change
// to the map files alone needs no reload.

import config from './config.js';

/* global Types, JSZip */

const LS_META = 'clientdata.meta'; // { version, files: { path: sha1 } } -- the server's list
const LS_FILE = 'clientdata.file.'; // + path -> text of a start-up file
const REQUEST_TIMEOUT = 60000;

// ------------------------------------------------------------------- helpers

function lsGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (err) {
        return null;
    }
}

function lsSet(key, value) {
    window.localStorage.setItem(key, value); // throws on quota: callers handle it
}

function lsRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch (err) {
        /* ignore */
    }
}

// The files read at start-up (synchronously): kept in localStorage. The map
// files are big and read later: kept in IndexedDB.
function isStartupFile(path) {
    return path.indexOf('data/') === 0 || path === 'maps/maplist.json';
}

function builtinVersion() {
    const b = config.build || {};
    for (const key of ['shared_version', 'version']) {
        const n = Number(b[key]);
        if (b[key] !== undefined && b[key] !== null && Number.isFinite(n)) return n;
    }
    return 0;
}

function readMeta() {
    try {
        const m = JSON.parse(lsGet(LS_META) || 'null');
        return m && typeof m === 'object' && m.files && typeof m.files === 'object' ? m : null;
    } catch (err) {
        return null;
    }
}

// What the start-up files in use are: the downloaded ones' hashes, or this build's.
function startupFingerprint() {
    const meta = readMeta();
    if (!meta) return 'built-in';
    return Object.keys(meta.files)
        .filter(isStartupFile)
        .sort()
        .map((p) => p + '=' + meta.files[p])
        .join('|');
}

// fixed when this module is first loaded, before any shared data is read
const loadedFingerprint = startupFingerprint();

// sha1 of a string, or null where the browser can't do it (crypto.subtle needs a
// secure context): the check is then skipped.
async function sha1(text) {
    try {
        if (!(window.crypto && window.crypto.subtle)) return null;
        const buf = await window.crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    } catch (err) {
        return null;
    }
}

async function hashMatches(text, expected) {
    const h = await sha1(text);
    return h === null || h === expected;
}

// ---------------------------------------------------------------- IndexedDB

let dbPromise = null;

function db() {
    if (!dbPromise) {
        dbPromise = new Promise(function (resolve) {
            try {
                const req = window.indexedDB.open('clientdata', 1);
                req.onupgradeneeded = function () {
                    req.result.createObjectStore('files');
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            } catch (err) {
                resolve(null);
            }
        });
    }
    return dbPromise;
}

async function dbGet(key) {
    const d = await db();
    if (!d) return undefined;
    return new Promise(function (resolve) {
        try {
            const req = d.transaction('files', 'readonly').objectStore('files').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(undefined);
        } catch (err) {
            resolve(undefined);
        }
    });
}

async function dbPut(key, value) {
    const d = await db();
    if (!d) return;
    await new Promise(function (resolve) {
        try {
            const tx = d.transaction('files', 'readwrite');
            tx.objectStore('files').put(value, key);
            tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
        } catch (err) {
            resolve();
        }
    });
}

// ------------------------------------------------------- talking to the server

let client = null; // the GameClient, once connected
const requests = {}; // path -> { promise, resolve, reject, timer }
let pushDone = Promise.resolve(); // a pushed update still being stored

// The hello, sent by the game client just before its login.
export function sendHello(gameClient) {
    client = gameClient;
    const meta = readMeta();
    client.sendMessage([Types.Messages.CW_CLIENTDATA, 0, meta ? Number(meta.version) : builtinVersion()]);
}

// One file from the game server (WC_CLIENTDATA 1), or a rejection.
function requestFile(path) {
    if (!client) return Promise.reject(new Error('not connected'));
    if (requests[path]) return requests[path].promise;
    const r = {};
    r.promise = new Promise(function (resolve, reject) {
        r.resolve = resolve;
        r.reject = reject;
    });
    r.timer = setTimeout(function () {
        settle(path, null, new Error('no reply for ' + path));
    }, REQUEST_TIMEOUT);
    requests[path] = r;
    client.sendMessage([Types.Messages.CW_CLIENTDATA, 1, path]);
    return r.promise;
}

function settle(path, text, err) {
    const r = requests[path];
    if (!r) return;
    delete requests[path];
    clearTimeout(r.timer);
    if (err) r.reject(err);
    else r.resolve(text);
}

// WC_CLIENTDATA from the game server (gameclient.js).
export function onMessage(data) {
    const type = Number(data[0]);
    if (type === 0) {
        const version = Number(data[1]);
        const files = data[2] || {};
        const zip = data[3];
        pushDone = applyPush(version, files, zip).catch(function (err) {
            console.error('ClientData: update to version ' + version + ' failed (' + err + ')');
        });
    } else if (type === 1) {
        settle(String(data[2]), String(data[3]), null);
    } else if (type === 2) {
        settle(String(data[2]), null, new Error('the game server has no ' + data[2]));
    }
}

function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

async function filesFromZip(b64, files) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip is not loaded');
    const zip = await JSZip.loadAsync(base64ToBytes(b64));
    const out = {};
    for (const path in files) {
        const entry = zip.file(path);
        if (!entry) throw new Error('no ' + path + ' in the zip');
        const text = await entry.async('string');
        if (!(await hashMatches(text, files[path]))) throw new Error(path + ' in the zip does not match');
        out[path] = text;
    }
    return out;
}

// The start-up files one by one (only those whose downloaded copy isn't
// already the server's); the map files are left to loadMapText().
async function startupFilesDirect(files, oldMeta) {
    const out = {};
    for (const path in files) {
        if (!isStartupFile(path)) continue;
        const have = oldMeta && oldMeta.files[path] === files[path] ? lsGet(LS_FILE + path) : null;
        if (have !== null) {
            out[path] = have;
            continue;
        }
        const text = await requestFile(path);
        if (!(await hashMatches(text, files[path]))) throw new Error(path + ' does not match');
        out[path] = text;
    }
    return out;
}

function clearCache() {
    const meta = readMeta();
    if (meta) for (const path in meta.files) if (isStartupFile(path)) lsRemove(LS_FILE + path);
    lsRemove(LS_META);
}

async function applyPush(version, files, zipBase64) {
    if (version === builtinVersion()) {
        // the server is on this build's own files: drop any downloaded copy
        clearCache();
    } else {
        const oldMeta = readMeta();
        let texts;
        try {
            texts = await filesFromZip(zipBase64, files);
        } catch (err) {
            console.warn('ClientData: zip not used (' + err + '): downloading the files one by one.');
            texts = await startupFilesDirect(files, oldMeta);
        }
        lsRemove(LS_META); // never leave a list pointing at half-written files
        try {
            for (const path in texts) {
                if (isStartupFile(path)) lsSet(LS_FILE + path, texts[path]);
                else await dbPut(path, { sha1: files[path], text: texts[path] });
            }
            if (oldMeta)
                for (const path in oldMeta.files)
                    if (isStartupFile(path) && !(path in files)) lsRemove(LS_FILE + path);
            lsSet(LS_META, JSON.stringify({ version: version, files: files }));
        } catch (err) {
            clearCache();
            throw err;
        }
        console.info('ClientData: updated to version ' + version + '.');
    }
    if (startupFingerprint() !== loadedFingerprint) {
        console.info('ClientData: shared data changed: reloading.');
        window.location.reload();
    }
}

// ------------------------------------------------------------ reading files

// fetchJsonSync()'s hook: the downloaded copy of a start-up file for this path
// ("shared/data/lang.json", "./shared/maps/maplist.json"; any ?query ignored),
// or undefined to use this build's.
export function cachedSharedJson(url) {
    const m = /^(?:\.\/)?shared\/((?:data|maps)\/[^?#]+\.json)/.exec(String(url));
    if (!m || !isStartupFile(m[1])) return undefined;
    const meta = readMeta();
    if (!meta || !meta.files[m[1]]) return undefined;
    const text = lsGet(LS_FILE + m[1]);
    if (text === null) return undefined;
    try {
        return JSON.parse(text);
    } catch (err) {
        return undefined;
    }
}

// A map file's text ("map4/map4_0_0.json") from the game server's version of the
// files, or null to use this build's own (map/map.js). Asks the game server for
// it now if the pushed zip couldn't be used.
export async function loadMapText(name) {
    await pushDone;
    const path = 'maps/' + name;
    const meta = readMeta();
    const want = meta && meta.files[path];
    if (!want) return null;
    const cached = await dbGet(path);
    if (cached && cached.sha1 === want && typeof cached.text === 'string') return cached.text;
    const text = await requestFile(path);
    if (!(await hashMatches(text, want))) throw new Error(path + ' does not match');
    await dbPut(path, { sha1: want, text: text });
    return text;
}
