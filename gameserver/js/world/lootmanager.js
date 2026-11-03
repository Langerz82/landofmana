// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import Item from '../entity/item.js';
import Mob from '../entity/mob/mob.js';
import Player from '../entity/player/player.js';
import Utils from '../utils.js';
import ItemRoom from '../items/itemroom.js';
import Messages from '../message.js';
import ItemData from '../data/itemdata.js';
import { ItemTypes } from '../common.js';
import { G_TILESIZE } from '../constants.js';

class LootManager {
    constructor(world) {
        this.world = world;
    }

    handleDropItem(entity, attacker) {
        const itemLoot = this.getLootItem(attacker, entity, 0);
        if (itemLoot && itemLoot instanceof Item) {
            console.info('LOOT ITEM SENT!');
            const pos = Utils.fixGridPosition(G_TILESIZE, entity.x, entity.y);
            itemLoot.x = pos.x;
            itemLoot.y = pos.y;
            this.handleItemDespawn(itemLoot);
            return;
        }

        const item = this.getDroppedOrStolenItem(attacker, entity, 0);
        if (item && item instanceof Item) {
            const pos = Utils.fixGridPosition(G_TILESIZE, entity.x, entity.y);
            item.x = pos.x;
            item.y = pos.y;
            this.handleItemDespawn(item);
            return;
        }
    }

    handleItemDespawn(item) {
        if (item) {
            item.handleDespawn({
                beforeBlinkDelay: 20000,
                blinkCallback: function () {
                    //item.map.entities.pushToAdjacentGroups(item.group, new Messages.Blink(item));
                },
                blinkingDuration: 10000,
                despawnCallback: function () {
                    item.map.entities.itemDespawn(item);
                }
            });
        }
    }

    // Picks one entry from a `{id: chance}` drops object, where each chance
    // is out of 1000 (getDrop() and getLootItem() below). Rolls 1-1000, then
    // walks the drops from rarest (smallest chance) to most common,
    // subtracting each one's chance from the roll; the first that takes it
    // to 0 or below is the drop. So every item keeps its full chance out of
    // 1000 -- the rarest first -- and when the chances add up to more than
    // 1000 (e.g. a mob area's bonusDrop multiplier), only the most common
    // items lose out, never the rare ones. (It used to walk the entries in
    // key order, so whatever happened to come last -- e.g. the crystal --
    // got cut.) Ties go by item id, so the order is always the same.
    // Returns the id (a string, as object keys are) or null for no drop.
    _pickWeighted(drops) {
        const entries = Object.keys(drops)
            .filter((id) => drops[id] > 0)
            .sort((a, b) => drops[a] - drops[b] || Number(a) - Number(b));
        let roll = Utils.randomRangeInt(1, 1000);
        for (const id of entries) {
            roll -= drops[id];
            if (roll <= 0) return id;
        }
        return null;
    }

    // FIX: operator precedence meant `!target instanceof Mob` evaluated as
    // `(!target) instanceof Mob` (always false, since `!target` is a
    // boolean, and booleans are never instances of Mob) instead of the
    // intended `!(target instanceof Mob)`. This guard clause never actually
    // fired, so non-Mob targets (e.g. players) fell through into mob-only
    // quest-drop logic.
    getLootItem(source, target, stolen) {
        const self = this;

        if (!(target instanceof Mob)) return;

        // NOTE: `itemId2` used to be declared twice with `var` -- once here
        // (`= null`) and once more, bare, right after the `if` above.
        // Redeclaring without an initializer is a no-op under `var` (the
        // `null` from the first declaration survived); a SyntaxError under
        // `let`. Consolidated to the one declaration -- now just the return
        // value of the shared _pickWeighted() scan above.
        const drops = target.questDrops;
        const itemId2 = this._pickWeighted(drops);

        if (itemId2) {
            //console.info("itemName: "+itemName);
            //var kind = ItemTypes.getKindFromString(itemName);
            // FIX: was `[..., 0, 0, 0]` -- baseitem.js's set() now only
            // treats null/undefined as "use default durability" (see its
            // FIX comment). null gives this fresh quest-drop item its
            // correct default durability instead of landing at durability 0.
            const itemRoom = new ItemRoom([
                parseInt(itemId2),
                1,
                null,
                null,
                0
            ]);
            const lootItem = target.map.entities.createItem(
                itemRoom,
                target.x,
                target.y,
                1
            );
            lootItem.count = 1;
            lootItem.experience = 0;

            target.map.entities.sendNeighbours(target, lootItem.spawn());
            return target.map.entities.addItem(lootItem);
        }
        return null;
    }

