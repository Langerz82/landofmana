import _ from 'underscore';
import ItemLootJson from "../../shared/data/itemloot.json" with { type: 'json' };

const ItemLoot = [];

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

export { ItemLoot };
export default { ItemLoot };
