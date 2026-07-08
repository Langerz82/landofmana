import './common.js';
import './data/data.js';

import LogModule from 'log';
import fs from 'fs';
import util from 'util';
import crypto from 'crypto';
import BISON from 'bison';
var useBison = false;
import WS from './ws.js';

import ProductionConfig from './productionconfig.js';
import UserHandler from './user/userhandler.js';
import WorldHandler from './user/worldhandler.js';

import UserMessages from './user/usermessage.js';

//import RedisServer from 'redis-server';

import _ from 'underscore';
import WorldServer from './worldserver.js';
import { Types } from './common.js';
import readlineModule from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

// NOTE: ES modules have no `__dirname`/`__filename` (those are CommonJS-only
// module wrapper variables). This is the standard replacement, needed so
// the `log_file` stream below (which uses `__dirname`) keeps working.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readline = readlineModule.createInterface({
  input: process.stdin,
  output: process.stdout
});

let packageName = "com.retrorpgonline2";

//let verifier = null;

let IO_STATES = {
	MSG_BUYPRODUCT: 1,
	MSG_ERRORPRODUCT: 2,
};

// NOTE: all of the constants below were originally assigned to bare,
// undeclared identifiers (e.g. `G_LATENCY = 75;`). In the old CommonJS/
// sloppy-mode world that implicitly created real properties on Node's
// `global` object, which is how every other file in this project could
// reference `G_TILESIZE`, `mobState`, etc. as bare globals. ES modules are
// always strict mode and never leak to the global object, so that trick no
// longer works. These are now proper module-scoped bindings, exported by
// name so the handful of other converted files that need them
// (formulas.js, mobai.js, pathfinder.js, updater.js, utils.js,
// worldserver.js) can `import` them explicitly instead.

export const G_LATENCY = 75;
export const G_ROUNDTRIP = G_LATENCY * 2;

export const G_TILESIZE = 16;

export const G_FRAME_INTERVALS = 2;
export const G_FRAME_INTERVAL_EXACT = (1000/60);
export const G_FRAME_INTERVAL = ~~(G_FRAME_INTERVAL_EXACT);
export const G_UPDATE_INTERVAL = ~~(G_FRAME_INTERVAL*G_FRAME_INTERVALS);
//G_UPDATE_INTERVAL = (G_UPDATE_INTERVAL_EXACT);
export const G_INTERVAL =( G_UPDATE_INTERVAL * G_FRAME_INTERVALS);

export const G_SPATIAL_SIZE = 32;

export const G_SCREEN_WIDTH = 34;
export const G_SCREEN_HEIGHT = 18;

//G_ROUNDTRIP = G_LATENCY * 2 - G_UPDATE_INTERVAL;

export const ATTACK_INTERVAL = 1000;
export const ATTACK_MAX = 1000;

export const PLAYER_SAVE_INTERVAL = 1800000;

export const mobState = {
    IDLE: 1,
    ROAMING: 2,
    AGGRO: 3,
    CHASING: 4,
    ATTACKING: 5,
    RETURNING: 6,
    STUCK: 7
};

let SAVING_SERVER = false;
let AUCTION_SAVED = false;
let PLAYERS_SAVED = false;
let LOOKS_SAVED = false;

let IS_EXITING = false;

//GDATE = new Date();

/* global log, Player, databaseHandler */

//var worldHandler;
var userHandler = null;
//var main = null;
//var world = null;

//var userHandler;

//worlds = [];
let server = null;
global.server = server;
let world = null;
global.world = world;

// `players`/`hashes` are mutated in place (Map#set/#delete) rather than
// reassigned, so they're safe to export as `const` for the other converted
// files (worldserver.js) that previously reached them as a leaked global.
export const players = new Map();
global.players = players;
//players = [];
export const hashes = new Map();
global.hashes = hashes;

var Main = {};

