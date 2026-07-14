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
        const p = this.player;

        const type = parseInt(message[0]);
        const itemIndex = parseInt(message[1]);

        const item = p.items.itemStore[0].rooms[itemIndex];
        if (!item)
            return;

        //p.tut.buy = true;
        //p.tut.buy2 = true;

        const kind = item.itemKind;
        if (ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind))
            return;

        const price = ItemTypes.getEnchantSellPrice(item);
        if (price < 0)
            return;

        const itemKind = item.itemKind;
        //gold = p.gold[0];
        p.items.inventory.makeEmptyItem(itemIndex);
        p.items.modifyGold(price);
        const itemName = ItemTypes.KindData[itemKind].name;
        p.sendPlayer(new Messages.Notify("SHOP","SHOP_SOLD", [itemName]));
    }

// TODO - Revise beloww!!!!!!!!!!!!!!
    handleAuctionSell(message) {
        const p = this.player;

        const itemIndex = parseInt(message[0]),
            price = parseInt(message[1]);
        if (price < 0 || itemIndex < 0 || itemIndex >= p.items.inventory.maxNumber)
            return;

        const item = p.items.inventory.rooms[itemIndex];
        // FIX: itemIndex being within range doesn't mean the slot is
        // occupied -- an empty room is a falsy/null entry, and dereferencing
        // item.itemKind below crashed the handler on client-triggerable
        // input (e.g. selling from an empty inventory slot).
        if (!item)
            return;

        const kind = item.itemKind;
        if (ItemTypes.isConsumableItem(kind) || ItemTypes.isLootItem(kind))
            return;

        if (kind) {
            this.world.auction.add(this.player, item, price, itemIndex);
            this.world.auction.list(this.player, 0);
            p.items.inventory.setItem(itemIndex, null);
        }
    }

    handleAuctionOpen(message) {
        const p = this.player;

        const type = parseInt(message[0]);
        if (type >= 0 && type <= 3)
            this.world.auction.list(this.player, type);
    }

    handleAuctionBuy(message) {
        const p = this.player;

        const auctionIndex = parseInt(message[0]),
            type = parseInt(message[1]);
        if (auctionIndex < 0 || auctionIndex >= this.world.auction.auctions.length)
            return;
        if (type < 0 || type > 3)
            return;

        const auctions = this.world.auction;
        const auction = this.world.auction.auctions[auctionIndex];
        if (!auction)
            return;
        if (auction.playerName === p.name)
            return;

        const price = auction.price;
        if (price < 0)
            return;

        const goldCount = p.items.gold[0];

        if (goldCount < price) {
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
            return;
        }

        if (!p.items.inventory.hasRoom()) {
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOSPACE"));
            return;
        }

        const itemKind = auction.item.itemKind;
        if (auctions.putItem(this.player, auction.item)) {
            p.items.modifyGold(-price);
            const itemName = ItemTypes.KindData[itemKind].name;
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_SOLD", [itemName]));

            const auctionPlayer = this.world.getPlayerByName(auction.playerName);
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
        const p = this.player;

        const auctionIndex = parseInt(message[0]),
            type = parseInt(message[1]);
        if (auctionIndex < 0 || auctionIndex >= this.world.auction.auctions.length)
            return;
        if (type < 0 || type > 3)
            return;

        const auctions = this.world.auction;
        const auction = auctions.auctions[auctionIndex];
        if (!auction)
            return;

        if (auction.playerName !== p.name) {
            return;
        }

        if (!p.items.inventory.hasRoom()) {
            p.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOSPACE"));
            return;
        }

        const itemKind = auction.item.itemKind;
        if (auctions.putItem(this.player, auction.item))
        {
            const itemName = ItemTypes.KindData[itemKind].name;
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_REMOVED", [itemName]));
            this.world.auction.remove(auctionIndex);
            this.world.auction.list(this.player, type);
        }
    }

    handleStoreModItem(msg) {
        const p = this.player;

        const modType = parseInt(msg[0]),
            type = parseInt(msg[1]),
            itemIndex = parseInt(msg[2]);

        //console.info("type=" + type + ",invNumber=" + inventoryNumber1);
        if (type === 0 || type === 2) {
            const itemStore = p.items.itemStore[type];
            // FIX: used `&&` instead of `||` -- an index can't simultaneously
            // be negative AND >= maxNumber, so this condition could never be
            // true and out-of-range indices were never rejected here.
            if (itemIndex < 0 || itemIndex >= itemStore.maxNumber)
                return;
            const item = p.items.itemStore[type].rooms[itemIndex];
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
        const p = this.player;

        let itemKind = null,
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

        const goldCount = p.items.gold[0];
        //console.info("goldCount="+goldCount+",price="+price);
        if (goldCount < price) {
            p.sendPlayer(new Messages.Notify("SHOP","SHOP_NOGOLD"));
            return;
        }

        item.itemDurabilityMax -= 50;
        item.itemDurability = item.itemDurabilityMax;
        // FIX: when an item's durability is fully worn out, `item` was set to
        // null and the store slot emptied, but the code right after
        // unconditionally did `item.slot = index` and then used `item` again
        // to build the response messages -- throwing on every full-durability
        // repair attempt instead of notifying the player it broke. Moved the
        // slot/notify logic into each branch so the null case sends a
        // "repaired but destroyed" style response instead of crashing.
        if (item.itemDurabilityMax <= 0) {
            item = null;
            p.items.itemStore[type].makeEmptyItem(index);
            p.sendPlayer(new Messages.ItemSlot(type, [{slot: index, itemKind: -1}]));
            return;
        }

        console.info("itemNumber=" + item.itemNumber);
        p.items.modifyGold(-price);
        item.slot = index;

        p.sendPlayer(new Messages.ItemSlot(type, [item]));
        const itemName = ItemTypes.KindData[item.itemKind].name;
        p.sendPlayer(new Messages.Notify("SHOP","SHOP_REPAIRED", [itemName]));
    }

    // NOTE: `goldCount` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    _enchantItem(type, item, index) {
        const p = this.player;

        let itemKind = null,
            price = 0;

        if (!(item && item.itemKind))
            return;

        if (!ItemTypes.isEquipment(item.itemKind))
            return;

        price = ItemTypes.getEnchantPrice(item);
        if (price <= 0)
            return;

        const goldCount = p.items.gold[0];
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
        const itemName = ItemTypes.KindData[item.itemKind].name;
        p.sendPlayer(new Messages.Notify("SHOP", "SHOP_ENCHANTED", [itemName]));
    }

    handleStoreBuy(message) {
        const p = this.player;

        // NOTE: this used to be one `var` chain declaring all seven of
        // these together, including `itemName = null` -- dead, since
        // nothing read it before it was redeclared as `var itemName =
        // itemData.name` further down (once itemData exists). Split by
        // actual mutability: itemType/itemKind/buyCount are never
        // reassigned (const); itemCount/price/goldCount are (let);
        // itemName's real declaration moved down to where its value is
        // actually available.
        const itemType = parseInt(message[0]);
        const itemKind = parseInt(message[1]);
        let itemCount = parseInt(message[2]);
        let price = 0;
        let goldCount = 0;
        const buyCount = 0;

        if (!itemKind || itemCount <= 0) {
            return;
        }

        // FIX: ItemTypes.KindData is a plain object (keyed by item id), not
        // an array -- `.length` is always undefined, so `itemKind >=
        // undefined` is always false and this bounds check silently never
        // rejected an out-of-range itemKind. `itemData` then came back
        // undefined and `itemData.name` below threw. Use the same
        // hasOwnProperty check the sibling handleCraft() already does correctly.
        if (itemKind < 0 || !ItemTypes.KindData.hasOwnProperty(itemKind))
            return;

        //console.info("itemKind="+itemKind);
        //console.info(JSON.stringify(ItemTypes));
        const itemData = ItemTypes.KindData[itemKind];

        const itemName = itemData.name;
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

            const consume = ItemTypes.isConsumableItem(itemKind);
            if (consume || (!consume && p.items.inventory.hasRoom())) {
                const item = new ItemRoom([itemKind, itemCount, 0, 0, 0]);
                const res = p.items.inventory.putItem(item);
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
        const p = this.player;

        // NOTE: same story as handleStoreBuy above -- split a single `var`
        // chain (which included a dead `itemName = null` initializer) by
        // actual mutability.
        const craftId = parseInt(message[0]);
        let itemCount = parseInt(message[1]);
        let price = 0;
        let goldCount = 0;
        const buyCount = 0;

        if (itemCount <= 0) {
            return;
        }

        if (craftId < 0 || craftId >= ItemData.CraftData.length)
            return;

        const craftData = ItemData.CraftData[craftId];

        const itemKind = Number(craftData.o);

        //console.info("itemKind="+itemKind);
        //console.info(JSON.stringify(ItemTypes));
        if (!ItemTypes.KindData.hasOwnProperty(itemKind))
        {
            console.error("handleCraft - itemData not found for kind: "+itemKind);
            return;
        }

        const itemData = ItemTypes.KindData[itemKind];

        const itemName = itemData.name;
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

        for (const it of craftData.i)
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
        for (const it of craftData.i)
        {
            p.items.inventory.removeItemKind(it[0],it[1]*itemCount);
        }

        let durability = 0;
        if (ItemTypes.isWeapon() || ItemTypes.isArmor())
            durability = 900;

        const item = new ItemRoom([itemKind, itemCount, durability, durability]);
        if (p.items.inventory.putItem(item) === -1)
            return;

        p.sendPlayer(new Messages.Notify("SHOP", "SHOP_BUY", [itemName]));
    }
}

export default ShopHandler;
