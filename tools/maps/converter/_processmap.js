// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

var fs = require("fs"),
    path = require("path"),
    zlib = require("zlib"),
    Log = require('log'),
    _ = require('underscore');

// ---- Hidden-tile culling (client maps only) ----------------------------------------------------------------
// A tile completely covered by a fully opaque tile drawn after it can never be seen, so the client map leaves
// it out: smaller map files, fewer sprites to draw. "Drawn after" follows the clients' two passes: normal tiles
// (bottom layer to top), then the characters, then the high tiles (tileset property "v"). So a normal tile hides
// under any opaque tile on a layer above it, but a high tile only under an opaque high tile above it (a normal
// tile, even on a higher layer, is drawn before it). Collision is still worked out from every tile, and the
// server map keeps them all. Turn it off with MAP_CULL=0 (environment variable) when converting.
//
// Kept even when covered: tiles the clients look up by id in a cell -- the harvestable trees
// (HARVEST_TILE_TYPES in gameserver/js/map/map.js and godot-client/scripts/world/map_data.gd).
var KEEP_TILES = { 678: 1, 679: 1, 698: 1, 699: 1, 855: 1, 875: 1, 274: 1, 275: 1, 294: 1, 295: 1 };
var GID_MASK = 0x1FFFFFFF;          // without Tiled's flip flags (flipping doesn't change how opaque a tile is)
var cull = null;                    // per conversion: { cover: Uint8Array, opaque: {gid: true}, high: {gid: true}, count }

// An 8-bit RGBA (colour type 6), non-interlaced PNG -> { width, height, data: RGBA Buffer }; null otherwise.
function readPngRGBA(file) {
    var b = fs.readFileSync(file), pos = 8, width = 0, height = 0, idat = [];
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    while (pos < b.length) {
        var len = b.readUInt32BE(pos), type = b.toString('ascii', pos + 4, pos + 8), body = b.slice(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            width = body.readUInt32BE(0); height = body.readUInt32BE(4);
            if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) return null;
        } else if (type === 'IDAT') idat.push(body);
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    var raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * 4, out = Buffer.alloc(stride * height);
    for (var y = 0; y < height; y++) {
        var f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
        for (var x = 0; x < stride; x++) {
            var a = x >= 4 ? out[dst + x - 4] : 0, up = y > 0 ? out[dst - stride + x] : 0,
                ul = (x >= 4 && y > 0) ? out[dst - stride + x - 4] : 0, v = raw[src + x];
            if (f === 1) v += a;
            else if (f === 2) v += up;
            else if (f === 3) v += (a + up) >> 1;
            else if (f === 4) { var p = a + up - ul, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul);
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : ul); }
            out[dst + x] = v & 255;
        }
    }
    return { width: width, height: height, data: out };
}

// gid -> true for every tile of the tilesheet whose pixels are all fully opaque.
var opaqueCache = {};
function opaqueTiles(TsxJSON, tilesize) {
    var img = TsxJSON && TsxJSON.tileset && TsxJSON.tileset.image;
    var file = path.join(__dirname, '..', 'data', (img && img['@_source']) || 'tilesheet.png');
    if (opaqueCache[file]) return opaqueCache[file];
    var png = null;
    try { png = readPngRGBA(file); } catch (e) { console.warn('Hidden-tile culling off: cannot read ' + file + ': ' + e.message); }
    var res = {};
    if (png) {
        var cols = Math.floor(png.width / tilesize), rows = Math.floor(png.height / tilesize);
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
            var full = true;
            for (var py = 0; py < tilesize && full; py++)
                for (var px = 0; px < tilesize; px++)
                    if (png.data[((r * tilesize + py) * png.width + c * tilesize + px) * 4 + 3] !== 255) { full = false; break; }
            if (full) res[r * cols + c + 1] = true;
        }
    }
    opaqueCache[file] = res;
    return res;
}
    //Types = require("../../shared/js/gametypes"),
    //ItemTypes = require("../../shared/js/itemtypes");


