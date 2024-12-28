

var path = require('path');
var Utils = require('./utils');
var Chest = require('./entity/chest');
var NpcStatic = require('./entity/npcstatic');

var Messages = require('./message');
var MobCallback = require("./mobcallback");
var MobAI = require("./mobai");

var MapEntities = cls.Class.extend({


    init: function (id, server, map, database) {
    	var self = this;

    	self.id = id;
    	self.map = map;
    	self.server = server;
    	self.database = database;

      self.entities = {};
      self.players = {};
      self.characters = {};
      self.npcplayers = {};
      self.mobs = {};
//      self.attackers = {};
      self.items = {};
      self.equipping = {};
      self.hurt = {};
      self.npcs = {};
//      self.pets = {};
      self.chests = {};
      self.blocks = {};

      self.spatial = [];
      var spatialWidth = Math.ceil(self.map.width / G_SPATIAL_SIZE);
      var spatialHeight = Math.ceil(self.map.height / G_SPATIAL_SIZE);
      for(var i=0, j=0; i < spatialHeight; i++) {
        self.spatial[i] = [];
        for(j=0; j < spatialWidth; j++) {
          self.spatial[i][j] = [];
        }
      }


//      self.gather = {};
//      self.pvpBases = {};
//      self.houses = {};
      self.packets = {};

      self.mobAreas = [];
      self.chestAreas = [];
      self.groups = {};

  		self.pathfinder = null;
  		self.pathingGrid = null;

  		self.zoneGroupsReady = false;

  		self.maxPackets = 10;

  		self.entityCount = 0;

      this.mobCallback = null;
      this.mobAI = null;

      this.cellsize = G_TILESIZE;

      this.harvest = {};
    },

    getSpatialEntities: function (arr)
    {
        var x1 = ~~(Math.max(arr[0],0) / G_SPATIAL_SIZE);
        var y1 = ~~(Math.max(arr[1],0) / G_SPATIAL_SIZE);
        var x2 = ~~(Math.min(arr[2],this.map.width-1) / G_SPATIAL_SIZE);
        var y2 = ~~(Math.min(arr[3],this.map.height-1) / G_SPATIAL_SIZE);

        //console.info("getSpatialEntities - x1:"+x1+",y1:"+y1+",x2:"+x2+",y2:"+y2);
        var res = [];
        var l1 = this.spatial.length;
        var l2 = 0;
        for(var j = y1, i=0; j <= y2; ++j)
        {
          l2 = this.spatial[j].length;
          for(i = x1; i <= x2; ++i) {
            /*if (j < 0 || j >= l1)
              continue;
            if (i < 0 || i >= l2)
              continue;*/
            for (var entity of this.spatial[j][i]) {
              if (!entity) continue;
              //console.info("id:"+id);
              //console.info("entity.id:"+entity.id);
              res.push(entity);
            }
          }
        }
        return res;
    },

    mapready: function() {
      this.initPathFinder();
      this.initPathingGrid();
    	//this.initZoneGroups();

      this.mobCallback = new MobCallback(this.server, this.map);
      this.mobAI = new MobAI(this.server, this.map);
    },

    initPathFinder: function() {
    	this.pathfinder = new Pathfinder(this.map.width, this.map.height);
    },

    spawnNpcs: function(count) {
    	var npc;
    	//console.info("SPAWN NPCS");
    	//if (this.map == this.server.maps[0]) // World Map
    	//{
			for(var i = 0; i < count; ++i)
			{
				npc = this._createNpc("Npc"+i);
			}
		  //}
    },

    _createNpc: function(name) {
	    var self = this;

      pos = self.spaceEntityRandomApart(2, function () { return self.map.getRandomPosition(); });

	    var npc = new NpcMove(++self.entityCount, 0, pos.x * 16, pos.y * 16, self.map);
      //npc.name = name;

		  self.addNpcPlayer(npc);
		  //self.pushBroadcast(npc.spawn());
		  return npc;
    },

    initPathingGrid: function() {
		var map = this.map,
		    self = this;
			console.info("pathinggrid height:"+map.height+", width:"+map.width);

		var grid = new Uint8Array(map.height);
		for(var i=0, j=0; i < map.height; ++i) {
			grid[i] = new Uint8Array(map.width);
			for(j=0; j < map.width; ++j) {
        if (map.grid[i][j])
          grid[i][j] = 1;
        else
          grid[i][j] = 0;
			}
		}
		self.entitygrid = grid.slice(0);
    //self.pathingGrid = grid.slice(0);

		console.info("Initialized the pathing grid with static colliding cells.");
    },

    /*pushSpawnsToPlayer: function(player, ids) {
        this.processWho(this.player);
    },*/

    processWho: function(player) {
        var self = this;
        //console.info("processWho - called.");
        //var neighbours = [];
        var screens = [];
        var ids = [];
        var knowns = [];

        var ids = player.knownIds;
        ids = ids.parseInt();
        //console.info("knownIds: "+JSON.stringify(ids));

        var pgx = ~~(player.x/G_TILESIZE);
        var pgy = ~~(player.y/G_TILESIZE);

        var x1 = pgx - 64;
        var y1 = pgy - 32;
        var x2 = pgx + 64;
        var y2 = pgy + 32;
        //console.info("x1:"+x1+",y1:"+y1+",x2:"+x2+",y2:"+y2);
        var entities = this.getSpatialEntities([x1,y1,x2,y2]);

        //console.info("self.entities.length: "+Object.keys(self.entities).length);
        for (var entity of entities) {
          if (entity && !(entity == player) && self.isOffset(player, entity))
            screens.push(entity.id);
          //else if (entity && !(entity == player) && self.isOffset(player, entity, 20))
            //neighbours.push(entity.id);
        }
        //console.info("screens:"+JSON.stringify(screens));
        //console.info("ids:"+JSON.stringify(ids));

        var screenIds = (ids && ids.length > 0) ? _.difference(screens, ids) : screens;
        //var neighbourIds = (ids && ids.length > 0) ? _.difference(neighbours, ids) : neighbours;


        //screenIds.concat(neighbourIds);
        //console.info(JSON.stringify(screenIds));

        _.each(screenIds, function(id) {
            var entity = self.getEntityById(id);
            if(entity && !(entity == player))
            {
                //if (typeof player.knownIds[entity.id] === "undefined")
                player.knownIds.push(entity.id);
                self.pushToPlayer(player, entity.spawn());
                if (entity.path) {
                  var msg = new Messages.MovePath(entity, entity.path);
                  self.pushToPlayer(player, msg);
                }
            }
        });
    },

    isOffset: function(entity, entity2, extra, cameraHalfX, cameraHalfY) {
        extra = (extra || 0) * G_TILESIZE;
        cameraHalfX = (cameraHalfX || 32) * G_TILESIZE;
        cameraHalfY = (cameraHalfY || 18) * G_TILESIZE;
        var minX = Math.max(0,entity.x-cameraHalfX-extra);
        var minY = Math.max(0,entity.y-cameraHalfX-extra);
        var maxX = Math.min(this.map.width * G_TILESIZE, entity.x+cameraHalfX+extra);
        var maxY = Math.min(this.map.height * G_TILESIZE, entity.y+cameraHalfX+extra);

        //console.info("entity.x: "+entity.x+" entity.y:"+entity.y);
        //console.info("entity2.x: "+entity2.x+" entity2.y:"+entity2.y);
        //console.info("minX:"+minX+",maxX:"+maxX+",minY:"+minY+",maxY:"+maxY);
        if(entity2.y >= minY && entity2.y <= maxY && entity2.x >= minX && entity2.x <= maxX)
        {
            return true;
        } else {
            return false;
        }
    },

    processPackets: function() {
        var self = this;

        if (self.packets.length > 0)
        	console.info(JSON.stringify(self.packets));
        Utils.forEach(this.packets, (packet, id) => {
          len = packet.length;
          if (len > 0 && typeof packet != 'undefined' && packet != null)
          {
             var player = self.getEntityById(id);
              var conn = self.server.socket.getConnection(id);
              if (player && player.mapStatus >= 2 && conn != null && typeof conn != 'undefined')
              {
                  var packets = [];
                  for (var i =0; i < self.maxPackets; ++i)
                  {
                      if (packet.length == 0)
                        break;
                      packets.push(packet.shift());
                  }
                  conn.send(packets);
              } else
                  delete conn;
          }
        });
    },

    pushToPlayer: function(player, message) {
        if (!message)
        	return;

        var self = this;
        //console.info("sent_raw: "+message;
        if (player && player.id in self.packets)
        {
				    self.packets[player.id].push(message.serialize());
        }
    },


    pushBroadcast: function(message, ignoredPlayer)  {
        if (!message)
        	return;

        Utils.forEach(this.packets, function (packet, id) {
          if (id != ignoredPlayer)
          {
              packet.push(message.serialize());
          }
        });
    },

    pushNeighbours: function(entity, message, ignoredPlayer, areaLength)  {
    	//console.info("pushNeighbours");
    	var self = this;
    	//console.info(JSON.stringify(message.serialize()));
      areaLength = areaLength || 48;
    	var players = self.getPlayerAround(entity, areaLength);
      if (entity instanceof Player) players.push(entity);

    	//console.info(entities.length);
      for (var player of players) {
          if (self.packets.hasOwnProperty(player.id) && !ignoredPlayer || (ignoredPlayer && player != ignoredPlayer))
          {
               //console.info("neighbour.id:"+neighbour.id);
               self.packets[player.id].push(message.serialize());
          }
      }

    },

    isMobsOnSameTile: function(mob) {
  		var X = mob.x,
  			Y = mob.y,
  			result = false,
  			X2 = 0,
  			Y2 = 0;
  		if (mob.path && mob.path.length > 0)
  		{
  			X = mob.path[mob.path.length-1][0];
  			Y = mob.path[mob.path.length-1][1];
  		}
  		_.each(self.mobs, function(entity) {
  			if (entity.isMoving())
  			{
  				X2 = entity.path[entity.path.length-1][0];
  				Y2 = entity.path[entity.path.length-1][1];
  			}
  			else
  			{
  				X2 = entity.x;
  				Y2 = entity.y;
  			}
  			//console.info("x:"+X+",y:"+Y+",y2:"+Y2+",x2:"+X2);
  			if(entity.id != mob.id && X == X2 && Y == Y2)
  			{
  			result = true;
  			}
  		});
  		//console.info("result="+result);
  		return result;
    },

    getFreeAdjacentNonDiagonalPosition: function(entity) {
  		var self = this,
  			result = null;

  		entity.forEachAdjacentNonDiagonalPosition(function(x, y, orientation) {
  			if(!result && !self.map.isColliding(x, y) && !self.isCharacterAt(x, y)) {
  			   result = {x: x, y: y, o: orientation};
  			}
  		});
  		return result;
    },

    getFreeFutureAdjacentNonDiagonalPosition: function(entity) {
  		var self = this,
  			result = [];

  		entity.forEachFutureAdjacentNonDiagonalPosition(function(x, y, orientation) {

        if(!self.map.isColliding(x, y) && !self.isMobAt(x, y)) {
  			     result.push({x: x, y: y, o: orientation});
  			}
  		});
  		return result;
    },

  	getRandomPosition: function (entity, threshold) {
  		var pos = [];
  		var valid = false;
  		//console.info("entity.x:"+entity.x+",entity.y:"+entity.y);
  		var tries = 10;
  		var attempts = 0;
      threshold *= G_TILESIZE;
  		while (attempts++ < tries && (pos.y != entity.y && pos.x != entity.x)) {
  			//console.info("try move attempt:"+attempts);
  			var r1 = Utils.randomRangeInt(-threshold,threshold);
  			var r2 = Utils.randomRangeInt(-threshold,threshold);
  			//console.info("r1="+r1+",r2="+r2);
  			pos[0] = entity.x + r1;
  			pos[1] = entity.y + r2;
        //console.info("pos: "+pos[0]+","+pos[1]);
  			valid = !this.map.isColliding(pos[0], pos[1]);
        //console.info("valid="+valid);

  			if (valid && !(pos[0]==-1 && pos[1]==-1))
  				return {x: pos[0], y: pos[1]};
  		}
  		//console.info("pos.x:"+pos.x+",pos.y:"+pos.y);
      console.info("getRandomPosition - failed");
  		return null;
  	},

    handleOpenedChest: function(chest, player) {
      var self = this;
      self.pushToAdjacentGroups(chest.group, chest.despawn());
      self.removeEntity(chest);

	    var item = self.server.getDroppedOrStolenItem(player, chest, false);
	    if (item && item instanceof Item)
	    {
    		item.x = chest.x;
    		item.y = chest.y;
    		chest.map.entities.pushBroadcast(new Messages.Spawn(item));
    		self.server.handleItemDespawn(item);
	    }
	    chest.handleRespawn();

    },

    spawnStaticEntities: function(map) {
        var self = this;
        var count = 0;

        console.info(JSON.stringify(self.map.staticEntities));
        _.each(self.map.staticEntities, function(kind, tid) {
            //var kind;
            /*if (MobData.Properties[kindName])
                 kind = MobData.Properties[kindName].kind;
            else if (NpcData.Properties[kindName])
            {
                 kind = NpcData.Properties[kind].kind;
            }*/

            var pos = map.tileIndexToGridPosition(tid);

            console.info("kind:"+kind);
            if (NpcData.isNpc(kind)) {
              console.info("npc:" + kind + ",x:"+pos.x+",y:"+pos.y);
              self.addNpc(kind, pos.x, pos.y);
            }

            /*if (MobData.isMob(kind)) {
                self.addMob(kind, pos.x, pos.y);
                mob.onRespawn(function() {
                    mob.isDead = false;
                    mob.droppedItem = false;
                    self.addMob(mob);
                    if (mob.area)
                        mob.area.addToArea(mob);
                });
                self.tryAddingMobToChestArea(mob);
            }*/
        });
    },

    spawnEntity: function(kind, x, y, map) {
        var self = this;
        var entity;
        //console.info("kind="+kind);
        if (NpcData.isNpc(kind)) {
            entity = self.addNpc(kind, x, y, map);
        }
        else if (MobData.isMob(kind)) {
            entity = self.addMob(kind, x, y);
        }
        return entity;
    },

    addEntity: function(entity) {
      this.entities[entity.id] = entity;
      if (entity instanceof Character)
        this.characters[entity.id] = entity;
    },

    addPlayer: function(player) {
      console.info("addPlayer - player id: "+player.id);
      this.addEntity(player);
      this.players[player.id] = player;
      this.packets[player.id] = [];
    },

    addChest: function(chest) {
        this.addEntity(chest);
        this.chests[chest.id] = chest;
    },

    addBlock: function (block) {
      this.addEntity(block);
      this.blocks[block.id] = block;
      return block;
    },

    addMob: function(kind, x, y, area) {
      var self = this;

      var mob = new Mob(++self.entityCount, kind, x, y, self.map, area);
      mob.mobAI = this.mobAI;

      //mob.onMove(self.server.onMobMoveCallback.bind(self.server));
      this.mobCallback.setCallbacks(mob);

      this.addEntity(mob);
      this.mobs[mob.id] = mob;

      return mob;
    },

    addNpc: function(kind, x, y) {
        var self = this;

        var npc = new NpcStatic(++self.entityCount, kind, x, y, self.map);

        self.addEntity(npc);
        self.npcs[npc.id] = npc;

        return npc;
    },

    addNpcPlayer: function(player) {
        //console.info("addNpcPlayer - player id: "+player.id);
    	  var self = this;

        self.addEntity(player);
        self.npcplayers[player.id] = player;

        return player;
    },

    addItem: function(item) {
        var self = this;

        self.addEntity(item);
        self.items[item.id] = item;

        return item;
    },

    removeEntity: function(entity) {
    	//console.info("removeEntity: "+entity.id);
        if (entity.id in this.mobs)
            delete this.mobs[entity.id];

        if (entity.id in this.items)
            delete this.items[entity.id];

        if (entity.id in this.players)
            delete this.players[entity.id];

        if (entity.id in this.chests)
            delete this.chests[entity.id];

        if (entity.id in this.blocks)
            delete this.blocks[entity.id];

        if (entity.id in this.characters)
            delete this.characters[entity.id];

        if (entity.id in this.entities)
            delete this.entities[entity.id];

        entity.destroy();
    },

    removePlayer: function(player) {
      //try { throw new Error(); } catch (e) { console.error(e.stack); }

      console.info("removePlayer-called");
    	var self = this;

	    if (player instanceof Player)
		     player.packetHandler.broadcast(player.despawn());


      console.info("deleting player traces..");
      //delete self.players[player.id];
      delete self.packets[player.id];
      //delete self.entities[player.id];

      self.removeEntity(player);

      delete player;

    },

    removeNpcPlayer: function(player) {
      console.info("removePlayer-called");
  	  var self = this;

      self.pushBroadcast(player.despawn(0));
      self.removeEntity(player);

      delete self.npcplayers[player.id];
    },

    createItem: function(itemRoom, x, y) {
        var id = (++this.entityCount);
        var item = null;

        var type = Types.EntityTypes.ITEM;
        if(!ItemTypes.isEquippable(itemRoom.itemKind))
          type = Types.EntityTypes.ITEMLOOT;
        item = new Item(type, id, itemRoom, x, y, this.map);
        this.addItem(item);

        return item;
    },

    /*createChest: function(x, y, items) {
        var self = this;
        var chest = self.createItem(37, x, y); // CHEST
        chest.map = self.map;
        return chest;
    },*/

    addStaticItem: function(map, item) {
        var self = this;

        item.isStatic = true;
        item.onRespawn(self.addStaticItem.bind(self, item));

        return self.addItem(item);
    },

    addItemFromChest: function(kind, x, y) {
        var item = this.createItem(kind, x, y);
        item.isFromChest = true;
        return this.addItem(item);
    },

    getNpcByQuestId:function(id) {
      var self = this;
      var npc;
      for (var id in self.npcs) {
        npc = self.npcs[id];
        if (npc.questId == id)
          return npc;
      }
      return null;
    },

    getEntityById: function(id) {
    	var self = this;
      if (self.entities.hasOwnProperty(id))
          return self.entities[id];
      else
          ; //try{ throw new Error(); } catch (err) { console.info(err.stack); }
    },

    getPlayerByName: function(name)
    {
        for (var id in this.players) {
          var p = this.players[id];
          if (p.name === name)
            return p;
        }
        return null;
    },

    setModifyGoldByName: function(name, mod) {
      var player = this.getPlayerByName(name);
      if (player)
        player.modifyGold(mod);
      else
        this.database.modifyGold(name, mod);
    },

    getEntitiesByPosition: function(x,y) {
    	entities = [];
    	this.forEachEntity(function(e) {
    		if (e.x == x && e.y == y)
    		    entities.push(e);
    	});
    	return entities;
    },

    isCharacterAt: function (x,y) {
      return this.entitygrid[y][x] === 1;
    },

    isMobAt: function(x,y) {
    	var result = false;
	    this.forEachMob(function (mob) {
    		var X = mob.x,
    		    Y = mob.y;
    		if (mob.path && mob.path.length > 0)
    		{
    			X = mob.path[mob.path.length-1][0];
    			Y = mob.path[mob.path.length-1][1];
    		}
    		if (x == X && y == Y)
    		    result = true;
  	  });
  	  return result;
    },

    forEachEntity: function(callback) {
        //var self = this;
        //console.info("forEachEntity, count:"+Object.keys(self.entities).length);
        /*for (var id in self.entities) {
            if (self.entities.hasOwnProperty(id))
                callback(self.entities[id]);
        }*/
        Utils.forEach(this.entities, function (entity) {
          callback(entity);
        });
    },

    forEachPlayer: function(callback) {
        //var self = this;
        /*(for (var id in self.players) {
            if (self.players.hasOwnProperty(id))
                callback(self.players[id]);
        }*/
        Utils.forEach(this.players, function (entity) {
          callback(entity);
        });

    },

    /*forEachPartyPlayer: function(callback) {
        //var self = this;
        Utils.forEach(this.players, function (entity) {
          callback(entity);
        });
        for (var id in self.players) {
            if (self.players.hasOwnProperty(id))
                callback(self.players[id]);
        }
    },*/

    forEachMob: function(callback) {
        Utils.forEach(this.mobs, function (entity) {
          callback(entity);
        });

        /*var self = this;
        //try { throw new Error(); } catch (e) { console.info(e.stack); }
        //console.info("forEachMob, count:"+Object.keys(self.mobs).length);
        for (var id in self.mobs) {
            //console.info("forEachMob, id:"+id);
            if (self.mobs.hasOwnProperty(id)) {
              callback(self.mobs[id]);
            }
        }*/
    },

    forEachCharacter: function(callback) {
        Utils.forEach(this.entities, function (entity) {
          if (entity instanceof Character)
            callback(entity);
        });

        /*var self = this;
        //console.info("forEachCharacter, count:"+Object.keys(self.entities).length);
        for (var id in self.entities) {
            if (self.entities.hasOwnProperty(id) && self.entities[id] instanceof Character)
                callback(self.entities[id]);
        }*/
    },

    forEachNpcPlayer: function(callback) {
      Utils.forEach(this.npcplayers, function (entity) {
        if (entity instanceof Character)
          callback(entity);
      });
        /*var self = this;
        for (var id in self.npcplayers) {
            if (self.npcplayers.hasOwnProperty(id))
                callback(self.npcplayers[id]);
        }*/
    },

// TODO - Minimize function calls so you can pass type to loop through, and the additional condition.
    getEntitySpatialCount: function(entity, range, conditional) {
      range *= G_TILESIZE;
      var x = entity.x;
      var y = entity.y;
      var r = range >> 1;
      var count = 0;
      var def_conditional = function (e1,e2) { return e1 !== e2; };
      conditional = conditional || def_conditional;
      var group = this.getSpatialEntities([x-r,y-r,x+r,y+r]);
      for (var e2 of group) {
          if (conditional(e1, e2))
            count++;
      }
      return count;
    },

    getEntityAroundSpatial: function(entity, range, conditional) {
      range *= G_TILESIZE;
      var r = range >> 1;
      var x = entity.x;
      var y = entity.y;
      var entities = [];
      var def_conditional = function (e1,e2) { return e1 !== e2; };
      conditional = conditional || def_conditional;
      //console.info("getEntityAround, range: "+range+",x:"+x+",y:"+y);
      var e2;
      var group = this.getSpatialEntities([x-r,y-r,x+r,y+r]);
      for (var e2 of group) {
          if (conditional(entity,e2))
          {
              //console.info("getEntityAround, pushed:"+e2.id);
              entities.push(e2);
          }
      }
      return entities;
    },

    getEntityCount: function(group, e1, range, conditional) {
      range *= G_TILESIZE;
      conditional = conditional || function (e1, e2) { return e1 !== e2; };
      var compare = function (e1, e2) {
        return (Math.abs(e2.x-e1.x) <= range && Math.abs(e2.y-e1.y) <= range &&
            conditional(e1,e2))
      };
      var count=0;
      if (Array.isArray(group)) {
        for (var e2 of group) {
            if (compare(e1,e2))
              count++;
        }
      } else {
        Utils.forEach(group, function (e2) {
          if (compare(e1,e2))
            count++;
        })
      }
      return count;
    },

    getEntityAround: function(group, e1, range, conditional) {
      range *= G_TILESIZE;
      var entities = [];
      conditional = conditional || function (e1, e2) { return e1 !== e2; };
      var compare = function (e1, e2) {
        return (Math.abs(e2.x-e1.x) <= range && Math.abs(e2.y-e1.y) <= range &&
            conditional(e1,e2))
      };
      if (Array.isArray(group)) {
        for (var e2 of group) {
            if (compare(e1,e2))
              entities.push(e2);
        }
      } else {
        Utils.forEach(group, function (e2) {
          if (compare(e1,e2))
            entities.push(e2);
        })
      }
      return entities;
    },

    getEachEntityAround: function(x, y, s) {
        var x = ~~(x/G_TILESIZE);
        var y = ~~(y/G_TILESIZE);
        var entities = this.getSpatialEntities([x-s,y-s,x+s,y+s]);
        return this.getEntityAround(entities, {x: x, y: y}, s);
    },

    getEntitiesAround: function(entity, range) {
      var x = ~~(entity.x/G_TILESIZE);
      var y = ~~(entity.y/G_TILESIZE);
      var r = (range*G_TILESIZE) >> 1;
      var entities = this.getSpatialEntities([x-r,y-r,x+r,y+r]);
      return this.getEntityAround(entities, entity, r);
    },

    getCharactersAround: function(entity, range) {
      return this.getEntityAround(this.getEntitiesAround(entity, range), entity, range,
        function(e1,e2) { return (e1 !== e2 && e2 instanceof Character); });
    },

    getMobsAround: function(entity, range) {
      return this.getEntityAround(this.mobs, entity, range);
    },

    getPlayerAround: function(entity, range) {
      return this.getEntityAround(this.players, entity, range);
    },

    getAroundCount: function(entities, entity, range) {
      return this.getEntityAround(entities, entity, range);
    },

    getEntityAroundCount: function(entity, range) {
      return this.getEntityCount(this.getEntitiesAround(entity, range), entity, range);
    },

    getPlayerAroundCount: function(entity, range) {
      return this.getEntityCount(this.players, entity, range);
    },

    getPartyAround: function(entity, range) { // entity
      return this.getEntityAround(entity.party.players, entity, range);
    },

    itemDespawn: function (item)
    {
      this.pushNeighbours(item, new Messages.Despawn(item));
      this.removeEntity(item);
    },

    handleEmptyChestArea: function(area) {
        var self = this;
        if(area) {
            //var chest = self.addItem(self.createChest(area.chestX, area.chestY, area.items));
            self.handleItemDespawn(chest);
        }
    },

    tryAddingMobToChestArea: function(mob) {
        var self = this;
        _.each(self.chestAreas, function(area) {
            if (area.contains(mob))
                area.addToArea(mob);
        });
    },

    findPath: function(character, x, y, ignoreList) {
      var self = this,
          path = [];

      //console.info("PATHFINDER CODE");

      if(this.pathfinder && character)
      {
          var grid = self.map.grid;
          var path = null;
          var pS =[character.x, character.y];
          var ts = G_TILESIZE;

          if (this.map.isColliding(character.x, character.y))
          {
            console.warn("findPath - isColliding start.");
            return null;
          }

          var pE = [x,y];
          if (this.map.isColliding(x, y))
          {
            console.warn("findPath - isColliding end.");
            return null;
          }

          if (pS[0] == pE[0] && pS[1] == pE[1]) {
            try { throw new Error(); } catch(err) { console.info(err.stack); }
            console.warn("findPath - path coordinates are the same.")
            return null;
          }

          if (!path || path.length == 0) {
            if (pS[0] == pE[0] || pS[1] == pE[1]) {
              mp = [pS, pE];

              if(this.pathfinder.isValidPath(grid, mp)) {
                  //console.warn("path-mp:"+JSON.stringify(mp));
                  return mp;
              }
            }

            var mp = [pS, [pS[0],pE[1]], pE];
            console.info("mp:"+JSON.stringify(mp));
            if(this.pathfinder.isValidPath(grid, mp)) {

              //console.warn("findPath - lPath:"+JSON.stringify(mp));
              return mp;
            }

            //console.info("path:"+JSON.stringify(path));
            mp = [pS, [pE[0],pS[1]], pE];
            console.info("mp:"+JSON.stringify(mp));
            if(this.pathfinder.isValidPath(grid, mp)) {
                //console.warn("findPath - lPath:"+JSON.stringify(mp));
                return mp;
            }
            //console.info("path:"+JSON.stringify(path));
          }
          if (!path || path.length == 0) {
            //console.warn("findPath - shortPath: attempting.");
            var shortGrid = this.pathfinder.getShortGrid(grid, pS, pE, 3);
            //console.info("grid:"+JSON.stringify(grid));
            //console.info(JSON.stringify(shortGrid));
            path = this.pathfinder.findShortPath(shortGrid.crop,
          	 shortGrid.minX, shortGrid.minY, shortGrid.substart, shortGrid.subend);
            //console.info("findPath - shortPath:"+JSON.stringify(path));
          }

          if (!path || path.length == 0) {
            console.warn("findPath - DANGER - findPath LONGGG");
            path = this.pathfinder.findPath(grid, pS, pE, false);
            //console.info("findPath - longPath:"+JSON.stringify(path));
          }

          if (!path)
            console.error("findPath - Error while finding the path to "+x+", "+y+" for "+character.id);

          //console.info("cid: "+character.id+", path_result:"+JSON.stringify(path));
          return path;
      } else {
          console.error("findPath - Error while finding the path to "+x+", "+y+" for "+character.id);
      }
      return path;
    },

    spaceEntityRandomApart: function (dist, callback_func, entities, entity, threshold) {
      entities = entities || this.entities;
      threshold = threshold || 50;
    	var pos = null;
    	var count = 1;
      var param = (entity && entity.collision) ? entity.collision : null;
      var iter = 0;

			while (count > 0 && iter < threshold)
			{
				if (callback_func)
				{
				  pos = callback_func(param);
				  count = pos ? this.getAroundCount(entities, {x: pos.x, y: pos.y},dist) : 0;
				}
        iter++;
			}
		  return pos;
    },

    isGridPositionEmpty: function (x, y) {
      console.info("isGridPositionEmpty: x="+x+",y="+y);
      if (this.map.isColliding(x, y))
        return false;

      var pos = {x: x, y: y};
      var entities = this.getEntitiesAround(pos, 1);
      if (entities.length == 0)
        return true;
      for (var entity of entities) {
        if (entity.isOverPosition(pos))
          return false;
      }
      return true;
    },
});


module.exports = MapEntities;
