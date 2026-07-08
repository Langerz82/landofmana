/* global bootKind, _, exports, module, Types */

const ItemTypes = {};
let ItemData = {};
let KindData = {};

ItemTypes.setKindData = (kindData) => {
  KindData = kindData;
  ItemTypes.KindData = kindData;
};

ItemTypes.getData = (k) => {
  const data = KindData[k];
  if (!data || data.legacy == 1) return null;
  return data;
};

ItemTypes.getName = (kind) => {
  try {
    const item = KindData[kind];
    if (!item) return '';
    return item.name;
  } catch (e) {
    console.error(`No name found for item: ${KindData[kind]}`);
    console.error(`Error stack: ${e.stack}`);
  }
};

ItemTypes.getWeaponLevel = (kind) => {
  try {
    const item = KindData[kind];
    if (!item) return 0;
    return item.modifier;
  } catch (e) {
    console.error(`No level found for weapon: ${KindData[kind]}`);
    console.error(`Error stack: ${e.stack}`);
  }
};

ItemTypes.getArmorLevel = (kind) => {
  try {
    const item = KindData[kind];
    if (!item) return 0;
    return item.modifier;
  } catch (e) {
    console.error(`No level found for armor: ${KindData[kind]}`);
    console.error(`Error stack: ${e.stack}`);
  }
};

ItemTypes.getItemByLevel = (type, level) => {
  for (const kind in KindData) {
    const item = KindData[kind];
    if ((item.type == "armor" || item.type == "armorarcher") &&
      item.type == type && level == item.modifier) {
      return item;
    }
    if ((item.type == "weapon" || item.type == "weaponarcher") &&
      item.type == type && level == item.modifier) {
      return item;
    }
  }
  return null;
};

ItemTypes.getLevelByKind = (kind) => {
  const item = KindData[kind];
  if (ItemTypes.isArmor(kind)) {
    return item.level;
  }
  if (ItemTypes.isWeapon(kind)) {
    return item.level;
  }
  return null;
};

ItemTypes.getType = (kind) => {
  try {
    const item = KindData[kind];
    return item.type;
  } catch (e) {
    console.error(`No type found for item: ${kind}`);
    console.error(`Error stack: ${e.stack}`);
  }
};

ItemTypes.getBuyPrice = (kind) => {
  const item = KindData[kind];
  if (!item) return 0;

  const type = item.type;
  if (type == "bow") {
    return Math.floor(item.modifier * item.modifier * 5);
  } else if (type == "chest") {
    return Math.floor(item.modifier * item.modifier * 5);
  } else if (ItemTypes.isArmor(kind)) {
    return Math.floor(item.modifier * item.modifier * 10);
  } else if (ItemTypes.isWeapon(kind)) {
    return Math.floor(item.modifier * item.modifier * 5);
  } else if (type == "object" && item.buy > 0) {
    if (item.buyCount > 1) return (item.buy * item.buyCount);
    else return item.buy;
  }
  return 0;
};

ItemTypes.getCraftPrice = (k) => {
  const item = KindData[k];
  if (!item || item.legacy == 1) return 0;

  if (item.buy > 0) return item.buy;

  return ~~(ItemTypes.getBuyPrice(k) / 4);
};

ItemTypes.getEnchantSellPrice = (item) => {
  let value = ItemTypes.getBuyPrice(item.itemKind) / 10;
  const enchantLevel = item.itemNumber;
  if (enchantLevel > 1) {
    value += ~~(ItemTypes.getEnchantPrice(item) / 10);
  }
  value *= item.itemDurabilityMax / 900;
  return Math.floor(value);
};

ItemTypes.getEnchantPrice = (item, current = false) => {
  if (!item) return NaN;

  const data = KindData[item.itemKind];
  const enchantLevel = current ? item.itemNumber : item.itemNumber + 1;
  if (enchantLevel >= 25) return NaN;

  const experience = item.itemExperience;

  const baseLevel = data.modifier;
  console.info(`getEnchantPrice: ${ItemTypes.itemExpForLevel[enchantLevel]}`);
  const cost = Math.floor(baseLevel * baseLevel * 10 * Math.pow(2, enchantLevel) *
    (1 - (experience / ItemTypes.itemExpForLevel[enchantLevel])));
  console.info(`cost: ${cost}`);
  return cost;
};

const Clamp = (min, max, value) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

ItemTypes.getRepairPrice = (item) => {
  let value = ItemTypes.getBuyPrice(item.itemKind) / 10;
  if (item.itemDurability == item.itemDurabilityMax) return 0;

  if (item.itemNumber > 1) {
    value = ItemTypes.getEnchantPrice(item, true) / 10;
  }
  const mp = ((item.itemDurabilityMax / 900) * (1 - (item.itemDurability / item.itemDurabilityMax)));
  log.info(`getRepairPrice - mp: ${mp}`);
  value *= Clamp(0, 1, mp);
  return 1 + ~~(value);
};

ItemTypes.isEquippable = (kind) =>
  ItemTypes.isArmor(kind) ||
  ItemTypes.isWeapon(kind) ||
  ItemTypes.isArcherWeapon(kind) ||
  ItemTypes.isClothes(kind);

ItemTypes.isClothes = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return (item.type === "helm" || item.type === "chest" || item.type === "gloves" || item.type === "boots");
};