const EntityTypes = {
    NONE: 0,
    PLAYER: 1,
    MOB: 2,
    ITEM: 3,
    ITEMLOOT: 4,
    NPCSTATIC: 5,
    NPCMOVE: 6,
    BLOCK: 8,
    TRAP: 9,
    NODE: 10
};

var map, mode;
var collidingTiles = {};
//var entitiesFirstGid = -1;

var log = new Log(Log.DEBUG, fs.createWriteStream('processmap.log'));

var isNumber = function(o) {
    return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
};

var G_TILESIZE = 16;

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
        checkpoints: [],
        camera: []
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
        //map.high = [];
        map.entities = [];
        map.mobAreas = [];
        map.entityAreas = [];
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

    // a part of a split map (tools/maps/generator/split.py): where its top-left tile sits in the full map,
    // from the Tiled map properties worldX/worldY (the clients' HUD shows full-map coordinates with it)
    if (Array.isArray(TiledJSON.properties)) {
        var mapProps = getPropertyList(TiledJSON.properties);
        if (mapProps.worldX !== undefined || mapProps.worldY !== undefined) {
            map.worldX = mapProps.worldX || 0;
            map.worldY = mapProps.worldY || 0;
        }
    }

    var length = map.width * map.height;
    for(var i = 0; i < length; i += 1)
        map.collision[i] = 0;
