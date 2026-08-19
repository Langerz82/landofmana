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
    // differing only in whether the userserver's legacy 'z|' prefix was
    // recognized and whether a remote address is available to log. Both
    // subclasses now just call this; behavior for each caller is unchanged.
    //
    // FIX: dropped the `acceptZPrefix` parameter and its `isZPrefixed`
    // check. 'z|' was userserver/js/ws.js's old compressed-message prefix;
    // that file's socketioConnection.send()/userConnection.send() both now
    // always emit the plain "2" prefix instead (see the FIX comment there
    // -- 'z|' was never even parseable on the receiving end, since nothing
    // here strips it before base64-decoding except this now-removed
    // branch). With no sender left anywhere in this codebase that emits
    // 'z|', the `isZPrefixed` branch and the two-character payload offset
    // it fed into `payload` were unreachable dead code, not a live
    // compatibility path -- removed rather than left as a landmine for a
    // future reader to assume still matters.
    _decodeAndDispatch(msg) {
        // PERF: this is the raw entry point for every message on either
        // connection type (per-game-client traffic on socketioConnection,
        // gameserver<->userserver traffic on userConnection) -- unconditionally
        // logging the raw payload here is hot, so it's gated behind G_DEBUG.
        if (G_DEBUG) console.info('m=' + msg);

        const flag = msg.charAt(0);
        // Only socketioConnection's underlying socket.io socket exposes
        // `.conn.remoteAddress`; userConnection's io_client socket doesn't,
        // so this naturally comes out blank there (matching prior behavior).
        const addr =
            this._connection && this._connection.conn
                ? this._connection.conn.remoteAddress
                : undefined;
        const addrSuffix = addr ? ' from ' + addr : '';

        // FIX: a '2'-flagged (compressed) message used to be decoded via a
        // bare zlib.gunzip() callback with nothing serializing it against
        // any other decode on this same connection, while a plain
        // ('1'-flagged) message dispatched straight to listenCallback()
        // synchronously, immediately. zlib.gunzip() runs on Node's libuv
        // threadpool, so two compressed messages arriving back-to-back on
        // one connection weren't guaranteed to finish decoding in the order
        // they arrived -- and a plain message arriving between them would
        // always cut in line ahead of a still-decoding compressed one
        // regardless. Either way, listenCallback() (the game logic that
        // actually processes the message) could run out of order relative
        // to the bytes' real arrival order. This is the exact mirror image
        // of the ordering bug already fixed for send() below (see its own
        // FIX comment) -- routing every dispatch, compressed or not,
        // through the same kind of per-connection promise chain send()
        // already uses restores strict FIFO processing of incoming
        // messages on this connection, while still doing the decompression
        // work off the synchronous call path.
        this._recvQueue = (this._recvQueue || Promise.resolve()).then(
            () =>
                new Promise((resolve) => {
                    if (flag === '2') {
                        const payload = msg.substr(1);
                        const buffer = Buffer.from(payload, 'base64');
                        zlib.gunzip(buffer, (err, buffer) => {
                            if (err) {
                                console.log(err.toString());
                                resolve();
                                return;
                            }
                            if (!this.listenCallback) {
                                resolve();
                                return;
                            }
                            if (useBison) {
                                this.listenCallback(BISON.decode(buffer));
                            } else {
                                // FIX: see safeJsonParse above -- don't let a
                                // corrupt decompressed payload throw inside
                                // this callback.
                                const parsed = safeJsonParse(buffer, (e) =>
                                    console.warn(
                                        'Dropping malformed compressed message' +
                                            addrSuffix +
                                            ': ' +
                                            e.message
                                    )
                                );
                                if (parsed !== undefined)
                                    this.listenCallback(parsed);
                            }
                            resolve();
                        });
                    } else {
                        if (this.listenCallback) {
                            if (useBison) {
                                this.listenCallback(BISON.decode(msg.substr(1)));
                            } else {
                                // FIX: see safeJsonParse above -- don't let
                                // one malformed message crash this handler;
                                // just drop it and keep going.
                                const parsed = safeJsonParse(
                                    msg.substr(1),
                                    (e) =>
                                        console.warn(
                                            'Dropping malformed message' +
                                                addrSuffix +
                                                ': ' +
                                                e.message
                                        )
                                );
                                if (parsed !== undefined)
                                    this.listenCallback(parsed);
                            }
                        }
                        resolve();
                    }
                })
        );
    }

    // SIMPLIFY: both subclasses duplicated this JSON.stringify / gzip-if-large
    // / base64 / '1'|'2' prefix logic verbatim (only the gzip error log
    // differed). Moved here; subclasses only need to implement sendUTF8().
    send(message) {
        // PERF: called for every outgoing packet flush -- gated behind
        // G_DEBUG for the same reason as _decodeAndDispatch above.
        if (G_DEBUG) console.info('send=' + message);

        // FIX: encoding (JSON.stringify()/BISON.encode()) used to run
        // unguarded here. This is the single choke point every outgoing
        // packet on either connection type passes through -- game-client
        // traffic on socketioConnection, and gameserver<->userserver
        // traffic on userConnection (see the header comment on
        // _decodeAndDispatch above for the same "one class, two callers"
        // shape). A message containing something that can't be encoded (a
        // circular reference, a BigInt, an entity object accidentally
        // passed instead of its plain serialized data, etc.) threw
        // synchronously here, uncaught by anything between this method and
        // whatever called send() -- most of those callers (e.g.
        // user/userhandler.js's/user/worldhandler.js's sendToUserServer())
        // have no try/catch of their own, so this was only ever stopped
        // from crashing the whole process by the blanket
        // process.on('uncaughtException', ...) in main.js, which just logs
        // and swallows it -- abandoning the caller's still-unfinished
        // work partway through (a save, a login handshake, a disconnect
        // cleanup) rather than failing cleanly at just this one packet.
        // Mirrors safeJsonParse's containment on the receive side
        // (_decodeAndDispatch above): catch the encode failure here, log
        // which connection and message type it was, and discard just this
        // one packet instead of throwing. Deliberately not re-serializing
        // `message` itself in the log below -- that's the exact operation
        // that just failed, so logging only its message-type tag (the
        // first element of every CW_*/WC_*/UW_*/WU_* tuple in this
        // codebase) avoids risking a second failure while still saying
        // which kind of packet was lost.
        let data;
        try {
            data = useBison ? BISON.encode(message) : JSON.stringify(message);
        } catch (err) {
            console.error(
                this.constructor.name +
                    '.send - failed to encode outgoing message (type=' +
                    (Array.isArray(message) ? message[0] : typeof message) +
                    '), discarding packet: ' +
                    err.message
            );
            return;
        }

        // FIX: messages under 2048 bytes used to call sendUTF8() directly,
        // synchronously, right here -- while messages at/over that size
        // instead went through an async zlib.gzip() callback before ever
        // reaching sendUTF8(). Two send() calls issued back-to-back (a big
        // one immediately followed by a small one -- e.g. a full
        // inventory/world-state dump followed by a movement/chat update)
        // could therefore have their sendUTF8() calls -- and so the bytes
        // that actually go out on the wire -- fire in the OPPOSITE order
        // from how send() was called: the small message's synchronous path
        // wins the race while the big one is still awaiting its gzip
        // callback. Any code on either end that assumes send-order is
        // preserved (e.g. "send full state, then send a delta") could
        // desync as a result. Routing every send through a per-connection
        // promise chain -- each call's actual sendUTF8() only runs once the
        // previous call's has completed -- restores strict FIFO ordering of
        // outgoing bytes on this connection, while still doing the gzip
        // work off the main synchronous path (only sends on the SAME
        // connection wait on each other; unrelated connections are
        // unaffected, since each Connection instance gets its own chain).
        this._sendQueue = (this._sendQueue || Promise.resolve()).then(
            () =>
                new Promise((resolve) => {
                    if (data.length >= 2048) {
                        zlib.gzip(data, { level: 1 }, (err, buffer) => {
                            if (err) {
                                console.error(
                                    this.constructor.name +
                                        '.send - gzip failed: ' +
                                        err
                                );
                                resolve();
                                return;
                            }
                            const encoded =
                                Buffer.from(buffer).toString('base64');
                            this.sendUTF8('2' + encoded);
                            resolve();
                        });
                    } else {
                        this.sendUTF8('1' + data);
                        resolve();
                    }
                })
        );
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
