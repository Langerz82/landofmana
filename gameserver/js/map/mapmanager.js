var Map = require("./map");
var MapEntities = require("./mapentities");

//var BlockArea = require("../area/blockarea");
//var TrapArea = require("../area/traparea");
var MobArea = require("../area/mobarea");
var EntityArea = require("../area/entityarea");
var NpcMove = require("../entity/npcmove");
var Node = require("../entity/node");
//var TrapGroup = require("../entity/trapgroup");

module.exports = MapManager = cls.Class.extend({

    /*storeMobAreas: function(map) {
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
            	a.include, a.exclude, a.definite, map, a.ellipse, a.excludeId, null);
            //map.mobLiveAreas[a.id] = area;
            map.mobArea.push(area);
        //});
        }
        return map.mobArea;
    },*/

    /*spawnMobs: function(map) {
	    var self = this;
      map.initMobAreas();
      //setTimeout(function () {

      //},20000);
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

      	this.maps[0] = new Map(server, 0,"map0","./maps/map0.json","");
      	this.maps[0].ready(function() {
      		var map = self.maps[0];

      		map.entities = new MapEntities(self.id, self.server, map, self.server.database);
      		map.entities.mapready();

      		map.entities.spawnEntities(map);

      		map.enterCallback = function (player) {
      			var pos = map.getRandomStartingPosition();
      			return pos;
      		}
      		self.MapsReady();
      	});


        //setTimeout(function () {
          self.maps[1] = new Map(server, 1,"map1","./maps/map1.json","");
          self.maps[1].ready(function() {
              var map = self.maps[1];

              map.entities = new MapEntities(self.id, self.server, map, self.server.database);
              map.entities.mapready();

              //map.entities.spawnEntities(map);
              //map.initMobAreas();

              map.mobArea = [];
              var mobArea = new MobArea(map, 0, 25, 0, 1, 512, 512, 40, 40,
                [1], null, null, true, -1, null, null);
              map.mobArea.push(mobArea);
              mobArea.addMobs();
              mobArea.spawnMobs();

              var npc = map.entities.addNpcMove(0, 510*G_TILESIZE, 510*G_TILESIZE);
              npc.name = "Old Man";
              npc.scriptQuests = false;

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

                      id++;

                      //var mobtype = (id % (Object.keys(MobData.Kinds).length-1))+1;
                      mobArea = new MobArea(map, id, 12, 1+(id), 1+(id), a, b, 40, 40,
                        null, null, null, true, -1, null);
                      map.mobArea.push(mobArea);
                      mobArea.addMobs();
                      mobArea.spawnMobs();

                      var area = new EntityArea(map, 0, a, b, 10, 10, true, -1);
                      var pos = area._getRandomPositionInsideArea(30);
                      var npc = map.entities.addNpcMove(id, pos.x, pos.y);

                      var area2 = new EntityArea(map, 0, a, b, 20, 20, true, -1);

                      prevNpc.nextNpcName = npc.name;
                      prevNpc.nextNpcDir = strDir;
                      prevNpc = npc;

                      if (id > 0) {
                        var level = 1;
                        if (id === 9) {
                          for (var k=0; k < 6; ++k) {
                            var	pos = map.entities.spaceEntityRandomApart(2,area2._getRandomPositionInsideArea.bind(area2,100));
                            var node = new Node(++map.entities.entityCount, 3, pos.x, pos.y, map, level, level);
                            node.name = "node1";
                            node.weaponType = "any";
                            area.addToArea(node);
                            map.entities.addEntity(node);
                          }
                        }
                        else if (id === 6) {
                          level = 2;
                          for (var k=0; k < 6; ++k) {
                            var	pos = map.entities.spaceEntityRandomApart(2,area2._getRandomPositionInsideArea.bind(area2,100));
                            var node = new Node(++map.entities.entityCount, 3, pos.x, pos.y, map, level, level);
                            node.name = "node2";
                            node.weaponType = "any";
                            area.addToArea(node);
                            map.entities.addEntity(node);
                          }
                        }
                        else if (id > 10) {
                          level = Utils.clamp(1,4,~~(id/10)+1);
                          for (var k=0; k < 10; ++k) {
                            var	pos = map.entities.spaceEntityRandomApart(2,area2._getRandomPositionInsideArea.bind(area2,100));
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

              map.enterCallback = function (player) {
                var pos = map.getRandomStartingPosition();
              	return pos;
              };
              self.MapsReady();
          });
        //},10000);
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
    	return (this.mapCount === Object.keys(this.maps).length);
    },

    onMapsReady: function (readyFunc)
    {
    	this.readyFunc = readyFunc;
    },

});
