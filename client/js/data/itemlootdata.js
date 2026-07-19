// Converted from AMD (define) + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
import fetchJsonSync from '../lib/fetchjsonsync.js';

const lootParse = fetchJsonSync('shared/data/itemloot.json');
const ItemLoot = lootParse.map(val => ({
    name: val.name,
    rarity: val.rarity,
    sprite: val.sprite,
    offset: val.offset,
    staticsheet: val.staticsheet > 0 ? val.staticsheet : 0,
    include: val.include || null
}));

export default ItemLoot;
