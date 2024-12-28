require('./common');
require('./data/data');

var Log = require('log');
var fs = require('fs');
var util = require('util');
var crypto = require('crypto');
var BISON = require('bison');
var useBison = false;
var WS = require('./ws');

var ProductionConfig = require('./productionconfig');
var UserHandler = require('./userhandler');
var WorldHandler = require('./worldhandler');

var UserMessages = require('./usermessage');

//var RedisServer = require('redis-server');

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


G_LATENCY = 75;
G_ROUNDTRIP = G_LATENCY * 2;

G_TILESIZE = 16;

G_FRAME_INTERVALS = 4;
G_FRAME_INTERVAL_EXACT = (1000/60);
G_FRAME_INTERVAL = ~~(G_FRAME_INTERVAL_EXACT);
G_UPDATE_INTERVAL = ~~(G_FRAME_INTERVAL*G_FRAME_INTERVALS);
//G_UPDATE_INTERVAL = (G_UPDATE_INTERVAL_EXACT);
G_INTERVAL =( G_UPDATE_INTERVAL * G_FRAME_INTERVALS);

G_SPATIAL_SIZE = 32;

G_SCREEN_WIDTH = 34;
G_SCREEN_HEIGHT = 18;

//G_ROUNDTRIP = G_LATENCY * 2 - G_UPDATE_INTERVAL;

ATTACK_INTERVAL = 1000;
ATTACK_MAX = 4000;

PLAYER_SAVE_INTERVAL = 1800000;

mobState = {
    IDLE: 1,
    ROAMING: 2,
    AGGRO: 3,
    CHASING: 4,
    FIRSTATTACK: 5,
    ATTACKING: 6,
    RETURNING: 7,
    STUCK: 8
};

SAVING_SERVER = false;
AUCTION_SAVED = false;
PLAYERS_SAVED = false;
LOOKS_SAVED = false;

//GDATE = new Date();

/* global log, Player, databaseHandler */

//var worldHandler;
var userHandler = null;
//var main = null;
var world = null;
var server = null;

//var userHandler;

//worlds = [];
world = null;
users = {};
//players = [];
hashes = {};

var Main = {};

module.exports = Main;

/*
Log = require('log');
var fs = require('fs');
var util = require('util');
var crypto = require('crypto');
*/

var log_file = fs.createWriteStream(__dirname + '/../console.log', {flags : 'w'});
var log_stdout = process.stdout;

/*var get_connect_string = function () {
    if (MainConfig)
      return MainConfig.protocol+'://'+MainConfig.address+':'+MainConfig.port;
    return null;
}*/

function main(config) {

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

    //main = this;
    var self = this;

    // redirect stdout / stderr
    log.log = function(d) { //
      var txt = "LOG: " + util.format(d) + '\n';
      console.info(txt);
    };
    log.info = function(d) { //
      var txt = "INFO: " + util.format(d) + '\n';
      console.info(txt);
    };
    log.warn = function(d) { //
      var txt = "WARN: " + util.format(d) + '\n';
      console.warn(txt);
    };
    log.error = function(d) { //
      var txt = "ERROR: " + util.format(d) + '\n';
      console.error(txt);
    };

    var production_config = new ProductionConfig(config);
    if(production_config.inProduction()) {
        _.extend(config, production_config.getProductionSettings());
    }
    var worldId = config.world_id;
    MainConfig = config;

    var ws = require("./ws");

    var WorldServer = require("./worldserver");

    server = new ws.WebsocketServer(config);
    var lastTotalPlayers = 0;
    var self = this;

    console.info("Initializing RRO2 GameServer - World " + worldId);

    world = new WorldServer('world'+ i, config.nb_players_per_world, server);
    world.run();
    world.name = config.world_name;

    //server.closeServer = main.closeServer;
    //server.exit = main.exit;
    //server.saveServer = main.saveServer;
    server.onStart(function (server) {
      console.info("server - onInit called.")
      if (!server.userConn) {
        server.userConn = new WS.userConnection(99999, server.userConn, server);
        var connect = config.protocol+'://'+config.user_address+':'+config.user_port;
        server.userConn.connect(connect);
      }

      server.userConn.onConnectUser(function (conn) {
        gConnection = conn;
        console.info("onConnectUser - Connected");
        this.send([GameTypes.UserMessages.WU_CONNECT_WORLD]);

        console.info("server.enterWorld");
        userHandler = new UserHandler(main, server, world, conn);
        server.userHandler = userHandler;
        world.userHandler = userHandler;

        //setTimeout(function () {
          userHandler.sendWorldInfo(config);
        //}, 10000);
      });
    })
    server.start();

    server.onConnect(function(conn) {

        //var self = this;

        var current_date = (new Date()).valueOf().toString();
        var random = Math.random().toString();
        var hash = crypto.createHash('sha1').update(current_date + random).digest('hex');
        conn.hash = hash;
        console.warn("onConnect: hash="+hash);

      	console.info(JSON.stringify(config));
      	console.info("version sent");
        console.info(GameTypes.Messages.WC_VERSION);

      	conn.sendUTF8(GameTypes.Messages.WC_VERSION+","+config.version+","+conn.hash);
        var wh = new WorldHandler(server, conn);
        wh.userConnection = server.userHandler.connection;

        conn.worldHandler = wh;

    });

    server.enterWorld = function (conn)
    {
        console.info("server.enterWorld");
        //console.info(JSON.stringify(conn));
        //var user = new User(self, conn);
        /*var user = {};
        user.hashChallenge = conn.hash;
        user.world = world;
        user.conn = conn;

        return user;*/
    };

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
		console.log('disconnected');
	  });

	  server._ioServer.on('msg', (message) => {
		console.log("msg="+JSON.stringify(message));
		//io.emit('msg', message);
	  });
	});

  /*server._ioServer.connect(1342, "localhost", function () {
    console.info("connected");
  })*/

  var signalHandler = function () {
    main.closeServer();
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
  //setInterval(cmdPrompt, 1000);
  /*process.nextTick(function () {
    for (var w of worlds)
      worlds.update();
  });*/

}

