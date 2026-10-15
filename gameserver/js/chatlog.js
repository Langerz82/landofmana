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

// Dedicated chat.log: one line per chat message actually sent (world chat
// and successful whispers), with the date/time, the account username, the
// player (character) name, the client's IP address and the message text.
//
// Kept separate from console.log on purpose so chat history is easy to
// review (moderation, abuse reports) without wading through server
// diagnostics. Opened in append mode, unlike console.log, so history
// survives server restarts.
//
// Line format (tab separated, so messages containing " | " etc. can't be
// confused with field boundaries):
//   2026-10-14 11:41:05 +11:00<TAB>user=bob<TAB>player=Bobby<TAB>ip=1.2.3.4<TAB>channel=world<TAB>hello all
//   ...<TAB>channel=whisper to=Alice<TAB>hi
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const chatLogFile = fs.createWriteStream(__dirname + '/../chat.log', {
    flags: 'a'
});
chatLogFile.on('error', (err) => {
    console.error('chatlog - write failed: ' + err.message);
});

const pad = (n) => String(n).padStart(2, '0');

// Server-local time with its UTC offset, e.g. "2026-10-14 11:41:05 +11:00".
function timestamp(d = new Date()) {
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    return (
        d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
        ' ' + sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60)
    );
}

// Client IP from the player's socket.io connection (player.connection is a
// SocketioConnection wrapping the raw socket.io Socket in ._connection).
// Strips the "::ffff:" prefix Node puts on IPv4 addresses. Note: if the
// gameserver ever sits behind a reverse proxy this will be the proxy's IP.
function playerIp(player) {
    const socket = player && player.connection && player.connection._connection;
    const addr =
        (socket && socket.conn && socket.conn.remoteAddress) ||
        (socket && socket.handshake && socket.handshake.address) ||
        'unknown';
    return String(addr).replace(/^::ffff:/, '');
}

// Keep one message per line: a raw newline/tab in a chat message would
// otherwise let a player forge extra log lines or fields.
const oneLine = (s) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ');

export function logChat(player, channel, message) {
    try {
        const username = player && player.user ? player.user.name : 'unknown';
        const line = [
            timestamp(),
            'user=' + oneLine(username),
            'player=' + oneLine(player && player.name),
            'ip=' + playerIp(player),
            'channel=' + oneLine(channel),
            oneLine(message)
        ].join('\t');
        chatLogFile.write(line + '\n');
    } catch (err) {
        // Never let logging break chat itself.
        console.error('chatlog - failed to log chat: ' + err.message);
    }
}

export default logChat;
