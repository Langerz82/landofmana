// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Item from './entity/item.js';
import Items from './data/items.js';

/* global ItemTypes, Utils */

export default class InventoryStore {
    constructor(parent, index) {
        this.parent = parent;
        this.index = index;
        this.itemKind = null;
        this.itemName = null;
        this.itemNumber = 0;
        this.skillKind = 0;
        this.skillLevel = 0;
        this.experience = 0;
        const name = '#dialogInventory' + Utils.fixed(this.index, 2);
        this.background = $(name + 'Background');
        this.body = $(name + 'Body');
        this.number = $(name + 'Number');

        this.rescale();
    }

    rescale() {
        this.scale = this.parent.parent.scale;
        const scale = this.scale;

        this.background.css({
            position: 'absolute',
            left:
                '' +
                (15 * scale + Math.floor(this.index % 6) * (17 * scale)) +
                'px',
            top:
                '' +
                (27 * scale + Math.floor(this.index / 6) * (23 * scale)) +
                'px',
            width: 16 * scale + 'px',
            height: 16 * scale + 'px',
            'background-image': 'url("img/' + scale + '/storedialogsheet.png")',
            'background-position': -300 * scale + 'px ' + -180 * scale + 'px'
        });
        this.body.css({
            position: 'absolute',
            width: 16 * scale + 'px',
            height: 16 * scale + 'px',
            bottom: '1px',
            'line-height': '16px',
            'text-shadow':
                '-1px 0 black, 0 1px black, 1px 0 black, 0 -1px black',
            color: 'rgba(255,255,0,1.0)',
            'font-size': 6 * scale + 'px',
            'text-align': 'center'
        });
        this.number.css({
            'margin-top': 16 * scale + 'px',
            color: '#fff',
            'font-size': 6 * scale + 'px',
            'text-align': 'center',
            'text-shadow':
                '-1px 0 black, 0 1px black, 1px 0 black, 0 -1px black'
        });

        if (this.itemKind) {
            this.restore();
        }
    }

    getIndex() {
        return this.index;
    }
    getItemKind() {
        return this.itemKind;
    }
    setItemKind(value) {
        if (value == null) {
            this.itemKind = null;
            this.itemName = '';
        } else {
            this.itemKind = value;
            this.itemName = ItemTypes.KindData[value].name;
        }
    }
    getItemName() {
        return this.itemName;
    }

    getComment() {
        return Item.getInfoMsgEx(this);
    }

    assign(arr) {
        this.setItemKind(arr[0]);
        this.itemNumber = arr[1];
        this.skillKind = arr[2];
        this.skillLevel = arr[3];
        this.itemName = ItemTypes.KindData[arr[0]].name;
        this.spriteName = ItemTypes.KindData[arr[0]].sprite;
        this.itemDurability = arr[4];
        this.itemDurabilityMax = arr[5];
        this.itemDurabilityPercent = Utils.Percent(arr[4] / arr[5]);
        this.experience = arr[6];
        this.restore();
    }
    clear() {
        this.setItemKind(null);
        this.itemNumber = 0;
        this.skillKind = 0;
        this.skillLevel = 0;
        this.release();
    }
    release() {
        this.body.css('background-image', '');
        this.body.html('');
        this.body.attr('title', '');
        this.number.html('');
    }
    restore() {
        Items.jqShowItem(this.body, this, this.number);

        if (
            !ItemTypes.isObject(this.itemKind) &&
            !ItemTypes.isCraftItem(this.itemKind)
        ) {
            this.body.html(this.itemDurabilityPercent);
        }
    }
}
