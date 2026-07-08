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
import Item from './entity/item.js';
import Chest from './entity/chest.js';
import Mob from './entity/mob.js';
import Node from './entity/node.js';
//import Main from './main.js';
//import Map from './map/map.js';
import MapManager from './map/mapmanager.js';
//import MapEntities from './mapentities.js';

import Messages from './message.js';

import util from "util";
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

//import Utils from './utils.js';
import { G_UPDATE_INTERVAL, players } from './main.js';
import NotifyData from './data/notificationdata.js';

class World {
    constructor(id, maxPlayers, socket)
    {
        var self = this;

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

        self.uselessDebugging = false;

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
          self.players.removeVal(player);
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
            var fnPlayer = function(player)
            {
                if (player instanceof Player)
                {
                    if (!player.isDead && !player.hasFullHealth() && !player.isAttacked())
                    {
                        var packet = player.modHp(Math.floor(player.stats.hpMax / 8));
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

        setInterval(function()
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
        var playerNameList = [];
        Utils.forEach(this.players, function (p) {
          playerNameList.push(p.name);
        });
        this.userHandler.sendPlayersList(playerNameList);
      } else {
        console.warn("worldServer save: no user server connection aborting save.");
        return false;
      }

      Utils.forEach(this.players, function (p) {
        if (update)
          p.save(update);
        else
          p.connection.disconnect();
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
      var self = this;

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
        if (map && map.ready && map.isLoaded && map.entities && callback)
          callback(map);
      });
    }

    run()
    {
        var self = this;

        setInterval(function () {
          self.update();
        }, G_UPDATE_INTERVAL);

        var processPackets = function () {
          self.forEachMap(function (map) {
              if (map.updater &&
                  map.entities.players.size > 0)
              {
                  map.entities.processPackets();
              }
          });
        };
        setInterval(processPackets, 16);

        setInterval(function()
        {
            self.forEachMap(function (map) {
              if (map.entities.players.size > 0)
              {
                map.entities.mobAI.update();
              }
            });
        }, 256);

        setInterval(function()
        {
          for (var p of self.players) {
            if (p.user && (Date.now() - p.user.lastPacketTime) >= 300000)
            {
                p.connection.close("idle timeout");
            }
          }
        }, 60000);

        setInterval(function()
        {
            if (self.regen_callback)
            {
                self.regen_callback();
            }
        }, 10000);

        setInterval(function()
        {
          self.forEachMap(function (map) {
            for (const p of map.entities.players.values()) {
              map.entities.mobAI.Roaming(p);
            }
          });
        }, 1000);

        setInterval(function()
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
      if (entity.effects) {
        console.info("entity.effects: "+JSON.stringify(entity.effects));
        var effects = [];

        Utils.forEach(entity.effects, function (v, k) {
          if (v === 1)
            effects.push(parseInt(k));
        });
      }

      var hpMod = -damage;
      var epMod = 0;
      //var ep= entity.stats.ep || 0;
      //var epMax= entity.stats.epMax || 0;

      console.info("effects: "+JSON.stringify(effects));
      console.info("DAMAGE: "+damage);
      console.info("CRIT: "+crit);

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
        var self = this;
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
