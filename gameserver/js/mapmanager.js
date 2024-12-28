var cls = require("./lib/class");
var Map = require("./map");
var MapEntities = require("./mapentities");
var Messages = require("./message");
var Utils = require("./utils");
var NpcMove = require("./entity/npcmove");
var BlockArea = require("./area/blockarea");
var TrapArea = require("./area/traparea");
var MobArea = require("./area/mobarea");
var EntityArea = require("./area/entityarea");
var TrapGroup = require("./trapgroup");
var Node = require("./entity/node");

module.exports = MapManager = cls.Class.extend({

    storeMobAreas: function(map) {
    	    var self = this;

            map.mobArea = [];
            //map.mobLiveAreas = {};
            //console.info("MobAreas: "+map.mobAreas.length);
            var a;
            for (var i=0; i < map.mobAreas.length; ++i)
            {
                a = map.mobAreas[i];
            //_.each(map.mobAreas, function(a) {
                a.sMinLevel = a.sMinLevel || 0;
                a.sMaxLevel = a.sMaxLevel || 0;
                var area = new MobArea(a.id, a.nb, a.minLevel, a.maxLevel, a.x, a.y, a.width, a.height,
                	a.include, a.exclude, a.definite, map, a.ellipse, a.excludeId, a.sMinLevel, a.sMaxLevel);
                //map.mobLiveAreas[a.id] = area;
                map.mobArea.push(area);
            //});
            }
            return map.mobArea;
    },

    spawnMobs: function(map) {
	    var self = this;
      for (a of map.mobArea) {
        a.addMobs();
        a.spawnMobs();
      }
    },

    /*storeChestArea: function(map) {
    	    var self = this;

            var chestAreas = [];
            _.each(map.chestAreas, function(a) {
                //console.info("number: " + a.nb + ",a.minLevel: "+a.minLevel+", a.maxLevel: "+a.maxLevel);
                var area = new ChestArea(a.id, a.nb, a.minLevel, a.maxLevel, a.x, a.y, a.width, a.height, map);
                area.spawnChests();
                //area.onEmpty(self.handleEmptyMobArea.bind(self, area));
                chestAreas.push(area);
            });
            return chestAreas;
    },*/

    init: function(server) {
    	    var self = this;

    	    this.server = server;
    	    this.maps = {};
    	    this.mapCount = 0;
          this.id = 0;
          this.mapInstances = {};
          this.loaded = false;

        /**
         * Map Loading
         */

      	this.maps[0] = new Map(0,"map0","./maps/map0.json","");
      	this.maps[0].ready(function() {
      		var map = self.maps[0];

      		map.entities = new MapEntities(self.id, self.server, map, self.server.database);
      		map.entities.mapready();

      		map.entities.spawnStaticEntities(map);

      		map.enterCallback = function (player) {
      			var pos = map.getRandomStartingPosition();
      			return pos;
      		}
      		self.MapsReady();
      	});


        this.maps[1] = new Map(1,"map1","./maps/map1.json","");
        this.maps[1].ready(function() {
            var map = self.maps[1];

            map.entities = new MapEntities(self.id, self.server, map, self.server.database);
            map.entities.mapready();

            map.mobArea = [];
            var mobArea = new MobArea(0, 25, 0, 1, 512, 512, 40, 40,
              [1], null, null, map, true, -1, null, null);
            map.mobArea.push(mobArea);

            var npc = new NpcMove(++map.entities.entityCount, 0, 510*16, 510*16, map);
            npc.name = "Old Man";
            //npc.questId = 0;
            npc.scriptQuests = false;
            map.entities.addNpcPlayer(npc);
            var prevNpc = npc;

            var x=0;
            var y=0;
            var a = 512;
            var b = 512;
            var j = 0;
            var j_max = 0;
            var id = 0;
            var offset = 40;
            var strDir = "EAST";
            loop:
            for (var i=0; i < 40; i++)
            {
                if (id >= 50)
                  break loop;

                j_max += (i%2==0) ? 1 : 0;
                var dir = i % 4;
                for (var j=1; j <= j_max; j++)
                {
                    x = 0;
                    y = 0;
                    switch (dir)
                    {
                      case 0: // East
                        strDir="EAST";
                        x=offset;
                        break;
                      case 1: // South
                        strDir="SOUTH";
                        y=offset;
                        break;
                      case 2: // West
                        strDir="WEST";
                        x=-offset;
                        break;
                      case 3: // North
                        strDir="NORTH";
                        y=-offset;
                        break;
                    }
                    a += x;
                    b += y;

                    /*
                    mobArea = new MobArea(id, 20, 1+(id), 1+(id), a, b, 35, 35,
                      [id % Object.keys(MobData.Kinds).length], null, null, map, true, -1, null, null);
                    map.mobArea.push(mobArea);

                    var area = new Area(0, a, b, 35, 35, map, false, -1);
                    var pos = area._getRandomPositionInsideArea(40);
                    var npc = new NpcMove(++map.entities.entityCount, 2+(i), pos.x, pos.y, map);
                    //npc.name = "Test"+id;
                    map.entities.addNpcPlayer(npc);
                    */
                    id++;
                    mobArea = new MobArea(id, 12, 1+(id), 1+(id), a, b, 40, 40,
                      [id % Object.keys(MobData.Kinds).length], null, null, map, true, -1, null, null);
                    map.mobArea.push(mobArea);

                    var area = new EntityArea(0, a, b, 30, 30, map, true, -1);
                    var pos = area._getRandomPositionInsideArea(35);
                    npc = new NpcMove(++map.entities.entityCount, id, pos.x, pos.y, map);
                    //npc.questId = id;
                    map.entities.addNpcPlayer(npc);

                    prevNpc.nextNpcName = npc.name;
                    prevNpc.nextNpcDir = strDir;

                    prevNpc = npc;

                    if (id > 0) {
                      var level = 1;
                      if (id == 5) {
                        for (var k=0; k < 6; ++k) {
                          var	pos = map.entities.spaceEntityRandomApart(2,area._getRandomPositionInsideArea.bind(area,100));
                          var node = new Node(++map.entities.entityCount, 3, pos.x, pos.y, map, level, level);
                          node.name = "node1";
                          node.weaponType = "any";
                          area.addToArea(node);
                          map.entities.addEntity(node);
                        }
                      }
                      else if (id == 6) {
                        level = 2;
                        for (var k=0; k < 6; ++k) {
                          var	pos = map.entities.spaceEntityRandomApart(2,area._getRandomPositionInsideArea.bind(area,100));
                          var node = new Node(++map.entities.entityCount, 3, pos.x, pos.y, map, level, level);
                          node.name = "node2";
                          node.weaponType = "any";
                          area.addToArea(node);
                          map.entities.addEntity(node);
                        }
                      }
                      else {
                        level = Utils.clamp(1,4,~~(id/10)+1);
                        for (var k=0; k < 10; ++k) {
                          var	pos = map.entities.spaceEntityRandomApart(2,area._getRandomPositionInsideArea.bind(area,100));
                          var node = new Node(++map.entities.entityCount, 2, pos.x, pos.y, map, level, level);
                          node.name = "node"+level;
                          node.weaponType = "hammer";
                          area.addToArea(node);
                          map.entities.addEntity(node);
                        }

                      }
                    }
                }
            }


            //gather.name = "node1";
            //gather.weaponType = "hammer";
            //map.entities.addEntity(gather);

            //console.info(JSON.stringify(map));
            //self.storeMobAreas(map);
            //console.info(JSON.stringify(map.mobArea));
            //console.info(map.mobArea.length);

            self.spawnMobs(map); // TODO - RE-ENABLE.

            /*map.blockAreas = [];
            var blockArea = new BlockArea(0, 510, 504, 12, 12, map);
            blockArea.initArea(1, 3, 2);

            blockArea.randomizeBlocks(2);

            blockArea.onComplete(function (blockArea) {
              for(var i in blockArea.players)
              {
                var count = blockArea.players[i];
                map.entities.setModifyGoldByName(i,(count * 100));
              }
            });*/


            /*map.trapAreas = [];
            var trapArea = new TrapArea(0, 500, 500, 24, 24, map);
            for (var i = 0; i < 4; ++i) {
              trapArea.addRandomGroup(1, Utils.randomRangeInt(1,4), Utils.randomRangeInt(1,4))
            }*/

            map.enterCallback = function (player) {
              var pos = map.getRandomStartingPosition();
            	return pos;
            }
            self.MapsReady();
        });

    },

    MapsReady: function () {
        this.mapCount++;
        console.info('mapCount='+this.mapCount);
    	if (this.isMapsReady() && !this.loaded)
    	{
        //console.info(JSON.stringify(this.maps));
    		console.info("maps ready");
    		this.readyFunc();
        this.loaded = true;
    	}
    },

    isMapsReady: function ()
    {
      console.info("Maps Length: "+Object.keys(this.maps).length);
    	return (this.mapCount == Object.keys(this.maps).length);
    },

    onMapsReady: function (readyFunc)
    {
    	this.readyFunc = readyFunc;
    },

});