/*
    _.each(TiledJSON.tilesets, function(val) {
        //console.info(JSON.stringify(val))
        if (val.source === "Mobs.tsx")
            entitiesFirstGid = val.firstgid;
    });
*/
    //console.info(JSON.stringify(TiledJSON.tilesets));
    console.info("tilesets");
    _.each(TiledJSON.tilesets, function (value) {
        if (value.source === "tilesheet.tsx")
        {
            console.info("tilesheet");
            //console.info(JSON.stringify(value));
        }
    });

    console.info("iterate through tileset tile properties");
    _.each(TsxJSON.tileset.tile, function(value) {
        //console.info(value);
        var tileId = parseInt(value['@_id'], 10) + 1;
        //console.info("*** Processing Tile ID " + tileId);
        if (tileId >= 272 && tileId <= 275)
            console.info(value);

        if (value.hasOwnProperty("properties")) {

            //console.info("properties:"+JSON.stringify(value.properties));
            var prop = getPropertyXmlList(value.properties);
            //console.log("prop:"+JSON.stringify(prop));

            if (prop.hasOwnProperty("v") && mode === "client") {
                //console.info("Tile ID [" + tileId + "] is a high tile (obscures foreground)");
                map.high.push(tileId);
            }

            if (prop.hasOwnProperty("c")) {
                //console.info("Tile ID [" + tileId + "] is a collision tile");
                collidingTiles[tileId] = true;
            }
        }

        if (value.hasOwnProperty("objectgroup")) {
            _.each(value.objectgroup, function(data) {
                    if (data["@_id"] == 1) {
                        //console.info("Tile ID [" + tileId + "] is a collision tile");
                        collidingTiles[tileId] = true;
                    }
            });
        }
    });

    cull = null;
    if (mode === "client" && options.cull !== false) {
        var high = {};
        _.each(map.high, function (id) { high[id] = true; });
        cull = { cover: new Uint8Array(length), opaque: opaqueTiles(TsxJSON, map.tilesize || 16), high: high, count: 0 };
    }

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
                console.info(JSON.stringify(area));
                if (area.properties) {
                    var prop = getPropertyList(area.properties);
                    var cp = {
                        id: ++count,
                        x: ~~(area.x),
                        y: ~~(area.y),
                        w: ~~(area.width),
                        h: ~~(area.height),
                        s: prop.s,
                    };
                    map.checkpoints.push(cp);
                }
            });
        }

        else if (layerName === "camera") {
            console.info("** Processing map camera...");
            var areas = layer.objects;
            var count = 0;

            // iterate through the checkpoints
            _.each(areas, function(area) {
                console.info(JSON.stringify(area));
                if (area) {
                    var cp = {
                        id: ++count,
                        x: ~~(area.x),
                        y: ~~(area.y),
                        w: ~~(area.width),
                        h: ~~(area.height)
                    };
                    map.camera.push(cp);
                }
            });
        }

        else if(layerName === "doors"){
             console.info("Processing doors...");
             //console.info(JSON.stringify(layer));
             var areas = layer.objects;
             if (areas) {
                 for(var i = 0; i < areas.length; i++){
                     var prop = getPropertyList(areas[i].properties);
                     //console.info(JSON.stringify(prop));
                     var doorArea = {
                         x: ~~(areas[i].x),
                         y: ~~(areas[i].y),
                         width: ~~(areas[i].width),
                         height: ~~(areas[i].height),
                         o: "d",
                     };
                     setDoorTarget(doorArea, prop);
                     // Level range a player needs to use the door. Written as tminLevel/tmaxLevel,
                     // the names the gameserver (map.js _getDoors) and both clients read -- this used
                     // to write tMinLevel/tMaxLevel, so no door's level limit ever took effect.
                     if (prop.tMinLevel) doorArea.tminLevel = prop.tMinLevel;
                     if (prop.tMaxLevel) doorArea.tmaxLevel = prop.tMaxLevel;
                     if (prop.tx) doorArea.tx = prop.tx;
                     if (prop.ty) doorArea.ty = prop.ty;
                     if (prop.o) doorArea.to = getOrientation(prop.o);
                     if (prop.rel) doorArea.rel = 1;
                     map.doors.push(doorArea);
                 }
             }
        }

        else if(layerName === "doors_old"){
             console.info("Processing doors...");
             //console.info(JSON.stringify(layer));
             var areas = layer.objects;
             if (areas) {
                 for(var i = 0; i < areas.length; i++){
                     var prop = getPropertyList(areas[i].properties);
                     //console.info(JSON.stringify(prop));
                     var doorArea = {
                         x: ~~(areas[i].x),
                         y: ~~(areas[i].y),
                         width: ~~(areas[i].width),
                         height: ~~(areas[i].height),
                         to: 2
                     };
                     setDoorTarget(doorArea, prop);
                     // Level range a player needs to use the door. Written as tminLevel/tmaxLevel,
                     // the names the gameserver (map.js _getDoors) and both clients read -- this used
                     // to write tMinLevel/tMaxLevel, so no door's level limit ever took effect.
                     if (prop.tMinLevel) doorArea.tminLevel = prop.tMinLevel;
                     if (prop.tMaxLevel) doorArea.tmaxLevel = prop.tMaxLevel;
                     // a destination of tile 0 is a real coordinate (map sections start at 0)
                     if (prop.x !== undefined && prop.x !== null) doorArea.tx = prop.x * G_TILESIZE;
                     if (prop.y !== undefined && prop.y !== null) doorArea.ty = prop.y * G_TILESIZE;
                     if (prop.o) doorArea.to = getOrientation(prop.o);
                     // edge doors (map sections): keep the player's position along the door, so
                     // the destination is tx/ty plus the player's offset from the door's corner
                     if (prop.rel) doorArea.rel = 1;
                     map.doors.push(doorArea);
                 }
             }
        }

        else if(layerName === "entities"){
            if (mode == "server") {
                     console.info("Processing entities...");
                     //console.info(JSON.stringify(layer));
                     var areas = layer.objects;
                     if (areas) {
                         for(var i = 0; i < areas.length; i++){
                             var prop = getPropertyList(areas[i].properties);
                             //console.info(JSON.stringify(prop));
                             var entity = {
                                 x: ~~(areas[i].x),
                                 y: ~~(areas[i].y),
                                 type: getEntityType(prop.type),
                                 kind: prop.kind
                             };
                             if (prop.name) {
                                 entity.name = prop.name;
                             }
                             if (prop.quests) {
                                 entity.quests = prop.quests;
                             }
                             if (prop.level) {
                                 entity.level = prop.level;
                             }
                             if (prop.durability) {
                                 entity.durability = prop.durability;
                             }
                             if (prop.durabilityMax) {
                                 entity.durabilityMax = prop.durabilityMax;
                             }

                             map.entities.push(entity);
                         }
                     }
            }
            else
                return;
        }

        else if(layer.name === "mobareas" && mode == "server"){
             map.mobAreas = map.mobAreas.concat(mobAreasOf(layer));
        }

        else if(layer.name === "entityareas" && mode == "server"){
             map.entityAreas = map.entityAreas.concat(entityAreasOf(layer));
        }

    });

    // iterate through remaining layers
    console.info("* Phase 3 Tile Map Processing");
    for(var i = TiledJSON.layers.length - 1; i > 0; i -= 1) {
        processLayer(TiledJSON.layers[i]);
    }

    if (cull) console.info("Hidden tiles left out of the client map: " + cull.count + " (MAP_CULL=0 keeps them)");

    // If combined empty layer then make it a collision.
    for (var i = 0, max = length; i < max; i += 1) {
        if(map.data[i] === undefined) {
            map.collision[i] = 1;
        }
    }

    return map;
};


