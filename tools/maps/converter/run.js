#!/usr/bin/env node

var util = require('util'),
    Log = require('log'),
    path = require("path"),
    fs = require("fs"),
    //file = require("../../shared/js/file"),
    processMap = require('./_processmap'),
    log = new Log(Log.DEBUG);

//const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser/src/fxp");
//const parser = new XMLParser();
//var parser = require('fast-xml-parser');
var he = require('he');
const parser = require("fast-xml-parser");
//var parser = new XMLParser();

var xmloptions = {
    attributeNamePrefix : "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName : "#text",
    ignoreAttributes : false,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : true,
    parseAttributeValue : true,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false, //"strict"
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),//default is a=>a
    tagValueProcessor : (val, tagName) => he.decode(val), //default is a=>a
    stopNodes: ["parse-me-as-string"]
};

var source = process.argv[2],
    mode = process.argv[3] || "direct",
    chunkWidth = process.argv[4] || 128;
    chunkHeight = process.argv[5] || 128;
    destination = process.argv[6];

if(!source || (mode!="direct" && mode!="both" && mode!="client" && mode!="server") || (mode!="direct" && !destination)) {
    log.info("Usage : ./exportmap.js tiled_json_file [mode] [destination]");
    console.info("Optional parameters : mode & destination. Values:");
    console.info("    - \"direct\" (default) → updates current server and map files (WARNING: SHOULD ONLY BE CALLED FROM BrowserQuest/tools/maps !!!);");
    console.info("    - \"client destination_file\" → will generate destination_file.js and destination_file.json for client side map;");
    console.info("    - \"server destination_file.json\" → will generate destination_file.json for server side map;");
    console.info("    - \"both destination_directory\" → will generate world_client.js, world_client.json and world_server.json in directory.");
    process.exit(0);
}

function main() {
    getTiledJSONmap(source, callback_function);
}

function callback_function(json, jsontsx) {
	switch(mode){
		case "client":
			processClient(json, jsontsx, destination);
			break;
		case "server":
			processServer(json, jsontsx, destination);
			break;
		case "direct":
			var filename=source.substr(source.lastIndexOf('/')+1,
				source.lastIndexOf('.') - source.lastIndexOf('/')-1);
			var client_dir = "../../../client/maps/"+filename;
			if (!fs.existsSync(client_dir))
				fs.mkdirSync(client_dir);
			processClient(json, jsontsx, client_dir+"/"+filename);
			processServer(json, jsontsx, "../../../gameserver/maps/"+filename+".json");
			break;

		case "both":
			var directory=destination.replace(/\/+$/,'');//strip last path slashes
			processClient(json, jsontsx, directory+"/"+source);
			processServer(json, jsontsx, directory+"/"+source);
			break;
		default:
			console.info("Unrecognized mode, how on earth did you manage that ?");
	}
}


var map = {};


