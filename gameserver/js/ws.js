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

export default WS;

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

        this.onClose(function (self) {
          this._protoServer.close();
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
                      self.listenCallback(JSON.parse(buffer));
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
                self.listenCallback(JSON.parse(msg.substr(1)));
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
            delete self._server.removeConnection(self.id);
        });
    }

    send(message) {
        //if (message.indexOf("3,")==0);
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
			    buffer = new Buffer(buffer).toString('base64');
			    self.sendUTF8('z|'+buffer);
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
                      self.listenCallback(JSON.parse(buffer));
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
                self.listenCallback(JSON.parse(msg.substr(1)));
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
