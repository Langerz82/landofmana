// Extracted from ws.js: the concrete WS.WebsocketServer class (the actual
// http(s)+socket.io listener game clients connect to). Behavior unchanged.
import fs from 'fs';
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import { sServer } from './wsbase.js';
import SocketioConnection from './socketioconnection.js';

/**
 * WebsocketServer
 */
export default class WebsocketServer extends sServer {
    // NOTE: in the original `Class.extend()` system, `_connections: {}` and
    // `_counter: 0` were copied onto the shared *prototype*, so (in theory)
    // every instance shared the same `_connections` object unless an
    // instance overwrote it. This app only ever creates a single
    // WebsocketServer, so that quirk was never actually observable. Public
    // class fields (below) give each instance its own copy, which is the
    // more correct behavior and matches what the code already assumed
    // (`this._connections[...]` being per-server).
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
        // not a safe condition to silently continue past).
        const app = {};
        if (config.https_cert != '') {
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
        if (config.https_key != '') {
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

        let protocol = http;
        if (config.protocol === 'https') protocol = https;

        const client_connect = function (socket) {
            console.info(
                'Client socket connected from ' + socket.conn.remoteAddress
            );
            // Add remoteAddress property
            socket.remoteAddress = socket.conn.remoteAddress;

            const c = new SocketioConnection(self._createId(), socket, self);

            if (self.connectionCallback) {
                self.connectionCallback(c);
            }

            self.addConnection(c);
        };

        this._protoServer = protocol.createServer(app);
        this._protoServer.listen(
            config.port,
            config.ip,
            function serverOnlyListening() {
                console.info(
                    'Server (only) is listening on port ' + config.port
                );
            }
        );
        this._ioServer = new Server(this._protoServer, {
            cors: {
                origin: '*'
            }
        });
        // TODO Add one socket connection to Server that connects to User.

        //var c = new WS.UserConnection(self._createId(), socket, self);
        this._ioServer.on('connection', function webSocketListener(socket) {
            client_connect(socket);
        });
        this._ioServer.on('connect_error', function (err) {
            console.error(err);
        });

        // FIX: `close()` invokes this callback as a plain function call
        // (`this._close_callback(this)`), so inside the callback `this` is
        // undefined (ES modules are strict mode) -- the server instance is
        // only available via the `self` parameter, which was being ignored.
        // `server.close()` (used during graceful shutdown in
        // main.safe_exit()) threw instead of ever actually closing the
        // HTTP/HTTPS listener.
        this.onClose(function (self) {
            self._protoServer.close();
        });

        // Add a connect listener
    }

    _createId() {
        return 50000 + this._counter++;
    }

    broadcast(message) {
        this.forEachConnection(function (connection) {
            connection.send(message);
        });
    }

    onRequestStatus(statusCallback) {
        this.statusCallback = statusCallback;
    }

    /*sendUser(message)
    {
      this.userConn.sendUserUTF8(data);
    },

    sendUserUTF8(data) {
      this.userConn.emit("message", data);
    },*/
}