function processClient(json, tsx, dest){
  var mapData = processMap(json, tsx, {mode:"client"});

  if (chunkWidth == 0 && chunkHeight == 0)
  {
    createMapFile(mapData, dest);
    return;  	  
  }

  chunkWidth = parseInt(chunkWidth || map.chunkWidth);
  chunkHeight = parseInt(chunkHeight || map.chunkHeight);
  
  var map = mapData;
  var tile = [];
  var collision = [];
  var offset = 0;
  for (var i=0; i < map.height; ++i)
  {
  	  offset = i * map.width;
  	  tile[i] = map.data.slice(offset, offset+map.width);
  	  collision[i] = map.collision.slice(offset, offset+map.width);
  }
 
  chunkBlockWidth = Math.ceil(map.width / chunkWidth);
  chunkBlockHeight = Math.ceil(map.height / chunkHeight);
  chunkTotal = chunkWidth * chunkHeight;
  var mapDataLength = map.height * map.width;
  
  var subMap;
//  console.info(JSON.stringify(collision));
  for (var a=0; a < chunkBlockHeight; ++a)
  {
  	    for (var b=0; b < chunkBlockWidth; ++b)
  	    {
  	      var subMap = {};
  	      subMap.data = [];
  	      subMap.collision = [];
  	      subMap.height = chunkHeight; //((a+1)*chunkHeight > (map.height)) ? map.height % chunkHeight : chunkHeight;
  	      subMap.width = chunkWidth; //((b+1)*chunkWidth > (map.width)) ? map.width % chunkWidth : chunkWidth;
  	      subMap.oh = ((a+1)*chunkHeight > (map.height)) ? map.height % chunkHeight : chunkHeight;
  	      subMap.ow = ((b+1)*chunkWidth > (map.width)) ? map.width % chunkWidth : chunkWidth;

  	      var index = (a*chunkBlockHeight+b);
  	      subMap.index = index;

		  var x = b*subMap.width;
		  var y = a*subMap.height;

		  
		  for (var i=0; i < subMap.oh; ++i)
		  {
		  	var section = offset + (i*map.width);
		  	var dline = tile[y+i].slice(x, x+subMap.ow);
		  	subMap.data = subMap.data.concat(dline);
		  	var cline = collision[y+i].slice(x, x+subMap.ow);
		  	subMap.collision = subMap.collision.concat(cline);
		  	var padlen = subMap.width - subMap.ow;
		  	for (var j=0; j < padlen; ++j)
		  	{
		  		subMap.data.push(0);
		  		subMap.collision.push(1);
		  	}
		  }
		  var padlen = subMap.height - subMap.oh;
		  for (var i=0; i < padlen; ++i)
		  {
		  	for (var j=0; j < subMap.width; ++j)
		  	{
		  		subMap.data.push(0);
		  		subMap.collision.push(1);
		  	}
		  }
		  
		  delete subMap.ow;
		  delete subMap.oh;

		  var subTotal = subMap.width * subMap.height;
		  for (var i=0; i < subTotal; ++i)
		  {
		  	  if (!subMap.data[i])
		  	  {
		  	  	  subMap.data[i] = 0;
		  	  	  subMap.collision[i] = 1;
		  	  }
		  	  if (subMap.data[i] == 0 && subMap.collision[i] == 0)
		  	  	  subMap.collision[i] = 1;
		  }
		  
		  if (subTotal != subMap.data.length)
		  {
		  	  console.error("totals not correct for index: "+subMap.index+" "+
		  	  	  subTotal+"!="+subMap.data.length);
		  }
		  var subDest = dest+"_"+subMap.index;
		  createMapFile(subMap, subDest);
		}
   }
   
   delete map.data;
   delete map.collision;
   delete map.plateau;
   delete map.animated;
   
   map.chunkWidth = chunkWidth;
   map.chunkHeight = chunkHeight;
   map.indexes = subMap.index+1;
   if (map.width < chunkWidth)
   	   map.width = chunkWidth;
   if (map.height < chunkHeight)
   	   map.height = chunkHeight;

   var dest = dest+"_GO";
   createMapFile(map, dest);
}

function createMapFile(mapData, dest)
{
  var jsonMap = JSON.stringify(mapData);
  // map in a .json file for ajax loading
  console.info(dest+".json");
  fs.writeFile(dest+".json", jsonMap, function(err, file) {
    if(err){
      console.error(JSON.stringify(err));
    }
    else{
      //console.info("Finished processing map file: "+ dest + ".json was saved.");
    }
  });

  // map in a .js file for web worker loading
  jsonMap = "var mapData = "+jsonMap;
  console.info(dest+".json");
  /*fs.writeFile(dest+".js", jsonMap, function(err, file) {
    if(err){
      console.error(JSON.stringify(err));
    }
    else{
      console.info("Finished processing map file: "+ dest + ".js was saved.");
    }
  });*/
}

function processServer(json, tsx, dest){
	var jsonMap = JSON.stringify(processMap(json, tsx, {mode:"server"})); // Save the processed map object as JSON data
	
	var subTotal = jsonMap.width * jsonMap.height;
	for (var i=0; i < subTotal; ++i)
	{
	  if (!jsonMap.data[i])
	  {
		  jsonMap.data[i] = 0;
		  jsonMap.collision[i] = 1;
	  }
	  if (jsonMap.data[i] == 0 && jsonMap.collision[i] == 0)
		  jsonMap.collision[i] = 1;
	}

	//console.info(dest);
	fs.writeFile(dest, jsonMap, function(err, file) {
		if(err){
			console.error(JSON.stringify(err));
		}
		else{
			console.info("Finished processing map file: "+ dest + " was saved.");
		}
	});
}

function getTiledJSONmap(filename, callback) {
    var self = this;

	console.info(filename);
	
	var tsx = "../data/tilesheet.tsx";
	console.info(tsx);
	var exists = fs.readFileSync(filename);
	if (!exists) {
		console.error(filename + " doesn't exist.");
		return;
	}
	var tsxExists = fs.readFileSync(tsx);

	if (!tsxExists) {
		console.error(tsx + " doesn't exist.");
		return;
	}
	
	//console.info("blah");
	fs.readFile(filename, function(err, file1) {
		if (err)
			console.error(err);
		//console.info("blah2");
		fs.readFile(tsx, function(err, file2) {
			if (err)
				console.error(err);
			
			//console.info("blah3");
			var tsxdata = file2.toString();
			//console.info(JSON.stringify(parser));
			//if( parser.validate(tsxdata) === true) {
			//var jsonObj = parser.parse(tsxdata,xmloptions);
			//}

			// Intermediate obj
			var tObj = parser.getTraversalObj(tsxdata,xmloptions);
			var jsonObj = parser.convertToJson(tObj,xmloptions);

			callback(JSON.parse(file1.toString()), jsonObj);
		});
	});
}

main();