// A mob area's levels: its "level" property -- one level ("10") or a range ("10-12"); minLevel/maxLevel
// properties are not read any more (mobAreaLevels() below).
// The mobAreas of a Tiled "mobareas" object layer, in the format of the game
// server's entityarea.json (gameserver map/map.js). Also used on its own by areasOf() below.
// A door's destination map ("tmap"): a map index (107), or -- so the door survives the target
// map being split differently -- a map's name, resolved here with gameserver/maps/maplist.json:
//   "map1"            the map's warp point (its start town's part; split.py), landing on its start area
//   "map1/map1_3_0"   that part
//   "map1" with wx/wy  the part holding full-map tile (wx, wy), landing on that tile
// So a door into a split map names the map (and a full-map tile) instead of a part's index, and only
// needs converting again (split.py --convert does it) after that map is re-split.
var mapListCache = null;
function readMapList() {
    if (mapListCache) return mapListCache;
    var p = path.join(__dirname, '../../../gameserver/maps/maplist.json');
    mapListCache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { maps: {} };
    return mapListCache;
}
function mapIndexOf(name) {
    var list = readMapList(), group = name.split('/')[0], m = /^map(\d+)$/.exec(group);
    var files = m && list.maps && list.maps[group];
    if (!files) return -1;
    var i = files.indexOf(name);
    return i < 0 ? -1 : Number(m[1]) * 100 + i;
}
function setDoorTarget(doorArea, prop) {
    var t = prop.tmap;
    if (t === undefined || t === null || t === '') return;
    if (typeof t === 'number' || /^\d+$/.test(String(t).trim())) {
        if (Number(t) >= 0) doorArea.tmap = Number(t);
        return;
    }
    var name = String(t).trim(), list = readMapList(), index = -1;
    if (name.indexOf('/') >= 0) index = mapIndexOf(name);
    else if (prop.wx !== undefined && prop.wy !== undefined) {
        // the part holding full-map tile (wx, wy) (maplist "areas": [worldX, worldY, w, h], in tiles)
        var files = (list.maps || {})[name] || [];
        for (var i = 0; i < files.length && index < 0; i++) {
            var a = (list.areas || {})[files[i]];
            if (a && prop.wx >= a[0] && prop.wy >= a[1] && prop.wx < a[0] + a[2] && prop.wy < a[1] + a[3]) {
                index = mapIndexOf(files[i]);
                doorArea.tx = (prop.wx - a[0]) * G_TILESIZE;
                doorArea.ty = (prop.wy - a[1]) * G_TILESIZE;
                delete prop.x; delete prop.y;
            }
        }
        if (files.length === 1 && index < 0) {
            index = mapIndexOf(files[0]);
            doorArea.tx = prop.wx * G_TILESIZE;
            doorArea.ty = prop.wy * G_TILESIZE;
            delete prop.x; delete prop.y;
        }
    } else {
        var warp = (list.warps || []).filter(function (n) { return n.split('/')[0] === name; })[0];
        index = mapIndexOf(warp || ((list.maps || {})[name] || [])[0] || name);
    }
    if (index < 0) console.error('Door to "' + name + '"' + (prop.wx !== undefined ? ' tile ' + prop.wx + ',' + prop.wy : '') +
        ': no such map in gameserver/maps/maplist.json -- the door leads nowhere.');
    else doorArea.tmap = index;
}

