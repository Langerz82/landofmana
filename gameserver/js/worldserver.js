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
    Map = require('./map'),
    MapManager = require('./mapmanager'),
    MapEntities = require('./mapentities'),

    Messages = require('./message'),

    PlayerController = require("./playercontroller"),
    NpcMoveController = require("./npcmovecontroller"),

    util = require("util"),
    Pathfinder = require("./pathfinder"),

    Updater = require("./updater"),
    Auction = require("./auction"),
    Looks = require("./looks"),
    Party = require("./party"),
    TaskHandler = require("./taskhandler"),
    UserHandler = require("./userhandler");

/**
 * Always use instanced self = this;
 * and follow conventions.
 */

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
        self.userBans = {};

        self.party = [];

        self.itemCount = 0;

        self.uselessDebugging = false;

        self.expMultiplier = 0.0;

        //self.pvpManager = new PVPManager(self);

        self.mapManager.onMapsReady(function ()
        {
          console.info("ALL MAPS LOADED BITCHES!");
          //self.Wheather = new Wheather(self);
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
          self.objPlayers[player.name] = player;
        });

        self.onPlayerRemoved(function(player) {
          console.info("worldServer - onPlayerRemoved.");
          delete self.objPlayers[player.name];
          var index = self.players.indexOf(player);
          self.players.splice(index,1);
          self.userHandler.sendWorldPlayerCount(self.players.length,
            self.maxPlayers);
        });

        self.onPlayerEnter(function(player)
        {
            player.map = self.maps[1];
            player.map.entities.addPlayer(player);

            console.info("Player: " + player.name + " has entered the " + player.map.name + " map.");

            player.map.entities.pushBroadcast(new Messages.Notify("MAP", "MAP_ENTERED", [player.name, player.map.name]), true);

            player.onDeath(function()
            {
                player.forEachAttacker(function (c) {
                  c.removeAttacker(player);
                  if (c instanceof Mob)
                    c.forgetPlayer(player.id);
                });
            });

            player.packetHandler.onBroadcast(function(message, ignoreSelf)
            {
                player.map.entities.pushBroadcast(message, ignoreSelf ? player.id : null);
            });

            player.packetHandler.onExit(function(player)
            {
                console.info("worldServer, packetHandler.onExit.");
                //console.info("Player: " + player.name + " has exited the world.");

                if (player.hasOwnProperty("party") && player.party)
                {
                    var party = player.party;
                    party.removePlayer(player);
                    player.packetHandler.handlePartyAbandoned(party);
                }

                if (self.removed_callback)
                    self.removed_callback(player);

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

            var fnMob = function(character)
            {
                if (character instanceof Mob)
                {
                    if (!character.isDead && !character.hasFullHealth() && !character.isAttacked() &&
                        character.x == character.spawnX && character.y == character.spawnY)
                    {
                        //console.info("stats="+JSON.stringify(character.stats));
                        var packet = character.modHealthBy(Math.floor(character.stats.hpMax / 8));
                    }
                }
            };

            self.forEachMap(function (map) {
                map.entities.forEachPlayer(fnPlayer);
                map.entities.forEachMob(fnMob);
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

    stop: function ()
    {
      this.save();
    },

    isSaved: function () {
      return this.PLAYERS_SAVED && this.AUCTIONS_SAVED && this.LOOKS_SAVED
        && this.BANS_SAVED;
    },

    skipSave: function () {
      this.PLAYERS_SAVED = true;
      this.AUCTIONS_SAVED = true;
      this.LOOKS_SAVED = true;
      this.BANS_SAVED = true;
    },

    saveBans: function () {
        var now = Date.now();

        var data = [];
        for (var username in this.userBans)
        {
            var banTime = this.userBans[username];
            if (banTime < now)
              continue;

            var rec = username+","+banTime;
            data.push(rec);
        }
        return data;
    },

    loadBans: function (msg) {
        var now = Date.now();

        for(var rec of msg) {
          var ban = rec.split(",");
          if (now > (ban[1]))
            continue;
          this.userBans[ban[0]] = ban[1];
        }
    },

    banplayer: function (name, duration) {
      if (!this.objPlayers.hasOwnProperty(name)) {
        console.info("worldServer, banplayer: player not in world.");
        return;
      }
      var username = this.objPlayers[name].user.name;
      this.banuser(username, duration);
    },

    banuser: function (username, duration) {
      duration *= 86400 * 1000;
      this.userBans[username] = Date.now() + duration;
    },

    save: function (update)
    {
      if (this.userHandler) {
        var playerNameList = [];
        Utils.forEach(this.players, function (p) {
          playerNameList.push(p.name);
        });
        this.userHandler.sendPlayersList(playerNameList);
      } else {
        console.warn("worldServer save: no user server connection aborting save.");
      }

      Utils.forEach(this.players, function (p) {
        p.save(update);
        p.connection.disconnect();
      });

      this.PLAYERS_SAVED = true;

      this.auction.save(this);
      this.AUCTIONS_SAVED = true;
      this.looks.save(this);
      this.LOOKS_SAVED = true;

      if (this.userHandler) {
        var data = this.saveBans();
        this.userHandler.sendBansData(data);
        this.BANS_SAVED = true;
      }
      else {
        console.info("worldserver, save: userHandler not set");
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

        /*setInterval(function()
        {
            Utils.forEachMap(function (map) {
                var players = map.entities.players;
                Utils.forEach(players, function (p) {
                  if (p.idleTimer.isOver());
                    p.packetHandler.exit_callback(p);
                });
            });
        }, 300000);*/

        setInterval(function()
        {
            self.save(true);
        }, 600000);
    },

    addParty: function(player1, player2)
    {
        var party = new Party(player1, player2);
        this.party.push(party);
        return party;
    },

    removeParty: function(party)
    {
        this.party = _.reject(this.party, function(el)
        {
            return el === party;
        });
        delete party;
    },

    loggedInPlayer: function(name)
    {
        var self = this;

        var mapId;
        for (var id in self.maps) {
            var map = self.maps[id];
            if (map.ready && map.entities)
            {
                var players = map.entities.players;
                var p;
                for (var id in players)
                {
                    if (players.hasOwnProperty(id))
                    {
                        p = players[id];
                        if (p.name == name)
                        {
                            if (!p.isDead)
                            {
                                console.info("loggedInPlayer: true");
                                return true;
                            }
                        }
                    }
                }
            }
        }
        console.info("loggedInPlayer: false");
        return false;
    },

    getPlayerByName: function(name)
    {
        for (var p of this.players) {
          if (p.name == name)
          {
              return p;
          }
        }
        return null;
    },

    handlePlayerVanish: function(player)
    {
        var self = this;

        player.forEachAttacker(function(mob)
        {
            if (mob instanceof Mob)
            {
              player.removeAttacker(mob);
              mob.clearTarget();
              mob.forgetPlayer(player.id, 1000);
            }
        });
    },

    handleDropItem: function (entity, attacker)
    {
      var itemLoot = this.getLootItem(attacker, entity, 0);
      if (itemLoot && itemLoot instanceof Item)
      {
          console.info("LOOT ITEM SENT!")
          itemLoot.x = entity.x;
          itemLoot.y = entity.y;
          this.handleItemDespawn(itemLoot);
          return;
      }

      var item = this.getDroppedOrStolenItem(attacker, entity, 0);
      if (item && item instanceof Item)
      {
          item.x = entity.x;
          item.y = entity.y;
          this.handleItemDespawn(item);
          return;
      }
    },

    handleDamage: function(entity, attacker, damage, crit)
    {
      if (entity.effects) {
        console.info("entity.effects: "+JSON.stringify(entity.effects));
        var effects = [];

        Utils.forEach(entity.effects, function (v, k) {
          if (v == 1)
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

    handleEntityDeath: function (entity, attacker)
    {
      if (attacker instanceof Player) {
        attacker.skillHandler.setXPs();
        this.taskHandler.processEvent(attacker, PlayerEvent(EventType.KILLMOB, entity, 1));
      }

      this.handleDropItem(entity, attacker);

      if (entity instanceof Player)
      {
          entity.forEachAttacker(function (c) {
            c.returnToSpawn();
          });

          this.handlePlayerVanish(entity);
      }
    },

    handleHurtEntity: function(entity, attacker)
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

          //this.handleDropItem(entity, attacker);
          this.handleEntityDeath(entity, attacker);
          entity.die(attacker);
        }
    },

    handleItemDespawn: function(item)
    {
        if (item)
        {
            item.handleDespawn(
            {
                beforeBlinkDelay: 20000,
                blinkCallback: function()
                {
                    //item.map.entities.pushToAdjacentGroups(item.group, new Messages.Blink(item));
                },
                blinkingDuration: 10000,
                despawnCallback: function()
                {
                    item.map.entities.itemDespawn(item);
                }
            });
        }
    },

    getLootItem: function(source, target, stolen)
    {
      var self = this;
      var itemId2 = null;

      if ( !target instanceof Mob || !target instanceof Chest)
        return;

      var v = Utils.randomRangeInt(0,1000);
      var itemId2;
      var drops = target.questDrops;

      for (var d in drops) {
        var count = drops[d];
        if (v >= 0 && v < count) {
          itemId2 = d;
          break;
        }
        v -= count;
      }

      if (itemId2) {
        //console.info("itemName: "+itemName);
        //var kind = ItemTypes.getKindFromString(itemName);
        var itemRoom = new ItemRoom([parseInt(itemId2), 1, 0, 0, 0]);
        var lootItem = target.map.entities.createItem(itemRoom, target.x, target.y, 1);
        lootItem.count = 1;
        lootItem.experience = 0;

        target.map.entities.pushNeighbours(target, lootItem.spawn());
        return target.map.entities.addItem(lootItem);
      }
      return null;
    },

    getPlayerDrop: function(source, target, stolen) {
      var itemIndex = target.inventory.getRandomItemNumber();
      if (itemIndex == -1)
        return;
      item = target.inventory.rooms[itemIndex];
      var count = 1;
      if (ItemTypes.isConsumableItem(item.itemKind)) {
        count = Math.floor((Math.random() * target.level + 2) / 2);
        if (count > item.itemNumber)
          count = item.itemNumber;
      }
      var item2;
      if (stolen) {
        item2 = Object.assign(new ItemRoom(), item);
        item2.itemNumber = count;
        source.map.entities.pushToPlayer(source, new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name]));
      }
      else {
        item2 = target.map.entities.addItem(target.map.entities.createItem(type, item, target.x, target.y, count));
      }
      target.inventory.takeOutItems(itemIndex, count);
      return item2;
    },

    getDrop: function(source, target, stolen) {
      //console.info("getDroppedItem");
      if (target.droppedItem == true)
        return;

      target.droppedItem = true;

      var drops = target.drops;
      var v = Utils.random(1000);
      var itemId2;

      for (var itemId in drops) {
        var count = drops[itemId];
        if (v >= 0 && v < count) {
          itemId2 = itemId;
          break;
        }
        v -= count;
      }

// TODO CHECK CODE AS ITEM IS NOT PROVIDING ITEM KIND.
      if (!itemId2)
        return null;

      //console.info("itemName: "+itemName);
      //var kind = ItemTypes.getKindFromString(itemName);
      var itemRoom;
      if (ItemTypes.isEquippable(itemId2))
      {
        var count = Utils.setEquipmentBonus(itemId2)
        itemRoom = new ItemRoom([itemId2, count, 0, 0, 900, 900]);
        itemRoom.itemExperience = ItemTypes.itemExpForLevel[count - 1];
      }
      else {
        itemRoom = new ItemRoom([itemId2, 1, 0, 0, 0, 0]);
      }
      var item = target.map.entities.createItem(itemRoom, target.x, target.y, 1);

      if (stolen)
      {
        if (source instanceof Player)
          source.map.entities.pushToPlayer(source, new Messages.Notify("CHAT", "ITEM_ADDED", [ItemData.Kinds[item.itemKind].name]));
        return itemRoom;
      }
      else
      {
        if (target.data && target.data.dropBonus)
          item.count += target.data.dropBonus;

        target.map.entities.pushNeighbours(target, item.spawn());
        item.enemyDrop = true;
        return target.map.entities.addItem(item);
      }
    },

    getGoldDrop: function(source, target, stolen) {
      // No item drop gold.
      var count = target.dropGold();

      if (source instanceof Player) {
        source.modifyGold(count);
      }
    },

    getDroppedOrStolenItem: function(source, target, stolen) {
      var self = this;
      var item = null;
      if (source instanceof Player && target instanceof Player) {
        this.getGoldDrop(source, target, stolen);
        return this.getPlayerDrop(source, target, stolen);
      } else if (target instanceof Mob || target instanceof Chest) {
        this.getGoldDrop(source, target, stolen);
        return this.getDrop(source, target, stolen);
      }
      /*else if (target instanceof Gather) {
        return this.getDrop(source, target, stolen);
      }*/
      return null;
    },

    onInit: function(callback)
    {
        this.init_callback = callback;
    },

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

    onPvpRegenTick: function(callback)
    {
        this.pvp_regen_callback = callback;
    },

    onEntityAttack: function(callback)
    {
        this.attack_callback = callback;
    },

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

    getPopulation: function()
    {
      var count = 0;
      var map = null;
      return this.players.length;
    },

});
