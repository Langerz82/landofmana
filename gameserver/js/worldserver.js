/**
 * @type GameWorld Handler
 */
import _ from "underscore";
import Log from 'log';
import Entity from './entity/entity.js';

import Character from './entity/character.js';
import NpcStatic from './entity/npcstatic.js';
import NpcMove from './entity/npcmove.js';
import Player from './entity/player.js';
import Mob from './entity/mob.js';
import Node from './entity/node.js';
//import Main from './main.js';
//import Map from './map/map.js';
import MapManager from './map/mapmanager.js';
//import MapEntities from './mapentities.js';

import Messages from './message.js';

import Pathfinder from "./pathfinder.js";

import Updater from "./updater.js";

import MobCallback from "./callbacks/mobcallback.js";
import NpcMoveCallback from "./callbacks/npcmovecallback.js";
import PlayerCallback from "./callbacks/playercallback.js";

import Auction from "./world/auction.js";
import Looks from "./world/looks.js";

import TaskHandler from "./world/taskhandler.js";
import BanManager from "./world/banmanager.js";
import PartyManager from "./world/partymanager.js";

import LootManager from "./world/lootmanager.js";

import Utils from './utils.js';
import { G_UPDATE_INTERVAL, players, G_DEBUG } from './main.js';
import NotifyData from './data/notificationdata.js';
import Scheduler from './scheduler.js';

class World {
    constructor(id, maxPlayers, socket)
    {
        const self = this;

        self.id = id;
        self.maxPlayers = maxPlayers;
        self.socket = socket;

        // New Several Maps per World Server.
        self.mapManager = new MapManager(self);
        self.taskHandler = new TaskHandler();

        self.maps = self.mapManager.maps;

        self.players = [];
        self.objPlayers = {};

        self.ban = new BanManager(self);
        self.party = new PartyManager(self);
        self.loot = new LootManager(self);

        self.mobCallback = new MobCallback();
        self.playerCallback = new PlayerCallback();
        self.npcMoveCallback = new NpcMoveCallback();

        self.itemCount = 0;

        // FIX: removed `self.uselessDebugging = false;` -- dead, never read
        // anywhere in the codebase, just a leftover from an earlier debug
        // pass that was misleading future readers into thinking it did
        // something.

        self.mapManager.onMapsReady(function ()
        {
          console.info("ALL MAPS LOADED BITCHES!");
          self.maps = self.mapManager.maps;
          Utils.forEach(self.maps, function (map, k) {
            map.updater = new Updater(self, map);
          });
        });

        //self.products = JSON.parse(JSON.stringify(Products));

        self.auction = new Auction();
        self.looks = new Looks();

        self.lastUpdateTime = Date.now();

        // FIX: `self._idleStart` was read (in the notification-timer setup
        // further down) but never assigned anywhere, so `notify.lastTime`
        // became NaN at startup and the periodic world-notification system
        // (NotifyData.Notifications) never fired -- `Date.now() - NaN` and
        // any comparison against it is always NaN/false.
        self._idleStart = Date.now();

        self.PLAYERS_SAVED = false;
        self.AUCTIONS_SAVED = false;
        self.LOOKS_SAVED = false;
        self.BANS_SAVED = false;
        /**
         * Handlers
         */
        self.onPlayerConnect(function(player)
        {
          console.info("worldServer - onPlayerConnect.");
          //try { throw new Error(); } catch (e) { console.info(e.stack); }
          if (self.players.indexOf(player) < 0) {
            self.players.push(player);
            self.userHandler.sendWorldPlayerCount(self.players.length,
              self.maxPlayers);
          }
          self.objPlayers[player.name.toLowerCase()] = player;
        });

        self.onPlayerRemoved(function(player) {
          console.info("worldServer - onPlayerRemoved.");
          delete self.objPlayers[player.name.toLowerCase()];
          // FIX: removeVal() was an Array.prototype monkey-patch; migrated to
          // the named Utils.removeFromArray() helper (see utils.js).
          Utils.removeFromArray(self.players, player);
          //self.players.splice(self.players.indexOf(player),1);
          self.userHandler.sendPlayerLogout(player);
          self.userHandler.sendWorldPlayerCount(self.players.length,
            self.maxPlayers);
        });

        self.onPlayerEnter(function(player)
        {
            player.map = self.maps[1];
            player.map.entities.addPlayer(player);

            console.info("Player: " + player.name + " has entered the " + player.map.name + " map.");

            player.map.entities.sendBroadcast(new Messages.Notify("MAP", "MAP_ENTERED", [player.name, player.map.name]), true);

            player.packetHandler.onBroadcast(function(message, ignoreSelf)
            {
                player.map.entities.sendBroadcast(message, ignoreSelf ? player.id : null);
            });

            player.packetHandler.onExit(function(player)
            {
                console.info("worldServer, packetHandler.onExit.");
                //console.info("Player: " + player.name + " has exited the world.");

                self.party.removePlayer(player);

                if (self.removed_callback)
                    self.removed_callback(player);

                console.info("delete user: "+player.user.name);
                players.delete(player.user.name);
                player.map.entities.removePlayer(player);
                //delete player;
                player = null;
            });

            if (self.added_callback)
                self.added_callback();

        });

        self.onRegenTick(function()
        {
            const fnPlayer = function(player)
            {
                if (player instanceof Player)
                {
                    if (!player.isDead && !player.hasFullHealth() && !player.isAttacked())
                    {
                        const packet = player.modHp(Math.floor(player.stats.hpMax / 8));
                    }
                }
            };

            self.forEachMap(function (map) {
                map.entities.forEachPlayer(fnPlayer);
            });
        });

        // Notifications.
        self.notify = NotifyData.Notifications;
        Utils.forEach(self.notify, function (notify) {
            notify.lastTime = Date.now() - self._idleStart;
        });

        // PERF: was its own setInterval(fn, 60000); routed through the
        // shared Scheduler (gameserver/js/scheduler.js) instead. 60s period
        // is far coarser than Scheduler's 50ms resolution, so this is a
        // free consolidation (one fewer live Node timer) with no timing
        // impact.
        Scheduler.every(function()
        {
            Utils.forEach(self.notify, function (notify) {
              if (Date.now() - notify.lastTime >= notify.interval * 60000)
              {
                  self.sendWorld(new Messages.Notify("NOTICE", notify.textid));
                  notify.lastTime = Date.now();
              }
            });
        }, 60000);

    }

