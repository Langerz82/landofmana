// Converted from AMD (define) to a native ES6 module.
/* global Types, log, _ */
import Entity from './entity/entity.js';
import Item from './entity/item.js';
import Mob from './entity/mob.js';
import NpcStatic from './entity/npcstatic.js';
import NpcMove from './entity/npcmove.js';
import Player from './entity/player.js';
import Chest from './entity/chest.js';
import Block from './entity/block.js';
import Node from './entity/node.js';

const EntityFactory = {};

EntityFactory.createEntity = function(type, kind, id, mapIndex, name, level = 0) {
    if (!id) {
        log.info("ERROR - kind is undefined: " + kind + " " + id + " " + name, true);
        return null;
    }

    if (type === Types.EntityTypes.PLAYER)
        return new Player(id, type, mapIndex, kind, name);
    else if (type === Types.EntityTypes.MOB)
        return new Mob(id, type, mapIndex, kind, name, level);
    else if (type === Types.EntityTypes.NPCSTATIC)
        return new NpcStatic(id, type, mapIndex, kind);
    else if (type === Types.EntityTypes.ITEM || type === Types.EntityTypes.ITEMLOOT)
        return new Item(id, type, mapIndex, kind, "item");
    else if (type === Types.EntityTypes.BLOCK)
        return new Block(id, type, mapIndex, kind, name);
    else if (type === Types.EntityTypes.TRAP)
        return new Entity(id, type, mapIndex, kind, name);
    else if (type === Types.EntityTypes.NPCMOVE)
        return new NpcMove(id, type, mapIndex, kind, name);
    else if (type === Types.EntityTypes.NODE)
        return new Node(id, mapIndex, kind);
    // FIX: was a dead `isChest(id)` check (no such function exists) with the Chest branch
    // commented out, so CHEST-type spawns fell through to `return null`; gameclient.js's
    // onSpawnChest handler then calls `item.setPosition(...)` on that null and throws.
    // Chest is keyed by type like every other branch below.
    else if (type === Types.EntityTypes.CHEST)
        return new Chest(id, kind);

    return null;
};

export default EntityFactory;
