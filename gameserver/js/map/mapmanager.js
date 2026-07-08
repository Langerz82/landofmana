import Map from './map.js';
import MapEntities from './mapentities.js';

//var BlockArea = require("../area/blockarea");
//var TrapArea = require("../area/traparea");
import MobArea from '../area/mobarea.js';
import EntityArea from '../area/entityarea.js';
import NpcMove from '../entity/npcmove.js';
import Node from '../entity/node.js';
import Mob from '../entity/mob.js';
//var TrapGroup = require("../entity/trapgroup");
//import Utils from '../utils.js';
import { G_TILESIZE } from '../main.js';

class MapManager {
    constructor(server) {
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


        self.maps[1] = new Map(server, 1,"map1","./maps/map1.json","");
        self.maps[1].ready(function() {
            var map = self.maps[1];

            map.entities = new MapEntities(self.id, self.server, map, self.server.database);
            map.entities.mapready();

            //map.entities.spawnEntities(map);
            //map.initMobAreas();

            map.mobArea = [];
            var mobArea = new MobArea(map, 0, 25, 0, 1, 512*G_TILESIZE, 512*G_TILESIZE, 40*G_TILESIZE, 40*G_TILESIZE,
                [1], null, null, true, -1, null, null);
            map.mobArea.push(mobArea);
            mobArea.addMobs();
            mobArea.spawnMobs();

            var npc = map.entities.addNpcMove(0, 510*G_TILESIZE, 510*G_TILESIZE);
            npc.name = "Old Man";
            npc.scriptQuests = false;

            var prevNpc = npc;

// Only uncomment for debugging spawns.
//setTimeout(function () {

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

                    id += 1;

                    var ga = a * G_TILESIZE;
                    var gb = b * G_TILESIZE;


                    //var mobtype = (id % (Object.keys(MobData.Kinds).length-1))+1;
                    var w = 40 * G_TILESIZE;
                    var h = 40 * G_TILESIZE;
                    var mobArea1 = new MobArea(map, id, 12, 1+(id), 1+(id), ga, gb, w, h,
                        null, null, null, true, -1, null);
                    map.mobArea.push(mobArea1);
                    mobArea1.addMobs();
                    mobArea1.spawnMobs();

                    // Slighter tougher mobs in inner circle.
                    w = 20 * G_TILESIZE;
                    h = 20 * G_TILESIZE;
                    var mobArea2 = new MobArea(map, id, 4, 2+(id), 2+(id), ga, gb, w, h,
                        null, null, null, true, -1, null);
                    map.mobArea.push(mobArea2);
                    mobArea2.addMobs();
                    mobArea2.spawnMobs();

                    // Boss is in innermost circle.
                    w = 10 * G_TILESIZE;
                    h = 10 * G_TILESIZE;
                    var mobArea3 = new MobArea(map, id, 1, 3+(id), 3+(id), ga, gb, w, h,
                        null, null, null, true, -1, null);
                    map.mobArea.push(mobArea3);
                    mobArea3.addMobs();
                    mobArea3.spawnMobs();
                    for (var mob of mobArea3.entities) {
                        mob.createBoss(5);
                    }

                    w = 20 * G_TILESIZE;
                    h = 20 * G_TILESIZE;
                    var area = new EntityArea(map, 0, ga, gb, w, h, true, -1);
                    var pos = area._getRandomPositionInsideArea(30*G_TILESIZE);
                    var npc = map.entities.addNpcMove(id, pos.x, pos.y);

                    var area2 = new EntityArea(map, 0, ga, gb, w, h, true, -1);

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

//}, 10000);

            map.enterCallback = function (player) {
                var pos = map.getRandomStartingPosition();
                return pos;
            };
            self.MapsReady();
        });

        this.maps[2] = new Map(server, 2, "map2", "./maps/map2.json", "");
        this.maps[2].ready(function() {
            var map = self.maps[2];

            map.entities = new MapEntities(self.id, self.server, map, self.server.database);
            map.entities.mapready();

            //map.entities.spawnEntities(map);

            map.enterCallback = function (player) {
                var pos = map.getRandomStartingPosition();
                return pos;
            }
            self.MapsReady();
        });

    }

    MapsReady() {
        this.mapCount++;
        console.info('mapCount='+this.mapCount);
        if (this.isMapsReady() && !this.loaded)
        {
            //console.info(JSON.stringify(this.maps));
            console.info("maps ready");
            this.readyFunc();
            this.loaded = true;
        }
    }

    isMapsReady()
    {
        console.info("Maps Length: "+Object.keys(this.maps).length);
        return (this.mapCount === Object.keys(this.maps).length);
    }

    onMapsReady(readyFunc)
    {
        this.readyFunc = readyFunc;
    }
}

export default MapManager;
