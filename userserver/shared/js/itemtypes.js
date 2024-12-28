/* global bootKind, _, exports, module, Types */

var ItemTypes = {};
var ItemData = {};
var KindData = {};

//ItemTypes.KindData = KindData;

ItemTypes.setKindData = function(kindData) {
	//console.info(JSON.stringify(kindData));
	KindData = kindData;
	ItemTypes.KindData = kindData;
};

ItemTypes.getData = function (k) {
	var data = KindData[k];
	if (!data || data.legacy == 1)
			return null;
	return data;
}

ItemTypes.getName = function(kind) {
    //if (kind == null) return false;
    try {
    	var item = KindData[kind];
    	if (!item) return '';
        return item.name;
   } catch(e) {
        console.error("No name found for item: "+KindData[kind]);
        console.error('Error stack: ' + e.stack);
    }
}

ItemTypes.getWeaponLevel = function(kind) {
    //if (kind == null) return false;
    try {
    	var item = KindData[kind];
    	if (!item) return 0;
        return item.modifier;
    } catch(e) {
        console.error("No level found for weapon: "+KindData[kind]);
        console.error('Error stack: ' + e.stack);
    }
};


ItemTypes.getArmorLevel = function(kind) {
    //if (kind == null) return false;
    try {
    	var item = KindData[kind];
        if (!item) return 0;
    	return item.modifier;
    } catch(e) {
        console.error("No level found for armor: "+KindData[kind]);
        console.error('Error stack: ' + e.stack);
    }
};

ItemTypes.getItemByLevel = function(type, level) {
	for (var kind in KindData)
	{
	    var item = KindData[kind];
	    if ((item.type == "armor" || item.type == "armorarcher") &&
		item.type == type && level == item.modifier)
	    {
		return item;
	    }
	    if ((item.type == "weapon" || item.type == "weaponarcher") &&
		item.type == type && level == item.modifier)
	    {
		return item;
	    }

	}
	return null;
};

ItemTypes.getLevelByKind = function(kind) {
    var item = KindData[kind];
    if (ItemTypes.isArmor(kind))
    {
			return item.level;
    }
    if (ItemTypes.isWeapon(kind))
    {
			return item.level;
    }
    return null;
};

ItemTypes.getType = function(kind) {
    //if (kind == null) return false;
    try {
    	var item = KindData[kind];
        return item.type;
    } catch(e) {
        console.error("No type found for item: "+kind);
        console.error('Error stack: ' + e.stack);
    }
};

ItemTypes.getBuyPrice = function(kind) {
    	var item = KindData[kind];
        if (!item) return 0;

				var type = item.type;
        if (type == "bow") {
        	return Math.floor(item.modifier*item.modifier*10);
        } else if (type == "chest") {
        	return Math.floor(item.modifier*item.modifier*10);
				} else if (ItemTypes.isArmor(kind)) {
					return Math.floor(item.modifier*item.modifier*10);
				} else if (ItemTypes.isWeapon(kind)) {
					return Math.floor(item.modifier*item.modifier*10);
        } else if (type == "object" && item.buy > 0) {
        	if (item.buyCount > 1)
        		return (item.buy * item.buyCount);
        	else
        		return item.buy;
        }
    	return 0;
};

ItemTypes.getCraftPrice = function (k) {
	var item = KindData[k];
	if (!item || item.legacy == 1)
			return 0;

	if (item.buy > 0) return item.buy;

	return ~~(ItemTypes.getBuyPrice(k) / 4);
};

ItemTypes.getEnchantSellPrice = function(item) {
	var value = ItemTypes.getBuyPrice(item.itemKind) / 10;
	//console.info("getEnchantSellPrice:" + itemKind + " " + enchantLevel + " " + durabilityMax + " " + experience);
	var enchantLevel = item.itemNumber;
	if (enchantLevel > 1)
	{
		//console.info("getEnchantSellPrice: " + ItemTypes.getEnchantPrice(itemKind,enchantLevel-1,experience) / 10);
		value += ~~(ItemTypes.getEnchantPrice(item) / 10);
	}
	//console.info("full price1:"+value);
	value *= item.itemDurabilityMax / 900;
	//console.info("full price2:"+value);
	return Math.floor(value);
};

