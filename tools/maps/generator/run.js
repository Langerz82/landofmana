// Read Synchrously
var fs = require("fs");

function getRandomInt(max) {
  return Math.round(Math.random() * Math.round(max));
}

function round(num, precision) {
	num = parseFloat(num);
	if (!precision) return num;
	return (Math.round(num / precision) * precision);
}

Number.prototype.clamp = function (min, max) { return Math.min(Math.max(this, min), max); }

function get2D(array, index)
{
	var a = ~~(index/array.length);
	var b = index % array.length;
	return array[a][b];
}

function get1D(array, a, b)
{
	var i = a * a + b;
	return array[i];
}


var map = fs.readFileSync("../data/blank.json");
var jsonMap = JSON.parse(map);
console.log("Output Content : \n"+ jsonMap.backgroundcolor);

var MAP_WIDTH = 1024;
var MAP_HEIGHT = 1024;
var MAP_TOTAL = MAP_WIDTH * MAP_HEIGHT;

function setMountains(layer, amount, size, sections)
{
	var mountain = [
		[931,932,933,934,935,936,937,938,939,940],
		[951,952,953,954,955,956,957,958,959,960],
		[971,972,973,974,975,976,977,978,979,980],
		[991,992,993,994,995,996,997,998,999,1000],
		[1011,1012,1013,1014,1015,1016,1017,1018,1019,1020],
		[1031,1032,1033,1034,1035,1036,1037,1038,1039,1040],
		[1051,1052,1053,1054,1055,1056,1057,1058,1059,1060],
		[1071,1072,1073,1074,1075,1076,1077,1078,1079,1080],
		[1091,1092,1093,1094,1095,1096,1097,1098,1099,1100]
	];
	
	var line = [
		[4,4,0],
		[0,4,-4],
		[-4,0,4]
	];

	var mntFRE = [
		955,975,995
	];
	var mntFLE = [
		954,974,994
	];	
	var mntFM = [
		1054,1055,1056,1057,
		1074,1075,1076,1077,
		1094,1095,1096,1097
	];
	
	var mntFL = [
		1033,0,0,0,
		1032,1033,0,0,
		1052,1053,1033,0,
		1072,1073,1032,1033,
		1092,1093,1052,1053,
		0,0,1072,1073,
		0,0,1092,1093,
	];
	var mntFR = [
		0,0,0,1038,
		0,0,1038,1039,
		0,1038,1058,1059,
		1038,1039,1078,1079,
		1058,1059,1098,1099,
		1078,1079,0,0,
		1098,1099,0,0,
	];
	
	
	var piece_data = [];
	// piece, width, displaceX, displaceY
	
	piece_data[0] = [mntFL,4,4];
	piece_data[1] = [mntFM,4,0];
	piece_data[2] = [mntFR,4,-4];
	
	var startPiece = [mntFLE,1,0];
	var endPiece = [mntFRE,1,0];

	var get_front_piece = function (prev)
	{
		var index = 1;
		if (prev)
		{
		  index = piece_data.indexOf(prev);
		  index += getRandomInt(2)-1;
		}
		index = index.clamp(0,piece_data.length-1);
		console.log(index);
		return piece_data[index];
	}


	
	var layerOverlap = [];

	// Zero initialize overlap array.
	for (var j = 0; j < MAP_WIDTH; ++j)
	{
		for (var k = 0; k < MAP_HEIGHT; ++k)
		{
			layerOverlap[(k * MAP_HEIGHT) + j] = 0;
		}
	}

	// Zero initialize layer.
	for (var j = 0; j < MAP_HEIGHT; ++j)
	{
		for (var k = 0; k < MAP_WIDTH; ++k)
		{
			layer[(j * MAP_HEIGHT) + k] = 0;
		}
	}

	//copyTilePatchToLayer(layer, mountainLeft, 4, 100, 100);
	
	for(var i = 0; i < 1; ++i)
	{
		var Width = round(getRandomInt(size),4);
		var Height = round(getRandomInt(size),3);
		var sectionWidth = Width / 4;
		var sectionHeight = Height / 3;
		//var TL = round(getRandomInt(MAP_HEIGHT), 10) * (MAP_HEIGHT) + 
			//round(getRandomInt(MAP_WIDTH), 9);		
		var TL = 20 * MAP_HEIGHT + 20;
		var TR = TL + Width;
		var BR = TR + Height * (MAP_HEIGHT);
		var BL = BR - Width;
		
		
		var prevPiece = null;
		var pos = TL;
		//for (var j = 0; j < 4; ++j)
		//{
		copyTilePatchToLayer(layer, startPiece[0], startPiece[1], pos);
		pos += startPiece[1];
		for (var k = 0; k < 20; ++k)
		{
			var piece = get_front_piece(prevPiece);
			if (prevPiece) {
				var prevIndex = piece_data.indexOf(prevPiece);
				var index = piece_data.indexOf(piece);
				var diff = index - prevIndex;
				var off = line[prevIndex][index];
				if (diff == 0)
					pos += (prevPiece[2] * MAP_HEIGHT);
				else 
					pos += (off * MAP_HEIGHT);
			}
			var w = piece[1];
			copyTilePatchToLayer(layer, piece[0], w, pos);
			pos += w;
			prevPiece = piece;
		}
		copyTilePatchToLayer(layer, endPiece[0], endPiece[1], pos);
	}
}

