// Extracted from ws.js: the concrete WS.userConnection class (the gameserver
// side of the gameserver<->userserver link, built on socket.io-client).
// Behavior unchanged.
import io_client from 'socket.io-client';
import { Connection } from './wsbase.js';
import Utils from '../utils.js';

export default class UserConnection extends Connection {
    constructor(id, connection, server) {
        super(id, connection, server);
        const self = this;

        // NOTE: the userserver's socketioConnection.send() (userserver/js/ws.js)
        // used to prefix large/compressed messages with 'z|'; it now always
        // uses the same '2' prefix this class's own send() (shared
        // Connection.send()) uses, so both ends of this link agree on one
        // format. The shared decoder (wsbase.js's _decodeAndDispatch) no
        // longer accepts a 'z|' variant at all -- see its FIX comment.
        this.fnOnMessage = function (msg) {
            self._decodeAndDispatch(msg);
        };
    }

    connect(connectString) {
        const self = this;

        this._connection = io_client.connect(connectString, {
            reconnect: true,
            rejectUnauthorized: false
        });

        this._connection.on('connect_error', function (err) {
            console.info(
                'Failed to establish a connection to the servers, or lost     connection'
            );
            console.info(JSON.stringify(err));
        });

        this._connection.on('error', function (err) {
            console.error(JSON.stringify(err));
        });

        this._connection.on('message', this.fnOnMessage);

        this._connection.on('connect', function (socket) {
            console.info('CONNECTED! YAYYYY');

            self._connection.off('message').on('message', self.fnOnMessage);
            if (self.connectionUserCallback) self.connectionUserCallback(self);
        });

        const fnDisconnect = function (reason) {
            //try { throw new Error(); } catch (e) { console.error(e.stack); }
            console.info('USER CONNECTION CLOSED. reason=' + reason);
            if (self.closeCallback) {
                self.closeCallback();
            }
            self.disconnect();
            //self._connection.disconnect();
            //self._connection.offAny();
            //delete self._connection;
        };
        this._connection.on('disconnect', fnDisconnect);
    }

    onConnectUser(callback) {
        this.connectionUserCallback = callback;
    }

    // send() lives on the shared Connection base class now.

    disconnect() {
        console.info('USER CONNECTION - DISCONNECT.');
        //this._connection.removeAllListeners(['message']);
        this._connection.disconnect();
        //this._connection.off();
    }

    sendUTF8(data) {
        //console.info("sendUTF8 - "+data);
        if (this._connection) {
            this._connection.emit('message', data);
        } else {
            console.error('this connection not set.');
            // PERF/FIX: consolidated into Utils.captureStack() (utils.js) --
            // the throw/catch was unnecessary; `new Error().stack` alone
            // gives the same trace.
            console.warn(Utils.captureStack());
        }
    }
}
