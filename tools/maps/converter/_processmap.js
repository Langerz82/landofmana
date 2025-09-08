var fs = require("fs"),
    Log = require('log'),
    _ = require('underscore');
    //Types = require("../../shared/js/gametypes"),
    //ItemTypes = require("../../shared/js/itemtypes");

var map, mode;
var collidingTiles = {};
//var staticEntities = {};
var entitiesFirstGid = -1;

var log = new Log(Log.DEBUG, fs.createWriteStream('processmap.log'));

var isNumber = function(o) {
    return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
};

module.exports = function processMap(json, jsontsx, options) {
    var self = this, TiledJSON = json, TsxJSON = jsontsx;
    var layerIndex = 0, tileIndex = 0;

    
    map = {
        width: 0,
        height: 0,
        chunkWidth: 0,
        chunkHeight: 0,
        collision: [],
        doors: [],
        checkpoints: []
	
    };
    mode = options.mode;
    
    if(mode === "client") {
        map.data = [];
        map.high = [];
        map.animated = {};
        map.plateau = [];
        map.musicAreas = [];
    }
    if(mode === "server") {
    	map.data = [];
		map.high = [];
        map.roamingAreas = [];
        map.chestAreas = [];
        map.pvpAreas = [];
        map.staticChests = [];
        map.staticEntities = {};
		map.entities = [];
		map.mobAreas = [];
    }

    console.info("Processing map info...");
    map.width = TiledJSON.width;
    map.height = TiledJSON.height;
    
    var length = map.width * map.height;
	for(var i = 0; i < length; i += 1)
		if (!map.data[i])
			map.data[i] = 0;
    
    if (TiledJSON.editorsettings && TiledJSON.editorsettings.chunksize)
    {
    	map.chunkWidth = TiledJSON.editorsettings.chunksize.width;
    	map.chunkHeight = TiledJSON.editorsettings.chunksize.height;
    }
    map.tilesize = TiledJSON.tilewidth;
    console.debug("Map is [" + map.width + "x" + map.height + "] Tile Size: " + map.tilesize);
    
    var length = map.width * map.height;
	for(var i = 0; i < length; i += 1)
		map.collision[i] = 0;

    //console.error(TsxJSON.tileset.tile[1].attr["@_id"]);

    // Tile properties (collision, z-index, animation length...)
    var handleTileProp = function(propName, propValue, tileId) {
    	//console.info(propName);
    	//console.info(tileId);
    	if(propName === "c") {
            //console.info("Tile ID [" + tileId + "] is a collision tile");
            collidingTiles[tileId] = true;
        }

        if(mode === "client") {
			if(propName === "v") {
				map.high.push(tileId);
				//console.debug("Tile ID [" + tileId + "] is a high tile (obscures foreground)");
			}

            if(propName === "length") {
                if(!map.animated[tileId]) {
                    map.animated[tileId] = {};
                    //console.debug("Tile ID [" + tileId + "] is an animated tile");
                }
                map.animated[tileId].l = propValue;
            }
            if(propName === "delay") {
                if(!map.animated[tileId]) {
                    map.animated[tileId] = {};
                }
                map.animated[tileId].d = propValue;
            }
        }
    };

	_.each(TiledJSON.tilesets, function(val) {
		//console.info(JSON.stringify(val))
		if (val.source === "Mobs.tsx")
			entitiesFirstGid = val.firstgid;
	});
	//console.info(JSON.stringify(TiledJSON.tilesets));
	_.each(TiledJSON.tilesets, function (value) {
		//console.info(JSON.stringify(value));
	});
	//console.info(JSON.stringify(TiledJSON.tilesets[0].tiles));
	var tiles = TiledJSON.tilesets[0].tiles;
	// iterate through tileset tile properties
	_.each(tiles, function(value) {
		var tileId = parseInt(value.id, 10) + 1;
		//console.info("*** Processing Tile ID " + tileId);
		//console.info(value);
		if (value.hasOwnProperty("properties")) {
			//console.info(JSON.stringify(value.properties));
			
			_.each(value.properties, function(data) {
					//console.info(JSON.stringify(data));
					var tpName = data.name;
					var tpVal = data.value;

					handleTileProp(tpName, (isNumber(parseInt(tpVal, 10))) ? parseInt(tpVal, 10) : tpVal, tileId);
			});
		}

		if (value.hasOwnProperty("objectgroup")) {
			//console.info(JSON.stringify(value));
			
			_.each(value.objectgroup.object, function(data) {
					//console.info(JSON.stringify(data));
					var id = data.id;
					if (id == 1) {
						//console.info("Tile ID [" + tileId + "] is a collision tile");
						collidingTiles[tileId] = true;
					}
			});
		}
		
		//objectgroup -> object.id;

	});

    // iterate through layers and process
    console.info("* Phase 2 Layer Processing");
    _.each(TiledJSON.layers, function(layer) {
        var layerName = layer.name.toLowerCase();
        var layerType = layer.type;

        // Map Checkpoints
        if (layerName === "checkpoints" && mode === "server") {
            console.info("** Processing map checkpoints...");
            var areas = layer.objects;
            var count = 0;
			
            // iterate through the checkpoints
            _.each(areas, function(area) {
				var prop = getPropertyList(area.properties);
                var cp = {
                    id: ++count,
                    x: ~~(area.x / map.tilesize),
                    y: ~~(area.y / map.tilesize),
                    w: ~~(area.width / map.tilesize),
                    h: ~~(area.height / map.tilesize),
					s: prop.s,
                };
                map.checkpoints.push(cp);
            });
        }

	else if(layer.name === "entities" && mode === "server"){
                 console.info("Processing entities...");
                 var areas = layer.objects;
                 for(var i = 0; i < areas.length; i++){
					 var prop = getPropertyList(areas[i].properties);
					 console.info(JSON.stringify(prop));
                     var entityArea = {
                         x: ~~(areas[i].x / map.tilesize),
                         y: ~~(areas[i].y / map.tilesize),
						 type: prop.type,
                         id: prop.id,
						 name: prop.name,
						 scriptQuests: prop.scriptQuests,
                     };
                     map.entities.push(entityArea);
                 }
             }


	else if(layer.name === "mobareas" && mode === "server"){
                 console.info("Processing mobareas...");
                 var areas = layer.objects;
				 console.info(JSON.stringify(areas));
				 //return;
                 for(var i = 0; i < areas.length; i++){
					 console.info(areas[i]);
					 var prop = getPropertyList(areas[i].properties);
                     var area = {
						 id: i,
						 count: prop.count,
						 minLevel: prop.minLevel,
						 maxLevel: prop.maxLevel,
                         x: ~~(areas[i].x / map.tilesize),
                         y: ~~(areas[i].y / map.tilesize),
                         w: ~~(areas[i].width / map.tilesize),
                         h: ~~(areas[i].height / map.tilesize),
						 include: prop.include || '',
						 exclude: prop.exclude || '',
						 definite: prop.definite || '',
						 level: prop.level || '',
                     };
                     map.mobAreas.push(area);
                 }
             }

    });

    // iterate through remaining layers
    console.info("* Phase 3 Tile Map Processing");
    /*var length = map.width * map.height;
	for(var i = 0; i < length; i += 1)
		map.collision[i] = 0;
	console.info("before:"+map.collision);*/
    for(var i = TiledJSON.layers.length - 1; i > 0; i -= 1) {
        processLayer(TiledJSON.layers[i]);
    }
    // If combined empty layer then make it a collision.
	for (var i = 0, max = length; i < max; i += 1) {
		if(map.data[i] === undefined) {
			map.collision[i] = 1;
		}
	}

	//console.info("after:"+JSON.stringify(map.data));
    //console.info("after:"+JSON.stringify(map.collision));

    if(mode === "client") {
        console.info("* Phase 4 Map Data Fixup");

        // set all undefined tiles to 0
        /*for (var i = 0, max = map.data.length; i < max; i += 1) {
            if(map.data[i] == null) {
                map.data[i] = 0;
            }
        }*/
    }

    return map;
};

