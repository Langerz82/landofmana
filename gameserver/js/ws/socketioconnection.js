// Extracted from ws.js: the concrete WS.socketioConnection class (wraps a
// single socket.io Socket for one connected game client). Behavior unchanged.
import { Connection } from './wsbase.js';

/**
 * Connection class for socket.io Socket
 * https://github.com/Automattic/socket.io
 */
export default class SocketioConnection extends Connection {
    constructor(id, connection, server) {
        super(id, connection, server);
        const self = this;

        //this.conn = connection;

        // NOTE: this used to base64-decode `flag` (the single "2" prefix
        // character) instead of the actual payload, so any compressed/large
        // message from a game client failed to decompress. Decode logic now
        // lives in the shared Connection._decodeAndDispatch (see base class
        // above); this connection type only ever needs the plain "2" flag,
        // not the userserver's 'z|' variant, so acceptZPrefix is false.
        const fnOnMessage = function (msg) {
            self._decodeAndDispatch(msg, false);
        };

        this._connection.on('message', fnOnMessage);

        this._connection.on('disconnect', function () {
            console.info(
                'Client closed socket ' + self._connection.conn.remoteAddress
            );
            if (self.closeCallback) {
                self.closeCallback();
            }
            //self._connection.conn.close();
            // FIX: `delete` was applied to the return value of
            // removeConnection() (a plain function call, not a property
            // reference) -- a no-op that did nothing beyond what
            // removeConnection() already does internally (it deletes the
            // entry from this._connections itself). Harmless but misleading;
            // call it directly.
            self._server.removeConnection(self.id);
        });
    }

    // send() lives on the shared Connection base class now (see NOTE there
    // about the 'z|' vs '2' prefix mixup this used to have).

    sendUTF8(data) {
        //console.info("sendUTF8 - "+data);
        this._connection.send(data);
    }

    disconnect() {
        //console.info("USER CONNECTION - DISCONNECT.");
        this._connection.disconnect();
    }
}