function modgems (args) {
  var playerName = args[0];
  var gems = args[1];

  var player = world.getPlayerByName(playerName);
  if (player && player.user)
    player.user.modifyGems(gems);
}

function modgold (args) {
  var playerName = args[0];
  var gold = args[1];

  var player = world.getPlayerByName(playerName);
  if (player)
    player.modifyGold(gold);
}

function banplayer(args) {
  var playerName = args[0];
  var duration = parseInt(args[1]);
  if (!duration) {
    console.info("banplayer - provide how many days banned.");
    return;
  }
  world.banplayer(playerName, duration);
}

function banuser(args) {
  var username = args[0];
  var duration = parseInt(args[1]);
  if (!duration) {
    console.info("banuser - provide how many days banned.");
    return;
  }
  world.banuser(username, duration);
}

function getInput(cmd) {
    args = cmd.split(" ");
    cmdarg = args[0];
    args.shift();
    console.info("cmd: " + cmd);

    switch (cmdarg)
    {
      case "banplayer":
        banplayer(args);
        break;
      case "banuser":
        banuser(args);
        break;
      case "modgems":
        modgems(args);
        break;
      case "modgold":
        modgold(args);
        break;
      case "exit":
      case "quit":
      case 'q':
      case 'x':
        main.closeServer();
        break;
      case "s":
      case "save":
        main.saveServer();
        break;
      case "forcequit":
        main.closeServer();
        break;
      case "reloadauction":
        reloadAuction();
        break;
      default:
        console.info("Unknown command.")
    }
}

function reloadAuction() {
  _.each(worlds, function(world) {
			world.auction.load();
	});
}

function getWorldDistribution(worlds) {
    var distribution = [];

    _.each(worlds, function(world) {
        distribution.push(world.playerCount);
    });
    return distribution;
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

main.checkSaved = function () {
  console.info("Main - checkSaved!");
  var allSaved = setInterval(function () {
    //console.info("world.PLAYERS_SAVED:"+world.PLAYERS_SAVED);
    //console.info("world.AUCTIONS_SAVED:"+world.AUCTIONS_SAVED);
    //console.info("world.LOOKS_SAVED:"+world.LOOKS_SAVED);
    if (world.isSaved())
    {
      clearInterval(allSaved);
      main.safe_exit();
    }
  }, 500);
}

/*function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}*/

main.saveServer = function () {
  console.info("Main - saveServer!");
  if (world && userHandler) {
    world.userHandler = userHandler;
    world.save();
  }
  else {
    process.exit(1);
  }
}

main.closeServer = function () {
  console.info("Main - closeServer!");
  main.saveServer();
  readline.close();
  main.checkSaved();
}

main.safe_exit = function () {
  //server.userHandler.disconnect();
  setTimeout(function () { process.exit(0); }, 1000);
};

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
