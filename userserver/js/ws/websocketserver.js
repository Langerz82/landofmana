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

// Extracted from the old monolithic userserver/js/ws.js -- the concrete
// WS.WebsocketServer class (the actual http(s)+socket.io listener both
// players and connecting world/game servers connect to). Mirrors
// gameserver/js/ws/websocketserver.js's own split.
import fs from 'fs';
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import { sServer } from './wsbase.js';
import SocketioConnection from './socketioconnection.js';

export default class WebsocketServer extends sServer {
    // NOTE: in the original `Class.extend()` system this codebase used
    // before ES classes, `_connections: {}` and `_counter: 0` were copied
    // onto the shared *prototype*, so (in theory) every instance shared the
    // same `_connections` object unless an instance overwrote it. This app
    // only ever creates a single WebsocketServer, so that quirk was never
    // actually observable. Public class fields (below) give each instance
    // its own copy, which is the more correct behavior and matches
    // gameserver/js/ws/websocketserver.js's identical choice.
    _connections = {};
    _counter = 0;

    constructor(config) {
        super();
        const self = this;

        // FIX: these two readFileSync() calls had no try/catch, so a bad
        // path in config (typo, wrong working directory, file removed/
        // rotated since config was written) threw an unhandled ENOENT deep
        // inside `fs` at startup -- a generic Node stack trace with no
        // indication of which config field or file was actually the
        // problem. Wrapping each individually and re-throwing with the
        // field name and path attached turns that into an actionable error
        // message while still failing startup immediately (a missing
        // cert/key when https_cert/https_key is explicitly configured is
        // not a safe condition to silently continue past). Matches the same
        // fix already made on the gameserver side (websocketserver.js).
        const app = {};
        if (config.https_cert) {
            try {
                app.cert = fs.readFileSync(config.https_cert);
            } catch (err) {
                throw new Error(
                    'WebsocketServer: failed to read config.https_cert ("' +
                        config.https_cert +
                        '"): ' +
                        err.message
                );
            }
        }
        if (config.https_key) {
            try {
                app.key = fs.readFileSync(config.https_key);
            } catch (err) {
                throw new Error(
                    'WebsocketServer: failed to read config.https_key ("' +
                        config.https_key +
                        '"): ' +
                        err.message
                );
            }
        }

        const protocol = config.protocol === 'https' ? https : http;

        const client_connect = (socket) => {
            console.info(
                'Client socket connected from ' + socket.conn.remoteAddress
            );
            socket.remoteAddress = socket.conn.remoteAddress;

            const c = new SocketioConnection(self._createId(), socket, self);

            if (self.connectionCallback) {
                self.connectionCallback(c);
            }

            self.addConnection(c);
        };

        this._protoServer = protocol.createServer(app);
        this._protoServer.listen(config.port, config.ip, () => {
            console.info('Server (only) is listening on port ' + config.port);
        });

        // Optional IP allowlist (config.allowed_ips, an array). Checked in
        // socket.io's allowRequest hook, i.e. during the HTTP handshake,
        // before a connection is accepted or any message is processed.
        // Missing/empty = allow every address. Only the socket's own remote
        // address is trusted -- never X-Forwarded-For, which a client can set
        // to anything (so don't use this behind a reverse proxy as-is).
        const normalizeIp = (addr) => {
            let ip = String(addr || '').trim();
            if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
            if (ip === '::1') ip = '127.0.0.1'; // IPv6 loopback = localhost
            return ip;
        };
        const allowedIps = Array.isArray(config.allowed_ips)
            ? new Set(config.allowed_ips.map(normalizeIp).filter(Boolean))
            : null;
        const allowRequest =
            allowedIps && allowedIps.size > 0
                ? (req, callback) => {
                      const ip = normalizeIp(req.socket && req.socket.remoteAddress);
                      if (allowedIps.has(ip)) return callback(null, true);
                      console.warn(
                          'WebsocketServer :' + config.port +
                              ' refused connection from ' + ip + ' (not in allowed IP list)'
                      );
                      callback('forbidden', false);
                  }
                : undefined;

        this._ioServer = new Server(this._protoServer, {
            cors: { origin: '*' },
            ...(allowRequest ? { allowRequest } : {}),
            // socket.io's own per-message size limit (default 1 MB). The
            // internal gameserver listener raises it (see main.js) since it
            // carries full player saves; the public client listener keeps the
            // default.
            maxHttpBufferSize: config.max_http_buffer_size || 1e6
        });

        this._ioServer.on('connection', client_connect);
        this._ioServer.on('connect_error', (err) => {
            console.error(err);
        });

        // Arrow function -- `this` here is already the enclosing
        // WebsocketServer instance (unlike a plain `function`, which the
        // base class's close() would invoke as `this._close_callback(this)`
        // and so would need the callback's own parameter to reach the
        // server instance instead of shadowing it).
        this.onClose(() => {
            this._protoServer.close();
        });
    }

    _createId() {
        return 50000 + this._counter++;
    }

    broadcast(message) {
        this.forEachConnection((connection) => {
            connection.send(message);
        });
    }

    onRequestStatus(statusCallback) {
        this.statusCallback = statusCallback;
    }
}
