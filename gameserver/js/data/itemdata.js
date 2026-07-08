import _ from 'underscore';
import ItemsJson from "../../shared/data/items2.json" with { type: 'json' };
import CraftData from "../../shared/data/craft.json" with { type: 'json' };
import ItemTypes from '../../shared/js/itemtypes.js';
//import {*} from '../common.js';

//import { ItemTypes } from '../common.js';

var id = 0;
for (var craft of CraftData) {
	craft.id = id++;
}

var getCraftData = function (index) {
	var data = [];
	for (var craft of CraftData)
	{
		if (craft.o === index)
			data.push(craft);
	}
	return data;
};

var KindData = {};

//console.info(ItemsJson);
KindData[0] = null;
_.each( ItemsJson, function( itemValue, key ) {
	var itemData = {
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
    cooldown: (itemValue.cooldown) ? itemValue.cooldown : 10,
    craft: getCraftData(itemValue.id)
	};

  if (itemData.type == "object")
    itemData.cooldown = (itemValue.cooldown) ? itemValue.cooldown : 10;

  KindData[itemValue.id] = itemData;
});

ItemTypes.setKindData(KindData);

export const Kinds = KindData;
export { CraftData };
export default { Kinds, CraftData };