function copyTilePatchToLayer(layer, tilePatch, width, mapPos)
{
	//var o = y * MAP_HEIGHT + x;
	height = ~~(tilePatch.length / width);
	for (var i=0 ; i < tilePatch.length; ++i)
	{
		var j = ~~(i/width);
		var k = (i % width);
		var pos = mapPos + (j * MAP_HEIGHT + k);
		var tile = layer[pos];
		if (pos >= 0 && pos < MAP_TOTAL && tile == 0)
			layer[pos] = tilePatch[j * width + k];
	}
}

function setSimpleLayer(layer, tilePatchMap, amount, minSize, maxSize, fillPatch, erodeLayer)
{
	var layerOverlap = [];

	// Zero initialize overlap array.
	for (var j = 0; j < MAP_WIDTH; ++j)
	{
		for (var k = 0; k < MAP_HEIGHT; ++k)
		{
			layerOverlap[(k * MAP_HEIGHT) + j] = 0;
		}
	}

	// Zero initialize layer.
	for (var j = 0; j < MAP_HEIGHT; ++j)
	{
		for (var k = 0; k < MAP_WIDTH; ++k)
		{
			layer[(j * MAP_HEIGHT) + k] = 0;
		}
	}

	var fillWidth = (tilePatchMap[0].length-2);
	var fillHeight = (tilePatchMap.length-2);
	console.log("fillHeight="+fillHeight);
	console.log("fillWidth="+fillWidth);
	for(var i = 0; i < amount; ++i)
	{
		var rnd1 = Math.ceil(1+minSize+getRandomInt(maxSize-minSize));
		var rnd2 = Math.ceil(1+minSize+getRandomInt(maxSize-minSize));
		var Width = rnd1 * fillWidth + 1;
		var Height = rnd2 * fillHeight + 1;
		//if (Width===1 || Height===1)
			//continue;
		console.log("Width:"+Width+",Height:"+Height);

		var TL = round(getRandomInt(MAP_HEIGHT), fillHeight) * (MAP_HEIGHT) + 
			round(getRandomInt(MAP_WIDTH), fillWidth);
		var TR = TL + Width;
		var BR = TR + Height * (MAP_HEIGHT);
		var BL = BR - Width;

		// Skip if the patch is totally within any previous patch.
		var make_patch = true;
		for (var j = 0; j < Width; ++j)
		{
			for (var k = 0; k < Height; ++k)
			{
				if (layerOverlap[TL + (k * MAP_HEIGHT) + j] != 0)
				{
					make_patch = false;
				}
				//console.log("setting ");
			}
		}

		if (!make_patch)
			continue;
		

		// TODO - Checking Layer-overlap is corrupting grass layer.
		// Do the sides.
		for (var j = 1; j < Width; ++j)
		{
			var x = tilePatchMap.length-1;
			var y = 1+((j-1) % (tilePatchMap[0].length-2));
			if (layerOverlap[TL + j] === 0)
				layer[TL + j] = tilePatchMap[0][y];
			if (layerOverlap[TL + j] >= 1)
				layer[TL + j] = tilePatchMap[1][1];
			if (layerOverlap[BL + j] === 0)
				layer[BL + j] = tilePatchMap[x][y];
			if (layerOverlap[BL + j] >= 1)
				layer[BL + j] = tilePatchMap[1][1];
		}

		for (var j = 1; j < Height; ++j)
		{
			var x = 1+((j-1) % (tilePatchMap.length-2));
			var y = tilePatchMap[0].length-1;
			var t = (j*MAP_HEIGHT);
			if (layerOverlap[TR + t] === 0)
				layer[TR + t] = tilePatchMap[x][y];
			if (layerOverlap[TR + t] >= 1)
				layer[TR + t] = tilePatchMap[1][1];
			if (layerOverlap[TL + t] === 0)
				layer[TL + t] = tilePatchMap[x][0];
			if (layerOverlap[TL + t] >= 1)
				layer[TL + t] = tilePatchMap[1][1];
		}

		// Register where overlapping.
		for (var j = 1; j < Width; ++j)
		{
			for (var k = 1; k < Height; ++k)
			{
				var index = (TL + (k * MAP_HEIGHT) + j);
				if (index >= 0 && index <= MAP_TOTAL)
					layerOverlap[index] += 1;
			}
		}
	

		// Insert the Corners
		if (layer[TL] == 0)
			layer[TL] = tilePatchMap[0][0];
		
		if (layer[TR] == 0)
			layer[TR] = tilePatchMap[0][tilePatchMap[0].length-1];

		if (layer[BL] == 0)
			layer[BL] = tilePatchMap[tilePatchMap.length-1][0];

		if (layer[BR] == 0)
			layer[BR] = tilePatchMap[tilePatchMap.length-1][tilePatchMap[0].length-1];


		// Fill in patches.
		for (var j = 1; j < Width; ++j)
		{
			for (var k = 1; k < Height; ++k)
			{
				var index = (TL + (k * MAP_HEIGHT) + j);
				index.clamp(0, MAP_TOTAL-1);
				//console.log(index);
				if (layerOverlap[index] > 0)
					layer[index] = tilePatchMap[1][1];
					//[1+((k-1) % (tilePatchMap[0].length-2))]
					//[1+((j-1) % (tilePatchMap.length-2))];
			}
		}
	}


	// TODO Create and pass mask, so that fill tiles erode, and partial tiles do nothing.
	// Erode layer for fill.
	var fill = tilePatchMap[1][1];
	var tileTotal = tilePatchMap.length * tilePatchMap[0].length;
	if (erodeLayer && erodeLayer.length > 0) 
	{
		for (var j = 0; j < MAP_WIDTH; ++j)
		{
			for (var k = 0; k < MAP_HEIGHT; ++k)
			{
				var index = (k * MAP_HEIGHT) + j;
				for (var m = 0; m < erodeLayer.length; ++m)
				{
					for (var a = 0; a < tileTotal; ++a)
					{
						if (layer[index] == get2D(tilePatchMap,a))
						{
							if (!fillPatch || fillPatch[a] == 1)
								erodeLayer[m][index] = 0;
						}
					}
				}
			}
		}
	}
	
	// TODO - Patches that cross over need detecting, filling in the inner corner gaps. - Works!
	for (var j = 0; j < MAP_WIDTH; ++j)
	{
		for (var k = 0; k < MAP_HEIGHT; ++k)
		{
			var index = (k * MAP_HEIGHT) + j;
			if (layer[index] == fill || layer[index] == 0)
				continue;

			var indexL = index - 1;
			var indexR = index + 1;
			var indexU = index - MAP_HEIGHT;
			var indexD = index + MAP_HEIGHT;
			var indexes = [
				[indexL,1,fillWidth],
				[indexR,1,fillWidth],
				[indexU,20,20*fillHeight],
				[indexD,20,20*fillHeight]];

			var skip = false;
			var fill = tilePatchMap[1][1];
			for (var l=0; l < indexes.length; ++l)
			{
				var tile = layer[indexes[l][0]];
				if (tile == 0)
				{
					skip = true;
					break;
				}
			}
			if (skip) continue;

			for (var l=0; l < indexes.length; ++l)
			{
				var tileComp = indexes[l][0];
				var diff = Math.abs(layer[index]-layer[tileComp]);
				if (diff != indexes[l][1] && diff != indexes[l][2])
				{
					layer[index] = tilePatchMap[1][1];
				}
			}
		}
	}
}

