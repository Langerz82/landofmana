import Messages from '../../message.js';
import Utils from '../../utils.js';
import { Types } from '../../common.js';
import Item from '../item.js';
import ItemRoom from '../../items/itemroom.js';
import { PlayerEvent } from '../../world/taskhandler.js';

/* global EventType */

class PlayerHarvest {
    constructor(player) {
        this.player = player;
    }

    _harvest(x, y, callback, duration) {
        const p = this.player;

        const valid = p._checkHarvest(x, y);
        if (!valid) {
            p._abortHarvest(x, y);
            return;
        }

        const px = p.x, py = p.y;
        const type = p.items.getWeaponType();

        p.isHarvesting = true;

        let exp = p.stats.exp.logging;
        if (type === "hammer")
            exp = p.stats.exp.mining;

        const durationMod = Utils.clamp(0.1, 1, (1 - Types.getSkillLevel(exp)/20));
        duration = ~~(duration * durationMod);
        clearTimeout(p.harvestTimeout);
        p.harvestTimeout = setTimeout(function () {
            let complete = true;

            if (!p.isHarvesting)
                complete = false;

            if (!(p.x === px && p.y === py))
                complete = false;

            if (!p.hasWeaponType(type))
                complete = false;

            if (!complete) {
                p._abortHarvest(x, y);
                return;
            }

            if (callback)
                callback(p);

            p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 2, x, y));
        }, duration);

        p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 1, x, y), p);
        p.sendPlayer( new Messages.Harvest(p, 1, x, y, duration));
    }

    _checkHarvest(x, y) {
        const p = this.player;
        if (!p.isNextTooPosition(x,y))
            return false;

        if (!p.items.hasWeaponType())
            return false;

        return true;
    }

    onHarvestEntity(entity) {
        const p = this.player;
        let res = true;

        const type = entity.weaponType;
        if (!p.items.hasWeaponType(type)) {
            this.sendPlayer(new Messages.Notify("CHAT", "HARVEST_WRONG_TYPE", type));
            res = false;
        }

        const x= entity.x, y=entity.y;
        if (!res) {
            this._abortHarvest(x, y);
            return;
        }

        const duration = 5000 + (entity.level*1000);
        this._harvest(x, y, function (p) {
            p.world.taskHandler.processEvent(p, PlayerEvent(Types.EventType.USE_NODE, entity, 1));

            if (type === "hammer")
                p.stats.exp.mining += 10;
            entity.die();
            const item = p.world.loot.getDrop(p, entity, false);
            if (item && item instanceof Item)
            {
                item.x = x;
                item.y = y;
                p.world.loot.handleItemDespawn(item);
            }
            return;
        }, duration);
    }

    _abortHarvest(x,y) {
        const p = this.player;
        p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 2, x, y));
        p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_INVALID"));
    }

    onHarvest(x, y) {
        const p = this.player;
        const gp = Utils.getGridPosition(x,y);

        // NOTE: `time` was a bare (undeclared) assignment in the original CommonJS
        // source, which created an implicit global there; declared with `var` here
        // since ES modules are always strict mode and forbid implicit globals. This
        // is local-only in both versions in practice (no other file reads it).
        const time = p.map.entities.harvest[gp.gx + "_" + gp.gy];

        let res = true;
        // FIX: getWeaponType() is defined on PlayerItems (p.items), not on
        // Player itself -- as correctly called elsewhere in this same file
        // (_checkHarvest/_harvest use p.items.getWeaponType()/hasWeaponType()).
        // Calling p.getWeaponType() threw "not a function", breaking the
        // harvesting flow entirely.
        const type = p.items.getWeaponType();
        if (!type) {
            res = false;
        }
        if (res && !p.map.isHarvestTile(gp, type)) {
            p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_WRONG_TYPE", type));
            res = false;
        }

        if (res && time && (Date.now() - time) < 60000) {
            res = false;
        }

        if (!res) {
            this._abortHarvest(x, y);
            return;
        }

// TODO CHECK WHY NOT ADDING ITEM AND NOT NOTIFYING CLIENT.
        const duration = 6000;
        p._harvest(x, y, function (p) {
            p.world.taskHandler.processEvent(p, PlayerEvent(Types.EventType.HARVEST, p, 1));
            // FIX: same p.getWeaponType() -> p.items.getWeaponType() mismatch
            // as above; both call sites here would throw and abort this
            // harvest-completion callback before rewarding the player.
            if (p.items.getWeaponType() === "axe")
                p.stats.exp.logging += 10;
            p.map.entities.harvest[gp.gx + "_" + gp.gy] = Date.now();
            if (p.items.inventory.hasRoom()) {
                let kind;
                if (p.items.getWeaponType() === "axe")
                    kind = 320;
                const item = new ItemRoom([kind, 1, 0, 0]);
                if (p.items.inventory.putItem(item) === -1)
                    return;
                const data = ItemTypes.getData(item.itemKind);
                p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_ADDED", data.name));
            }
        }, duration);
    }
}

export default PlayerHarvest;
