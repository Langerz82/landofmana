/**
 * @type GameWorld Handler
 */
var cls = require("./lib/class"),
    _ = require("underscore"),
    Log = require('log'),
    Entity = require('./entity/entity'),

    Character = require('./entity/character'),
    NpcStatic = require('./entity/npcstatic'),
    NpcMove = require('./entity/npcmove'),
    Player = require('./entity/player'),
    Item = require('./entity/item'),
    Chest = require('./entity/chest'),
    Mob = require('./entity/mob'),
    Node = require('./entity/node'),
//    Main = require('./main'),
//    Map = require('./map/map'),
    MapManager = require('./map/mapmanager'),
//    MapEntities = require('./mapentities'),

    Messages = require('./message'),

    util = require("util"),
    Pathfinder = require("./pathfinder"),

    Updater = require("./updater"),

    MobCallback = require("./callbacks/mobcallback"),
    NpcMoveCallback = require("./callbacks/npcmovecallback"),
    PlayerCallback = require("./callbacks/playercallback"),

    Auction = require("./world/auction"),
    Looks = require("./world/looks"),

    TaskHandler = require("./world/taskhandler"),
    BanManager = require("./world/banmanager"),
    PartyManager = require("./world/partymanager"),
    LootManager = require("./world/lootmanager");

module.exports = World = cls.Class.extend(
{
    init: function(id, maxPlayers, socket)
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
          var index = self.players.indexOf(player);
          self.players.splice(index,1);
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

            /*player.onDeath(function()
            {
                player.forEachAttacker(function (c) {
                  c.removeAttacker(player);
                  if (c instanceof Mob)
                    c.forgetPlayer(player.id);
                });
            });*/

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

                delete users[player.user.name];
                player.map.entities.removePlayer(player);
                delete player;
            });

            if (self.added_callback)
                self.added_callback();

        });

        self.onRegenTick(function()
        {
            var fnPlayer = function(character)
            {
                if (character instanceof Player)
                {
                    if (!character.isDead && !character.hasFullHealth() && !character.isAttacked())
                    {
                        var packet = character.modHealthBy(Math.floor(character.stats.hpMax / 8));
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
                  self.pushWorld(new Messages.Notify("NOTICE", notify.textid));
                  notify.lastTime = Date.now();
              }
            });
        }, 60000);

    },

    notifyWorld: function (msg) {
      this.pushWorld(new Messages.Notify("GLOBAL", msg));
    },

    stop: function ()
    {
      this.save();
    },

    isSaved: function () {
      return this.PLAYERS_SAVED && this.AUCTIONS_SAVED && this.LOOKS_SAVED
        && this.BANS_SAVED;
    },

    savePlayers: function (update) {
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
    },

    setSaves: function (setSave) {
      this.PLAYERS_SAVED = setSave;
      this.AUCTIONS_SAVED = setSave;
      this.LOOKS_SAVED = setSave;
      this.BANS_SAVED = setSave;
    },

    save: function (update)
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
    },

    update: function () {
      var self = this;

      this.lastUpdateTime = Date.now();
      //console.info("world update called.");

      self.forEachMap(function (map) {
        if (map.updater && Object.keys(map.entities.players).length > 0)
        {
            map.updater.update();
        }
      });
    },

    forEachMap: function (callback) {
      Utils.forEach(this.maps, function (map) {
        if (map && map.ready && map.isLoaded && map.entities && callback)
          callback(map);
      });
    },

    run: function()
    {
        var self = this;

        setInterval(function () {
          self.update();
        }, G_UPDATE_INTERVAL);

        var processPackets = function () {
          self.forEachMap(function (map) {
              if (map.updater &&
                  Object.keys(map.entities.players).length > 0)
              {
                  map.entities.processPackets();
              }
          });
        };
        setInterval(processPackets, 16);

        setInterval(function()
        {
            self.forEachMap(function (map) {
              if (Object.keys(map.entities.players).length > 0)
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
            var players = map.entities.players;
            Utils.forEach(players, function (p) {
              map.entities.mobAI.Roaming(p);
            });
          });
        }, 1000);

        setInterval(function()
        {
            self.save(true);
        }, 600000);
    },

    loggedInPlayer: function(name)
    {
        return typeof (this.getPlayerByName(name)) === "object";
    },

    getPlayerByName: function(name)
    {
        return this.objPlayers[name.toLowerCase()];
    },

    handleDamage: function(entity, attacker, damage, crit)
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
    },

    /*handleHurtEntity: function(entity, attacker)
    {
        var self = this;

        if (!entity || !attacker)
            return;

        if (entity.stats.hp <= 0)
        {
          _.each(entity.attackers, function(e) {
            if (e instanceof Player)
              delete e.knownIds[entity.id];
          });

          entity.die(attacker);
        }
    },*/

    /*onInit: function(callback)
    {
        this.init_callback = callback;
    },*/

    onPlayerConnect: function(callback)
    {
        this.connect_callback = callback;
    },

    onPlayerEnter: function(callback)
    {
        this.enter_callback = callback;
    },

    onPlayerAdded: function(callback)
    {
        this.added_callback = callback;
    },

    onPlayerRemoved: function(callback)
    {
        this.removed_callback = callback;
    },

    onRegenTick: function(callback)
    {
        this.regen_callback = callback;
    },

    /*onPvpRegenTick: function(callback)
    {
        this.pvp_regen_callback = callback;
    },*/

    /*onEntityAttack: function(callback)
    {
        this.attack_callback = callback;
    },*/

    /*onMobMoveCallback: function(mob)
    {
        var self = this;
    },*/

    pushWorld: function(message)
    {
        var self = this;
        self.forEachMap(function (map) {
            var packets = map.entities.packets;
            if (Object.keys(packets).length > 0)
            {
                Utils.forEach(packets, function (packet) {
                  packet.push(message.serialize());
                });
            }
        });
    },

    /*getPopulation: function()
    {
      return this.players.length;
    },*/

});
