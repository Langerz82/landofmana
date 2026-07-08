import BaseItem from '../items/baseitem.js';
import Messages from '../message.js';
import ItemRoom from '../items/itemroom.js';
import { Types } from '../common.js';

class AuctionRecord {
    constructor(playerName, price, item) {
        this.playerName = playerName;
        this.price = price;
        this.item = item;
    }

    save() {
        return [this.playerName,
            this.price].join(",") + "," + this.item.toArrayNoSlot().join(",");
    }

    toArray() {
        var cols = [
            this.playerName,
            this.price];
        cols = cols.concat(this.item.toArray());
        return cols;
    }
}

class Auction {
    constructor() {
        this.auctions = [];
    }

    // NOTE: `auctions` was a bare (undeclared) assignment in the original
    // CommonJS source, which created an implicit global there; declared with
    // `var` here since ES modules are always strict mode and forbid implicit
    // globals.
    load(data)
    {
        var self = this;
        console.info("auction - load: "+JSON.stringify(data));

        if (Array.isArray(data) && data.length === 0)
            return;

        var auctions = [];
        for (var rec of data)
        {
            var sData = rec.split(",");
            var record = new AuctionRecord(
                sData[0],
                parseInt(sData[1]),
                new ItemRoom([
                    parseInt(sData[2]),
                    parseInt(sData[3]),
                    parseInt(sData[4]),
                    parseInt(sData[5]),
                    parseInt(sData[6])])
            );
            auctions.push(record);
        }
        if (auctions)
            this.auctions = auctions;
    }

    save(world)
    {
        console.info("auction - save: "+JSON.stringify(this.auctions));

        var data = [];
        for(var auction of this.auctions) {
            if (auction)
                data.push(auction.save());
        }

        if (world.userHandler) {
            world.userHandler.sendAuctionsData(data);
            return true;
        } else {
            console.info("save: world.userHandler not set.");
        }
        return false;
    }

    add(player, item, price, invIndex) {
        var auction = new AuctionRecord(player.name, price, item);
        this.auctions.push(auction);
        player.items.inventory.setItem(invIndex, null);
        player.sendPlayer(new Messages.Notify("AUCTION","AUCTION_ADDED"));
    }

    remove(index) {
        this.auctions[index] = null;
    }

    putItem(player, item) {
        return player.items.inventory.putItem(item) >= 0;
    }

    list(player, type) {
        var msg = [Types.Messages.WC_AUCTIONOPEN, type, 0];
        var recCount = 0;
        for (var auction of this.auctions) {
            if (!auction) {
                continue;
            }
            var kind = auction.item.itemKind;
            var pc = player.name === auction.playerName;
            if ((type === 1 && !pc && ItemTypes.isArmor(kind)) ||
                (type === 2 && !pc && ItemTypes.isWeapon(kind)) ||
                (type === 0 && pc))
            {
                msg.push(this.auctions.indexOf(auction));
                msg = msg.concat(auction.toArray());
                ++recCount;
            }
        }
        msg[2] = recCount;
        player.sendPlayer(new Messages.AuctionOpen(msg));
    }
}

export { AuctionRecord };
export default Auction;
