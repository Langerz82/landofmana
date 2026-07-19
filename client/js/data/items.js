// Converted from AMD (define) + Class.extend + RequireJS's text! plugin to a native ES6 module.
// See data/fetchjsonsync.js for why jQuery's synchronous $.ajax is used here instead of fetch()/
// JSON import attributes/Node's fs module.
//
// `Items[itemKey+1] = Item.extend({ init: function(id) { this._super(...); } })` becomes a real
// ES6 subclass declared per-iteration (a class expression inside the loop body, same as the
// original per-iteration Class.extend() call) with the super call moved into constructor().
/* global $, ItemTypes */
import fetchJsonSync from '../lib/fetchjsonsync.js';
import Item from '../entity/item.js';
import ItemLoot from './itemlootdata.js';

const Items = {};
const CraftData = fetchJsonSync('shared/data/craft.json');
let id = 0;
for (let craft of CraftData) {
    craft.id = id++;
}

const getCraftData = function(index) {
    const data = [];
    for (let craft of CraftData) {
        if (craft.o === index)
            data.push(craft);
    }
    return data;
};

const Staticsheet = fetchJsonSync('data/staticsheet.json');
const kindData = {};
kindData[0] = null;
const itemParse = fetchJsonSync('shared/data/items2.json');
//log.info(JSON.stringify(itemParse));
$.each(itemParse, function(itemKey, itemValue) {
    const kind = itemValue.id;
    if (itemValue.type === "weapon" || itemValue.type === "weaponarcher" ||
        ItemTypes.isArmor(kind) || itemValue.type === "object" || itemValue.type === "craft") {
        Items[itemKey + 1] = class extends Item {
            constructor(id) {
                super(id, parseInt(itemKey), itemValue.type);
            }
        };
    }
    const itemData = {
        name: itemValue.name,
        type: itemValue.type || "object",
        damageType: itemValue.damageType || "none",
        typemod: itemValue.typemod || "none",
        modifier: itemValue.modifier || 0,
        hand: itemValue.hand || 0,
        sprite: itemValue.sprite || "",
        spriteName: itemValue.spriteName || "",
        offset: itemValue.offset || [0, 0],
        buy: itemValue.buy || 0,
        buyCount: itemValue.buyCount || 1,
        staticsheet: itemValue.staticsheet > 0 ? itemValue.staticsheet : 0,
        level: itemValue.level || itemValue.modifier,
        legacy: itemValue.legacy || 0,
        craft: getCraftData(kind)
    };

    if (itemData.type === "object")
        itemData.cooldown = itemValue.cooldown || 10;

    kindData[kind] = itemData;
});

ItemTypes.setKindData(kindData);

Items.getStaticSheet = function() {
    return Staticsheet;
}

Items.itemLoad = {};

Items.jqShowItem = function(jq, item, jqn, size) {
    size = size || 1;
    const kind = item.itemKind;
    const itemCount = item.itemNumber;
    let itemData = ItemTypes.KindData[kind];
    if (item.sprite) {
        const spriteName = "item/item-" + item.sprite + ".png";
        itemData = {sprite: spriteName, offset: [0, 0]};
    }
    if (kind >= 1000 && kind < 2000) {
        itemData = ItemLoot[kind - 1000];
    }

    // FIX (var cleanup): this and the `var scale = 3` in the else branch below were two
    // separate var declarations of the same name in the same function - legal because var
    // ignores block boundaries, and harmless here because the if/else branches are mutually
    // exclusive and each only reads its own value within its own branch. Converting both to
    // block-scoped declarations is behaviorally identical for that reason.
    const scale = 2;
    if (itemData.staticsheet && itemData.staticsheet > 0) {
        const data = Staticsheet[itemData.staticsheet];
        if (size > 1)
            data.scale = size;

        const ow = (itemData.offset[0] * data.spritewidth * data.scale);
        const oh = (itemData.offset[1] * data.spriteheight * data.scale);

        const margin = (56 - (data.spritewidth * data.scale)) >> 1;
        jq.css({
            'display': 'block',
            'background-image': "url('img/" + scale + "/sprites/" + data.sheet + "')",
            'background-size': ~~(data.width * data.scale) + "px " + ~~(data.height * data.scale) + "px",
            'background-position': '-' + ow + 'px -' + oh + 'px',
            'margin': margin + 'px',
            'line-height': (51 - (margin << 1)) + 'px'
        });
        jq.width(data.spritewidth * data.scale);
        jq.height(data.spriteheight * data.scale);

    }
    else {
        let spriteName = itemData.sprite;
        if (kind >= 1000 && kind < 2000) {
            spriteName = game.sprites["itemloot"].file;
        } else if (ItemTypes.isEquippable(kind)) {
            spriteName = game.sprites["items"].file;
        }

        const scale = 3;

        const margin = (56 - (scale * 16)) >> 1;

        const resize = function(img) {
            jq.css({
                'background-size': ~~(img.width * size) + "px " + ~~(img.height * size) + "px",
                'background-position': '-' + (itemData.offset[0] * scale * 16 * size) + 'px -' + (itemData.offset[1] * scale * 16 * size) + 'px',
            });
            jq.width(scale * 16 * size);
            jq.height(scale * 16 * size);
        };

        const filename = "img/" + scale + "/" + spriteName;

        jq.css({
            'display': 'block',
            'background-image': "url('" + filename + "')",
            'background-size': "auto",
            'background-position': '-' + (itemData.offset[0] * scale * 16) + 'px -' + (itemData.offset[1] * scale * 16) + 'px',
            'margin': margin + 'px',
            'line-height': (51 - (margin << 1)) + 'px'
        });

        jq.width(scale * 16 * size);
        jq.height(scale * 16 * size);

        if (size > 1) {
            let img = null;
            if (Items.itemLoad[filename]) {
                img = Items.itemLoad[filename];

                const fnResize = function(image) {
                    if (image.complete) {
                        resize(image);
                        return true;
                    }
                    return false;
                };

                const res = fnResize(img);
                if (!res)
                    setTimeout(function() { fnResize(img); }, 50);
            }
            else {
                img = new Image();
                img.src = filename;
                img.onload = function() {
                    resize(img);
                };
                Items.itemLoad[filename] = img;
            }
        }
    }

    jq.attr('title', Item.getInfoMsgEx(item));
    jq.html(itemCount);

    if (jqn) {
        if (ItemTypes.isEquippable(kind)) {
            jqn.html(ItemTypes.getLevelByKind(kind) + '+' + itemCount);
        } else {
            if (itemCount > 1)
                jqn.html(itemCount);
        }
    }

};

export default Items;
