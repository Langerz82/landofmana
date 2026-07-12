// Converted from AMD (define) to a native ES6 module.
/* global Types, log, _ */
import Entity from './entity/entity.js';
import Item from './entity/item.js';
import Mob from './entity/mob.js';
import NpcStatic from './entity/npcstatic.js';
import NpcMove from './entity/npcmove.js';
import Player from './entity/player.js';
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
        // Chests are spawned server-side as Node.CHEST_KIND nodes (see
        // gameserver/js/entity/node.js) rather than a separate entity type,
        // so this one branch already covers ore/tree nodes and chests alike.
        return new Node(id, mapIndex, kind);

    return null;
};

export default EntityFactory;
