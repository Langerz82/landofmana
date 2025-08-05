/* global Types, log, _ */
define(['entity/entity', 'entity/item', 'entity/mob', 'entity/npcstatic', 'entity/npcmove', 'entity/player', 'entity/chest', 'entity/block', 'entity/node'],
	function(Entity, Item, Mob, NpcStatic, NpcMove, Player, Chest, Block, Node) {

    var EntityFactory = {};

    EntityFactory.createEntity = function(type, kind, id, mapIndex, name, level=0) {
        if(!id) {
            log.info("ERROR - kind is undefined: "+kind+" "+id+" "+name, true);
            return null;
        }

        //if (isChest(id))
        //return new Chest(id, kind);

        // If Items.

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

        return null;
    };
    return EntityFactory;
});
