var _ = require('underscore'),
    ItemsJson = require("../../shared/data/items2.json"),
    CraftData = require("../../shared/data/craft.json");

  	var id = 0;
  	for (var craft of CraftData) {
  		craft.id = id++;
  	}

  	var getCraftData = function (index) {
  		var data = [];
  		for (var craft of CraftData)
  		{
  			if (craft.o == index)
  				data.push(craft);
  		}
  		return data;
  	};

var KindData = {};


//console.info(ItemsJson);
KindData[0] = null;
_.each( ItemsJson, function( itemValue, key ) {
	KindData[itemValue.id] = {
    name: itemValue.name,
    type: (itemValue.type) ? itemValue.type : "object",
    damageType: (itemValue.damageType) ? itemValue.damageType : "none",
    typemod: (itemValue.typemod) ? itemValue.typemod : "none",
    modifier: (itemValue.modifier) ? itemValue.modifier : 0,
    hand: (itemValue.hand) ? itemValue.hand : 0,
    sprite: (itemValue.sprite) ? itemValue.sprite : "",
    spriteName: (itemValue.spriteName) ? itemValue.spriteName : "",
    offset: (itemValue.offset) ? itemValue.offset : [0,0],
    buy: (itemValue.buy) ? itemValue.buy : 0,
    buycount: (itemValue.buycount) ? itemValue.buycount : 1,
    staticsheet: (itemValue.staticsheet > 0) ? itemValue.staticsheet : 0,
    level: (itemValue.level) ? itemValue.level : itemValue.modifier,
    legacy: (itemValue.legacy) ? itemValue.legacy : 0,
    craft: getCraftData(itemValue.id)
	};
});

ItemTypes.setKindData(KindData);

module.exports.Kinds = KindData;
module.exports.CraftData = CraftData;