var getPropertyList = function (properties) {
	props = {}
	for (var prop of properties) {
		if (prop.type === "bool")
			props[prop.name] = prop.value;
		if (prop.type === "string")
			props[prop.name] = prop.value;
		if (prop.type === "int")
			props[prop.name] = parseInt(prop.value);
		if (prop.type === "float")
			props[prop.name] = parseFloat(prop.value);
	}
	return props;
};

var processLayer = function(layer) {
    var layerName = layer.name.toLowerCase();
    var layerType = layer.type;
    //console.info("** Processing layer: " + layerName);

/*    if (mode === "server" && layerName === "_entities") {
        console.info("*** Processing positions of static entities...");
        var tiles = layer.data;
		
        //console.info(JSON.stringify(tiles));
		var i=0;
		for (var tile of tiles) {
			if (tile > 0) {
				console.info(JSON.stringify(layer.properties));
				return;
			}
			i++;
		}
		//return;
		var entity = {
			
		};
		map.entities.push(entity);
    }
*/

    var tiles = layer.data;
    
    if(mode === "client" && layerName === "plateau") {
        console.info("*** Processing plateau tiles...");
        for(var i = 0; i < tiles.length; i += 1) {
            var gid = tiles[i];

            if(gid && gid > 0) {
                map.plateau.push(i);
            }
        }
    }
    else if(layerType === "tilelayer" && /*layer.visible !== 0 &&*/ 
    	layerName !== "_entities" && layerName !== "collision") 
    {
        //console.info("*** Process raw layer data...");
        for(var j = 0; j < tiles.length; j += 1) {
            var gid = tiles[j];

            //if(mode === "client") {
                // set tile gid in the tilesheet
                if(gid > 0) {
                    if(!map.data[j]) {
                        map.data[j] = gid;
                    }
                    else if(map.data[j] instanceof Array) {
                        map.data[j].unshift(gid);
                    }
                    else {
                        map.data[j] = [gid, map.data[j]];
                    }
                }
                //if (map.data[j] === undefined)
                	//map.data[j] = 0;
                
            //}

            // colliding tiles
            if(gid > 0 && gid in collidingTiles) {
            	map.collision[j] = 1;
            }
        }
    }
}

