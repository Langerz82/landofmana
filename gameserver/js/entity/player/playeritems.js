import Timer from '../../timer.js';
import Messages from '../../message.js';
import { Types, ItemTypes } from '../../common.js';
import ItemRoom from '../../items/itemroom.js';
import Utils from '../../utils.js';

class PlayerItems {
    constructor(entity) {
        this.entity = entity;

        this.inventory = null;
        this.bank = null;
        this.equipment = null;
        this.itemStore = new Array(3);

        this.gold = new Array(2);

        this.consumeTimeout = null;
        this.consumeTime = new Timer(10000);
    }

    // FIX: was defaulting `type` to "any" and returning true immediately, before even
    // checking whether the entity has a weapon equipped, and *before* the `type` param
    // could ever be falsy again - which made the final `isHarvestWeapon` fallback below
    // permanently unreachable dead code. Mirrors the (correct) pattern used by the sibling
    // hasHarvestWeapon() just below in this file: only short-circuit on an explicit "any".
    hasWeaponType(type) {
        if (type === 'any') return true;

        const weapon = this.equipment.getWeapon();
        if (!weapon) return false;

        if (type) {
            return this.getWeaponType() === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }

    getWeapon() {
        return this.equipment.getWeapon();
    }

    // NOTE: equipment.rooms here is always pre-filled with `null` (see
    // items/equipment.js), so `!== null` is already correct in this
    // codebase's context -- kept as `!!` anyway to match the client's
    // equivalent (client's rooms array is sparse and can hold `undefined`
    // for a never-set slot, where `!== null` would be wrong).
    hasWeapon() {
        return !!this.getWeapon();
    }

    getWeaponLevel() {
        const entity = this.entity;

        const weapon = this.getWeapon();
        if (!weapon) return 0;
        const weaponData = ItemTypes.KindData[weapon.itemKind];
        return Types.getWeaponLevel(entity.stats.exp[weaponData.type]);
    }

    getWeaponType() {
        const weapon = this.getWeapon();
        if (!weapon) return null;
        return ItemTypes.getType(weapon.itemKind);
    }

    hasHarvestWeapon(type) {
        if (type === 'any') return true;

        const weapon = this.getWeapon();
        if (!weapon) return false;

        const weaponData = ItemTypes.KindData[weapon.itemKind];
        if (type) {
            return weaponData.type === type;
        }
        return ItemTypes.isHarvestWeapon(weapon.itemKind);
    }

    handleStoreEmpty(slot, item) {
        const entity = this.entity;

        // FIX: getStoredItem() returns null/undefined for a genuinely empty
        // slot (same case handleInventoryEat() already guards against,
        // above) but this dereferenced `item.itemKind` unconditionally --
        // a crafted CW_ITEMSLOT drop packet pointed at an empty slot threw
        // a TypeError here on every attempt.
        if (!item) return;

        const kind = item.itemKind;
        const store = this.itemStore[slot[0]];
        const index = slot[1];
        let count = slot[2];

        if (slot[0] === 2) {
            console.error('handleStoreEmpty - Cannot empty equipment store.');
            return;
        }

        const itemRoom = store.rooms[slot[1]];
        const newItemRoom = Object.assign(new ItemRoom(), itemRoom);
        // NOTE: this used to be `var item = ...`, redeclaring the `item`
        // parameter above (legal under `var`, which just reassigns the
        // existing binding; a SyntaxError under `let`/`const`). Just a plain
        // reassignment here -- `item` now points at the newly-created
        // dropped-item entity instead of the store-slot item that was
        // passed in.
        item = entity.map.entities.createItem(newItemRoom, entity.x, entity.y);
        count = Utils.clamp(1, itemRoom.itemNumber, count);

        if (!ItemTypes.isEquippable(kind)) {
            item.room.itemNumber = count;
            store.takeOutItems(index, count);
        } else {
            store.makeEmptyItem(index);
        }

        entity.map.entities.sendNeighbours(entity, item.spawn());
        entity.knownIds.push(item.id);
        entity.world.loot.handleItemDespawn(item);
    }

    swapItem(slot, slot2) {
        const entity = this.entity;

        //console.info(JSON.stringify(slot));
        //console.info(JSON.stringify(slot2));
        const store1 = this.itemStore[slot[0]];
        const store2 = this.itemStore[slot2[0]];
        // store.rooms is a fixed-length array (items/itemroomstore.js,
        // items/equipment.js), indexed by the real numeric slot -- plain
        // bracket access is correct and fastest here.
        const rs1 = store1.rooms[slot[1]];
        if (!rs1) return;

        // if equipment and item is equipment set the correct index.
        if (slot2[0] === 2 && rs1) {
            slot2[1] = store2.getItemTypeIndex(rs1);
        }

        let rs2 = null;
        if (slot2[1] >= 0) rs2 = store2.rooms[slot2[1]];

        if (rs1 === rs2) return;

        const splitItem = function (slot, slot2, rs1) {
            if (
                slot[2] > 0 &&
                slot[2] < rs1.itemNumber &&
                ItemTypes.isStackedItem(rs1.itemKind)
            ) {
                rs1.itemNumber -= slot[2];
                store1.setItem(slot[1], rs1);
                const rs2 = Object.assign(new ItemRoom(), rs1);
                rs2.itemNumber = slot[2];
                store2.setItem(slot2[1], rs2);
                return true;
            }
            return false;
        };

        if (rs2) {
            // FIX: was `store2.combineItem(rs1, rs2)` with no third
            // argument -- combineItem() used to always write `rs1`'s
            // leftover/cleared value back via `this.setItem(...)` (i.e.
            // store2, since combineItem is called ON store2 here), even
            // though `rs1` actually belongs to store1 whenever this swap
            // crosses stores (e.g. dragging a stack from inventory into the
            // bank). That wrote into store2's room at store1's slot INDEX
            // instead of clearing/updating store1's own slot -- either
            // silently destroying whatever unrelated item happened to sit
            // at that same index in store2, or (on a full merge) leaving
            // the source item never actually removed from store1 at all,
            // duplicating it. Passing store1 explicitly tells combineItem()
            // where `rs1` really lives.
            if (!store2.combineItem(rs1, rs2, store1)) {
                const tmp = rs2;
                if (
                    store2.checkItem(slot2[1], rs1) &&
                    store1.checkItem(slot[1], rs2)
                ) {
                    store2.setItem(slot2[1], rs1);
                    store1.setItem(slot[1], rs2);
                }
            }
        } else if (slot2[1] >= 0) {
            if (!splitItem(slot, slot2, rs1)) {
                if (store2.setItem(slot2[1], rs1))
                    store1.setItem(slot[1], null);
            }
        } else {
            if (store2.putItem(rs1) !== -1) store1.setItem(slot[1], null);
        }

        if (
            (slot && slot[0] === 2 && slot[1] === 4) ||
            (slot2 && slot2[0] === 2 && slot2[1] === 4)
        ) {
            entity.broadcastSprites();
        }
    }

    /* ITEM STORE FUNCTIONS */
    getStoredItem(type, slot, count) {
        const entity = this.entity;

        const store = this.itemStore[type];
        // FIX: `store` can be undefined for an out-of-range `type` (only
        // 0/1/2 are ever assigned in itemStore) -- currently masked
        // because packethandler.js's handleItemSlot() already checks
        // `itemStore` truthiness before ever calling this, but this method
        // has no callers-beware protection of its own.
        if (!store) return null;

        //console.info("inventory: "+JSON.stringify(this.player.inventory.rooms[index]));
        // FIX: was `slot >= rooms.length` -- at the time, `rooms` was keyed
        // by slot index as a plain `{}` dictionary (later a Map), not an
        // array, so `.length` was always `undefined` and `slot >=
        // undefined` was always `false`. This bounds check therefore never
        // actually rejected an over-large slot -- only ever caught `slot <
        // 0`. rooms is a real fixed-length array now (see the FIX comment
        // on items/itemroomstore.js), so `rooms.length` would work today,
        // but checking against `store.maxNumber` directly is still the
        // more robust contract to enforce here (masked the same way as the
        // `type` check above -- handleItemSlot() already validates slot
        // against the real store's maxNumber before calling in -- but this
        // method shouldn't rely entirely on every future caller
        // remembering to pre-check it).
        if (slot < 0 || slot >= store.maxNumber) return null;

        let item = store.rooms[slot];
        if (!item) return;

        const count2 = item.itemNumber;
        // FIX: when a client requested more (`count`) than the slot
        // actually holds (`count2`), this used to call
        // store.takeOutItems(slot, count2) -- i.e. remove the *entire*
        // stack from the store right here, as a side effect of just
        // looking the item up. takeOutItems() reduces itemNumber to 0 and
        // returns null in that case, so getStoredItem() then returned null
        // too -- meaning the caller (handleInventoryEat/handleStoreEmpty)
        // saw "no item here" and did nothing further, while the entire
        // stack had already been silently deleted from the store above.
        // Any client could trigger this just by padding the count field on
        // an eat/drop packet (CW_ITEMSLOT) above their real stack size.
        // Neither caller actually needs this method to pre-remove or
        // pre-clamp anything: handleStoreEmpty() already clamps its own
        // count against the live room's itemNumber before calling
        // takeOutItems() itself, and handleInventoryEat() always consumes
        // exactly 1 regardless of the requested count. So just return the
        // item unchanged and let each caller's own (already-correct)
        // removal logic decide how much actually comes out.
        return item;
    }

    modifyGold(gold, type) {
        const entity = this.entity;

        type = type || 0;
        if (this.gold[type] + gold < 0) return false;

        this.gold[type] += parseInt(gold);

        entity.sendPlayer(new Messages.Gold(entity));
        if (gold === 0) {
            //this.sendPlayer(new Messages.Notify("CHAT", "GOLD_ZERO"));
        } else if (gold > 0)
            entity.sendPlayer(
                new Messages.Notify('CHAT', 'GOLD_ADDED', [gold])
            );
        else {
            gold *= -1;
            entity.sendPlayer(
                new Messages.Notify('CHAT', 'GOLD_REMOVED', [gold])
            );
        }
        return true;
    }

    // FIX: `p` was never defined anywhere in this file (the constructor
    // parameter/property is named `entity` everywhere else in this class, and
    // Messages.Gold expects a player-shaped object with .items.gold/.user.gems
    // -- see message.js). This threw a ReferenceError on every successful gem
    // spend, right after the gems had already been deducted, so the client
    // never got its updated gold/gems packet.
    modifyGems(diff) {
        const entity = this.entity;

        diff = parseInt(diff);
        if (entity.user.gems - diff < 0) {
            entity.connection.send(
                new Messages.Notify('SHOP', 'SHOP_NOGEMS').serialize()
            );
            return false;
        }
        entity.user.gems += diff;
        entity.connection.send(new Messages.Gold(entity).serialize());
        return true;
    }

    handleInventoryEat(item, slot) {
        const entity = this.entity;

        // FIX: getStoredItem() (above) returns null/undefined for an empty
        // slot, and packethandler.js's CW_ITEMSLOT "eat" action passes
        // whatever getStoredItem() returns straight through without checking
        // it first. A client could point an eat packet at an empty inventory
        // slot and throw a TypeError here on every such packet (previously
        // silently swallowed by the global uncaughtException handler instead
        // of being rejected cleanly).
        if (!item) return;

        const kind = item.itemKind;

        if (!this.consumeTime.isOver()) return;

        let amount;

        const itemData = ItemTypes.KindData[kind];
        this.consumeTime.duration = itemData.cooldown * 1000;

        if (itemData.typemod === 'health') {
            amount = itemData.modifier;
            if (!entity.hasFullHealth()) {
                entity.modHp(amount);
            }
        } else if (itemData.typemod === 'healthpercent') {
            amount = ~~((entity.stats.hpMax * itemData.modifier) / 100);
            if (!entity.hasFullHealth()) {
                entity.modHp(amount);
            }
        }
        if (itemData.typemod === 'energy') {
            amount = itemData.modifier;
            if (!entity.hasFullEnergy()) {
                entity.modEp(amount);
            }
        }

        // FIX: was `this.items.inventory.takeOutItems(...)` -- `this` here is
        // already the PlayerItems instance (player.items), which has
        // `this.inventory` directly, not `this.items`. That threw a
        // TypeError on every "eat" action, so the consumed item was never
        // removed from inventory (infinite-use/duplication bug).
        this.inventory.takeOutItems(slot, 1);
    }
}

export default PlayerItems;
