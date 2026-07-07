import * as common from './common.js';

import fs from 'fs';
import crypto from 'crypto';
import Metrics from './metrics.js';
import ProductionConfig from './productionconfig.js';
import User from './user.js';
import WorldHandler from './worldhandler.js';
import Utils from './utils.js';
import redis from './redis.js';
import UserMessages from './usermessage.js';

// Add these:
import ws from './ws.js';
import DatabaseSelector from './databaseselector.js';

//import _ from 'underscore';
import { createInterface } from 'readline';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

const packageName = "com.retrorpgonline2";

const IO_STATES = {
  MSG_BUYPRODUCT: 1,
  MSG_ERRORPRODUCT: 2,
};

let SAVING_SERVER = false;
let AUCTION_SAVED = false;
let PLAYERS_SAVED = false;

// Global setup
import Log from 'log';
import util from 'util';

const log_file = fs.createWriteStream(__dirname + '/../console.log', { flags: 'w' });
const log_stdout = process.stdout;

global.MainConfig = null;
global.DBH = null;
global.databaseHandler = null;
global.worldHandlers = [];
global.users = new Map();

// Logging setup
global.log = new Log(Log.INFO || Log.DEBUG || Log.ERROR);

function setupLogging() {
  console.isEnabled = true;

  // Clear old methods
  Object.defineProperty(log, "log", { value: undefined, writable: true, enumerable: true });
  Object.defineProperty(log, "info", { value: undefined, writable: true, enumerable: true });
  Object.defineProperty(log, "warn", { value: undefined, writable: true, enumerable: true });
  Object.defineProperty(log, "error", { value: undefined, writable: true, enumerable: true });

  log.log = (d) => {
    const txt = `LOG: ${util.format(d)}\n`;
    console.info(txt);
  };

  log.info = (d) => {
    const txt = `INFO: ${util.format(d)}\n`;
    console.info(txt);
  };

  log.warn = (d) => {
    const txt = `WARN: ${util.format(d)}\n`;
    console.warn(txt);
  };

  log.error = (d) => {
    const txt = `ERROR: ${util.format(d)}\n`;
    console.error(txt);
  };
}

async function main(config) {
  const self = this;
  setupLogging();

  const production_config = new ProductionConfig(config);
  if (production_config.inProduction()) {
    Object.assign(config, production_config.getProductionSettings());
  }
  global.MainConfig = config;

  const server = new ws.WebsocketServer(config);
  const metrics = config.metrics_enabled ? new Metrics(config) : null;

  console.info("Initializing RRO2 GameServer - World");

  try {
      const selectorModule = await DatabaseSelector(config);
      const DatabaseHandlerClass = selectorModule.default || selectorModule;

      global.DBH = global.databaseHandler = new DatabaseHandlerClass(config);
      console.log("REDIS SERVER CREATED!!!!!!!!!!!!!");
  } catch (err) {
      console.error("Database handler initialization failed:", err);
      process.exit(1);
  }

  //const selector = DatabaseSelector(config);
  //selector(config);
  //DBH = databaseHandler = new selector(config);

  //console.log("REDIS SERVER CREATED!!!!!!!!!!!!!");

  const handleConnectWorld = (msg, conn) => {
    const wh = new WorldHandler(global, conn);
    conn._connection.worldHandler = wh;
    worldHandlers.push(wh);

    conn.onClose((conn) => {
      if (conn._server.disconnectionCallback) {
        conn._server.disconnectionCallback(conn);
      }
    });
  };

  const handleConnectUser = (msg, conn) => {
    const current_date = Date.now().toString();
    const random = Math.random().toString();
    const hash = crypto.createHash('sha1').update(current_date + random).digest('hex');

    conn.hash = hash;
    console.warn(`onConnect: hash=${hash}`);

    console.info(JSON.stringify(config));
    console.info("version sent");
    console.info(`UC_VERSION: ${GameTypes.UserMessages.UC_VERSION}`);

    conn.sendUTF8(`${GameTypes.UserMessages.UC_VERSION},${config.version},${conn.hash}`);

    const reply = [GameTypes.UserMessages.UC_WORLDS];
    let i = 0;
    for (const wh of worldHandlers) {
      const world = wh.world;
      if (!world) continue;

      reply.push(i++);
      reply.push(world.name);
      reply.push(world.count);
      reply.push(world.maxCount);
    }
    conn.send(reply);

    const user = new User(global, conn);
    user.hashChallenge = conn.hash;

    conn.onClose((conn) => {
      if (user?.hasLoggedIn) {
        users.delete(user.name);
      }
    });
  };

  server.onConnect((conn) => {
    const listener = (message) => {
      console.info(`recv[0]=${message}`);
      const action = parseInt(message[0], 10);
      message.shift();

      switch (action) {
        case GameTypes.UserMessages.WU_CONNECT_WORLD:
          handleConnectWorld(message, conn);
          break;
        case GameTypes.UserMessages.CU_CONNECT_USER:
          handleConnectUser(message, conn);
          break;
      }
    };
    conn.listen(listener);
  });

  server.onDisconnect((socket) => {
    console.log('disconnected - client');

    const wh = socket._connection?.worldHandler;
    if (wh) {
      wh.release();
      worldHandlers = worldHandlers.filter(w => w !== wh);
    }
  });

  server.onError((...args) => {
    console.error(args.join(", "));
  });

  server.onRequestStatus(() => {
    return JSON.stringify(getWorldDistribution(worlds)); // Note: `worlds` not defined in original - check
  });

  process.on('uncaughtException', (e) => {
    console.info(JSON.stringify(e));
    console.error('uncaughtException: ' + e.stack);
  });

  // Socket.io events
  server._ioServer.on('connection', () => {
    console.log('connected');
  });

  server._ioServer.on('msg', (message) => {
    console.log("msg=" + JSON.stringify(message));
  });

  const signalHandler = () => closeServer();

  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);
  process.on('SIGQUIT', signalHandler);

  cmdPrompt();
}

