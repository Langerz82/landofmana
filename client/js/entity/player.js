/* global Types */

// TODO - Make Death Sprite seperate instead of changing Armor Sprite.
var STATE_IDLE = 0,
    STATE_MOVING = 1,
    STATE_ATTACKING = 2;

define(['./entity', './character', '../exceptions', 'data/appearancedata'], function(Entity, Character, Exceptions, AppearanceData) {
  var Player = Character.extend({
    init: function(id, type, map, kind, name) {

      this._super(id, type, map, kind);
      var self = this;

      //this.game = game;
      this.name = name;

      // Renderer
      this.nameOffsetY = -10;
      this.rights = 0;

      // sprites
      this.spriteName = "clotharmor";
      this.armorName = "clotharmor";
      this.weaponName = "sword1";

      //this.pClass = 0;

      this.moveSpeed = 500;
      this.setMoveRate(this.moveSpeed);

      //this.timesAttack = 0;
      this.setAttackRate(64);

      //this.stopMove = false;

      this.exp = {};
      this.level = {};
      this.sprites = new Array(2);

      this.stats = {};

      this.orientation = Types.Orientations.DOWN;
      this.keyMove = false;
      this.joystickTime = 0;

      this.fsm = "IDLE";

    },

    setItems: function () {
      this.equipment = {};
      this.inventory = {};
      this.equipment.rooms = game.equipmentHandler.equipment;
      this.inventory.rooms = game.inventoryHandler.inventory;
    },

    isMovingAll: function () {
      return !this.freeze && (this.isMoving() || this.orientation !== Types.Orientations.NONE);
      //return true;
    },

    /*getGuild: function() {
      return this.guild;
    },

    setGuild: function(guild) {
      this.guild = guild;
      $('#guild-population').addClass("visible");
      $('#guild-name').html(guild.name);
    },

    unsetGuild: function() {
      delete this.guild;
      $('#guild-population').removeClass("visible");
    },

    hasGuild: function() {
      return (typeof this.guild !== 'undefined');
    },


    addInvite: function(inviteGuildId) {
      this.invite = {
        time: new Date().valueOf(),
        guildId: inviteGuildId
      };
    },

    deleteInvite: function() {
      delete this.invite;
    },

    checkInvite: function() {
      if (this.invite && ((new Date().valueOf() - this.invite.time) < 595000)) {
        return this.invite.guildId;
      } else {
        if (this.invite) {
          this.deleteInvite();
          return -1;
        } else {
          return false;
        }
      }
    },*/

    setSkill: function(index, exp) {
      this.skillHandler.add(index, exp);
    },

    setSkills: function(skillExps) {
      this.skillHandler.addAll(skillExps);
    },

    setConsumable: function(itemKind) {
    },

    isMovingToLoot: function() {
      return this.isLootMoving;
    },

    getSpriteName: function() {
      return this.getArmorSprite().name;
    },

    getArmorSprite: function() {
      var spriteName = this.spriteName;
      if (game.sprites.hasOwnProperty(spriteName))
        return game.sprites[spriteName];
      return null;
    },

    getWeaponSprite: function() {
      var spriteName = this.weaponName;
      if (game.sprites.hasOwnProperty(spriteName))
        return game.sprites[spriteName];
      return null;
    },

    isArcher: function () {
      if (!this.equipment)
        return false;

      var weapon = this.equipment.rooms[4];
      if (weapon && ItemTypes.isArcherWeapon(weapon.itemKind)) {
        return true;
      }
      return false;
    },

    /*setArmorSpriteId: function (id) {
      var sprite = game.sprites[AppearanceData[id].sprite];
      if (sprite) {
        this.spriteName = sprite.name;
        this.setSprite(sprite);
      }
    },

    setWeaponSpriteId: function (id) {
      var sprite = game.sprites[AppearanceData[id].sprite];
      if (sprite) {
        this.weaponName = sprite.name;
        if (!this.pjsWeaponSprite)
          this.pjsWeaponSprite = game.renderer.createSprite(sprite);
        else
        {
          this.pjsWeaponSprite = game.renderer.changeSprite(sprite, this.pjsWeaponSprite);
        }
      }
    },*/

    setArmorSprite: function(sprite) {
      this._setArmorSprite(sprite);
    },

    setWeaponSprite: function(sprite) {
      this._setWeaponSprite(sprite);
    },

    _setArmorSprite: function(sprite) {
      if (!sprite)
      {
        var id = this.sprites[0];
        /*if (this.isArcher()) {
          id = this.sprites[2];
        }*/
        sprite = game.sprites[AppearanceData[id].sprite];
      }
      if (sprite) {
        this.armorSprite = sprite;
        this.spriteName = sprite.name;
        this.setSprite(sprite);
      }
    },

    _setWeaponSprite: function(sprite) {
      if (!sprite)
      {
        var id = this.sprites[1];
        /*if (this.isArcher()) {
          id = this.sprites[3];
        }*/
        sprite = game.sprites[AppearanceData[id].sprite];
      }

      if (sprite) {
        this.weaponName = sprite.name;
        this.weaponSprite = sprite;
        if (!this.pjsWeaponSprite)
          this.pjsWeaponSprite = game.renderer.createSprite(sprite);
        else
        {
          this.pjsWeaponSprite = game.renderer.changeSprite(sprite, this.pjsWeaponSprite);
        }
      }
    },

    hasWeapon: function() {
      return this.weaponName !== null;
    },

    flagPVP: function(pvpFlag) {
      this.pvpFlag = pvpFlag;
    },

    // Override walk, idle, and updateMovement for mounts.
    /*walk: function(orientation) {
      this.setOrientation(orientation);
      this.animate("walk", this.walkSpeed);
    },

    idle: function(orientation) {
      orientation = orientation || 0;
      this.setOrientation(orientation);
      this.animate("idle", this.idleSpeed);
    },*/

    setRange: function() {
      //this.pClass = pClass;
      //ts = game.tilesize;
      this.setAttackRange(1);
      if (this.isArcher()) {
        this.setAttackRange(10);
      }
    },

    setPvpSide: function(side) {
      this.pvpSide = side;
    },

    canKeyMove: function () {
        var x=this.x, y=this.y;
        switch (this.orientation)
        {
          case Types.Orientations.UP:
            y--;
            break;
          case Types.Orientations.DOWN:
            y++;
            break;
          case Types.Orientations.LEFT:
            x--;
            break;
          case Types.Orientations.RIGHT:
            x++;
            break;
        }
        var ov = game.isOverlapping(this, x, y);
        if (ov)
          log.info("isOverlapping.")
        var ic = game.mapContainer.isColliding(x,y);
        if (ic)
          log.info("isColliding.")
        return !(ov || ic);
    },

    move: function (time, orientation, state, x, y) {
      var self = this;

      this.setOrientation(orientation);
      if (state == 1 && orientation != Types.Orientations.NONE)
      {
        var lockStepTime = (G_LATENCY - (getWorldTime()-time));
        lockStepTime = lockStepTime.clamp(G_UPDATE_INTERVAL,G_LATENCY);
        console.warn("lockStepTime="+lockStepTime);

        lockStepTime += G_LATENCY;
        clearTimeout(this.moving_callback)
        this.moving_callback = setTimeout(function () {
          self.forceStop();
          self.setPosition(x,y);
          self.ex = -1;
          self.ey = -1;
          self.moving_callback = null;
          self.walk(orientation);
          self.freeze = false;
          self.keyMove = true;
        }, lockStepTime);
      }
      else if (state == 0 || orientation == Types.Orientations.NONE)
      {
        this.ex = x;
        this.ey = y;
        if (!this.movement.inProgress || this.moving_callback) {
          this.forceStop();
          this.setPosition(x,y);
          clearTimeout(this.moving_callback);
          this.moving_callback = null;
        }
      }
      else if (state == 2 && orientation != Types.Orientations.NONE)
      {
        this.forceStop();
        this.setPosition(x,y);
        this.ex = -1;
        this.ey = -1;
        clearTimeout(this.moving_callback);
        this.moving_callback = null;
      }
    },

    /*forceStop: function () {
      this.keyMove = false;
      this._super();

    },*/


    /*moveTo_: function(x, y, callback) {
      var ts = G_TILESIZE;
      var self = this;
      var parent = self._super;

      if (!game.player) {
        return this._super(x, y, callback);
      }

      if (this.freeze || this.movement.inProgress || this.isMoving() || this.isMovingPath()) {
        //this.forceStop();
        return;
      }

      this.freeze = true;
      this._super(x, y, callback);
      if (!this.path)
        return;

      var orientation = this.orientation;

      log.info("background - free delay =" + G_LATENCY);
      this.fsm = "MOVE";
      //var orientation = this.orientation;
      clearTimeout(self.moveTimeout);
      self.moveTimeout = setTimeout(function() {
        if (self.movement.inProgress) {
          self.movement.stop();
          return;
        }
        //self.forceStop();
        self.orientation = orientation;
        //self.setOrientation(orientation);
        self.freeze = false;
        clearTimeout(self.moveTimeout);
        self.moveTimeout = null;

      }, G_LATENCY);

    },*/


    baseHit: function() {
      return 0;
    },

    baseHitDef: function() {
      return 0;
    },

    baseCrit: function() {
      var itemDiff = this.level.base*2;
      var item = this.equipment.rooms[4];
      if (item) {
        itemDiff = (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
      }
      var statDiff = this.stats.attack + (this.stats.luck*2);
      var chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
      log.info("player - baseCrit: "+chance);
      var chance_out = (chance / 5).toFixed(0)+"%";
      return chance_out;
      //return chance;
    },

    baseCritDef: function() {
      var itemDiff = this.level.base*2;
      for (var id in this.equipment.rooms) {
        if (id == 4) continue;
        var item = this.equipment.rooms[id];
        if (item) {
          itemDiff += (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
        }
      }
      var statDiff = this.stats.defense + (this.stats.luck*2);
      var chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
      log.info("player - baseCritDef: "+chance);
      var chance_out = (chance / 5).toFixed(0)+"%";
      return chance_out;
      //return chance;
    },

    getWeapon: function () {
      var weapon = this.equipment.rooms[4];
      return weapon;
    },

    getWeaponLevel: function () {
      var weapon = this.getWeapon();
      if (!weapon)
        return 0;
      var weaponData = ItemTypes.KindData[weapon.itemKind];
      return Types.getWeaponLevel(this.exp[weaponData.type]);
    },

    hasHarvestWeapon: function (type) {
      if (type && type == "any")
          return true;

      var weapon = this.getWeapon();
      if (!weapon)
        return false;

      var weaponData = ItemTypes.KindData[weapon.itemKind];
      if (type) {
        return weaponData.type == type;
      }
      return ItemTypes.isHarvestWeapon(weapon.itemKind);
    },

    getWeaponType : function () {
      //return "axe"; // todo remove.

      var weapon = this.getWeapon();
      if (!weapon)
        return null;
      var weaponData = ItemTypes.KindData[weapon.itemKind];
      return weaponData.type;
    },

    baseDamage: function() {
      var dealt, dmg;
      var weapon = this.equipment.rooms[4];
      var level = this.level.base;

      dealt = ~~(weapon ? (ItemTypes.getData(weapon.itemKind).modifier * 3 + weapon.itemNumber * 2) : level);

      var power = ((this.level.attack / 50) + 1);

      power *= ((this.getWeaponLevel() / 50) + 1);

      // Weapon Durability affects Damage.
      if (weapon) {
        dealt = ~~(dealt * ((weapon.itemDurability / weapon.itemDurabilityMax * 0.5) + 0.5));
      }

      // Players Stat affects Damage.
      var mods = (this.mod ? this.mod.attack : 0);
      dealt += ((this.stats.attack+mods)*3) + this.stats.luck;

      var min = ~~(level*power);
      var max = ~~(min*3);

      dmg = Utils.randomRangeInt(min, max) + dealt;

      var noobLvl = 10;
      var noobMulti = 1.15 + Math.max(0,(noobLvl-this.level.base) * (0.5/noobLvl));

      dmg = ~~(dmg * noobMulti);

      min = ~~((min + dealt)*noobMulti);
      max = ~~((max + dealt)*noobMulti);

      return [min,max];
      //return dmg;
    },

    baseDamageDef: function() {
      var dealt = 0, dmg = 0;

      var level = this.level.base+3;
      log.info("baseDamageDef:");

      dealt = level;
      for (var id in this.equipment.rooms)
      {
        var item = this.equipment.rooms[id];
        if (item) {
          var eq_multi = (id == 1) ? 4 : 2;
          var def = (ItemTypes.getData(item.itemKind).modifier * eq_multi + item.itemNumber * eq_multi);
          dealt += ~~(def * ((item.itemDurability / item.itemDurabilityMax * 0.5) + 0.5));
        }
      }

      log.info("dealt="+dealt);
      var power = ((this.level.defense / 50) + 1);
      log.info("power="+power);
      var min = ~~(level*power);
      var max = ~~(min*2);

      log.info("dealtrange="+dealt);
      // Players Stat affects Damage.
      var mods = (this.mod ? this.mod.defense : 0);
      dealt += ~~((this.stats.defense+mods)*3) + this.stats.luck;

      log.info("dealtstats="+dealt);

      dmg = Utils.randomRangeInt(min, max) + dealt;

      min += dealt;
      max += dealt;

      return [min,max];
      //return dmg;
    },

    onKeyMove: function (callback) {
      this.key_move_callback = callback;
    },

    hit: function(orientation) {
        this.fsm = "ATTACK";
        this.forceStop();
        this._super(orientation);
    },

    revive: function () {
      this.isDead = false;
      this.isDying = false;
      this.freeze = false;
      this.stats.hp = this.stats.hpMax;
      this.stats.ep = this.stats.epMax;

      this.setArmorSprite();
      this.forceStop();
      this.disengage();
    },

    respawn: function () {
      this.setArmorSprite();
      this.setOrientation(Types.Orientations.DOWN);
      this.idle(this.orientation);
      this.fsm = "IDLE";
    },

    setPosition: function (x, y) {
      this._super(x,y);

      if (this.holdingBlock)
      {
        var ts=G_TILESIZE;
        var posArray = [
          [x,y],
          [x,y-ts],
          [x,y+ts],
          [x-ts,y],
          [x+ts,y]
        ];
        var pos = posArray[this.orientation];
        this.holdingBlock.setPosition(pos[0], pos[1]);
      }
    },

    followPath: function(path) {
      this._followPath(path);
    },

    _followPath: function(path) {
        if(path.length > 1) { // Length of 1 means the player has clicked on himself
            this.path = path;
            this.step = 1;

            if(this.start_pathing_callback) {
                this.start_pathing_callback(path);
                this.updateMovement();
            }
            if(this.before_move_callback) {
                this.before_move_callback();
            }
        }
    },

    /*setPositionGrid: function() {
        var gx = (this.x >> 4);
        var gy = (this.y >> 4);
        //this.gx = gx;
        //this.gy = gy;
        var o = this.orientation;
    },*/

    /*isMoving: function() {
        return this._super() && this.keyMove;
    },*/

    harvestOn: function(type) {
      var self = this;
      var tmptype = type;
      var harvest = function () {
        self.setOrientation(self.orientation);
        self.fsm = "HARVEST";
        self.animate("atk", self.atkSpeed, 1, function () {
          self.idle(self.orientation);
        });
        if (tmptype == "any")
          self.hideWeapon = true;
      };
      harvest();
      clearInterval(this.harvestTimeout);
      this.harvestTimeout = setInterval(function () {
        if (!self.harvestTimeout) {
          self.forceStop();
          return;
        }
        if (self.target && !(self.target.type == Types.EntityTypes.NODE)) {
          self.forceStop();
          return;
        }
        harvest();
      },1000);
      this.startHarvestTime = Date.now();
    },

    harvestOff: function () {
      if (this.fsm == "HARVEST") {
        clearInterval(this.harvestTimeout);
        this.harvestTimeout = null;
        //this.fsm = "IDLE";
        //this.forceStop();
        //this.fsm = "IDLE";
        //this.idle();
        this.startHarvestTime = 0;
        this.hideWeapon = false;
      }
    },

    forceStop: function () {
      //this.keyMove = false;
      this._super();
      if (this.key_move_callback)
      {
        this.key_move_callback(false);
      }
    },

  });

  return Player;
});