function setFixedTileObject(layer, tilePatchMap, amount)
{
	TiledObjectMap = [];

	for(var i = 0; i < amount; ++i)
	{
		var TL = getRandomInt(MAP_HEIGHT) * (MAP_HEIGHT) + getRandomInt(MAP_WIDTH) - tilePatchMap.length * MAP_HEIGHT;
		var Width = tilePatchMap[0].length;
		var Height = tilePatchMap.length;
		
		var BR = TL + Height * (MAP_HEIGHT) + Width;
		var BL = BR - Width;
		var TR = TL + Width;

		var generate = true;
		for (var j = 0; j < Width; ++j)
		{
			for (var k = 0; k < Height; ++k)
			{
				if (layer[TL + (k * MAP_HEIGHT) + j] > 0)
				{
					generate = false;
					break;
				}
			}
		}
		
		if (generate)
		{
			
			for (var j = 0; j < Width; ++j)
			{
				for (var k = 0; k < Height; ++k)
				{
					layer[TL + (k * MAP_HEIGHT) + j] = tilePatchMap[k][j];
				}
			}
			TiledObjectMap[i] = TL;
		}
	}
	return TiledObjectMap;
}

function setOnFixedTileObject(layer, tilePatchMap, amount, baseTileObject, correctionOffset, avoidLayers)
{
	TiledObjectMap = [];

	for(var i = 0; i < amount; ++i)
	{
		if (baseTileObject[i] == 0) { continue; console.log("no base"); }

		var Width = tilePatchMap[0].length;
		var Height = tilePatchMap.length;
		var TL = baseTileObject[i] - correctionOffset.y * MAP_HEIGHT - correctionOffset.x;
		var BR = TL + Height * MAP_HEIGHT + Width;
		var BL = BR - Width;
		var TR = TL + Width;

		var generate = true;
		for (var j = 0; j < Width; ++j)
		{
			for (var k = 0; k < Height; ++k)
			{
				if (layer[TL + (k * MAP_HEIGHT) + j] > 0)
				{
					generate = false;
					break;
				}
				for (var m = 0; m < avoidLayers.length; ++m)
				{
					if (avoidLayers[m][TL + (k * MAP_HEIGHT) + j] != 0)
					{
						generate = false;
						break;
					}
				}				
			}
		}
		
		if (generate)
		{
			
			for (var j = 0; j < Width; ++j)
			{
				for (var k = 0; k < Height; ++k)
				{
					layer[TL + (k * MAP_HEIGHT) + j] = tilePatchMap[k][j];
				}
			}
			TiledObjectMap[i] = TL;
		}
	}
	return TiledObjectMap;
}