var mobAreasOf = function (layer) {
    var out = [];
             console.info("Processing mobareas...");
             var areas = layer.objects;
             console.info(JSON.stringify(areas));
             //return;
             for(var i = 0; i < areas.length; i++){
                 console.info(areas[i]);
                 var prop = getPropertyList(areas[i].properties);
                 // An ellipse drawn in Tiled (or an "elipse" property) becomes an elliptical
                 // area on the server, whose x/y are its centre (gameserver area/area.js).
                 var elipse = !!(areas[i].ellipse || prop.elipse);
                 var lv = mobAreaLevels(prop, areas[i].name || ('mob area ' + i));
                 if (!lv) continue;
                 var area = {
                    id: i + 1,      // area ids start at 1, as entity ids do
                    count: prop.count,
                    // the area's levels, from its "level" property ("10" or "10-12"; mobAreaLevels)
                    // "35", or "35-36" for a range (the game server reads it, gameserver map/mapgroup.js areaLevels())
                    level: lv.min === lv.max ? String(lv.min) : lv.min + '-' + lv.max,
                    x: ~~(areas[i].x + (elipse ? areas[i].width / 2 : 0)),
                    y: ~~(areas[i].y + (elipse ? areas[i].height / 2 : 0)),
                    w: ~~(areas[i].width),
                    h: ~~(areas[i].height),
                    include: prop.include || '',
                    // levelWeight (how often each level of the area's level range is picked) and kindWeight (how
                    // often each include kind spawns, in include order) are only written when the mob area
                    // sets them in Tiled: the game server gives every level and every include kind 1 by
                    // default (gameserver area/mobarea.js).
                    // Multiplies the drop chances of every mob spawned in this
                    // area (gameserver: MobArea.bonusDrop -> Mob.setDrops).
                 };
                 // left out when empty, or 1 for bonusDrop: the game server's defaults (gameserver area/mobarea.js)
                 if (String(area.include).trim() === '') delete area.include;
                 // exclude/definite are not mob area settings any more: include lists the kinds it spawns
                 if (String(prop.exclude || '').trim() !== '' || String(prop.definite || '').trim() !== '')
                     console.error((areas[i].name || ('mob area ' + i)) + ': exclude/definite are no longer read -- ' +
                         'list the kinds to spawn in include.');
                 if (Number(prop.bonusDrop) > 0 && Number(prop.bonusDrop) !== 1) area.bonusDrop = Number(prop.bonusDrop);
                 if (prop.levelWeight !== undefined && String(prop.levelWeight).trim() !== '')
                     area.levelWeight = String(prop.levelWeight).replace(/\s+/g, '');
                 // one weight per level of the level range ("2,1,1" for 10-12), or the game server ignores it
                 if (area.levelWeight !== undefined) {
                     var nLv = Math.max(1, lv.max - lv.min + 1);
                     var nW = area.levelWeight.split(',').filter(function (v) { return v !== ''; }).length;
                     if (nW !== nLv) console.error('Mob area "' + (areas[i].name || ('mob area ' + i)) + '": levelWeight "' +
                         area.levelWeight + '" has ' + nW + ' values for levels ' + area.level +
                         ' (needs ' + nLv + ', one per level) -- the game server will weight every level 1.');
                 }
                 if (prop.kindWeight !== undefined && String(prop.kindWeight).trim() !== '')
                     area.kindWeight = String(prop.kindWeight).replace(/\s+/g, '');
                 // kindWeight shares spawns between the include kinds: nothing to share with one kind (or none)
                 if (String(area.include || '').split(',').filter(function (k) { return k.trim() !== ''; }).length < 2)
                     delete area.kindWeight;
                 if (elipse) area.elipse = 1;
                 // Boss multiplier for every mob the area spawns (gameserver map.js initMobAreas).
                 if (prop.boss > 1) area.boss = prop.boss;
                 // Seconds a dead mob of the area waits to respawn (gameserver map.js initMobAreas).
                 if (Number(prop.spawnDelay) > 0) area.spawnDelay = Number(prop.spawnDelay);
                 out.push(area);
             }
    return out;
};

