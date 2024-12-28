var _ = require('underscore'),
		ItemLootJson = require("../../shared/data/itemloot.json");

var ItemLoot = [];

_.each( ItemLootJson, function( val, key ) {
	ItemLoot[key] = {
		name: val.name,
		rarity: val.rarity,
    sprite: val.sprite,
    offset: val.offset,
    include: (val.include) ? val.include : null
	};
});

//console.info("ITEMLOOT="+JSON.stringify(ItemLoot));

module.exports.ItemLoot = ItemLoot;
