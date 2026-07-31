// REFACTOR: split out of the old monolithic userserver/js/ws.js (sServer,
// Connection, WS.WebsocketServer, WS.socketioConnection, and a WS.userConnection
// all defined in one ~410-line file), mirroring the equivalent split already
// done for the gameserver (see gameserver/js/ws/wsbase.js's own header). This
// file holds the two abstract base classes (sServer/Connection) plus the
// decode/dispatch and send() logic every concrete connection type shares.
//
// REFACTOR: unlike the gameserver side, there's only one concrete Connection
// subclass here (SocketioConnection, in ./socketioconnection.js) -- the old
// file's WS.userConnection (built on socket.io-client's `.connect()`, the
// same shape as gameserver's genuinely-used UserConnection) was never
// instantiated anywhere in this server. Checked every call site in main.js:
// both a connecting player (CU_CONNECT_USER) and a connecting world/game
// server (WU_CONNECT_WORLD) arrive as the exact same inbound transport
// object -- WebsocketServer's own 'connection' handler always creates a
// SocketioConnection, and main.js only decides which role a given connection
// plays *after* looking at its first message, by wrapping that same
// connection in either a User or a WorldHandler (see main.js's
// handleConnectUser/handleConnectWorld). The userserver never makes an
// outbound socket.io connection anywhere, so there's no second transport
// role to give its own class the way the gameserver's own link *to* this
// server needed one. Dropped rather than carried forward as unused
// scaffolding.
import _ from 'underscore';
import BISON from 'bison';
import zlib from 'zlib';

const useBison = false;

// FIX: JSON.parse (and BISON.decode) on client-controlled bytes used to run
// with no try/catch in either of this file's two message-decode branches
// below. A single malformed payload (truncated JSON, bad base64, etc.) threw
// synchronously inside the socket 'message' event handler -- only prevented
// from crashing the whole process by the blanket
// process.on('uncaughtException', ...) handler in main.js, which just logs
// and swallows it, leaving no record of *which* connection sent the bad data
// and no way to reject just that one message. This helper catches the parse
// error locally so a bad message from one client is dropped/logged instead
// of relying on the global safety net.
function safeJsonParse(raw, onError) {
    try {
        return JSON.parse(raw);
    } catch (e) {
        onError(e);
        return undefined;
    }
}

/**
 * Abstract Server and Connection classes
 */
export class sServer {
    // REFACTOR: `_connections`/`_counter` used to be set here in the base
    // constructor. Moved to WebsocketServer (the only concrete sServer
    // subclass) as class fields instead -- see that file's own comment for
    // why (the old Class.extend()-style prototype-sharing this mirrors was
    // never actually a live bug here, since only one WebsocketServer is ever
    // constructed, but per-instance class fields are the more correct
    // pattern regardless, and matches gameserver/js/ws/wsbase.js's identical
    // choice).
    constructor() {}

    start() {
        if (this.startCallback) this.startCallback(this);
    }

    onStart(callback) {
        this.startCallback = callback;
    }

    onConnect(callback) {
        this.connectionCallback = callback;
    }

    // NOTE: gameserver's equivalent sServer has no onDisconnect/
    // disconnectionCallback -- this one keeps it because, unlike the
    // gameserver side, userserver/js/main.js actually registers one
    // (`server.onDisconnect((socket) => {...})`) to release a disconnected
    // world/game server's WorldHandler. Dropping this would silently break
    // that cleanup path.
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

export class Connection {
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

    // SIMPLIFY: pulled up from being duplicated (near-verbatim, only the
    // logged class name differing) between this server's socketioConnection
    // and the never-instantiated userConnection in the old monolithic
    // ws.js -- see this file's header. Any future second Connection subclass
    // gets this decode/dispatch logic for free instead of needing its own
    // copy, the same way gameserver/js/ws/wsbase.js's version already works
    // for both of its concrete subclasses.
    _decodeAndDispatch(msg) {
        // NOTE: unconditional, unlike gameserver/js/ws/wsbase.js's equivalent
        // log line -- this server has no G_DEBUG-style flag to gate it
        // behind (no constants.js here), so this preserves the old file's
        // existing always-on behavior rather than introducing a new global
        // just for this.
        console.info('m=' + msg);

        const flag = msg.charAt(0);
        // Only a socket.io Socket (this server's real, only connection type)
        // exposes `.conn.remoteAddress`; falls back to undefined harmlessly
        // for anything that doesn't.
        const addr =
            this._connection && this._connection.conn
                ? this._connection.conn.remoteAddress
                : undefined;
        const addrSuffix = addr ? ' from ' + addr : '';

        if (flag === '2') {
            const payload = msg.substr(1);
            const buffer = Buffer.from(payload, 'base64');
            zlib.gunzip(buffer, (err, decompressed) => {
                if (err) {
                    console.log(err.toString());
                    return;
                }
                if (!this.listenCallback) return;
                if (useBison) {
                    this.listenCallback(BISON.decode(decompressed));
                } else {
                    const parsed = safeJsonParse(decompressed, (e) =>
                        console.warn(
                            'Dropping malformed compressed message' +
                                addrSuffix +
                                ': ' +
                                e.message
                        )
                    );
                    if (parsed !== undefined) this.listenCallback(parsed);
                }
            });
        } else {
            if (!this.listenCallback) return;
            if (useBison) {
                this.listenCallback(BISON.decode(msg.substr(1)));
            } else {
                const parsed = safeJsonParse(msg.substr(1), (e) =>
                    console.warn(
                        'Dropping malformed message' + addrSuffix + ': ' + e.message
                    )
                );
                if (parsed !== undefined) this.listenCallback(parsed);
            }
        }
    }

    // SIMPLIFY: pulled up the same way _decodeAndDispatch above was -- both
    // concrete send() methods in the old monolithic ws.js were identical
    // apart from which class name they logged on gzip failure, which
    // `this.constructor.name` below now derives automatically instead of
    // hardcoding.
    //
    // FIX: the >= 2048 branch used to compress with the async zlib.gzip(),
    // only calling sendUTF8() once its callback fired on a later tick, while
    // the `else` branch below sends straight away, synchronously, in the
    // same tick send() was called in. send() is called synchronously, one
    // message at a time, all over this codebase -- so a large (>=2048 byte)
    // message followed immediately by a small one could have its actual wire
    // write happen *after* the smaller message's, reordering otherwise-
    // sequential state on arrival at the other end. gzip at level 1
    // (fastest) is cheap enough to run synchronously here, which keeps every
    // send() call's outbound write in the same relative order it was called
    // in, matching the `else` branch's already-synchronous behavior instead
    // of racing it.
    send(message) {
        console.info('send=' + message);
        const data = useBison ? BISON.encode(message) : JSON.stringify(message);

        if (data.length >= 2048) {
            try {
                const buffer = zlib.gzipSync(data, { level: 1 });
                const encoded = buffer.toString('base64');
                // Must match the "2" flag checked by _decodeAndDispatch above --
                // this server previously had a "z|"/"2" prefix mismatch bug
                // here (see git history); both ends now agree on "2".
                this.sendUTF8('2' + encoded);
            } catch (err) {
                console.error(
                    this.constructor.name + '.send - gzip failed: ' + err.message
                );
            }
        } else {
            this.sendUTF8('1' + data);
        }
    }

    sendUTF8(data) {
        throw new Error('Not implemented');
    }

    close(logError) {
        console.info(
            'Closing connection to ' +
                this._connection.remoteAddress +
                '. ' +
                logError
        );
        this._connection.conn.close();
    }
}
