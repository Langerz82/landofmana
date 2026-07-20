import Messages from '../message.js';
import ItemRoom from '../items/itemroom.js';
// FIX: list() below calls ItemTypes.isArmor()/isWeapon() but ItemTypes was
// never imported here (only Types was) -- threw ReferenceError every time a
// player browsed the armor or weapon auction category.
import { GameTypes, ItemTypes } from '../common.js';
// FIX: see the FIX comment on add() below -- this is the same bound
// format.js already uses to validate the client-supplied auction index.
import { auctionEntriesMax } from '../format.js';

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
        let cols = [
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
        const self = this;
        console.info("auction - load: "+JSON.stringify(data));

        // FIX: this only ever gets real data pushed asynchronously from
        // the userserver (see user/userhandler.js#handleLoadPlayerAuctions),
        // but main.js's "reloadauction" console command called this with no
        // argument at all. `Array.isArray(undefined)` is false, so the old
        // `Array.isArray(data) && data.length === 0` guard didn't catch
        // that case, and `for (const rec of data)` below threw
        // "data is not iterable" -- only caught by the top-level
        // uncaughtException handler, so the command silently did nothing
        // useful. Guard against any non-array `data` explicitly so a bad or
        // missing call degrades to a safe no-op instead of throwing.
        if (!Array.isArray(data)) {
            console.warn("auction - load: no data supplied, skipping.");
            return;
        }

        if (data.length === 0)
            return;

        const auctions = [];
        for (const rec of data)
        {
            const sData = rec.split(",");
            const record = new AuctionRecord(
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

        const data = [];
        for(const auction of this.auctions) {
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

    // FIX: nothing here ever capped this.auctions.length, even though
    // CW_AUCTIONBUY/CW_AUCTIONDELETE (see format.js) only ever validate a
    // client-supplied index up to auctionEntriesMax (9999). remove() below
    // never shrinks the array (it just nulls out a slot), so length only
    // ever grows -- once more than auctionEntriesMax listings had ever been
    // created, any new one landed at an index no client could ever
    // reference again: permanently un-buyable and un-deletable, silently
    // losing that player's item for good. Rejecting new listings once at
    // capacity (and telling the player, instead of silently swallowing
    // their item) closes that off. Returns true/false so callers (see
    // packets/shophandler.js's handleAuctionSell) can avoid removing the
    // item from the player's inventory when the listing didn't happen.
    add(player, item, price, invIndex) {
        // FIX: remove() below only nulls a slot rather than shrinking the
        // array, so this.auctions.length only ever grew. Gating capacity on
        // raw array length meant that once auctionEntriesMax listings had
        // EVER been created, every future add() was rejected permanently --
        // even with thousands of sold/delisted (null) slots sitting empty.
        // Count only the still-active (non-null) listings against the cap
        // instead, so capacity is actually reclaimed as items sell or get
        // delisted. (Left as an append-only array rather than reusing null
        // slots in place, so existing auction indices already handed out to
        // clients via list() stay stable and never get silently reused for
        // a different listing.)
        const activeCount = this.auctions.reduce((n, a) => n + (a ? 1 : 0), 0);
        if (activeCount >= auctionEntriesMax) {
            player.sendPlayer(new Messages.Notify("AUCTION","AUCTION_FULL"));
            return false;
        }

        const auction = new AuctionRecord(player.name, price, item);
        this.auctions.push(auction);
        player.items.inventory.setItem(invIndex, null);
        player.sendPlayer(new Messages.Notify("AUCTION","AUCTION_ADDED"));
        return true;
    }

    // FIX: this used to just null the slot and never shrink the array, so
    // this.auctions.length only ever grew for the life of the process --
    // once a listing sold/expired, its slot stayed as a permanent null
    // placeholder that list()/save() still had to scan past forever. Full
    // compaction/reindexing isn't safe here: packets/shophandler.js's
    // handleAuctionBuy/handleAuctionDelete hold onto a client-supplied
    // `auctionIndex` across several checks and callbacks before finally
    // calling remove(index) -- reassigning a *different* listing to that
    // same index in between (as a naive compact-and-reindex would) could
    // let a buy/delete meant for one item silently resolve against whatever
    // new listing got shuffled into its old slot. Instead, after nulling
    // the slot, trim any now-trailing run of null slots off the end of the
    // array. This is always safe (nothing still references an index past
    // the new end -- those slots are empty) and, since listings tend to
    // resolve roughly in the order they were created, keeps
    // this.auctions.length tracking "highest index still in use + 1"
    // instead of "total listings ever created" in the common case.
    remove(index) {
        if (index < 0 || index >= this.auctions.length)
            return;

        this.auctions[index] = null;

        let end = this.auctions.length;
        while (end > 0 && this.auctions[end - 1] === null)
            --end;

        if (end < this.auctions.length)
            this.auctions.length = end;
    }

    putItem(player, item) {
        return player.items.inventory.putItem(item) >= 0;
    }

    list(player, type) {
        let msg = [GameTypes.Messages.WC_AUCTIONOPEN, type, 0];
        let recCount = 0;
        // FIX: this used to be a `for...of` loop that called
        // `this.auctions.indexOf(auction)` per matching entry -- indexOf is
        // itself an O(n) linear scan, so building a full listing was O(n^2)
        // in the number of auction slots (up to auctionEntriesMax, see
        // format.js). Iterating with an explicit index instead makes this
        // O(n) overall.
        for (let index = 0; index < this.auctions.length; index++) {
            const auction = this.auctions[index];
            if (!auction) {
                continue;
            }
            const kind = auction.item.itemKind;
            const pc = player.name === auction.playerName;
            if ((type === 1 && !pc && ItemTypes.isArmor(kind)) ||
                (type === 2 && !pc && ItemTypes.isWeapon(kind)) ||
                (type === 0 && pc))
            {
                msg.push(index);
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
