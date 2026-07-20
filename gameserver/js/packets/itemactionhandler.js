import Item from '../entity/item.js';
import Messages from '../message.js';
import { Types } from '../common.js';
import AppearanceData from '../data/appearancedata.js';
import { PlayerEvent } from '../world/taskhandler.js';

// Split out of packethandler.js -- the item/inventory packets: slot
// manipulation (eat/equip/move/drop), world loot pickup, and cosmetic
// appearance purchases/equips (still an "item" in the sense that
// AppearanceData/looks are catalog-purchased, ownable cosmetics, just not
// stored in player.items). Gold transfers and stat-point allocation used to
// live here too, but neither actually touches an item entity or inventory
// slot -- they moved to playerhandler.js. (Store/craft/auction traffic
// already lived in its own shophandler.js before this split.) Same
// constructor(packetHandler) convention as the other split-out handlers.
class ItemActionHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = this.ph.player;
        this.world = this.ph.world;
    }

// param 1 - action type.
// type 0 eat.
// type 1 equip.
// type 2 move item.
// type 3 drop item.
// type 4 store item.

// param 2 - slot type.
// slot 0 inventory.
// slot 1 equipment.
// slot 2 bank.

// param 3 slot index. (0-48).
// param 4 count of items.

// param 5 - slot type 2.
// param 6 - slot index 2.
// param 7 - count of items 2.

    handleItemSlot(msg) { // 28
        const self = this;
        const action = parseInt(msg[0]);

        if (this.player.isDead)
            return;

        // slot type, slot index, slot count.
        const slot = [Number(msg[1]), Number(msg[2]), Number(msg[3])];
        // FIX: this only bounds-checked slot type 2, and against
        // equipment's maxNumber (5) instead of that slot type's real store
        // size -- rejecting valid slots for whichever store type 2 actually
        // is. Worse, the other two slot types got no bounds check at all
        // here. itemStore[0..2] map to inventory(max 50)/bank(max 96,
        // items/bank.js)/equipment(max 5, items/equipment.js) respectively
        // -- confirmed against user/userhandler.js's handleLoadPlayerItems,
        // which is the code that actually constructs and assigns
        // itemStore[type] for type 0/1/2 (an earlier version of this
        // comment had the 1/2 order backwards: bank is slot type 1, not
        // equipment). Validate whichever store the requested slot type
        // actually is.
        const itemStore = this.player.items.itemStore[slot[0]];
        if (!itemStore || slot[1] < 0 || slot[1] >= itemStore.maxNumber)
            return;
        let item = null;
        if (slot[1] >= 0)
            item = this.player.items.getStoredItem(slot[0], slot[1], slot[2]);

        let slot2 = null;
        if (msg.length === 6)
        {
            slot2 = [Number(msg[4]), Number(msg[5])];
            // FIX: `slot` above is validated against its itemStore's
            // maxNumber, but slot2 wasn't validated at all before being
            // handed to items.swapItem(), which indexes
            // this.itemStore[slot2[0]] and then .rooms[slot2[1]] -- a
            // crafted CW_ITEMSLOT packet with an out-of-range slot2 could
            // throw deep inside swapItem(). -1 is a legitimate sentinel here
            // (see equipmenthandler.js/bankdialog.js client callers) meaning
            // "no specific target slot, let swapItem() place it wherever
            // there's room" -- swapItem() already branches on
            // `slot2[1] >= 0` for this, so only reject values that are
            // neither -1 nor a valid in-range slot.
            const itemStore2 = this.player.items.itemStore[slot2[0]];
            if (!itemStore2 || (slot2[1] !== -1 && (slot2[1] < 0 || slot2[1] >= itemStore2.maxNumber)))
                return;
            if (slot[0] === slot2[0] && slot[1] === slot2[1])
                return;
        }
        if (action === 0) {
            this.player.items.handleInventoryEat(item, slot[1]);
        }
        else if (action === 1) {
            this.player.items.swapItem(slot, slot2);
        }
        else if (action === 2) { // drop item.
            this.player.items.handleStoreEmpty(slot, item);
        }
    }

    // NOTE: `item` was a bare (undeclared) assignment in the original CommonJS
    // source, which created an implicit global there; declared with `var` here
    // since ES modules are always strict mode and forbid implicit globals.
    handleLoot(message) {
        console.info("handleLoot");

        const p = this.player;
        const item = p.map.entities.getEntityById(parseInt(message[0]));
        if (!item) {
            console.info("no item.");
            return;
        }

        // FIX: this checked the player's distance against the
        // CLIENT-SUPPLIED x/y (message[1]/message[2]) instead of the item
        // entity's actual server-side position (item.x/item.y). A crafted
        // CW_LOOT packet could set x/y to the player's own current
        // position -- trivially passing isWithinDist() regardless of where
        // the item entity actually was -- letting a client loot any item
        // anywhere on the map just by knowing its entity id. Checking
        // against the item's real, authoritative position closes that off;
        // message[1]/message[2] are no longer needed once the check uses
        // the entity itself.
        // FIX: a subsequent edit changed this to `p.canReachEntity(item)`,
        // but that method doesn't exist anywhere in the codebase (Player/
        // Character only has `canReach()`, which is a weapon-attackRange
        // check meant for combat, not a generic proximity helper) --
        // every CW_LOOT packet would throw a TypeError here, breaking
        // looting entirely. `isWithinDistEntity()` (entity/entity.js) is
        // the real, existing helper for "is this entity within N pixels of
        // me" and keeps the same 24px pickup radius as before.
        if (!p.isWithinDistEntity(item, 24)) {
            console.info("Player is not close enough to item.")
            return;
        }

        console.info("item="+item.toString());
        if (item.enemyDrop)
            console.info("enemyDrop");

        if (item instanceof Item) {
            if (p.items.inventory.putItem(item.room) >= 0) {
                this.world.taskHandler.processEvent(p, PlayerEvent(Types.EventType.LOOTITEM, item, 1));
                this.ph.broadcast(item.despawn(), false);
                p.map.entities.removeEntity(item);
            }
        }
    }

    handleAppearanceUnlock(message) {
        const appearanceIndex = parseInt(message[0]);
        const priceClient = parseInt(message[1]);

        if (appearanceIndex < 0 || appearanceIndex >= AppearanceData.Data.length)
            return;

        const itemData = AppearanceData.Data[appearanceIndex];
        if (!itemData)
            return;

        if (!(itemData.type === "armorarcher" || itemData.type === "armor"))
            return;

        const price = this.world.looks.prices[appearanceIndex];
        if (price !== priceClient) {
            this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_MISMATCH", [itemData.name]));
            this.world.looks.sendLooks(this.player);
            return;
        }

        let gemCount = 0;

        if (appearanceIndex >= 0) {
            gemCount = this.player.user.gems;

            console.info("gemCount=" + gemCount);

            if (gemCount >= price) {
                this.player.user.looks[appearanceIndex] = 1;
                // FIX: modifyGems() is defined on PlayerItems (player.items),
                // not directly on Player -- calling this.player.modifyGems(...)
                // threw "not a function", so appearance/gem purchases never
                // actually completed (and the gem cost was never deducted).
                this.player.items.modifyGems(-price);
                this.world.looks.prices[appearanceIndex] += 100;

                this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_SOLD", [itemData.name]));
                this.world.looks.sendLooks(this.player);
            } else {
                this.ph.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOGEMS"));
            }
        }
    }

    handleLookUpdate(message) {
        const type = parseInt(message[0]),
            id = parseInt(message[1]);

        const p = this.player;
        if (id < 0 || id >= AppearanceData.Data.length)
            return;
        if (type < 0 || type > 1)
            return;

        const itemData = AppearanceData.Data[id];
        if (!itemData)
            return;

        if (!(itemData.type === "armorarcher" || itemData.type === "armor"))
            return;

        const appearance = this.player.user.looks[id];
        if (appearance === 1) {
            if (type === 0) {
                p.setSprite(0, id);
            }
        }

        p.broadcastSprites();
    }

}

export default ItemActionHandler;