    // FIX: three bugs here. (1) `target.inventory` doesn't exist -- inventory
    // lives on `target.items.inventory` everywhere else in this codebase
    // (including two lines below, and takeOutItems() at the bottom), so this
    // threw immediately on every call. (2) the else-branch referenced a bare
    // `type` identifier that was never defined anywhere in this function.
    // (3) it called target.map.entities.createItem(...) with 5 arguments even
    // though that method's signature is (itemRoom, x, y) -- and createItem()
    // already adds the item internally, so the extra wrapping addItem() call
    // below would have double-added the entity even if the arguments were
    // right. Building a proper ItemRoom clone (same pattern as the `stolen`
    // branch just above) and calling createItem() directly fixes all three.
    getPlayerDrop(source, target, stolen) {
        const itemIndex = target.items.inventory.getRandomItemNumber();
        if (itemIndex === -1) return;
        const item = target.items.inventory.rooms[itemIndex];
        let count = 1;
        if (ItemTypes.isConsumableItem(item.itemKind)) {
            count = Math.floor((Math.random() * target.level + 2) / 2);
            if (count > item.itemNumber) count = item.itemNumber;
        }
        let item2;
        if (stolen) {
            item2 = Object.assign(new ItemRoom(), item);
            item2.itemNumber = count;
            source.sendPlayer(
                new Messages.Notify('CHAT', 'ITEM_ADDED', [
                    ItemData.Kinds[item.itemKind].name
                ])
            );
        } else {
            const droppedRoom = Object.assign(new ItemRoom(), item);
            droppedRoom.itemNumber = count;
            item2 = target.map.entities.createItem(
                droppedRoom,
                target.x,
                target.y
            );
        }
        target.items.inventory.takeOutItems(itemIndex, count);
        return item2;
    }

    getDrop(source, target, stolen) {
        //console.info("getDroppedItem");
        if (target.droppedItem === true) return;

        target.droppedItem = true;

        const drops = target.drops;
        let itemId2 = this._pickWeighted(drops);

        // FIX: `itemId` from a `for...in` loop is always a string (object
        // keys are strings even when numeric-looking, the same class of
        // bug already fixed elsewhere in this codebase -- see
        // entity/components/playercombat.js's baseCritDef/baseDamageDef).
        // `itemId2` was left as that string and used directly below in
        // `ItemTypes.isEquippable(itemId2)` -- this is exactly what the
        // "ITEM IS NOT PROVIDING ITEM KIND" TODO was flagging: an
        // equippable drop's kind wouldn't compare/lookup correctly as a
        // string, misclassifying it as non-equippable and building the
        // dropped ItemRoom with the wrong durability/experience defaults
        // for its actual kind. `new ItemRoom(...)` further down happens to
        // self-heal via its own `Number(arr[0])` coercion, but that's after
        // the isEquippable check already ran on the raw string. Coercing
        // once here fixes it at the source.
        if (!itemId2) return null;
        itemId2 = Number(itemId2);

        //console.info("itemName: "+itemName);
        //var kind = ItemTypes.getKindFromString(itemName);
        let itemRoom;
        if (ItemTypes.isEquippable(itemId2)) {
            const count = Utils.setEquipmentBonus(itemId2);
            // FIX: was `[itemId2, count, 0, 0, 900, 900]` -- durability/
            // durabilityMax (arr[2]/arr[3]) now use null instead of 0 for
            // "use default durability" (see baseitem.js's FIX comment). The
            // trailing `900, 900` were arr[4]/arr[5]: arr[4] would be
            // itemExperience, but it's immediately overwritten by the
            // itemExpForLevel assignment right below, and set() only ever
            // reads arr[0..4] -- arr[5] was never read at all. Left both
            // out rather than guessing at unexplained intent.
            itemRoom = new ItemRoom([itemId2, count, null, null]);
            itemRoom.itemExperience = ItemTypes.itemExpForLevel[count - 1];
        } else {
            // FIX: was `[itemId2, 1, 0, 0, 0, 0]` -- same null-for-default
            // fix; arr[5] here was likewise never read by set().
            itemRoom = new ItemRoom([itemId2, 1, null, null, 0]);
        }
        const item = target.map.entities.createItem(
            itemRoom,
            target.x,
            target.y,
            1
        );

        if (stolen) {
            if (source instanceof Player)
                source.sendPlayer(
                    new Messages.Notify('CHAT', 'ITEM_ADDED', [
                        ItemData.Kinds[item.itemKind].name
                    ])
                );
            return itemRoom;
        } else {
            if (target.data && target.data.dropBonus)
                item.count += target.data.dropBonus;

            target.map.entities.sendNeighbours(target, item.spawn());
            item.enemyDrop = true;
            return target.map.entities.addItem(item);
        }
    }

    getGoldDrop(source, target, stolen) {
        // No item drop gold.
        let count = target.dropGold();
        // EXPLOIT FIX: the level-difference bonus (up to x1.9) used to apply
        // to PvP kills too. A player's dropGold() takes the gold out of the
        // victim, so the killer received up to 90% more than the victim lost
        // -- killing an alt over and over minted gold from nothing. The
        // bonus now only applies to mob kills; PvP moves exactly what the
        // victim lost.
        if (source instanceof Player && !(target instanceof Player)) {
            let targetLevel = 0;
            targetLevel = target.level;
            const diff = targetLevel - source.level;
            const bonusLevel = Utils.clamp(0.1, 1.9, 1 + diff * 0.05);
            count *= bonusLevel;
            count = ~~count;
        }

        if (source instanceof Player) {
            source.items.modifyGold(count);
        }
    }

    getDroppedOrStolenItem(source, target, stolen) {
        // FIX: removed `const item = null;` (never read; every branch below
        // returns directly instead of assigning into it) and `const self =
        // this;` (also never read -- every branch below already uses
        // `this` directly).
        if (source instanceof Player && target instanceof Player) {
            this.getGoldDrop(source, target, stolen);
            return this.getPlayerDrop(source, target, stolen);
        } else if (target instanceof Mob) {
            this.getGoldDrop(source, target, stolen);
            return this.getDrop(source, target, stolen);
        }
        /*else if (target instanceof Gather) {
          return this.getDrop(source, target, stolen);
        }*/
        return null;
    }
}

export default LootManager;
