require('./common')

var fs = require('fs');
var crypto = require('crypto');
var Metrics = require('./metrics');
var ProductionConfig = require('./productionconfig');
var User = require('./user');
var WorldHandler = require('./worldhandler');
var Utils = require('./utils');
var redis = require('./redis');
var UserMessages = require('./usermessage');

var _ = require('underscore');
var readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

let packageName = "com.retrorpgonline2";

//let verifier = null;

let IO_STATES = {
	MSG_BUYPRODUCT: 1,
	MSG_ERRORPRODUCT: 2,
};

SAVING_SERVER = false;
AUCTION_SAVED = false;
PLAYERS_SAVED = false;

//GDATE = new Date();

/* global log, Player, databaseHandler */

//worlds = [];
worldHandlers = [];
users = {};
loggedInUsers = {};

player_users = {};

Log = require('log');
var fs = require('fs');
var util = require('util');
var crypto = require('crypto');

var log_file = fs.createWriteStream(__dirname + '/../console.log', {flags : 'w'});
var log_stdout = process.stdout;


function main(config) {

    /*switch(config.debug_level) {
        case "error":
        case "debug":
        case "info":
            log = new Log(Log.INFO || Log.DEBUG || Log.ERROR);
        break;
    }*/

    log = new Log(Log.INFO || Log.DEBUG || Log.ERROR);
    console.isEnabled = true;

    //console.log = console.info;
    Object.defineProperty(log, "log", {
      value: undefined,
      writable: true,
      enumerable: true
    });
    Object.defineProperty(log, "info", {
      value: undefined,
      writable: true,
      enumerable: true
    });
    Object.defineProperty(log, "warn", {
      value: undefined,
      writable: true,
      enumerable: true
    });
    Object.defineProperty(log, "error", {
      value: undefined,
      writable: true,
      enumerable: true
    });

    // redirect stdout / stderr
    log.log = function(d) { //
      var txt = "LOG: " + util.format(d) + '\n';
      //log_file.write(txt);
      //log_stdout.write(txt);
      console.info(txt);
    };
    log.info = function(d) { //
      var txt = "INFO: " + util.format(d) + '\n';
      //log_file.write(txt);
      //log_stdout.write(txt);
      console.info(txt);
    };
    log.warn = function(d) { //
      var txt = "WARN: " + util.format(d) + '\n';
      //log_file.write(txt);
      //log_stdout.write(txt);
      console.warn(txt);
    };
    log.error = function(d) { //
      var txt = "ERROR: " + util.format(d) + '\n';
      //log_file.write(txt);
      //log_stdout.write(txt);
      console.error(txt);
    };

    var production_config = new ProductionConfig(config);
    if(production_config.inProduction()) {
        _.extend(config, production_config.getProductionSettings());
    }
    MainConfig = config;

    var ws = require("./ws");

    var server = new ws.WebsocketServer(config);
    var metrics = config.metrics_enabled ? new Metrics(config) : null;
    var lastTotalPlayers = 0;
    var self = this;

    var DatabaseSelector = require("./databaseselector");

    console.info("Initializing RRO2 GameServer - World ");

    var selector = DatabaseSelector(config);
    selector(config);
    DBH = databaseHandler = new selector(config);

    console.log("REDIS SERVER CREATED!!!!!!!!!!!!!");

    self.handleConnectWorld = function (msg, conn) {
      var wh = new WorldHandler(self, conn);
      conn._connection.worldHandler = wh;
      worldHandlers.push(wh);
    };

    self.handleConnectUser = function (msg, conn) {
      var current_date = (new Date()).valueOf().toString();
      var random = Math.random().toString();
      var hash = crypto.createHash('sha1').update(current_date + random).digest('hex');
      conn.hash = hash;
      console.warn("onConnect: hash="+hash);

      console.info(JSON.stringify(config));
      console.info("version sent");
      console.info("UC_VERSION: "+GameTypes.UserMessages.UC_VERSION);

      conn.sendUTF8(GameTypes.UserMessages.UC_VERSION+","+config.version+","+conn.hash);

      var reply = [GameTypes.UserMessages.UC_WORLDS];
      var i=0;
      for (var wh of worldHandlers)
      {
        var world = wh.world;
        if (!world)
          continue;

        reply.push(i++);
        reply.push(world.name);
        reply.push(world.count);
        reply.push(world.maxCount);
      }
      conn.send(reply);

      var user = new User(self, conn);
      user.hashChallenge = conn.hash;

    };

    server.onConnect(function(conn) {
        var listener = function(message) {
          console.info("recv[0]="+message);
          var action = parseInt(message[0]);
          message.shift();

          switch (action)
          {
            case Types.UserMessages.WU_CONNECT_WORLD:
              self.handleConnectWorld(message, conn);
              break;
            case Types.UserMessages.CU_CONNECT_USER:
              self.handleConnectUser(message, conn);
              break;
          }
        };
        conn.listen(listener);
    });

    server.onError(function() {
        console.error(Array.prototype.join.call(arguments, ", "));
    });

    server.onRequestStatus(function() {
        return JSON.stringify(getWorldDistribution(worlds));
    });

    process.on('uncaughtException', function (e) {
        // Display the full error stack, to aid debugging
        console.info(JSON.stringify(e));

        console.error('uncaughtException: ' + e.stack);

    });

	server._ioServer.on('connection', (socket) => {
	  console.log('connected');
	  socket.on('disconnect', function(){
		   console.log('disconnected - client');

       // Remove WorldHandler if there is one present.
       var wh = socket.worldHandler;
       if (wh) {
         var index = worldHandlers.indexOf(wh);
         worldHandlers.splice(index, 1);
         //worlds.splice(index, 1);
         delete wh;
       }

       this.disconnect();
       delete this;
	  });

	  server._ioServer.on('msg', (message) => {
		    console.log("msg="+JSON.stringify(message));
		    //io.emit('msg', message);
	  });
	});

  var signalHandler = function () {
    closeServer();
  };

  process.on('SIGINT', signalHandler)
  process.on('SIGTERM', signalHandler)
  process.on('SIGQUIT', signalHandler)

  var cmdPrompt = function () {

    if (process.platform === "win32") {
      readline.on("SIGINT", function () {
        process.emit("SIGINT");
      });
    }

    readline.question('Command:', function (line) {
      //console.info("line: " + line);
      getInput(line);

      //Utils.utilSleep(100);
      setTimeout(cmdPrompt, 100);
    });
  };
  /*var cmdStart = function () {
    cmdPrompt();
  };*/

  cmdPrompt();
}

