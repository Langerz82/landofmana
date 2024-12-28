var Item = require('./item');

var Chest = Item.extend({
    init: function (id, x, y, map, area, minLevel, maxLevel) {
        this._super(id, Types.EntityTypes.CHEST, x, y); // CHEST
        this.map = map;
        this.level = Utils.randomRangeInt(minLevel, maxLevel);
        this.setDrops();
        this.area = area;
        this.spawnDelay = 30000;
    },

    handleRespawn: function () {
        var self = this;

        this.droppedItem = false;
        if (this.area && this.area instanceof ChestArea) {
            this.area.respawnChest(this, this.spawnDelay);
        }
    },

    setDrops: function () {
        this.drops = {};

        var dropLevel = Math.ceil(this.level / 10) * 10;
        //console.info("dropLevel="+dropLevel);
        for (var itemId in ItemData.Kinds)
        {
		var item = ItemData.Kinds[itemId];
		if (!item)
			continue;

		if (item.typemod=="attack" || item.typemod=="defense")
		{
			switch (dropLevel)
			{
			case item.modifier+10:
				this.drops[itemId] = 20;
				break;
			case item.modifier:
				this.drops[itemId] = 10;
				break;
			case item.modifier-10:
				this.drops[itemId] = 5;
				break;
			case item.modifier-20:
				this.drops[itemId] = 2;
				break;
			}
		}
		if (item.typemod=="craft")
		{
			switch (dropLevel)
			{
			case item.modifier+10:
				this.drops[itemId] = 400;
				break;
			case item.modifier:
				this.drops[itemId] = 200;
				break;
			case item.modifier-10:
				this.drops[itemId] = 100;
				break;
			case item.modifier-20:
				this.drops[itemId] = 50;
				break;
			}
		}
        }
        //console.info("drops="+JSON.stringify(this.drops));
   }
});

module.exports = Chest;