function changePassword(args) {
  // const world = worlds[0]; // `worlds` appears unused / undefined in provided code
  const username = args[0];
  const password = args[1];

  const hash = crypto.createHash('sha1').update(username + password).digest('hex');
  DBH.savePassword(username, hash);
}

function getInput(cmd) {
  const args = cmd.split(" ");
  const cmdarg = args[0];
  args.shift();

  console.info("cmd: " + cmd);

  switch (cmdarg) {
    case "setpass":
      changePassword(args);
      break;
    case "exit":
    case "quit":
    case "q":
    case "x":
    case "s":
    case "save":
      closeServer();
      break;
    case "forcequit":
      closeServer();
      process.exit(1);
      break;
    default:
      console.info("Unknown command.");
  }
}

function checkSaved() {
  const allSavedInterval = setInterval(() => {
    console.info("allSavedInterval");

    const allSaved = worldHandlers.every(wh => wh.savedWorldState());

    if (allSaved) {
      for (const wh of worldHandlers) {
        wh.sendWorldClose();
      }
      clearInterval(allSavedInterval);
      setTimeout(() => process.exit(0), 2000);
    }
  }, 500);
}

function closeServer() {
  readline.close();
  saveServer();
  checkSaved();
}

function saveServer() {
  console.log("saving server!");
  for (const wh of worldHandlers) {
    wh.sendWorldSave();
  }
}

function getConfigFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, json_string) => {
      if (err) {
        resolve(null);
      } else {
        try {
          resolve(JSON.parse(json_string));
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// --- Entry point ---
const defaultConfigPath = './config.json';
let customConfigPath = './config_local.json';

if (process.argv[2]) {
  customConfigPath = process.argv[2];
}

(async () => {
  try {
    const defaultConfig = await getConfigFile(defaultConfigPath);
    const localConfig = await getConfigFile(customConfigPath);

    if (localConfig) {
      main(localConfig);
    } else if (defaultConfig) {
      main(defaultConfig);
    } else {
      console.error("Server cannot start without any configuration file.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Config loading error:", err);
    process.exit(1);
  }
})();

// Helper (if needed)
const cmdPrompt = () => {
  readline.question('Command: ', (line) => {
    getInput(line);
    setTimeout(cmdPrompt, 100);
  });
};