ItemTypes.getEnchantPrice = function(item, current) {
			current = current || false;
			if (!item) return NaN;

			var data = KindData[item.itemKind];
			var enchantLevel = (current) ? item.itemNumber : item.itemNumber+1;
			var curLevel = item.itemNumber;
			if (enchantLevel >= 25) return NaN;

			experience = item.itemExperience;

      var baseLevel = data.modifier;
			console.info("getEnchantPrice: "+ItemTypes.itemExpForLevel[enchantLevel]);
			var cost = Math.floor(baseLevel*baseLevel*10 * Math.pow(2, enchantLevel) *
      	(1-(experience / ItemTypes.itemExpForLevel[enchantLevel])));
			console.info("cost: "+cost);
      return cost;
};

var Clamp = function(min, max, value) {
    if(value < min) {
        return min;
    } else if(value > max) {
        return max;
    } else {
        return value;
    }
};

ItemTypes.getRepairPrice = function(item) {
	var value = ItemTypes.getBuyPrice(item.itemKind) / 10;
	//var point = item.itemNumber;
	//console.info("kind="+kind+",point="+point);
	if (item.itemDurability == item.itemDurabilityMax)
		return 0;

	if (item.itemNumber > 1)
	{
			value = ItemTypes.getEnchantPrice(item, true) / 10;
	}
	var mp = ((item.itemDurabilityMax / 900) * (1 - (item.itemDurability / item.itemDurabilityMax)));
	log.info("getRepairPrice - mp: "+mp);
	value *= Clamp(0,1,mp);
	//value *= (item.itemDurability / item.itemDurabilityMax) * (item.itemDurabilityMax / 900) * item.itemNumber;
	//console.info("full price:"+value);
	return 1 + ~~(value);
};

ItemTypes.isEquippable = function(kind) {
	if (ItemTypes.isArmor(kind) ||
	    ItemTypes.isWeapon(kind) || ItemTypes.isArcherWeapon(kind) ||
		ItemTypes.isClothes(kind))
			return true;
	return false;
};

ItemTypes.isClothes = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return (item.type === "helm" || item.type === "chest" || item.type === "gloves" || item.type === "boots");
};

ItemTypes.isArmor = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return ItemTypes.isClothes(kind);
};

ItemTypes.isWeapon = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return ItemTypes.isMeleeWeapon(kind) || ItemTypes.isArcherWeapon(kind);
};

ItemTypes.isEquipment = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return ItemTypes.isWeapon(kind) || ItemTypes.isArmor(kind);
};

ItemTypes.getSpriteCode = function (kind) {
	var data = KindData[kind];
	if (ItemTypes.isArmor(kind))
	{
		return kind;
	}
	if (ItemTypes.isWeapon(kind))
	{
		var type = data.type;
		if (!type)
			return 0;
		if (type == "sword")
			return 1;
		if (type == "axe")
			return 2;
		if (type == "hammer")
			return 12;
		if (type == "bow")
			return 50;
	}
	return 0;
};

ItemTypes.getEquipmentSlot = function (kind) {
	if (ItemTypes.isWeapon(kind)) return 4;

	var item = KindData[kind];
	if (!item) return -1;

	if (item.type === "helm") return 0;
	if (item.type === "chest") return 1;
	if (item.type === "gloves") return 2;
	if (item.type === "boots") return 3;
	return -1;
};

ItemTypes.isMeleeWeapon = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return item.type === "sword" ||
			item.type === "hammer" ||
			item.type === "axe";
};

ItemTypes.isHarvestWeapon = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return item.type === "hammer" ||
			item.type === "axe";
};

ItemTypes.isArcherWeapon = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return item.type === "bow";
};

ItemTypes.isObject = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return item.type === "object";
};

ItemTypes.isCraftItem = function(kind) {
    var item = KindData[kind];
    if (!item) return false;
    return item.type === "craft";
};

ItemTypes.isLootItem = function(kind) {
    return kind >= 1000 && kind < 2000;
};

ItemTypes.isConsumableItem = function(kind) {
    var item = KindData[kind];
    if (!item)
    	return false;
    return item.type === "object";
};

ItemTypes.isHealingItem = function(kind) {
    var item = KindData[kind];
    if (!item)
    	return false;
    return item.type === "object" && (item.typemod=="health" || item.typemod=="healthpercent");
};

ItemTypes.isItem = function (kind) {
    var item = ItemTypes.KindData[kind];
    if (!item) return false;
    return ItemTypes.isArmor(kind) || ItemTypes.isWeapon(kind) ||
    	item.type == "object" ||
    	item.type == "craft";
}

ItemTypes.forEachKind = function(callback) {
    for(var k in kindData) {
    	//console.info("k="+JSON.stringify(k));
        callback(KindData[k], k);
    }
};