function setFixedObjectOnSimpleLayer(layer, tilePatchMap, amount, baselayer, avoidLayers)
{
	for(var i = 0; i < amount; ++i)
	{
		var Width = tilePatchMap[0].length;
		var Height = tilePatchMap.length;
		var TL = getRandomInt(MAP_HEIGHT) * (MAP_HEIGHT) + getRandomInt(MAP_WIDTH);
		//var BR = TL + Height * MAP_HEIGHT + Width;
		//var BL = BR - Width;
		//var TR = TL + Width;

		var generate = true;
		for (var j = 0; j < Width; ++j)
		{
			for (var k = 0; k < Height; ++k)
			{
				if (TL + (k * MAP_HEIGHT) + j >= MAP_WIDTH * MAP_HEIGHT)
					continue;

				if (typeof(baselayer) == "Array")
				{
					for (var m = 0; m < baselayer.length; ++m)
					{
						if (baselayer[m][TL + (k * MAP_HEIGHT) + j] == 0)
						{
							generate = false;
							break;
						}
					}
					
				}
				else 
				{
					if (baselayer[TL + (k * MAP_HEIGHT) + j] == 0)
					{
						generate = false;
						break;
					}	
				}
				if (layer[TL + (k * MAP_HEIGHT) + j] != 0)
				{
					generate = false;
					break;
				}
				for (var m = 0; m < avoidLayers.length; ++m)
				{
					if (avoidLayers[m][TL + (k * MAP_HEIGHT) + j] != 0)
					{
						generate = false;
						break;
					}
				}
			}
		}
		
		if (generate)
		{
			if (TL + (k * MAP_HEIGHT) + j >= MAP_WIDTH * MAP_HEIGHT)
				continue;
			
			for (var j = 0; j < Width; ++j)
			{
				for (var k = 0; k < Height; ++k)
				{
					layer[TL + (k * MAP_HEIGHT) + j] = tilePatchMap[k][j];
				}
			}
		}
	}
}

