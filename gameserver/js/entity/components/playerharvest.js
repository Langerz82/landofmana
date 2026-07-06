var Messages = require("../../message");

module.exports = PlayerHarvest = cls.Class.extend({
  init: function(player) {
    this.player = player;
  },

  _harvest: function (x, y, callback, duration) {
    var p = this.player;

    var valid = p._checkHarvest(x, y);
    if (!valid) {
      p._abortHarvest(x, y);
      return;
    }

    var px = p.x, py = p.y;
    var type = p.items.getWeaponType();

    p.isHarvesting = true;

    var exp = p.stats.exp.logging;
    if (type === "hammer")
      exp = p.stats.exp.mining;

    var durationMod = Utils.clamp(0.1, 1, (1 - Types.getSkillLevel(exp)/20));
    duration = ~~(duration * durationMod);
    clearTimeout(p.harvestTimeout);
    p.harvestTimeout = setTimeout(function () {
        var complete = true;

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
  },

  _checkHarvest: function (x, y) {
    var p = this.player;
    if (!p.isNextTooPosition(x,y))
      return false;

    if (!p.items.hasWeaponType())
      return false;

    return true;
  },

  onHarvestEntity: function (entity) {
    var p = this.player;
    var res = true;

    var type = entity.weaponType;
    if (!p.items.hasWeaponType(type)) {
      this.sendPlayer(new Messages.Notify("CHAT", "HARVEST_WRONG_TYPE", type));
      res = false;
    }

    var x= entity.x, y=entity.y;
    if (!res) {
      this._abortHarvest(x, y);
      return;
    }

    var duration = 5000 + (entity.level*1000);
    this._harvest(x, y, function (p) {
      p.world.taskHandler.processEvent(p, PlayerEvent(EventType.USE_NODE, entity, 1));

      if (type === "hammer")
        p.stats.exp.mining += 10;
      entity.die();
      var item = p.world.loot.getDrop(p, entity, false);
      if (item && item instanceof Item)
      {
          item.x = x;
          item.y = y;
          p.world.loot.handleItemDespawn(item);
      }
      return;
    }, duration);
  },

  _abortHarvest: function (x,y) {
    var p = this.player;
    p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 2, x, y));
    p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_INVALID"));
  },

  onHarvest: function (x, y) {
    var p = this.player;
    var gp = Utils.getGridPosition(x,y);

    time = p.map.entities.harvest[gp.gx + "_" + gp.gy];

    var res = true;
    var type = p.getWeaponType();
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
    var duration = 6000;
    p._harvest(x, y, function (p) {
      p.world.taskHandler.processEvent(p, PlayerEvent(EventType.HARVEST, p, 1));
      if (p.getWeaponType() === "axe")
        p.stats.exp.logging += 10;
      p.map.entities.harvest[gp.gx + "_" + gp.gy] = Date.now();
      if (p.items.inventory.hasRoom()) {
        var kind;
        if (p.getWeaponType() === "axe")
          kind = 320;
        var item = new ItemRoom([kind, 1, 0, 0]);
        if (p.items.inventory.putItem(item) === -1)
          return;
        var data = ItemTypes.getData(item.itemKind);
        p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_ADDED", data.name));
      }
    }, duration);
  },

});
