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

// Brings shared/shared.zip and shared/manifest.json up to date with every .json
// file under shared/data and shared/maps (see gameserver/js/lib/shareddata.js).
//
// The game server does this itself when it starts (restart it after changing the files), so
// this is only needed to have them up to date without running it -- e.g. before
// committing, or before a client build (the clients ship manifest.json so they
// know the hash of their own files):
//
//     node tools/sharedzip/make.mjs

import path from 'path';
import { fileURLToPath } from 'url';
import { readSharedFiles, writeSharedOutputs, ZIP_FILE, MANIFEST_FILE } from '../../gameserver/js/lib/shareddata.js';

const SHARED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../shared');
const files = readSharedFiles(SHARED);
const out = writeSharedOutputs(SHARED, files);
for (const e of out.errors) console.error('Could not write ' + e);
console.info(
    files.length + ' files, shared hash ' + out.hash + ': ' +
        (out.zipBuilt ? 'rebuilt ' + ZIP_FILE + ' (' + Math.round(out.zip.length / 1024) + ' KB)' : ZIP_FILE + ' already up to date') +
        ', ' + (out.manifestBuilt ? 'rewrote ' + MANIFEST_FILE : MANIFEST_FILE + ' already up to date')
);
if (out.errors.length) process.exitCode = 1;