    notifyWorld(msg) {
      this.sendWorld(new Messages.Notify("GLOBAL", msg));
    }

    stop()
    {
      this.save();
    }

    isSaved() {
      return this.PLAYERS_SAVED && this.AUCTIONS_SAVED && this.LOOKS_SAVED
        && this.BANS_SAVED;
    }

    savePlayers(update) {
      if (this.userHandler) {
        const playerNameList = [];
        Utils.forEach(this.players, function (p) {
          playerNameList.push(p.name);
        });
        this.userHandler.sendPlayersList(playerNameList);
      } else {
        console.warn("worldServer save: no user server connection aborting save.");
        return false;
      }

      // FIX: this used to disconnect every connected player instead of
      // saving them whenever `update` was falsy -- and the only live caller
      // of world.save() with no argument is main.js's saveServer(), which is
      // bound to the interactive "save"/"s" console command. Typing "save"
      // was actually mass-kicking the server instead of persisting player
      // data. savePlayers() should always persist; shutdown-time disconnects
      // are already handled separately by main.safe_exit() (server.close()
      // / server.userConn.disconnect()), so the disconnect branch here was
      // both misnamed-condition and redundant.
      Utils.forEach(this.players, function (p) {
        p.save(update);
      });
      return true;
    }

    setSaves(setSave) {
      this.PLAYERS_SAVED = setSave;
      this.AUCTIONS_SAVED = setSave;
      this.LOOKS_SAVED = setSave;
      this.BANS_SAVED = setSave;
    }

    save(update)
    {
      if (this.savePlayers(update))
        this.PLAYERS_SAVED = true;

      if (this.auction.save(this))
        this.AUCTIONS_SAVED = true;

      if (this.looks.save(this))
        this.LOOKS_SAVED = true;

      if (this.ban.save()) {
        this.BANS_SAVED = true;
      }

      if (update) {
        this.setSaves(false);
      }
    }

    update() {
      const self = this;

      this.lastUpdateTime = Date.now();
      //console.info("world update called.");

      self.forEachMap(function (map) {
        if (map.updater && map.entities.players.size > 0)
        {
            map.updater.update();
        }
      });
    }

    forEachMap(callback) {
      Utils.forEach(this.maps, function (map) {
        // FIX: was `map.ready` -- map.js's `ready` is a method (registers
        // the onLoad callback), not a flag; see the FIX comment in
        // map.js's initMap() for why relying on it as a boolean here was
        // fragile (it only read "truthy" because a function reference is
        // always truthy, not because it meaningfully signaled load state).
        // `isReady` is the actual boolean map.js sets once loading finishes.
        if (map && map.isReady && map.isLoaded && map.entities && callback)
          callback(map);
      });
    }

