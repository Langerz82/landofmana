// Extracted from the old monolithic userserver/js/ws.js -- the one concrete
// Connection subclass this server actually uses. Wraps a single socket.io
// Socket for one connected client, whether that client turns out (once
// main.js sees its first message) to be a player or a connecting world/game
// server -- see wsbase.js's header for why there's only one of these instead
// of a second class the way the gameserver side has. Behavior unchanged from
// the old WS.socketioConnection.
import { Connection } from './wsbase.js';

export default class SocketioConnection extends Connection {
    constructor(id, connection, server) {
        super(id, connection, server);
        const self = this;

        const fnOnMessage = function (msg) {
            self._decodeAndDispatch(msg);
        };

        this._connection.on('message', fnOnMessage);

        this._connection.on('disconnect', function () {
            console.info(
                'Client closed socket ' + self._connection.conn.remoteAddress
            );
            if (self.closeCallback) self.closeCallback(self._connection);
            if (self._server.disconnectionCallback)
                self._server.disconnectionCallback(self);
            self._server.removeConnection(self.id);
        });
    }

    // send() lives on the shared Connection base class now (wsbase.js).

    sendUTF8(data) {
        this._connection.send(data);
    }

    disconnect() {
        this._connection.disconnect();
    }
}
