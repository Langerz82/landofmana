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

module.exports = WS;

/**
 * Abstract Server and Connection classes
 */
var sServer = cls.Class.extend({
    init: function () {
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
        this._ioServer.on('connection', function webSocketListener(socket) {
            client_connect(socket);
        });
        this._ioServer.on('connect_error', function (err) {
            console.error(err);
        });

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
    }
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

        this._connection.on('message', function (message) {
          console.info("m="+message);
          console.info(typeof(message));
          var flag = message.charAt(0);
          if (flag === "2")
          {
		        //console.info("recv:"+message);
    				var buffer = Buffer.from(flag, 'base64');

    				zlib.gunzip(buffer, (err, buffer) => {
    					if (err)
    						console.log(err.toString());
    					else {
    						if (self.listenCallback) {
    							if (useBison) {
    								self.listenCallback(BISON.decode(buffer));
    							} else {
    							//console.info("bufferend="+buffer);
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
        				self.listenCallback(BISON.decode(message.substr(1)));
        			} else {
        			   //console.info("message="+message.substr(1));
        				self.listenCallback(JSON.parse(message.substr(1)));
        			}
        		}
    	    }
        });

        this._connection.on('disconnect', function () {
            console.info('Client closed socket ' + self._connection.conn.remoteAddress);
            if (self.closeCallback) {
                self.closeCallback();
            }
            self._connection.conn.close();
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
			    self.sendUTF8('2'+buffer);
		      });
	    }
    	else
    	{
    		self.sendUTF8('1'+data);
    	}
    },

    sendUTF8: function(data) {
        //console.info("sendUTF8 - "+data);
        //try { throw new Error(); } catch (e) { console.warn(e.stack); }
        this._connection.send(data);
    }
});

// Sends a file to the client
/*function sendFile (file, response, log) {
    try {
        var fs = require('fs');
        var realFile = fs.readFileSync(__dirname + '/../shared/' + file);
        var responseHeaders = {
            'Content-Type': 'text/javascript',
            'Content-Length': realFile.length
        };
        response.writeHead(200, responseHeaders);
        response.end(realFile);
    }
    catch (err) {
        response.writeHead(500);
        console.error('Something went wrong when trying to send ' + file);
        console.error('Error stack: ' + err.stack);
    }
}
*/
