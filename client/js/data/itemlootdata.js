// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
/* global $ */
import fetchJsonSync from './fetchjsonsync.js';

const ItemLoot = [];
const lootParse = fetchJsonSync('shared/data/itemloot.json');
$.each(lootParse, function(key, val) {
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
let i = 0;
for (let il of ItemLoot) {
    if (il)
        //console.info(i+": "+JSON.stringify(il));
        i++
}

export default ItemLoot;