ItemTypes.isArmor = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return ItemTypes.isClothes(kind);
};

ItemTypes.isWeapon = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return ItemTypes.isMeleeWeapon(kind) || ItemTypes.isArcherWeapon(kind);
};

ItemTypes.isEquipment = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return ItemTypes.isWeapon(kind) || ItemTypes.isArmor(kind);
};

ItemTypes.getSpriteCode = (kind) => {
  const data = KindData[kind];
  if (ItemTypes.isArmor(kind)) {
    return kind;
  }
  if (ItemTypes.isWeapon(kind)) {
    const type = data.type;
    if (!type) return 0;
    if (type == "sword") return 1;
    if (type == "axe") return 2;
    if (type == "hammer") return 12;
    if (type == "bow") return 50;
  }
  return 0;
};

ItemTypes.getEquipmentSlot = (kind) => {
  if (ItemTypes.isWeapon(kind)) return 4;

  const item = KindData[kind];
  if (!item) return -1;

  if (item.type === "helm") return 0;
  if (item.type === "chest") return 1;
  if (item.type === "gloves") return 2;
  if (item.type === "boots") return 3;
  return -1;
};

ItemTypes.isMeleeWeapon = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return item.type === "sword" ||
    item.type === "hammer" ||
    item.type === "axe";
};

ItemTypes.isHarvestWeapon = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return item.type === "hammer" ||
    item.type === "axe";
};

ItemTypes.isArcherWeapon = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return item.type === "bow";
};

ItemTypes.isObject = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return item.type === "object";
};

ItemTypes.isCraftItem = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return item.type === "craft";
};

ItemTypes.isLootItem = (kind) => kind >= 1000 && kind < 2000;

ItemTypes.isConsumableItem = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return item.type === "object";
};

ItemTypes.isHealingItem = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return item.type === "object" && (item.typemod == "health" || item.typemod == "healthpercent");
};

ItemTypes.isItem = (kind) => {
  const item = ItemTypes.KindData[kind];
  if (!item) return false;
  return ItemTypes.isArmor(kind) || ItemTypes.isWeapon(kind) ||
    item.type == "object" ||
    item.type == "craft";
};

ItemTypes.isStackedItem = (kind) => {
  const item = KindData[kind];
  if (!item) return false;
  return ItemTypes.isCraftItem(kind) ||
    ItemTypes.isLootItem(kind) ||
    ItemTypes.isConsumableItem(kind);
};

ItemTypes.forEachKind = (callback) => {
  for (const k in kindData) {
    callback(KindData[k], k);
  }
};

ItemTypes.forEachArmorKind = (callback) => {
  Types.forEachKind((kind, kindName) => {
    if (ItemTypes.isArmor(kind)) {
      callback(kind, kindName);
    }
  });
};

ItemTypes.forEachWeaponKind = (callback) => {
  Types.forEachKind((kind, kindName) => {
    if (ItemTypes.isWeapon(kind)) {
      callback(kind, kindName);
    }
  });
};

ItemTypes.forEachArcherWeaponKind = (callback) => {
  Types.forEachKind((kind, kindName) => {
    if (ItemTypes.isArcherWeapon(kind)) {
      callback(kind, kindName);
    }
  });
};

ItemTypes.getItemListBy = (itemType, minLevel, maxLevel) => {
  const ItemsList = [];
  for (const k in KindData) {
    const item = KindData[k];
    if (!item || item.legacy == 1) continue;

    if (itemType == 4 && !(ItemTypes.isArmor(k) || ItemTypes.isWeapon(k))) {
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
    if (itemType == 1 && item.type == "object" && item.buy > 0) {
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
    } else if (itemType == 2 && ItemTypes.isArmor(k) &&
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
    } else if (itemType == 3 && ItemTypes.isWeapon(k) &&
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

  if (ItemsList.length > 0 && ItemsList[0].rank > 0) {
    ItemsList.sort((a, b) => a.rank - b.rank);
  }

  return ItemsList;
};

ItemTypes.Store = {
  isBuy: (id) => {
    const item = KindData[id];
    if (!item) return false;
    return item.buy > 0;
  },
  isBuyMultiple: (id) => {
    const item = KindData[id];
    if (!item) return false;
    return item.buycount > 0;
  },
  isSell: (id) => {
    const item = KindData[id];
    if (!item) return false;
    return item.buy >= 2;
  },
  getBuyCount: (id) => {
    const item = KindData[id];
    if (!item) return false;
    return item.buyCount > 1 ? item.buyCount : 1;
  },

  getItems: (type, min, max) => ItemTypes.getItemListBy(type, min, max)
};

ItemTypes.itemExpForLevel = [];
ItemTypes.itemExpForLevel[0] = 0;

for (let i = 1; i < 30; i++) {
  const points = Math.floor((i * 150) * Math.pow(2, i / 10));
  ItemTypes.itemExpForLevel[i] = points;
}

ItemTypes.getItemLevel = (exp) => {
  if (exp == 0) return 1;
  for (let i = 1; i < 30; i++) {
    if (exp > ItemTypes.itemExpForLevel[i - 1] &&
      exp <= ItemTypes.itemExpForLevel[i]) {
      return i;
    }
  }
  return 30;
};

ItemTypes.KindData = KindData;
ItemTypes.ItemData = ItemData;

if(!(typeof exports === 'undefined')) {
    module.exports = ItemTypes;
}
