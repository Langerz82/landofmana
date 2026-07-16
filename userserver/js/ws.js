
import BISON from 'bison';
let useBison = false;
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import url from 'url';
let WS = {};
import zlib from 'zlib';
import connect from 'connect';
import fs from 'fs';
import io_client from 'socket.io-client';

export default WS;

/**
 * Abstract Server and Connection classes
 */
class sServer {
    constructor() {
        this._connections = {};
        this._counter = 0;
    }

    start() {
        if (this.startCallback) this.startCallback(this);
    }

    onStart(callback) {
        this.startCallback = callback;
    }

    onConnect(callback) {
        this.connectionCallback = callback;
    }

    onDisconnect(callback) {
        this.disconnectionCallback = callback;
    }

    onError(callback) {
        this.errorCallback = callback;
    }

    broadcast(message) {
        throw new Error('Not implemented');
    }

    forEachConnection(callback) {
        _.each(this._connections, callback);
    }

    addConnection(connection) {
        this._connections[connection.id] = connection;
    }

    removeConnection(id) {
        delete this._connections[id];
    }

    getConnection(id) {
        return this._connections[id];
    }

    onClose(callback) {
        this._close_callback = callback;
    }

    close() {
        if (this._close_callback) this._close_callback(this);
    }
}

class Connection {
    constructor(id, connection, server) {
        this._connection = connection;
        this._server = server;
        this.id = id;
    }

    onClose(callback) {
        this.closeCallback = callback;
    }

    listen(callback) {
        this.listenCallback = callback;
    }

    broadcast(message) {
        throw new Error('Not implemented');
    }

    send(message) {
        throw new Error('Not implemented');
    }

    sendUTF8(data) {
        throw new Error('Not implemented');
    }

    close(logError) {
        console.info('Closing connection to ' + this._connection.remoteAddress + '. ' + logError);
        this._connection.conn.close();
    }
}

/**
 * WebsocketServer
 */