// The entityAreas of a Tiled "entityareas" object layer, in the format of the game
// server's entityarea.json (gameserver map/map.js). Also used on its own by areasOf() below.
var entityAreasOf = function (layer) {
    var out = [];
             console.info("Processing entityareas...");
             var areas = layer.objects;
             console.info(JSON.stringify(areas));
             //return;
             for(var ai = 0; ai < areas.length; ai++) {
                 var area = areas[ai];
                 console.info(area);
                 var prop = getPropertyList(area.properties);
                 // ellipse -> centre x/y, as for mob areas above
                 var elipse = !!(area.ellipse || prop.elipse);
                 var entityarea = {
                    // was `id: i`, the enclosing layer loop's index (the same for every area);
                    // area ids start at 1, as entity ids do
                    id: ai + 1,
                    x: ~~(area.x + (elipse ? area.width / 2 : 0)),
                    y: ~~(area.y + (elipse ? area.height / 2 : 0)),
                    w: ~~(area.width),
                    h: ~~(area.height),
                 };
                 if (elipse) entityarea.elipse = 1;
                 if (prop.type) entityarea.type = getEntityType(prop.type);
                 if (prop.kind) entityarea.kind = prop.kind;
                 if (prop.count) entityarea.count = prop.count;
                 if (prop.name) entityarea.name = prop.name;
                 if (prop.spriteName) entityarea.spriteName = prop.spriteName;
                 if (prop.level) entityarea.level = prop.level;
                 if (prop.durability) entityarea.durability = prop.durability;
                 if (prop.durabilityMax) entityarea.durabilityMax = prop.durabilityMax;
                 if (prop.animName) entityarea.animName = prop.animName;
                 if (prop.weaponType) entityarea.weaponType = prop.weaponType;

                 entityarea.distanceApart = prop.distanceApart ?? 0;

                 out.push(entityarea);
             }
    return out;
};

// The mob areas and entity areas of a whole Tiled map ({ mobAreas, entityAreas }), without
// converting its tiles: run.js "areas" mode writes them to the map's entityarea.json.
module.exports.areas = function (TiledJSON) {
    var out = { mobAreas: [], entityAreas: [] };
    (TiledJSON.layers || []).forEach(function (layer) {
        if (layer.name === "mobareas") out.mobAreas = out.mobAreas.concat(mobAreasOf(layer));
        else if (layer.name === "entityareas") out.entityAreas = out.entityAreas.concat(entityAreasOf(layer));
    });
    out.mobAreas.forEach(function (a, i) { a.id = i + 1; });          // ids 1, 2, 3, ...
    out.entityAreas.forEach(function (a, i) { a.id = i + 1; });
    return out;
};

var mobAreaLevels = function (prop, name) {
    // its "level" property: one level ("10") or a range ("10-12"); null if missing or not a level of 1 or more
    var m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(String(prop.level === undefined || prop.level === null ? '' : prop.level));
    var lo = m ? parseInt(m[1], 10) : 0, hi = m && m[2] !== undefined ? parseInt(m[2], 10) : lo;
    if (hi < lo) { var t = lo; lo = hi; hi = t; }
    if (!m || lo < 1) {
        console.error(name + ': no usable "level" property ("10" or "10-12")' +
            (prop.minLevel !== undefined || prop.maxLevel !== undefined ? ' -- minLevel/maxLevel are no longer read, use level' : '') +
            '; the mob area is left out.');
        return null;
    }
    return { min: lo, max: hi };
};

