var _ = require('underscore');
var BISON = require('bison');
var useBison = false;
var cls = require('./lib/class');
var http = require('http');
var https = require('https');
const { Server } = require('socket.io');
var url = require('url');
var Utils = require('./utils');
var WS = {};
var zlib = require('zlib');
var connect = require('connect');
var fs = require('fs');
var io_client = require('socket.io-client');

module.exports = WS;

/**
 * Abstract Server and Connection classes
 */
var sServer = cls.Class.extend({
    init: function () {
    },

    start: function () {
      if (this.startCallback)
        this.startCallback(this);
    },

    onStart: function (callback) {
      this.startCallback = callback;
    },

    onConnect: function (callback) {
        this.connectionCallback = callback;
    },

    onError: function (callback) {
        this.errorCallback = callback;
    },

    broadcast: function (message) {
        throw 'Not implemented';
    },

    forEachConnection: function (callback) {
        _.each(this._connections, callback);
    },

    addConnection: function (connection) {
        this._connections[connection.id] = connection;
    },

    removeConnection: function (id) {
        delete this._connections[id];
    },

    getConnection: function (id) {
        return this._connections[id];
    }
});

var Connection = cls.Class.extend({
    init: function (id, connection, server) {
        this._connection = connection;
        this._server = server;
        this.id = id;
    },

    onClose: function (callback) {
        this.closeCallback = callback;
    },

    listen: function (callback) {
        this.listenCallback = callback;
    },

    broadcast: function (message) {
        throw 'Not implemented';
    },

    send: function (message) {
        throw 'Not implemented';
    },

    sendUTF8: function (data) {
        throw 'Not implemented';
    },

    close: function (logError) {
        console.info('Closing connection to ' + this._connection.remoteAddress + '. ' + logError);
        this._connection.conn.close();
    }
});



/**
 * WebsocketServer
 */
WS.WebsocketServer = sServer.extend({
    _connections: {},
    _counter: 0,

    init: function (config) {
        var self = this;

        this._super();

        var app = {};
        if (config.https_cert != "") {
          app.cert = fs.readFileSync(config.https_cert);
        }
        if (config.https_key != "") {
          app.key = fs.readFileSync(config.https_key);
        }

        var protocol = http;
        if (config.protocol == "https")
          protocol = https;

        var client_connect = function (socket) {
          console.info('Client socket connected from ' + socket.conn.remoteAddress);
          // Add remoteAddress property
          socket.remoteAddress = socket.conn.remoteAddress;

          var c = new WS.socketioConnection(self._createId(), socket, self);

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

        // Add a connect listener

    },

    _createId: function() {
        return 50000 + (this._counter++);
    },

    broadcast: function (message) {
        this.forEachConnection(function(connection) {
            connection.send(message);
        });
    },

    onRequestStatus: function (statusCallback) {
        this.statusCallback = statusCallback;
    },

    /*sendUser: function (message)
    {
      this.userConn.sendUserUTF8(data);
    },

    sendUserUTF8: function(data) {
      this.userConn.emit("message", data);
    },*/

});

/**
 * Connection class for socket.io Socket
 * https://github.com/Automattic/socket.io
 */
WS.socketioConnection = Connection.extend({
    init: function (id, connection, server) {
        var self = this;

        this._super(id, connection, server);
        //this.conn = connection;

        var fnOnMessage = function (msg) {
          console.info("m="+msg);
          var flag = msg.charAt(0);
          if (flag == "2")
          {
              var buffer = Buffer.from(flag, 'base64');
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
    },

    send: function(message) {
        //if (message.indexOf("3,")==0);
      console.info("send="+message);
    	var self = this;
    	var data;
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
    },

    sendUTF8: function(data) {
        //console.info("sendUTF8 - "+data);
        this._connection.send(data);
    },

    disconnect: function () {
      //console.info("USER CONNECTION - DISCONNECT.");
      this._connection.disconnect();
    },

});


WS.userConnection = Connection.extend({
    init: function (id, connection, server) {
        var self = this;

        this._super(id, connection, server);

        this.fnOnMessage = function (msg) {
          console.info("m="+msg);
          var flag = msg.charAt(0);
          if (flag == "2")
          {
              var buffer = Buffer.from(flag, 'base64');
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

    },

    connect: function (connectString) {
      var self = this;

      this._connection = io_client.connect(connectString, {reconnect: true, rejectUnauthorized: false});

      this._connection.on('connect_error', function(err){
        console.info('Failed to establish a connection to the servers, or lost     connection');
        console.info(JSON.stringify(err));
      });

      this._connection.on('message', this.fnOnMessage);

      this._connection.on('connect', function (socket) {
          console.info('CONNECTED! YAYYYY');

          self._connection.off('message').on('message', self.fnOnMessage);
          if (self.connectionUserCallback)
            self.connectionUserCallback(self);
      });

      var fnDisconnect = function () {
          try { throw new Error(); } catch (e) { console.error(e.stack); }
          console.info('USER CONNECTION CLOSED.');
          if (self.closeCallback) {
              self.closeCallback();
          }
          self.disconnect();
          //self._connection.disconnect();
          //self._connection.offAny();
          //delete self._connection;
      };
      this._connection.on('disconnect', fnDisconnect);
    },

    onConnectUser: function (callback) {
      this.connectionUserCallback = callback;
    },

    send: function(message) {
        //if (message.indexOf("3,")==0);
      console.info("send="+message);
    	var self = this;
    	var data;
      if (useBison) {
          data = BISON.encode(message);
      } else {
          data = JSON.stringify(message);
      }

      if (data.length >= 2048)
      {
		      zlib.gzip(data, {level:1}, (err, buffer) => {
			    buffer = new Buffer(buffer).toString('base64');
			    self.sendUTF8('2'+buffer);
		      });
	    }
    	else
    	{
    		self.sendUTF8('1'+data);
    	}
    },

    disconnect: function () {
      console.info("USER CONNECTION - DISCONNECT.");
      //this._connection.removeAllListeners(['message']);
      this._connection.disconnect();
      //this._connection.off();
    },

    sendUTF8: function(data) {
        //console.info("sendUTF8 - "+data);
        if (this._connection) {
          this._connection.emit("message", data);
        } else {
          console.error("this connection not set.");
          try { throw new Error(); } catch (e) { console.warn(e.stack); }
        }
    },
});