    run()
    {
        const self = this;

        // NOTE: these two stay on plain setInterval() rather than the
        // shared Scheduler (gameserver/js/scheduler.js) -- Scheduler's tick
        // resolution is 50ms, which is coarser than both of these periods
        // (G_UPDATE_INTERVAL is ~32ms, this one is 16ms). Routing them
        // through it would silently cap movement smoothness and packet-flush
        // responsiveness to Scheduler's own tick rate instead of their
        // actual configured rate -- a real, player-visible latency
        // regression for zero benefit (neither of these scales with entity
        // count the way the per-entity timers Scheduler targets did; there
        // is and only ever will be exactly one of each).
        setInterval(function () {
          self.update();
        }, G_UPDATE_INTERVAL);

        const processPackets = function () {
          self.forEachMap(function (map) {
              if (map.updater &&
                  map.entities.players.size > 0)
              {
                  map.entities.processPackets();
              }
          });
        };
        setInterval(processPackets, 16);

        // PERF: the remaining ticks below were all their own independent
        // setInterval() calls. All run at 256ms or coarser, well above
        // Scheduler's 50ms resolution, so routing them through
        // Scheduler.every() (self-rescheduling on top of the same shared
        // tick every other one-shot timer in this codebase now uses)
        // trades 6 live Node timers for 0 additional ones, with at most a
        // ~50ms/period (<=20%, and far less for the coarser ones) timing
        // jitter that's irrelevant for mob AI/roaming/regen/idle-checks/
        // saves/notifications.
        Scheduler.every(function()
        {
            self.forEachMap(function (map) {
              if (map.entities.players.size > 0)
              {
                map.entities.mobAI.update();
              }
            });
        }, 256);

        Scheduler.every(function()
        {
          for (const p of self.players) {
            if (p.user && (Date.now() - p.user.lastPacketTime) >= 300000)
            {
                p.connection.close("idle timeout");
            }
          }
        }, 60000);

        Scheduler.every(function()
        {
            if (self.regen_callback)
            {
                self.regen_callback();
            }
        }, 10000);

        Scheduler.every(function()
        {
          self.forEachMap(function (map) {
            for (const p of map.entities.players.values()) {
              map.entities.mobAI.Roaming(p);
            }
          });
        }, 1000);

        Scheduler.every(function()
        {
            self.save(true);
        }, 600000);
    }

    loggedInPlayer(name)
    {
        return typeof (this.getPlayerByName(name)) === "object";
    }

    getPlayerByName(name)
    {
        return this.objPlayers[name.toLowerCase()];
    }

    handleDamage(entity, attacker, damage, crit)
    {
      // FIX: `effects` was declared with `var` *inside* the `if
      // (entity.effects)` block, so for any entity without an `.effects` map
      // (most mobs/players most of the time) `effects` stayed `undefined`
      // for the rest of this function -- silently passing `undefined`
      // instead of an empty array into `JSON.stringify` and into
      // `entity.onDamage(...)` below. Declaring it up front keeps it a
      // well-defined `[]` regardless of which branch runs.
      const effects = [];
      if (entity.effects) {
        // PERF: handleDamage runs on every single hit landed in the game.
        // JSON.stringify-ing the effects map here unconditionally was pure
        // overhead outside of active debugging, so it's gated behind
        // G_DEBUG like the other per-hit/per-packet logging below.
        if (G_DEBUG)
          console.info("entity.effects: "+JSON.stringify(entity.effects));

        Utils.forEach(entity.effects, function (v, k) {
          if (v === 1)
            effects.push(parseInt(k));
        });
      }

      const hpMod = -damage;
      const epMod = 0;
      //var ep= entity.stats.ep || 0;
      //var epMax= entity.stats.epMax || 0;

      if (G_DEBUG) {
        console.info("effects: "+JSON.stringify(effects));
        console.info("DAMAGE: "+damage);
        console.info("CRIT: "+crit);
      }

      //attacker, hpMod, epMod, crit, effects
      entity.onDamage(attacker, hpMod, epMod, crit, effects);
    }

    onPlayerConnect(callback)
    {
        this.connect_callback = callback;
    }

    onPlayerEnter(callback)
    {
        this.enter_callback = callback;
    }

    onPlayerRemoved(callback)
    {
        this.removed_callback = callback;
    }

    onRegenTick(callback)
    {
        this.regen_callback = callback;
    }

    sendWorld(message)
    {
        const self = this;
        self.forEachMap(function (map) {
            map.entities.sendBroadcast(message);
        });
    }

    /*getPopulation()
    {
      return this.players.length;
    },*/

}

export default World;