// NOTE: kept exactly as in the original -- `Main` is exported here, but
// every method actually added below (checkSaved, safe_exit, saveServer,
// closeServer) is attached to the lowercase `main` *function*, not to this
// `Main` object. That mismatch is a pre-existing quirk of the original
// source (and, since nothing in this project ever required './main' for
// its exports, it was never actually exercised); it has not been "fixed"
// here since that's a logic change outside the scope of the ES module
// conversion.
export default Main;

export let MainConfig;
global.MainConfig = MainConfig;

export let log;
global.log = log;
export let gConnection;

var log_file = fs.createWriteStream(__dirname + '/../console.log', {flags : 'w'});
var log_stdout = process.stdout;

/*var get_connect_string = function () {
    if (MainConfig)
      return MainConfig.protocol+'://'+MainConfig.address+':'+MainConfig.port;
    return null;
}*/

function main(config) {

    log = new LogModule(LogModule.INFO || LogModule.DEBUG || LogModule.ERROR);
    global.log = log;
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
    global.MainConfig = config;

    server = new WS.WebsocketServer(config);
    var lastTotalPlayers = 0;
    var self = this;

    console.info("Initializing RRO2 GameServer - World " + worldId);

    world = new WorldServer('world', config.nb_players_per_world, server);
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
        this.send([Types.UserMessages.WU_CONNECT_WORLD]);

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
        console.info("main - onConnect: hash="+hash);

      	console.info(JSON.stringify(config));
      	console.info("version sent");
        console.info(Types.Messages.WC_VERSION);

      	conn.sendUTF8(Types.Messages.WC_VERSION+","+config.version+","+conn.hash);
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

	});

  server._ioServer.on('disconnect', function() {
    console.log('disconnected');
  });

  server._ioServer.on('msg', (message) => {
  console.log("msg="+JSON.stringify(message));
  //io.emit('msg', message);
  });

  /*server._ioServer.connect(1342, "localhost", function () {
    console.info("connected");
  })*/

  var signalHandler = function () {
    main.closeServer();
  };

  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);
  process.on('SIGQUIT', signalHandler);
  process.on('SIGHUP', signalHandler);

  var cmdPrompt = function () {

    if (process.platform === "win32") {
      readline.on("SIGINT", function () {
        process.emit("SIGINT");
      });
    }

    if (!IS_EXITING && readline) {
      readline.question('Command:', function (line) {
        //console.info("line: " + line);
        getInput(line);

        //Utils.utilSleep(100);
        setTimeout(cmdPrompt, 100);
      });
    }
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
  var duration = parseInt(args[1], 10);
  if (!duration) {
    console.info("banplayer - provide how many days banned.");
    return;
  }
  world.ban.banplayer(playerName, duration);
}

function banuser(args) {
  var username = args[0];
  var duration = parseInt(args[1], 10);
  if (!duration) {
    console.info("banuser - provide how many days banned.");
    return;
  }
  world.ban.banuser(username, duration);
}

function notify(args) {
  world.notifyWorld(args.join(" "));
}

function getInput(cmd) {
    var args = cmd.split(" ");
    var cmdarg = args[0];
    args.shift();
    console.info("cmd: " + cmd);

    switch (cmdarg)
    {
      case "notify":
      case "say":
      case "announce":
        notify(args);
        break;
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

main.safe_exit = function () {
    // Gracefully tell the userserver we're going away. Without this, the
    // gameserver's outgoing socket.io-client connection (server.userConn)
    // is just abandoned when the process dies, so the userserver only
    // notices via its ping-timeout instead of its immediate 'disconnect'
    // handler (see userserver/js/main.js server.onDisconnect), which is
    // what actually cleans up its worldHandlers list.
    if (server.userConn) {
        server.userConn.disconnect();
    }
    server.close();
    // Give the disconnect packet a moment to actually flush over the
    // socket before the process dies; process.exit() is immediate and can
    // otherwise cut off the pending write.
    setTimeout(function () {
        process.exit();
    }, 200);
};

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
  IS_EXITING = true;
  main.saveServer();
  readline.close();
  main.checkSaved();
}

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