function changePassword (args) {
  var world = worlds[0];
  var username = args[0];
  var password = args[1];

  var hash = crypto.createHash('sha1').update(username+password).digest('hex');
  DBH.savePassword(username, hash);
}

function getInput(cmd) {
    args = cmd.split(" ");
    cmdarg = args[0];
    args.shift();
    console.info("cmd: " + cmd);

    switch (cmdarg)
    {
      case "setpass":
        changePassword(args);
        break;
      case "exit":
      case "quit":
      case 'q':
      case 'x':
        closeServer();
        //process.exit(1);
        break;
      case "s":
      case "save":
        closeServer();
        break;
      case "forcequit":
        closeServer();
        process.exit(1);
        break;
      default:
        console.info("Unknown command.")
    }
}

function checkSaved() {
  var allSavedInterval = setInterval(function () {
    console.info("allSavedInterval");
    var allSaved = true;
    for (var wh of worldHandlers) {
      //console.info("wh.SAVED_AUCTIONS:"+wh.SAVED_AUCTIONS);
      //console.info("wh.SAVED_LOOKS:"+wh.SAVED_LOOKS);
      console.info("wh.SAVED_PLAYERS:"+wh.SAVED_PLAYERS);
      if (!wh.savedWorldState())
      {
        allSaved = false;
        break;
      }
    }
    if (allSaved)
    {
      for (var wh of worldHandlers) {
        wh.sendWorldClose();
      }
      clearInterval(allSavedInterval);
      setTimeout(function () { process.exit(0); }, 2000);
    }
  }, 500);
}

function closeServer() {
  readline.close();
  saveServer();
  checkSaved();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveServer() {
  console.log("saving server!")
  //SAVING_SERVER = true;
  for (var wh of worldHandlers)
  {
      wh.sendWorldSave();
  }
}

function getConfigFile(path, callback) {
    fs.readFile(path, 'utf8', function(err, json_string) {
        if(err) {
            //console.info("This server can be customized by creating a configuration file named: " + err.path);
            callback(null);
        } else {
            callback(JSON.parse(json_string));
        }
    });
}

var defaultConfigPath = './config.json';
var customConfigPath = './config_local.json';

process.argv.forEach(function (val, index, array) {
    if(index === 2) {
        customConfigPath = val;
    }
});

getConfigFile(defaultConfigPath, function(defaultConfig) {
    getConfigFile(customConfigPath, function(localConfig) {
        if(localConfig) {
            main(localConfig);
        } else if(defaultConfig) {
            main(defaultConfig);
        } else {
            console.error("Server cannot start without any configuration file.");
            process.exit(1);
        }
    });
});