WS.WebsocketServer = class extends sServer {
    constructor(config) {
        super();
        const self = this;

        let app = {};
        if (config.https_cert) {
            app.cert = fs.readFileSync(config.https_cert);
        }
        if (config.https_key) {
            app.key = fs.readFileSync(config.https_key);
        }

        const protocol = config.protocol === "https" ? https : http;

        const client_connect = (socket) => {
            console.info('Client socket connected from ' + socket.conn.remoteAddress);
            socket.remoteAddress = socket.conn.remoteAddress;

            const c = new WS.socketioConnection(self._createId(), socket, self);

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

        this.onClose(() => {
            this._protoServer.close();
        });
    }

    _createId() {
        return 50000 + (this._counter++);
    }

    broadcast(message) {
        this.forEachConnection((connection) => {
            connection.send(message);
        });
    }

    onRequestStatus(statusCallback) {
        this.statusCallback = statusCallback;
    }
};

/**
 * Connection class for socket.io Socket
 */
WS.socketioConnection = class extends Connection {
    constructor(id, connection, server) {
        super(id, connection, server);
        const self = this;

        const fnOnMessage = (msg) => {
            console.info("m=" + msg);
            const flag = msg.charAt(0);

            // FIX: JSON.parse (and BISON.decode) on client-controlled bytes
            // ran with no try/catch -- a malformed (non-JSON) message threw
            // synchronously inside this 'message' handler. The process-wide
            // uncaughtException handler in main.js kept the server from
            // hard-crashing, but the throw happened mid-dispatch with no
            // defined recovery. Parse defensively and just drop the message
            // on failure instead.
            if (flag === "2") {
                const buffer = Buffer.from(msg.substr(1), 'base64'); // fixed: was using flag only
                zlib.gunzip(buffer, (err, decompressed) => {
                    if (err) console.log(err.toString());
                    else if (self.listenCallback) {
                        try {
                            self.listenCallback(useBison ? BISON.decode(decompressed) : JSON.parse(decompressed));
                        } catch (parseErr) {
                            console.warn("socketioConnection: failed to parse decompressed message, dropping: " + parseErr.message);
                        }
                    }
                });
            } else if (self.listenCallback) {
                const payload = msg.substr(1);
                try {
                    self.listenCallback(useBison ? BISON.decode(payload) : JSON.parse(payload));
                } catch (parseErr) {
                    console.warn("socketioConnection: failed to parse message, dropping: " + parseErr.message);
                }
            }
        };

        this._connection.on('message', fnOnMessage);

        this._connection.on('disconnect', () => {
            console.info('Client closed socket ' + self._connection.conn.remoteAddress);
            if (self.closeCallback) self.closeCallback(self._connection);
            if (self._server.disconnectionCallback) self._server.disconnectionCallback(self);
            self._server.removeConnection(self.id);
        });
    }

    send(message) {
        console.info("send=" + message);
        const self = this;
        const data = useBison ? BISON.encode(message) : JSON.stringify(message);

        if (data.length >= 2048) {
            zlib.gzip(data, { level: 1 }, (err, buffer) => {
                if (!err) {
                    const encoded = Buffer.from(buffer).toString('base64');
                    // Must match the "2" flag checked by fnOnMessage's decompression
                    // branch above (and the flag userConnection.send() below actually
                    // uses) -- sending "z|" here meant every payload >= 2048 bytes was
                    // unparseable garbage on the receiving end.
                    self.sendUTF8('2' + encoded);
                }
            });
        } else {
            self.sendUTF8('1' + data);
        }
    }

    sendUTF8(data) {
        this._connection.send(data);
    }

    disconnect() {
        this._connection.disconnect();
    }
};

/**
 * User Connection (client side)
 */
WS.userConnection = class extends Connection {
    constructor(id, connection, server) {
        super(id, connection, server);
        const self = this;

        this.fnOnMessage = (msg) => {
            console.info("m=" + msg);
            const flag = msg.charAt(0);

            // FIX: same unguarded JSON.parse/BISON.decode issue as
            // socketioConnection above -- a malformed message from the
            // gameserver side of this connection threw synchronously here
            // with no recovery. Parse defensively and drop the message.
            if (flag === "2") {
                const buffer = Buffer.from(msg.substr(1), 'base64');
                zlib.gunzip(buffer, (err, decompressed) => {
                    if (err) console.log(err.toString());
                    else if (self.listenCallback) {
                        try {
                            self.listenCallback(useBison ? BISON.decode(decompressed) : JSON.parse(decompressed));
                        } catch (parseErr) {
                            console.warn("userConnection: failed to parse decompressed message, dropping: " + parseErr.message);
                        }
                    }
                });
            } else if (self.listenCallback) {
                const payload = msg.substr(1);
                try {
                    self.listenCallback(useBison ? BISON.decode(payload) : JSON.parse(payload));
                } catch (parseErr) {
                    console.warn("userConnection: failed to parse message, dropping: " + parseErr.message);
                }
            }
        };
    }

    connect(connectString) {
        const self = this;

        this._connection = io_client.connect(connectString, {
            reconnect: true,
            rejectUnauthorized: false
        });

        this._connection.on('connect_error', (err) => {
            console.info('Failed to establish a connection to the servers, or lost connection');
            console.info(JSON.stringify(err));
        });

        this._connection.on('message', this.fnOnMessage);

        this._connection.on('connect', () => {
            console.info('CONNECTED! YAYYYY');
            if (self.connectionUserCallback) self.connectionUserCallback(self);
        });

        this._connection.on('disconnect', () => {
            console.info('USER CONNECTION CLOSED.');
            if (self.closeCallback) self.closeCallback(self._connection);
            self.disconnect();
        });
    }

    onConnectUser(callback) {
        this.connectionUserCallback = callback;
    }

    send(message) {
        console.info("send=" + message);
        const self = this;
        const data = useBison ? BISON.encode(message) : JSON.stringify(message);

        if (data.length >= 2048) {
            zlib.gzip(data, { level: 1 }, (err, buffer) => {
                if (!err) {
                    const encoded = Buffer.from(buffer).toString('base64');
                    self.sendUTF8('2' + encoded);
                }
            });
        } else {
            self.sendUTF8('1' + data);
        }
    }

    disconnect() {
        console.info("USER CONNECTION - DISCONNECT.");
        if (this._connection) this._connection.disconnect();
    }

    sendUTF8(data) {
        if (this._connection) {
            this._connection.emit("message", data);
        } else {
            console.error("this connection not set.");
        }
    }
};