ItemTypes.forEachArmorKind = function(callback) {
    Types.forEachKind(function(kind, kindName) {
        if(ItemTypes.isArmor(kind)) {
            callback(kind, kindName);
        }
    });
};
ItemTypes.forEachWeaponKind = function(callback) {
    Types.forEachKind(function(kind, kindName) {
        if(ItemTypes.isWeapon(kind)) {
            callback(kind, kindName);
        }
    });
};

ItemTypes.forEachArcherWeaponKind = function(callback) {
    Types.forEachKind(function(kind, kindName) {
        if(ItemTypes.isArcherWeapon(kind)) {
            callback(kind, kindName);
        }
    });
};

ItemTypes.getItemListBy = function (itemType, minLevel, maxLevel) {
    var ItemsList = [];
    for(var k in KindData) {
    	var item = KindData[k];
    	if (!item || item.legacy == 1)
    	    continue;

			if (itemType == 4 && !(ItemTypes.isArmor(k) || ItemTypes.isWeapon(k)))
      {
          ItemsList.push({
						name: item.name,
						kind: k,
						type: item.type,
						buyCount: item.buycount,
						buyPrice: item.buy,
						craftPrice: ItemTypes.getCraftPrice(k),
						itemKind: k,
						itemNumber: item.buycount,
						craft: item.craft
          });
      }
      if (itemType == 1 && item.type == "object" && item.buy > 0)
      {
          ItemsList.push({
						name: item.name,
						kind: k,
						type: item.type,
						buyCount: item.buycount,
						buyPrice: item.buy,
						craftPrice: ItemTypes.getCraftPrice(k),
						itemKind: k,
						itemNumber: item.buycount,
						craft: item.craft
          });
      }
      else if (itemType == 2 && ItemTypes.isArmor(k) &&
      	 item.modifier >= minLevel && item.modifier <= maxLevel) {
          ItemsList.push({
						name: item.name,
						kind: k,
						type: item.type,
						buyCount: item.buyCount,
						buyPrice: ItemTypes.getBuyPrice(k),
						craftPrice: ItemTypes.getCraftPrice(k),
						rank: item.level,
						itemKind: k,
						itemNumber: item.buycount,
						craft: item.craft
          });
      }
      else if (itemType == 3 && ItemTypes.isWeapon(k) &&
      	 item.modifier >= minLevel && item.modifier <= maxLevel) {
          ItemsList.push({
						name: item.name,
						kind: k,
						type: item.type,
						buyCount: item.buyCount,
						buyPrice: ItemTypes.getBuyPrice(k),
						craftPrice: ItemTypes.getCraftPrice(k),
						rank: item.level,
						itemKind: k,
						itemNumber: item.buycount,
						craft: item.craft
          });
      }

    }

    if (ItemsList.length > 0 && ItemsList[0].rank > 0)
			ItemsList.sort(function(a, b) {
	    	return a.rank - b.rank;
    	});

    return ItemsList;
};


ItemTypes.Store = {
    isBuy: function(id) {
        var item = KindData[id];
        if (!item) return false;
        return (item.buy > 0) ? true : false;
    },
    isBuyMultiple: function(id) {
    	var item = KindData[id];
        if (!item) return false;
    	return (item.buycount > 0) ? true : false;
    },
    isSell: function(id) {
        var item = KindData[id];
        if (!item) return false;
        return (item.buy >= 2) ? true : false;
    },
    getBuyCount: function(id) {
    	var item = KindData[id];
        if (!item) return false;
    	return (item.buyCount > 1) ? item.buyCount : 1;
    },

    getItems: function (type, min, max)
    {
			return ItemTypes.getItemListBy(type, min, max);
    },
};

ItemTypes.itemExpForLevel = [];

ItemTypes.itemExpForLevel[0] = 0;

for(i=1; i < 30; i++){
    var points = Math.floor((i * 150) * Math.pow(2, i / 10.));
    //console.info("level_"+i+"="+points);
    ItemTypes.itemExpForLevel[i] = points;
};

ItemTypes.getItemLevel = function(exp){
    if (exp==0) return 1;
    var i=1;
    for(i=1; i < 30; i++){
        if(exp > ItemTypes.itemExpForLevel[i-1] &&
        	exp <= ItemTypes.itemExpForLevel[i]){
            return i;
        }
    }
    return 30;
};


if(!(typeof exports === 'undefined')) {
    module.exports = ItemTypes;
}