function setFixedObject(layer, tilePatchMap, amount, avoidLayers)
{
	for(var i = 0; i < amount; ++i)
	{

		var Width = tilePatchMap[0].length;
		var Height = tilePatchMap.length;
		var TL = getRandomInt(MAP_HEIGHT) * (MAP_HEIGHT) + getRandomInt(MAP_WIDTH);
		var BR = TL + Height * MAP_HEIGHT + Width;
		var BL = BR - Width;
		var TR = TL + Width;

		var generate = true;
		for (var j = 0; j < Width; ++j)
		{
			for (var k = 0; k < Height; ++k)
			{
				if (TL + (k * MAP_HEIGHT) + j >= MAP_WIDTH * MAP_HEIGHT)
					continue;
				
				if (layer[TL + (k * MAP_HEIGHT) + j] != 0)
				{
					generate = false;
					break;
				}
				for (var m = 0; m < avoidLayers.length; ++m)
				{
					if (avoidLayers[m][TL + (k * MAP_HEIGHT) + j] != 0)
					{
						generate = false;
						break;
					}
				}
			}
		}
		
		if (generate)
		{
			
			for (var j = 0; j < Width; ++j)
			{
				for (var k = 0; k < Height; ++k)
				{
					if (TL + (k * MAP_HEIGHT) + j >= MAP_WIDTH * MAP_HEIGHT)
						continue;
					
					layer[TL + (k * MAP_HEIGHT) + j] = tilePatchMap[k][j];
				}
			}
		}
	}
}

function DecorateLayer(layer, baseTiles, overlayTiles, Percentchance)
{

	for (var j = 0; j <= MAP_WIDTH; ++j)
	{
		for (var k = 0; k <= MAP_HEIGHT; ++k)
		{
			for (var m = 0; m < baseTiles.length; ++m)
			{
				if (layer[(k * MAP_HEIGHT) + j] == baseTiles[m] && getRandomInt(100) <= Percentchance)
					layer[(k * MAP_HEIGHT) + j] = overlayTiles[getRandomInt(overlayTiles.length)];
			}
		}
	}
}

var layer = {
	"collision": 	jsonMap.layers[0].data,
	"sand": 		jsonMap.layers[1].data,
	"sand objects": jsonMap.layers[2].data,
	"ground": 		jsonMap.layers[3].data,
	"mud": 			jsonMap.layers[4].data,
	"mudlakes": 	jsonMap.layers[5].data,
	"grass": 		jsonMap.layers[6].data,
	"stone": 		jsonMap.layers[7].data,
	"water": 		jsonMap.layers[8].data,
	"plateau": 		jsonMap.layers[9].data,
	"houses": 		jsonMap.layers[10].data,
	"trees": 		jsonMap.layers[11].data,
	"bigrocks": 	jsonMap.layers[12].data,
	"randomobjects":jsonMap.layers[13].data,
};



// Generate Dynamic Patches
var mudPatch = [
	[489,490,491,492,493,494], 
	[509,552,553,552,553,514],
	[529,572,573,572,573,534],
	[549,552,553,552,553,554],
	[569,572,573,572,573,574],
	[589,590,591,592,593,594],
];
var mudFill = [
	0, 0, 0, 0, 0, 0, 
	0, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 0,
	0, 0, 0, 0, 0, 0];

setSimpleLayer(layer.mud, mudPatch, 800, 3, 16, mudFill, [layer.sand]);

var grassPatch = [
	[ 92, 93, 94, 95, 96, 97], 
	[112,153,154,155,156,117],
	[132,153,154,155,156,137],
	[152,153,154,155,156,157],
	[172,153,154,155,156,177],
	[192,193,194,195,196,197],
];
var grassFill = [
	0, 0, 0, 0, 0, 0, 
	0, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 0,
	0, 0, 0, 0, 0, 0];

setSimpleLayer(layer.grass, grassPatch, 1200, 3, 12, grassFill, [layer.sand, layer.mud]);



//setMountains(layer.plateau, 200, 36, 4);


