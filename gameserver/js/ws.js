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
import { G_DEBUG } from './main.js';

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

    send(message) {
        throw 'Not implemented';
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

        const app = {};
        if (config.https_cert != "") {
          app.cert = fs.readFileSync(config.https_cert);
        }
        if (config.https_key != "") {
          app.key = fs.readFileSync(config.https_key);
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

        const fnOnMessage = function (msg) {
          // PERF: this is the raw entry point for every single message from
          // every connected game client, ahead of any parsing/decompression
          // -- unconditionally logging the raw payload here is even hotter
          // than the per-action logging in packethandler.js. Gated behind
          // G_DEBUG for the same reason.
          if (G_DEBUG)
            console.info("m="+msg);
          const flag = msg.charAt(0);
          if (flag === "2")
          {
              // NOTE: this used to base64-decode `flag` (the single "2" prefix
              // character) instead of the actual payload, so any compressed/
              // large message from a game client failed to decompress. Mirrors
              // the fix already present in WS.userConnection below.
              const buffer = Buffer.from(msg.substr(1), 'base64');
              zlib.gunzip(buffer, (err, buffer) => {
                if (err)
                  console.log(err.toString());
                else {
                  if (self.listenCallback) {
                    if (useBison) {
                      self.listenCallback(BISON.decode(buffer));
                    } else {
                      // FIX: see safeJsonParse above -- don't let a corrupt
                      // decompressed payload throw inside this callback.
                      const parsed = safeJsonParse(buffer, (e) =>
                        console.warn('Dropping malformed compressed message from ' +
                          self._connection.conn.remoteAddress + ': ' + e.message));
                      if (parsed !== undefined) self.listenCallback(parsed);
                    }
                  }
                }
              });
          }
          else
          {
            if (self.listenCallback) {
              if (useBison) {
                self.listenCallback(BISON.decode(msg.substr(1)));
              } else {
                 //console.info("message="+message.substr(1));
                // FIX: see safeJsonParse above -- don't let one malformed
                // message crash this handler (and fall back to the global
                // uncaughtException handler); just drop it and keep the
                // connection alive.
                const parsed = safeJsonParse(msg.substr(1), (e) =>
                  console.warn('Dropping malformed message from ' +
                    self._connection.conn.remoteAddress + ': ' + e.message));
                if (parsed !== undefined) self.listenCallback(parsed);
              }
            }
          }
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

    send(message) {
        //if (message.indexOf("3,")==0);
      // PERF: called for every outgoing packet flush -- gated behind
      // G_DEBUG for the same reason as fnOnMessage above.
      if (G_DEBUG)
        console.info("send="+message);
    	const self = this;
    	let data;
      if (useBison) {
          data = BISON.encode(message);
      } else {
          data = JSON.stringify(message);
      }

      if (data.length >= 2048)
      {
              // FIX: sent with a 'z|' prefix, but this class's own incoming
              // parser (fnOnMessage above) -- and the "2" convention used
              // consistently elsewhere in this file (WS.userConnection.send)
              // -- only recognizes a bare "2" flag for gzip-compressed
              // payloads. Any large message (inventories, world snapshots,
              // etc.) sent to a connected game client used a prefix nothing
              // on the receiving side expects. Also added the same `err`
              // guard userConnection.send() already has, since a gzip
              // failure previously passed `undefined` into `new Buffer(...)`.
		      zlib.gzip(data, {level:1}, (err, buffer) => {
			    if (err) {
			        console.log(err.toString());
			        return;
			    }
			    buffer = new Buffer(buffer).toString('base64');
			    self.sendUTF8('2'+buffer);
		      });
	    }
    	else
    	{
    		self.sendUTF8('1'+data);
    	}
    }

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

        this.fnOnMessage = function (msg) {
          console.info("m="+msg);
          const flag = msg.charAt(0);
          // NOTE: the userserver's socketioConnection.send() (userserver/js/ws.js)
          // prefixes large/compressed messages with 'z|', while this class's own
          // send() below prefixes them with '2'. Both prefixes have to be
          // recognized here since this connection receives messages sent by
          // whichever of those two implementations is on the other end. This
          // used to only check for "2" and also used `flag` (a single character)
          // instead of the actual payload when base64-decoding, so any large
          // message from the userserver (e.g. SendLoadPlayerData) fell through
          // to JSON.parse on a corrupted string and threw.
          const isZPrefixed = msg.charAt(0) === "z" && msg.charAt(1) === "|";
          if (flag === "2" || isZPrefixed)
          {
              const payload = isZPrefixed ? msg.substr(2) : msg.substr(1);
              const buffer = Buffer.from(payload, 'base64');
              zlib.gunzip(buffer, (err, buffer) => {
                if (err)
                  console.log(err.toString());
                else {
                  if (self.listenCallback) {
                    if (useBison) {
                      self.listenCallback(BISON.decode(buffer));
                    } else {
                      // FIX: see safeJsonParse above -- don't let a corrupt
                      // decompressed payload throw inside this callback.
                      const parsed = safeJsonParse(buffer, (e) =>
                        console.warn('Dropping malformed compressed message: ' + e.message));
                      if (parsed !== undefined) self.listenCallback(parsed);
                    }
                  }
                }
              });
          }
          else
          {
            if (self.listenCallback) {
              if (useBison) {
                self.listenCallback(BISON.decode(msg.substr(1)));
              } else {
                 //console.info("message="+message.substr(1));
                // FIX: see safeJsonParse above -- don't let one malformed
                // message crash this handler; just drop it and keep going.
                const parsed = safeJsonParse(msg.substr(1), (e) =>
                  console.warn('Dropping malformed message: ' + e.message));
                if (parsed !== undefined) self.listenCallback(parsed);
              }
            }
          }
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

    send(message) {
        //if (message.indexOf("3,")==0);
      // PERF: called for every outgoing packet flush -- gated behind
      // G_DEBUG for the same reason as fnOnMessage above.
      if (G_DEBUG)
        console.info("send="+message);
    	const self = this;
    	let data;
      if (useBison) {
          data = BISON.encode(message);
      } else {
          data = JSON.stringify(message);
      }

      if (data.length >= 2048)
      {
		      zlib.gzip(data, {level:1}, (err, buffer) => {
			    if (err) {
			        console.error("userConnection.send - gzip failed: " + err);
			        return;
			    }
			    buffer = Buffer.from(buffer).toString('base64');
			    self.sendUTF8('2'+buffer);
		      });
	    }
    	else
    	{
    		self.sendUTF8('1'+data);
    	}
    }

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
