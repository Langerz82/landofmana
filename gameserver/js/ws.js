import _ from 'underscore';
import BISON from 'bison';
const useBison = false;
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import url from 'url';
//import Utils from './utils.js';
const WS = {};
import zlib from 'zlib';
import connect from 'connect';
import fs from 'fs';
import io_client from 'socket.io-client';
import { G_DEBUG } from './constants.js';

export default WS;

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
class sServer {
    constructor() {
    }

    start() {
      if (this.startCallback)
        this.startCallback(this);
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
      if (this._close_callback)
        this._close_callback(this);
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
        if (G_DEBUG)
          console.info("m="+msg);

        const flag = msg.charAt(0);
        const isZPrefixed = acceptZPrefix && flag === "z" && msg.charAt(1) === "|";
        // Only socketioConnection's underlying socket.io socket exposes
        // `.conn.remoteAddress`; userConnection's io_client socket doesn't,
        // so this naturally comes out blank there (matching prior behavior).
        const addr = this._connection && this._connection.conn ? this._connection.conn.remoteAddress : undefined;
        const addrSuffix = addr ? (' from ' + addr) : '';

        if (flag === "2" || isZPrefixed) {
            const payload = isZPrefixed ? msg.substr(2) : msg.substr(1);
            const buffer = Buffer.from(payload, 'base64');
            zlib.gunzip(buffer, (err, buffer) => {
              if (err) { console.log(err.toString()); return; }
              if (!this.listenCallback) return;
              if (useBison) {
                this.listenCallback(BISON.decode(buffer));
              } else {
                // FIX: see safeJsonParse above -- don't let a corrupt
                // decompressed payload throw inside this callback.
                const parsed = safeJsonParse(buffer, (e) =>
                  console.warn('Dropping malformed compressed message' + addrSuffix + ': ' + e.message));
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
                console.warn('Dropping malformed message' + addrSuffix + ': ' + e.message));
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
      if (G_DEBUG)
        console.info("send="+message);
      const data = useBison ? BISON.encode(message) : JSON.stringify(message);

      if (data.length >= 2048) {
        zlib.gzip(data, {level:1}, (err, buffer) => {
          if (err) {
              console.error(this.constructor.name + '.send - gzip failed: ' + err);
              return;
          }
          const encoded = Buffer.from(buffer).toString('base64');
          this.sendUTF8('2'+encoded);
        });
      } else {
        this.sendUTF8('1'+data);
      }
    }

    sendUTF8(data) {
        throw 'Not implemented';
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
        if (config.https_cert != "") {
          try {
            app.cert = fs.readFileSync(config.https_cert);
          } catch (err) {
            throw new Error("WebsocketServer: failed to read config.https_cert (\""+config.https_cert+"\"): "+err.message);
          }
        }
        if (config.https_key != "") {
          try {
            app.key = fs.readFileSync(config.https_key);
          } catch (err) {
            throw new Error("WebsocketServer: failed to read config.https_key (\""+config.https_key+"\"): "+err.message);
          }
        }

        let protocol = http;
        if (config.protocol === "https")
          protocol = https;

        const client_connect = function (socket) {
          console.info('Client socket connected from ' + socket.conn.remoteAddress);
          // Add remoteAddress property
          socket.remoteAddress = socket.conn.remoteAddress;

          const c = new WS.socketioConnection(self._createId(), socket, self);

          if (self.connectionCallback) {
              self.connectionCallback(c);
          }

          self.addConnection(c);
        };

        this._protoServer = protocol.createServer(app);
        this._protoServer.listen(config.port, config.ip, function serverOnlyListening() {
            console.info('Server (only) is listening on port ' + config.port);
        });
        this._ioServer = new Server(this._protoServer, {
          cors: {
            origin: '*',
          },
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
        return 50000 + (this._counter++);
    }

    broadcast(message) {
        this.forEachConnection(function(connection) {
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

};

/**
 * Connection class for socket.io Socket
 * https://github.com/Automattic/socket.io
 */
WS.socketioConnection = class extends Connection {
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
            console.info('Client closed socket ' + self._connection.conn.remoteAddress);
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

};


WS.userConnection = class extends Connection {
    constructor(id, connection, server) {
        super(id, connection, server);
        const self = this;

        // NOTE: the userserver's socketioConnection.send() (userserver/js/ws.js)
        // prefixes large/compressed messages with 'z|', while this class's own
        // send() (shared Connection.send() now) prefixes them with '2'. Both
        // prefixes have to be recognized here since this connection receives
        // messages sent by whichever of those two implementations is on the
        // other end -- so unlike WS.socketioConnection above, this one passes
        // acceptZPrefix=true into the shared decoder.
        this.fnOnMessage = function (msg) {
          self._decodeAndDispatch(msg, true);
        };

    }

    connect(connectString) {
      const self = this;

      this._connection = io_client.connect(connectString, {reconnect: true, rejectUnauthorized: false});

      this._connection.on('connect_error', function(err){
        console.info('Failed to establish a connection to the servers, or lost     connection');
        console.info(JSON.stringify(err));
      });

      this._connection.on('error', function(err){
        console.error(JSON.stringify(err));
      });

      this._connection.on('message', this.fnOnMessage);

      this._connection.on('connect', function (socket) {
          console.info('CONNECTED! YAYYYY');

          self._connection.off('message').on('message', self.fnOnMessage);
          if (self.connectionUserCallback)
            self.connectionUserCallback(self);
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
      console.info("USER CONNECTION - DISCONNECT.");
      //this._connection.removeAllListeners(['message']);
      this._connection.disconnect();
      //this._connection.off();
    }

    sendUTF8(data) {
        //console.info("sendUTF8 - "+data);
        if (this._connection) {
          this._connection.emit("message", data);
        } else {
          console.error("this connection not set.");
          try { throw new Error(); } catch (e) { console.warn(e.stack); }
        }
    }
};