/*var lakePatch = [
	[611, 612, 612, 612, 613],
	[631, 406, 406, 406, 633],
	[631, 406, 406, 406, 633],
	[631, 406, 406, 406, 633],
	[651, 652, 652, 652, 653],
];
setSimpleLayer(layer.water, lakePatch, 240, 4, [layer.sand, layer.mud, layer.grass]);
// End Generate Dynamic Patches




/// HOUSES
var cementPatch = [
	[0,  374,375,376,377,378], 
	[0,  394,395,396,397,398],
	[413,414,415,416,417,418],
	[433,434,435,436,437,438],	
	[0,  454,455,456,457,458],	
	[0,  474,475,476,477,478],
];

cementPatches = setFixedTileObject(layer.stone, cementPatch, 750);

var house1Patch = [
	[ 44, 45, 46, 47, 48, 49, 50, 51],
	[ 64, 65, 66, 67, 68, 69, 70, 71],
	[ 84, 85, 86, 87, 88, 89, 90, 91],
	[104,105,106,107,108,109,110,111],
	[124,125,126,127,128,129,130,131],
	[144,145,146,147,148,149,150,151],
	[  0,165,166,167,168,169,170,171],
	[  0,185,186,187,188,189,190,191],
];

setOnFixedTileObject(layer.houses, house1Patch, 300, cementPatches.slice(0,20), {y:4,x:1}, [layer.water]);


var house2Patch = [
	[204,205,206,207,208,209,210],
	[224,225,226,227,228,229,230],
	[244,245,246,247,248,249,250],
	[264,265,266,267,268,269,270],
	[284,285,286,287,288,289,290],
	[304,305,306,307,308,309,310],
	[324,325,326,327,328,329,330],
	[344,345,346,347,348,349,350],
	[364,365,366,367,368,369,370]
];

setOnFixedTileObject(layer.houses, house2Patch, 300, cementPatches.slice(20,40), {y:6,x:1}, [layer.water]);
*/

// Generate Trees
var tree1Patch = [
	[213, 214, 215, 216],
	[233, 234, 235, 236],
	[253, 254, 255, 256],
	[273, 274, 275, 276],
	[293, 294, 295, 296],
	[  0, 314, 315,   0]
];
setFixedObjectOnSimpleLayer(layer.trees, tree1Patch, 20000, layer.grass, [layer.water, layer.houses, layer.stone]);

var deadTree1 = [
	[794, 795, 796],
	[814, 815, 816],
	[834, 835, 836],
	[854, 855, 856],
	[874, 875, 876],
	[  0, 895,   0]
];
setFixedObjectOnSimpleLayer(layer.trees, deadTree1, 20000, layer.mud, [layer.water, layer.houses, layer.stone]);

var deadTree2 = [
	[617, 618, 619, 620],
	[637, 638, 639, 640],
	[657, 658, 659, 660],
	[677, 678, 679, 680],
	[697, 698, 699, 700],
	[717, 718, 719, 720],
];

setFixedObjectOnSimpleLayer(layer.trees, deadTree2, 20000, layer.sand, [layer.water, layer.houses, layer.stone]);
// End Generate Trees