var getEntityType = function (type) {
	if (type === "player")
		return EntityTypes.PLAYER;
	else if (type === "mob" || type === "monster")
		return EntityTypes.MOB;
	else if (type === "item")
		return EntityTypes.ITEM;
    else if (type === "itemloot")
		return EntityTypes.ITEMLOOT;
	else if (type === "npc" || type === "npcstatic")
		return EntityTypes.NPCSTATIC;
	else if (type === "npcmove")
		return EntityTypes.NPCMOVE;
	else if (type === "block")
		return EntityTypes.BLOCK;
	else if (type === "trap")
		return EntityTypes.TRAP;
	else if (type === "node")
		return EntityTypes.NODE;
	return EntityTypes.NONE;
};

var getPropertyXmlList = function (properties) {
    props = {}
    for (var id in properties) {
        prop = properties[id];
        if (Array.isArray(prop)) {
            for (var p of prop) {
                props[p["@_name"]] = p["@_value"];
            }
        }
        else {
            //console.info(JSON.stringify(prop));
            props[prop["@_name"]] = prop["@_value"];
        }
    }
    return props;
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

var getOrientation = function (orientation) {
    switch (orientation) {
      case 'u':
        return 1;
      case 'd':
        return 2;
      case 'l':
        return 3;
      case 'r':
        return 4;
      default:
        return 1;
    }
}

var processLayer = function(layer) {
    var layerName = layer.name.toLowerCase();
    var layerType = layer.type;
    //console.info("** Processing layer: " + layerName);

    var tiles = layer.data;

    if(layerName === "plateau") {
        // FIX: this branch used to be gated on `mode === "client"`, so it
        // only ever ran (and skipped the layer) for client builds. For
        // "server" mode the condition was false, so plateau tiles fell
        // through into the generic tilelayer branch below, which flags
        // map.collision[j]=1 for any painted tile whose gid carries the
        // tileset's collision tag ('c' property / objectgroup id=1).
        // Plateau is an elevation/overlay layer, not a walls layer -- it's
        // deliberately excluded from collision on the client for that
        // reason -- so the server's compiled collision grid ended up with
        // extra false-positive solid tiles (map2 alone had 576 cells whose
        // *only* source of collision was a plateau tile) wherever a plateau
        // tile happened to reuse a gid that's tagged collidable for its
        // normal (wall/cliff) use elsewhere in the tileset. Dropping the
        // mode check makes plateau always skip collision/data processing,
        // matching the client behavior that was already correct.
        console.info("*** Processing plateau tiles...");
        /*for(var i = 0; i < tiles.length; i += 1) {
            var gid = tiles[i];

            if(gid && gid > 0) {
                map.plateau.push(i);
            }
        }*/
    }
    else if(layerType === "tilelayer" && layerName === "blocking") {
        console.info("Processing blocking tiles...");
        for(var i=0; i < tiles.length; i += 1) {
            var gid = tiles[i];
            // colliding tiles
            if(gid > 0) {
                map.collision[i] = 1;
            }
        }
    }
    else if(layerType === "tilelayer" && /*layer.visible !== 0 &&*/
        layerName !== "_entities" && layerName !== "collision")
    {
        //console.info("*** Process raw layer data...");
        // a layer drawn see-through (opacity below 1) doesn't hide what's under it
        var layerCovers = !(layer.opacity !== undefined && layer.opacity < 1);
        for(var j = 0; j < tiles.length; j += 1) {
            var gid = tiles[j];

            // hidden-tile culling: layers come top to bottom, so cull.cover says what is already above this
            // cell -- bit 1: an opaque normal tile, bit 2: an opaque high tile
            var hidden = false;
            if (cull && gid > 0) {
                var id = gid & GID_MASK, isHigh = !!cull.high[id], cov = cull.cover[j];
                hidden = !KEEP_TILES[id] && (isHigh ? (cov & 2) !== 0 : cov !== 0);
                if (hidden) cull.count++;
                if (layerCovers && cull.opaque[id]) cull.cover[j] |= isHigh ? 2 : 1;
            }

            // set tile gid in the tilesheet
            if(gid > 0 && !hidden) {
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

            // colliding tiles
            if(gid > 0 && gid in collidingTiles) {
                map.collision[j] = 1;
            }
        }
    }
}
