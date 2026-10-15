// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
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

// Log redaction: strips player password material out of any text before it
// is written to console.log / reject.log / the terminal.
//
// Only PLAYER passwords are redacted -- server passwords (config
// user_password / redis_password, WU_GAMESERVER_INFO's password field) are
// deliberately left visible in the logs.
//
// What counts as player password material here:
//   - The client's AES-encrypted password ("hash" in CU_LOGIN_USER /
//     CU_CREATE_USER / CU_REMOVE_USER, and the user.hash/player.hash that the
//     userserver forwards to the gameserver). CryptoJS AES output always
//     starts with base64("Salted__") = "U2FsdGVkX1", and the client sends it
//     base64'd once more, which always starts "VTJGc2RHVmtY". The AES key is
//     the per-connection challenge, which is also logged, so this value is
//     effectively the password and must never be logged.
//   - Stored player password hashes: bcrypt ("$2a$"/"$2b$"/"$2y$" strings),
//     and the "hash"/"salt" fields of a logged account record (covers legacy
//     SHA-1 hashes, which are plain hex and can't be recognised by shape).
//
// Applied centrally in main.js's teeToLogFile() wrapper, so every
// console.log/info/warn/error and log.* call passes through it.
//
// NOTE: kept in sync by hand between gameserver/js/redact.js and
// userserver/js/redact.js -- edit both.

const REDACTED = '[REDACTED]';

const VALUE_PATTERNS = [
    // Client AES-encrypted password, as sent on the wire (double base64).
    /VTJGc2RHVmtY[A-Za-z0-9+/=]*/g,
    // Same value after one base64 decode (raw CryptoJS "Salted__" output).
    /U2FsdGVkX1[A-Za-z0-9+/=]*/g,
    // bcrypt hash.
    /\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}/g
];

// Account record "hash"/"salt" fields, in JSON ("hash":"x") and
// util.inspect (hash: 'x') styles.
const KEYED_QUOTED = /(["']?\b(?:hash|salt)\b["']?\s*:\s*)(["'])((?:\\.|(?!\2)[^\\])*)\2/g;

export function redact(text) {
    if (typeof text !== 'string' || text.length === 0) return text;
    let out = text;
    for (const re of VALUE_PATTERNS) out = out.replace(re, REDACTED);
    out = out.replace(KEYED_QUOTED, (match, prefix, quote, value) =>
        value === '' ? match : prefix + quote + REDACTED + quote
    );
    return out;
}

export default redact;