/*
// Generate Plataeus
var dungeonEntrance1 = [
	[1008,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0, 1007],
	[1028, 1149,    0,    0,    0,    0,    0,    0,    0,    0, 1158, 1027],
	[1048, 1169, 1170, 1171, 1172, 1351, 1352, 1353, 1176, 1177, 1178, 1047],
	[1068, 1189, 1190, 1191, 1192, 1371, 1372, 1373, 1196, 1197, 1198, 1067],
	[   0, 1209, 1210, 1211, 1212, 1391, 1392, 1393, 1216, 1217, 1218,    0]
];
setFixedObject(layer.plateau, dungeonEntrance1, 100, [layer.water, layer.houses, layer.trees, layer.houses, layer.stone, layer.bigrocks]);


var miniPlataeu1 = [
	[1008,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0, 1007],
	[1028, 1149,    0,    0,    0,    0,    0,    0,    0,    0, 1158, 1027],
	[1048, 1169, 1170, 1171, 1172, 1173, 1174, 1175, 1176, 1177, 1178, 1047],
	[1068, 1189, 1190, 1191, 1192, 1193, 1194, 1195, 1196, 1197, 1198, 1067],
	[   0, 1209, 1210, 1211, 1212, 1213, 1214, 1215, 1216, 1217, 1218,    0]
];
setFixedObject(layer.plateau, miniPlataeu1, 200, [layer.water, layer.houses, layer.trees, layer.houses, layer.stone, layer.bigrocks]);
// End Generate Plataeus

// Generate Rocks
var bigRock1 = [
	[757, 758, 759],
	[777, 778, 779],
	[797, 798, 799],
	[817, 818, 819]
];
setFixedObjectOnSimpleLayer(layer.bigrocks, bigRock1, 1000, [layer.sand, layer.mud], [layer.water, layer.trees, layer.houses, layer.stone]);

var bigGrassRock1 = [
	[18, 19, 20],
	[38, 39, 40],
	[58, 59, 60],
	[78, 79, 80]
];
setFixedObjectOnSimpleLayer(layer.bigrocks, bigGrassRock1, 500, layer.grass, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau]);

var bigGrassRock2 = [
	[259, 260],
	[279, 280]
];
setFixedObjectOnSimpleLayer(layer.bigrocks, bigGrassRock2, 500, layer.grass, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau]);

var bigGrassRock3 = [
	[257, 258],
	[277, 278]
];
setFixedObjectOnSimpleLayer(layer.bigrocks, bigGrassRock3, 500, layer.grass, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau]);
// End Generate Rocks

var grave1 = [
	[61, 62],
	[81, 82]
];
var grave2 = [
	[101, 102],
	[121, 122]
];
setFixedObject(layer.randomobjects, grave1, 200, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau]);
setFixedObject(layer.randomobjects, grave2, 200, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau]);

var tribalPost1 = [
	[701],
	[721],
	[741],
	[761]
];
var tribalPost2 = [
	[702],
	[722],
	[742],
	[762]
];
var tribalPost3 = [
	[703],
	[723],
	[743],
	[763]
];
var tribalPost4 = [
	[704],
	[724],
	[744],
	[764]
];
setFixedObject(layer.randomobjects, tribalPost1, 50, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau, layer.bigrocks]);
setFixedObject(layer.randomobjects, tribalPost2, 50, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau, layer.bigrocks]);
setFixedObject(layer.randomobjects, tribalPost3, 50, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau, layer.bigrocks]);
setFixedObject(layer.randomobjects, tribalPost4, 50, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau, layer.bigrocks]);

var logStack = [
	[5],
	[25]
];
setFixedObject(layer.randomobjects, tribalPost4, 300, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau, layer.bigrocks]);



var well1 = [
	[281, 282, 283],
	[301, 302, 303],
	[321, 322, 323],
	[341, 342, 343],
	[361, 362, 363]
];
setFixedObject(layer.randomobjects, well1, 100, [layer.sand, layer.water, layer.trees, layer.houses, layer.stone, layer.plateau]);

var outHouse1 = [
	[381,382,383,384],
	[401,402,403,404],
	[421,422,423,424],
	[441,442,443,444],
	[461,462,463,464]
];
setFixedObject(layer.randomobjects, outHouse1, 100, [layer.sand, layer.water, layer.trees, layer.houses, layer.stone, layer.plateau]);


// Generate Decoration Layers
var mudCenterTiles = [
	552,553,572,573
];
var mudDecorateTiles = [
	550, 570 
];
DecorateLayer(layer.mud, mudCenterTiles, mudDecorateTiles, 10);

var grassCenterTiles = [
	153,154,155,156
];
var grassDecorateTiles = [
	158,159,160,606,607,608,626,627
];
DecorateLayer(layer.grass, grassCenterTiles, grassDecorateTiles, 5);

var waterCenterTiles = [
	406
];
var waterDecorateTiles = [
	426,446,466
];
DecorateLayer(layer.water, waterCenterTiles, waterDecorateTiles, 5);

// End Generate Decoration Layers


// Generate Random Objects.
var tentTiles = [
	[141,142,143],
	[161,162,163],
	[181,182,183],
	[201,202,203],
];
setFixedObject(layer.randomobjects, tentTiles, 100, [layer.water, layer.trees, layer.houses, layer.stone, layer.plateau, layer.bigrocks]);



// End Generate Random Objects.


for (var i = 0; i < jsonMap.layers.length; ++i)
{
	console.log(jsonMap.layers[i].width * jsonMap.layers[i].height);
	for (var j = 0; j < jsonMap.layers[i].width * jsonMap.layers[i].height; ++j)
		if(!jsonMap.layers[i].data[j])
			jsonMap.layers[i].data[j] = 0;
}*/
//console.log(JSON.stringify(layer["grass"]));
var mapOutput = JSON.stringify(jsonMap);
//mapOutput = mapOutput.replace(/,null/g, ",0");
fs.writeFile('../data/output.json', mapOutput, 'utf8', function() {});



