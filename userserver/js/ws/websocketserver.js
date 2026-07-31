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

        this._ioServer = new Server(this._protoServer, {
            cors: { origin: '*' }
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
