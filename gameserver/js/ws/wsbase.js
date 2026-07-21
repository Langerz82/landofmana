// Extracted from ws.js: the abstract sServer/Connection base classes shared by
// every concrete transport (WebsocketServer/socketioConnection/userConnection).
// Behavior unchanged -- see ws.js for the FIX/NOTE history on _decodeAndDispatch
// and send() that lives with this code.
import _ from 'underscore';
import BISON from 'bison';
import zlib from 'zlib';
import { G_DEBUG } from '../constants.js';

const useBison = false;

// FIX: JSON.parse on incoming client data was called with no try/catch in any
// of the message handlers below. A single malformed payload (truncated JSON,
// bad base64, etc.) threw synchronously inside the socket 'message' event and
// was only prevented from crashing the whole process by the blanket
// process.on('uncaughtException', ...) handler in main.js -- which just logs
// and swallows it, leaving no record of *which* connection sent the bad data
// and no way to reject just that one message. This helper catches the parse
// error locally so a bad message from one client is dropped/logged without
// relying on the global safety net.
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

    onError(callback) {
        this.errorCallback = callback;
    }

    broadcast(message) {
        throw 'Not implemented';
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
        throw 'Not implemented';
    }

    // SIMPLIFY: WS.socketioConnection and WS.userConnection used to each
    // define their own copy of this decode/dispatch logic (flag check,
    // base64 decode, gunzip, safeJsonParse, listenCallback dispatch),
    // differing only in whether the userserver's 'z|' prefix is recognized
    // and whether a remote address is available to log. Both subclasses now
    // just call this with `acceptZPrefix` set appropriately; behavior for
    // each caller is unchanged (see NOTE on WS.userConnection below re: the
    // 'z|' prefix).
    _decodeAndDispatch(msg, acceptZPrefix) {
        // PERF: this is the raw entry point for every message on either
        // connection type (per-game-client traffic on socketioConnection,
        // gameserver<->userserver traffic on userConnection) -- unconditionally
        // logging the raw payload here is hot, so it's gated behind G_DEBUG.
        if (G_DEBUG) console.info('m=' + msg);

        const flag = msg.charAt(0);
        const isZPrefixed =
            acceptZPrefix && flag === 'z' && msg.charAt(1) === '|';
        // Only socketioConnection's underlying socket.io socket exposes
        // `.conn.remoteAddress`; userConnection's io_client socket doesn't,
        // so this naturally comes out blank there (matching prior behavior).
        const addr =
            this._connection && this._connection.conn
                ? this._connection.conn.remoteAddress
                : undefined;
        const addrSuffix = addr ? ' from ' + addr : '';

        if (flag === '2' || isZPrefixed) {
            const payload = isZPrefixed ? msg.substr(2) : msg.substr(1);
            const buffer = Buffer.from(payload, 'base64');
            zlib.gunzip(buffer, (err, buffer) => {
                if (err) {
                    console.log(err.toString());
                    return;
                }
                if (!this.listenCallback) return;
                if (useBison) {
                    this.listenCallback(BISON.decode(buffer));
                } else {
                    // FIX: see safeJsonParse above -- don't let a corrupt
                    // decompressed payload throw inside this callback.
                    const parsed = safeJsonParse(buffer, (e) =>
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
                // FIX: see safeJsonParse above -- don't let one malformed
                // message crash this handler; just drop it and keep going.
                const parsed = safeJsonParse(msg.substr(1), (e) =>
                    console.warn(
                        'Dropping malformed message' +
                            addrSuffix +
                            ': ' +
                            e.message
                    )
                );
                if (parsed !== undefined) this.listenCallback(parsed);
            }
        }
    }

    // SIMPLIFY: both subclasses duplicated this JSON.stringify / gzip-if-large
    // / base64 / '1'|'2' prefix logic verbatim (only the gzip error log
    // differed). Moved here; subclasses only need to implement sendUTF8().
    send(message) {
        // PERF: called for every outgoing packet flush -- gated behind
        // G_DEBUG for the same reason as _decodeAndDispatch above.
        if (G_DEBUG) console.info('send=' + message);
        const data = useBison ? BISON.encode(message) : JSON.stringify(message);

        if (data.length >= 2048) {
            zlib.gzip(data, { level: 1 }, (err, buffer) => {
                if (err) {
                    console.error(
                        this.constructor.name + '.send - gzip failed: ' + err
                    );
                    return;
                }
                const encoded = Buffer.from(buffer).toString('base64');
                this.sendUTF8('2' + encoded);
            });
        } else {
            this.sendUTF8('1' + data);
        }
    }

    sendUTF8(data) {
        throw 'Not implemented';
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
