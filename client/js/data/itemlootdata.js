
define(['text!../../shared/data/itemloot.json'], function(ItemLootJson) {
  	var ItemLoot = [];
  	var lootParse = JSON.parse(ItemLootJson);
  	$.each( lootParse, function( key, val ) {
  		ItemLoot[key] = {
  			name: val.name,
  			rarity: val.rarity,
  			sprite: val.sprite,
        offset: val.offset,
        staticsheet: (val.staticsheet > 0) ? val.staticsheet : 0,
        include: (val.include) ? val.include : null
  		};
  	});
    //console.info(JSON.stringify(ItemLoot));
    var i = 0;
    for (var il of ItemLoot)
    {
      if (il)
        //console.info(i+": "+JSON.stringify(il));
      i++
    }
    return ItemLoot;
});
