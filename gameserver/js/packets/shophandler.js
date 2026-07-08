import Messages from '../message.js';
import ItemData from '../data/itemdata.js';
import { ItemTypes } from '../common.js';
import ItemRoom from '../items/itemroom.js';

class ShopHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.world = this.ph.world;
        this.player = this.ph.player;
    }

    handleStoreSell(message) {
        var p = this.player;

        var type = parseInt(message[0]);
        var itemIndex = parseInt(message[1]);

        var item = p.items.itemStore[0].rooms[itemIndex];
        if (!item)
            return;

        //p.tut.buy = true;
        //p.tut.buy2 = true;

        var kind = item.itemKind;
        if (ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind))
            return;

        var price = ItemTypes.getEnchantSellPrice(item);
        if (price < 0)
            return;

        var itemKind = item.itemKind;
        //gold = p.gold[0];
        p.items.inventory.makeEmptyItem(itemIndex);
        p.items.modifyGold(price);
        var itemName = ItemTypes.KindData[itemKind].name;
        p.sendPlayer(new Messages.Notify("SHOP","SHOP_SOLD", [itemName]));
    }

// TODO - Revise beloww!!!!!!!!!!!!!!
    handleAuctionSell(message) {
        var p = this.player;

        var itemIndex = parseInt(message[0]),
            price = parseInt(message[1]);
        if (price < 0 || itemIndex < 0 || itemIndex >= p.items.inventory.maxNumber)
            return;

        var item = p.items.inventory.rooms[itemIndex];
        console.info(JSON.stringify(item));

        var kind = item.itemKind;
        if (ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind))
            return;

        if (kind) {
            this.world.auction.add(this.player, item, price, itemIndex);
            this.world.auction.list(this.player, 0);
            p.items.inventory.setItem(itemIndex, null);
        }
    }

    handleAuctionOpen(message) {
        var p = this.player;

        var type = parseInt(message[0]);
        if (type >= 0 && type <= 3)
            this.world.auction.list(this.player, type);
    }

    handleAuctionBuy(message) {
        var p = this.player;

        var auctionIndex = parseInt(message[0]),
            type = parseInt(message[1]);
        if (auctionIndex < 0 || auctionIndex >= this.world.auction.auctions.length)
            return;
        if (type < 0 || type > 3)
            return;

        var auctions = this.world.auction;
        var auction = this.world.auction.auctions[auctionIndex];
        if (!auction)
            return;
        if (auction.playerName === p.name)
            return;

        var price = auction.price;
        if (price < 0)
            return;

        var goldCount = p.items.gold[0];

        if (goldCount < price) {
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
            return;
        }

        if (!p.items.inventory.hasRoom()) {
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOSPACE"));
            return;
        }

        var itemKind = auction.item.itemKind;
        if (auctions.putItem(this.player, auction.item)) {
            p.items.modifyGold(-price);
            var itemName = ItemTypes.KindData[itemKind].name;
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_SOLD", [itemName]));

            var auctionPlayer = this.world.getPlayerByName(auction.playerName);
            if (auctionPlayer) {
                auctionPlayer.items.modifyGold(price);
            } else {
                if (this.world.userHandler)
                    this.world.userHandler.sendPlayerGold(auction.playerName, price);
                else {
                    console.warn("packetHander handleAuctionBuy: no world userHandler.");
                }
            }
            this.world.auction.remove(auctionIndex);
            this.world.auction.list(this.player, type);
        }
    }

    handleAuctionDelete(message) {
        var p = this.player;

        var auctionIndex = parseInt(message[0]),
            type = parseInt(message[1]);
        if (auctionIndex < 0 || auctionIndex >= this.world.auction.auctions.length)
            return;
        if (type < 0 || type > 3)
            return;

        var auctions = this.world.auction;
        var auction = auctions.auctions[auctionIndex];
        if (!auction)
            return;

        if (auction.playerName !== p.name) {
            return;
        }

        if (!p.items.inventory.hasRoom()) {
            p.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOSPACE"));
            return;
        }

        var itemKind = auction.item.itemKind;
        if (auctions.putItem(this.player, auction.item))
        {
            var itemName = ItemTypes.KindData[itemKind].name;
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_REMOVED", [itemName]));
            this.world.auction.remove(auctionIndex);
            this.world.auction.list(this.player, type);
        }
    }

    handleStoreModItem(msg) {
        var p = this.player;

        var modType = parseInt(msg[0]),
            type = parseInt(msg[1]),
            itemIndex = parseInt(msg[2]);

        //console.info("type=" + type + ",invNumber=" + inventoryNumber1);
        if (type === 0 || type === 2) {
            var itemStore = p.items.itemStore[type];
            if (itemIndex < 0 && itemIndex >= itemStore.maxNumber)
                return;
            var item = p.items.itemStore[type].rooms[itemIndex];
            //console.info("item=" + JSON.stringify(item));
            if (modType === 0)
                this._repairItem(type, item, itemIndex);
            if (modType === 1)
                this._enchantItem(type, item, itemIndex);
        }
    }

    // NOTE: `goldCount` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    _repairItem(type, item, index) {
        var p = this.player;

        var itemKind = null,
            price = 0;

        if (!(item && item.itemKind))
            return;

        if (!ItemTypes.isEquipment(item.itemKind))
            return;

        if (item.itemDurability === item.itemDurabilityMax)
            return;

        price = ~~(ItemTypes.getRepairPrice(item));
        if (price <= 0)
            return;

        var goldCount = p.items.gold[0];
        //console.info("goldCount="+goldCount+",price="+price);
        if (goldCount < price) {
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
            return;
        }

        item.itemDurabilityMax -= 50;
        item.itemDurability = item.itemDurabilityMax;
        if (item.itemDurabilityMax <= 0) {
            item = null;
            p.items.itemStore[type].makeEmptyItem(index);
        } else {
            console.info("itemNumber=" + item.itemNumber);
            p.items.modifyGold(-price);
        }
        item.slot = index;

        p.sendPlayer(new Messages.ItemSlot(type, [item]));
        var itemName = ItemTypes.KindData[item.itemKind].name;
        p.sendPlayer(new Messages.Notify("SHOP","SHOP_REPAIRED", [itemName]));
    }

    // NOTE: `goldCount` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    _enchantItem(type, item, index) {
        var p = this.player;

        var itemKind = null,
            price = 0;

        if (!(item && item.itemKind))
            return;

        if (!ItemTypes.isEquipment(item.itemKind))
            return;

        price = ItemTypes.getEnchantPrice(item);
        if (price <= 0)
            return;

        var goldCount = p.items.gold[0];
        //console.info("goldCount="+goldCount+",price="+price);
        if (goldCount < price) {
            p.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOGOLD"));
            return;
        }

        item.itemExperience = ItemTypes.itemExpForLevel[item.itemNumber - 1];
        item.itemNumber++;

        item.slot = index;

        p.sendPlayer(new Messages.ItemSlot(type, [item]));
        console.info("itemNumber=" + item.itemNumber);
        p.items.modifyGold(-price);
        var itemName = ItemTypes.KindData[item.itemKind].name;
        p.sendPlayer(new Messages.Notify("SHOP", "SHOP_ENCHANTED", [itemName]));
    }

    handleStoreBuy(message) {
        var p = this.player;

        var itemType = parseInt(message[0]),
            itemKind = parseInt(message[1]),
            itemCount = parseInt(message[2]),
            itemName = null,
            price = 0,
            goldCount = 0,
            buyCount = 0;

        if (!itemKind || itemCount <= 0) {
            return;
        }

        if (itemKind < 0 || itemKind >= ItemTypes.KindData.length)
            return;

        //console.info("itemKind="+itemKind);
        //console.info(JSON.stringify(ItemTypes));
        var itemData = ItemTypes.KindData[itemKind];

        var itemName = itemData.name;
        price = ItemTypes.getBuyPrice(itemKind);
        if (price > 0) {
            if (ItemTypes.Store.isBuyMultiple(itemKind)) {
                itemCount = itemData.buycount;
            }
            goldCount = p.items.gold[0];
            //console.info("goldCount="+goldCount);
            //console.info("itemCount="+itemCount);

            if (goldCount < price) {
                p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
                return;
            }

            var consume = ItemTypes.isConsumableItem(itemKind);
            if (consume || (!consume && p.items.inventory.hasRoom())) {
                var item = new ItemRoom([itemKind, itemCount, 0, 0, 0]);
                var res = p.items.inventory.putItem(item);
                if (res === -1)
                    return;
                p.items.modifyGold(-price);
                p.sendPlayer(new Messages.Notify("SHOP", "SHOP_BUY", [itemName]));
                /*if (!p.tut.equip) {
                  p.tutChat("TUTORIAL_EQUIP", 10, "equip");
                }*/
            } else {
                p.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOSPACE"));
            }
        }

    }

    handleCraft(message) {
        var p = this.player;

        var craftId = parseInt(message[0]),
            itemCount = parseInt(message[1]),
            itemName = null,
            price = 0,
            goldCount = 0,
            buyCount = 0;

        if (itemCount <= 0) {
            return;
        }

        if (craftId < 0 || craftId >= ItemData.CraftData.length)
            return;

        var craftData = ItemData.CraftData[craftId];

        var itemKind = Number(craftData.o);

        //console.info("itemKind="+itemKind);
        //console.info(JSON.stringify(ItemTypes));
        if (!ItemTypes.KindData.hasOwnProperty(itemKind))
        {
            console.error("handleCraft - itemData not found for kind: "+itemKind);
            return;
        }

        var itemData = ItemTypes.KindData[itemKind];

        var itemName = itemData.name;
        price = ItemTypes.getCraftPrice(itemKind);
        if (price < 0)
            return;

        if (ItemTypes.Store.isBuyMultiple(itemKind)) {
            itemCount = (itemCount < itemData.buycount) ? itemCount : itemData.buycount;
        } else {
            itemCount = 1;
        }

        price = price * itemCount;

        goldCount = p.items.gold[0];
        //console.info("goldCount="+goldCount);
        //console.info("itemCount="+itemCount);

        if (goldCount < price) {
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
            return;
        }

        if (itemData.craft.length === 0)
            return;

        for (var it of craftData.i)
        {
            if (!p.items.inventory.hasItems(it[0],it[1]*itemCount)) {
                p.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOCRAFTITEMS"));
                return;
            }
        }

        if (!p.items.inventory.hasRoom())
        {
            p.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOSPACE"));
            return;
        }

        p.items.modifyGold(-price);
        for (var it of craftData.i)
        {
            p.items.inventory.removeItemKind(it[0],it[1]*itemCount);
        }

        var durability = 0;
        if (ItemTypes.isWeapon() || ItemTypes.isArmor())
            durability = 900;

        var item = new ItemRoom([itemKind, itemCount, durability, durability]);
        if (p.items.inventory.putItem(item) === -1)
            return;

        p.sendPlayer(new Messages.Notify("SHOP", "SHOP_BUY", [itemName]));
    }
}

export default ShopHandler;
