
define(['text!../../shared/data/items2.json', 'text!../../shared/data/craft.json', 'text!../../shared/data/staticsheet.json', '../entity/item', 'data/itemlootdata'], function(ItemsJson, CraftJson, staticsheet, Item, ItemLoot) {

	var Items = {};
	var CraftData = JSON.parse(CraftJson);
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

	var Staticsheet = JSON.parse(staticsheet);
	var kindData = {};
	kindData[0] = null;
	var itemParse = JSON.parse(ItemsJson);
	//log.info(JSON.stringify(itemParse));
	$.each( itemParse, function( itemKey, itemValue ) {
		var kind = itemValue.id;
		if (itemValue.type == "weapon" || itemValue.type == "weaponarcher") {
			Items[itemKey+1] = Item.extend({
				init: function(id) {
					this._super(id, parseInt(itemKey), itemValue.type);
				}
			});
		}
		else if (ItemTypes.isArmor(kind) ||
			 itemValue.type == "object" || itemValue.type == "craft") {
			Items[itemKey+1] = Item.extend({
				init: function(id) {
					this._super(id, parseInt(itemKey), itemValue.type);
				}
			});
		}
		kindData[kind] = {
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
			//craft: (itemValue.craft) ? itemValue.craft : [],
			craft: getCraftData(kind)
		};
	});

	ItemTypes.setKindData(kindData);

	Items.getStaticSheet = function () {
		return Staticsheet;
	}

	Items.itemLoad = {};

	Items.jqShowItem = function (jq, item, jqn, size) {
		size = size || 1;
		var kind = item.itemKind;
		var itemCount = item.itemNumber;
		var itemData = ItemTypes.KindData[kind];
		if (item.sprite) {
			var spriteName = "item/item-"+item.sprite+".png";
			itemData = {sprite: spriteName, offset: [0,0]};
		}
		if (kind >= 1000 && kind < 2000) {
			itemData = ItemLoot[kind - 1000];
		}

		var scale = 2;
		if (itemData.staticsheet > 0) {
			var data = Staticsheet[itemData.staticsheet];
			if (size > 1)
				data.scale = size;

			var ow = (itemData.offset[0]*data.spritewidth*data.scale);
			var oh = (itemData.offset[1]*data.spriteheight*data.scale);

			var margin = (56 - (data.spritewidth*data.scale)) >> 1;
			jq.css({
				'display': 'block',
				'background-image': "url('img/" + scale + "/sprites/" + data.sheet + "')",
				'background-size': ~~(data.width*data.scale)+"px "+ ~~(data.height*data.scale)+"px",
				'background-position': '-'+ow+'px -'+oh+'px',
				'margin': margin+'px',
				'line-height': (51-(margin<<1))+'px'
			});
			jq.width(data.spritewidth*data.scale);
			jq.height(data.spriteheight*data.scale);

		}
		else {
			var spriteName = itemData.sprite;
			if (kind >= 1000 && kind < 2000) {
				spriteName = game.sprites["itemloot"].file;
			} else if (ItemTypes.isEquippable(kind)) {
				spriteName = game.sprites["items"].file;
			}

			var scale = 3;

			var margin = (56 - (scale*16)) >> 1;

			var resize = function (img) {
				jq.css({
					'background-size': ~~(img.width*size)+"px "+ ~~(img.height*size)+"px",
					'background-position': '-'+(itemData.offset[0]*scale*16*size)+'px -'+(itemData.offset[1]*scale*16*size)+'px',
				});
				jq.width(scale*16*size);
				jq.height(scale*16*size);
			};

			var filename = "img/"+scale+"/" + spriteName;

			jq.css({
				'display': 'block',
				'background-image': "url('"+filename+"')",
				'background-size': "auto",
				'background-position': '-'+(itemData.offset[0]*scale*16)+'px -'+(itemData.offset[1]*scale*16)+'px',
				'margin': margin+'px',
				'line-height': (51-(margin<<1))+'px'
			});

			jq.width(scale*16*size);
			jq.height(scale*16*size);

			if (size > 1)
			{
				var img = null;
				if (Items.itemLoad[filename]) {
					img = Items.itemLoad[filename];
					resize(img)
				}
				else {
					img = new Image();
					img.src = "img/"+scale+"/" + spriteName;
					img.onload = function() {
						resize(img);
					}
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

    return Items;
});
