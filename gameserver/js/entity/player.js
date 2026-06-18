
/* global require, module, log, databaseHandler */
var Character = require('./character'),
    Messages = require("../message"),
    Formulas = require("../formulas"),
    Bank = require("../items/bank"),
    Equipment = require("../items/equipment"),
    Inventory = require("../items/inventory"),
    SkillHandler = require("../skillhandler"),
    SkillEffectHandler = require("../effecthandler"),
    PacketHandler = require("../packets/packethandler"),
    PlayerQuests = require("../playerquests");
    Quest = require("../quest");

module.exports = Player = Character.extend({
    init: function(world, user, connection) {
        var self = this;

        this.user = user;
        this.world = world;

        this.map = this.world.maps[0];

        this._super(connection.id, Types.EntityTypes.PLAYER, 1, 0, 0, this.map, 0);

        this.mapStatus = 0;
        this.mapIndex = 0;

        this.gold = new Array(2);

        this.inventory = null;
        this.bank = null;
        this.equipment = null;
        this.itemStore = new Array(3);

        this.stats = {
          attack: 0,
          defense: 0,
          health: 0,
          energy: 0,
          luck: 0,
          free: 0,
          hp: 0,
          hpMax: 0,
          ep: 0,
          epMax: 0,
          exp: {}
        };

        this.stats.mod = {
          attack: 0,
          defense: 0,
          damage: 0,
          health: 0
        };

        this.consumeTimeout = null;
        this.skillHandler = new SkillHandler(this);

        this.moveSpeed = 500;
        this.setMoveRate(this.moveSpeed);

        this.consumeTime = new Timer(10000);
        this.attackedTime = new Timer(500);
        this.attackQueue = null;

        this.attackSkill = [];
        this.attackTimer = 0;

        this.idleTimer = new Timer(300000);

        this.quests = new PlayerQuests(this);

        this.knownIds = [];

        this.sx = 0;
        this.sy = 0;
        this.ex = -1;
        this.ey = -1;

//        this.moveOrientation = 0;

        this.achievements = [];

        this.pStats = [];
        this.sprites = [];
        this.colors = [];

        this.shortcuts = {};

        this.loaded = 0;
    },

    start: function (connection) {
      this.connection = connection;
      this.id = connection.id;

      this.packetHandler = new PacketHandler(this);
      this.packetHandler.loadedPlayer = true;

      this.world.connect_callback(this);
      this.sendPlayerToClient();
    },

    destroy: function() {
      var self = this;
    },

    getState: function() {
      var basestate = this._getBaseState();
      var sprite1 = this.getSprite(0), sprite2 = this.getSprite(1);

      var state = [this.level,
        this.stats.hp,
        this.stats.hpMax,
        0,
        sprite1, sprite2,
  	    0, 0];

      return basestate.concat(state);
    },

    send: function(message) {
        this.connection.send(message);
    },

    resetBars: function() {
      var hp = this.stats.hp;
      var ep = this.stats.ep;
      var hpDiff = this.stats.hpMax - hp;
      var epDiff = this.stats.epMax - ep;
      this.modHp(hpDiff);
      this.modEp(epDiff);
      //this.map.entities.sendNeighbours(this, new Messages.ChangePoints(this, hpDiff, epDiff));
    },


    onKillEntity: function (entity, damage, dealt) {
      damage = damage || 0;
      dealt = dealt || 0;

      var ratio = (damage / entity.stats.hpMax);

      var xp = ~~(entity.getXP() * ratio);

      var diff = 10;
      var div = 1/diff;
      var mod = 1 + div + Utils.clamp(-diff,diff,(entity.level - this.level)) * div;
      var xp = ~~(xp * mod);

      this.incExp(xp);
      this.incWeaponExp(xp);

      var weaponSlot = 4;
      var armorDamage = Math.min(5, Math.ceil(dealt / 300));
      log.info("player - armorDamage:" + armorDamage);
      for (var it in this.equipment.rooms) {
        if (it === weaponSlot)
          continue;

        if (!this.equipment.rooms[it])
          continue;
        //log.info("armor: "+this.equipment[it].toString());
        if (armorDamage > 0)
        {
            if (this.equipment.degradeItem(it, 1))
              this.equipment.addExperience(it, armorDamage);
        }
      }
      this.armorDamage = 0;

      // Degrade weapon if over threshold.
      var weaponDamage = Math.min(5, Math.ceil(damage / 2000));
      if (weaponDamage > 0)
      {
          if (this.equipment.degradeItem(weaponSlot, 1))
            this.equipment.addExperience(weaponSlot, weaponDamage);
      }
      //target.addWeaponExp(target.weaponDamage);
      this.weaponDamage = 0;

      //this.damageCount[entity.id] = 0;
      //this.dealtCount[entity.id] = 0;
    },

    onDamage: function (attacker, hpMod, epMod, crit, effects) {
      var hpDiff = this.stats.hp;
      this._super(attacker, hpMod, epMod, crit, effects);
      hpDiff = hpDiff - this.stats.hp;

      attacker.onHitEntity(this, hpDiff);

      if (this.stats.hp <= 0)
      {
        _.each(this.attackers, function(attacker) {
          if (attacker.hasOwnProperty("knownIds"))
            delete attacker.knownIds[this.id];

        });
        this.die(attacker);
      }
    },

    getLevel: function () {
      return Types.getLevel(this.stats.exp.base);
    },

    getAttackLevel: function () {
      return Types.getAttackLevel(this.stats.exp.attack);
    },

    getDefenseLevel: function () {
      return Types.getDefenseLevel(this.stats.exp.defense);
    },

    incExp: function (gotexp)
    {
      var incExp = parseInt(gotexp);

      incExp = Math.ceil(incExp * this.getExpBonus());

      var prevLvl = this.getLevel();
      this.stats.exp.base = parseInt(this.stats.exp.base) + parseInt(incExp);
      var lvl = this.getLevel();
      this.sendPlayer(new Messages.Stat("exp.base", this.stats.exp.base, incExp));

      this.level = Types.getLevel(this.stats.exp.base);
      if(prevLvl !== lvl) {
      	this.levelUp(prevLvl);
      }

      return incExp;
    },

    incAttackExp: function(gotexp){
    	var incExp = parseInt(gotexp);

  		incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

      var prevLvl = this.getAttackLevel();
    	this.stats.exp.attack = parseInt(this.stats.exp.attack) + parseInt(incExp);
      var lvl = this.getAttackLevel();
      if(prevLvl !== lvl) {
      	this.sendPlayer(new Messages.LevelUp("attack", lvl, this.stats.exp.attack));
      }
      return incExp;
    },

    incDefenseExp: function(gotexp){
    	var incExp = parseInt(gotexp);

		  incExp = Math.ceil(incExp * this.getExpBonus());

      var prevLvl = this.getDefenseLevel();
    	this.stats.exp.defense = parseInt(this.stats.exp.defense) + parseInt(incExp);
      var lvl = this.getDefenseLevel();
      if(prevLvl !== lvl) {
      	this.sendPlayer(new Messages.LevelUp("defense", lvl, this.stats.exp.defense));
      }
      return incExp;
    },

    incWeaponExp: function(gotexp){
    	var incExp = parseInt(gotexp);

  		incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

      var type = this.getWeaponType();
      if (!this.stats.exp.hasOwnProperty(type))
        return null;

      var xp = parseInt(this.stats.exp[type]);
      var plvl = Types.getWeaponLevel(xp);
      xp = xp + incExp;
      var clvl = Types.getWeaponLevel(xp);
      this.stats.exp[type] = xp;
      if(plvl !== clvl) {
        this.sendPlayer(new Messages.LevelUp(type, clvl, xp));
      }
      return incExp;
    },

    getExpBonus: function ()
    {
      var self = this;
      var bonus = 1;
      if (this.party)
      {
        this.party.forEachPlayer(function (player) {
          if (self.isInScreen([player.x,player.y]))
          {
            bonus += 0.15;
          }
        });
      }
      return bonus;
    },

    levelUp: function (prevLevel) {
      for (var i=prevLevel; i < this.level; ++i)
      {
  	    if (i < 10)
  	    {
  	    	this.stats.attack+=2;
  	    	this.stats.defense+=2;
  	    	this.stats.health+=2;
  	    	this.stats.energy+=2;
  	    	this.stats.luck+=2;
  	    }
  	    else
  	    {
  	    	this.stats.free += 5;
  	    }
      }
      this.setHpMax();
      this.setEpMax();
    	this.sendPlayer(new Messages.StatInfo(this));
	    this.resetBars();
	    this.sendPlayer(new Messages.ChangePoints(this, 0, 0));
	    this.sendPlayer(new Messages.LevelUp("base", this.level, this.stats.exp.base));
    },

    sendPlayerToClient: function ()
    {
      var self = this;

      console.info("sendMessage");
      var i = 0;
      var sendMessage = [
          Types.Messages.WC_PLAYER,
          0,
          Date.now(),
          self.id,
          self.name,
          self.mapIndex,
          self.x,
          self.y,
          self.stats.hp,
          self.stats.ep,
          self.stats.exp.base,
          self.stats.exp.attack,
          self.stats.exp.defense,
          self.stats.exp.move,
          self.stats.exp.sword,
          self.stats.exp.bow,
          self.stats.exp.hammer,
          self.stats.exp.axe,
          self.stats.exp.logging,
          self.stats.exp.mining,
          self.colors[0],
          self.colors[1],
          self.gold[0],
          self.gold[1],
          self.user.gems,
          self.stats.attack,
          self.stats.defense,
          self.stats.health,
          self.stats.energy,
          self.stats.luck,
          self.stats.free
      ];

      console.info("sendMessage - Equipment");
      // Send All Equipment
      sendMessage.push(Object.keys(self.equipment.rooms).length);
      for(var equipIndex in self.equipment.rooms){
        var item = self.equipment.rooms[equipIndex];
        sendMessage = sendMessage.concat(item.toArray());
      }

      self.setRange();

      sendMessage.push(self.getSprite(0));
      sendMessage.push(self.getSprite(1));
      //sendMessage.push(self.isArcher() ? self.sprites[3] : self.sprites[1]);

      //console.info("inventory=" +JSON.stringify(self.inventory.rooms));

      console.info("sendMessage - Inventory");
      // Send All Inventory
      sendMessage.push(Object.keys(self.inventory.rooms).length);
      for(var invIndex in self.inventory.rooms){
        var item = self.inventory.rooms[invIndex];
        sendMessage = sendMessage.concat(item.toArray());
      }

      console.info("sendMessage - Bank");
      // Send All Bank
      sendMessage.push(Object.keys(self.bank.rooms).length);
      for(var bankIndex in self.bank.rooms){
        var item = self.bank.rooms[bankIndex];
        sendMessage = sendMessage.concat(item.toArray());
      }

// TODO - Make Quests work with new Class.
      // Send All Quests
      var quests = self.quests.quests.filter(function (q) { return q.status !== QuestStatus.COMPLETE; });
      sendMessage.push(quests.length);
      for(var questIndex = 0; questIndex < quests.length; ++questIndex){
          var q = quests[questIndex];
          console.info(JSON.stringify(q));
          sendMessage = sendMessage.concat(q.toClient());
      }

      // SEND ACHIEVEMENTS
      var achievements = self.achievements;
      sendMessage.push(achievements.length);
      for(var achieveIndex = 0; achieveIndex < achievements.length; ++achieveIndex){
          var achievement = achievements[achieveIndex];
          console.info(JSON.stringify(achievement));
          sendMessage = sendMessage.concat(achievement.toClient(achievement));
      }

      // Send install skills
      self.effectHandler = new SkillEffectHandler(self);
      sendMessage.push(self.skills.length);
      for(var i=0; i < self.skills.length; ++i) {
        sendMessage.push(parseInt(self.skills[i].skillXP));
      }

      // Send load Skill slots.
      var len = Object.keys(self.shortcuts).length;
      sendMessage.push(len);
      var sc;
      for(var id in self.shortcuts) {
        sc = self.shortcuts[id];
        if (sc) {
          sendMessage.push(parseInt(sc[0]));
          sendMessage.push(parseInt(sc[1]));
          sendMessage.push(parseInt(sc[2]));
        }
      }

      if (self.world.enter_callback)
      {
        self.world.enter_callback(self);
        self.connection.sendUTF8(sendMessage.join(","));
      }
    },

// TODO - Fill db_player variable assignments.
    fillPlayerInfo: function(db_player)
    {
        var self = this;
        self.mapIndex = parseInt(db_player.map[0]);
        self.map =  self.world.maps[self.mapIndex];
        self.x = parseInt(db_player.map[1]);
        self.y = parseInt(db_player.map[2]);
        self.orientation = parseInt(db_player.map[3]);

        if (db_player.sprites.length === 2) {
          db_player.sprites[2] = 151;
          db_player.sprites[3] = 50;
        }
        self.sprites = db_player.sprites.parseInt();
        self.colors = db_player.colors;

        self.stats.exp.base = parseInt(db_player.exps[0]);
        self.stats.exp.attack = parseInt(db_player.exps[1]);
        self.stats.exp.defense = parseInt(db_player.exps[2]);
        self.stats.exp.move = parseInt(db_player.exps[3]);
        if (db_player.exps.length >= 8)
        {
          self.stats.exp.sword = parseInt(db_player.exps[4]);
          self.stats.exp.bow = parseInt(db_player.exps[5]);
          self.stats.exp.hammer = parseInt(db_player.exps[6]);
          self.stats.exp.axe = parseInt(db_player.exps[7]);
        }
        else {
          self.stats.exp.sword = 0;
          self.stats.exp.bow = 0;
          self.stats.exp.hammer = 0;
          self.stats.exp.axe = 0;
        }
        if (db_player.exps.length === 10)
        {
          self.stats.exp.logging = parseInt(db_player.exps[8]);
          self.stats.exp.mining = parseInt(db_player.exps[9]);
        } else {
          self.stats.exp.logging = 0;
          self.stats.exp.mining = 0;
        }

        self.level = Types.getLevel(self.stats.exp.base);

        self.gold[0] = parseInt(db_player.gold[0]);
        self.gold[1] = parseInt(db_player.gold[1]);

        self.isDead = false;

    		self.pStats = db_player.pStats.parseInt();

        db_player.stats = db_player.stats.parseInt();

        // Check to make sure stats are correct for level.
        var isValidStats = function (lvl, stats) {
            var total = 0;
            if (lvl < 10)
              total = lvl * 10;
            else
              total = (9 * 10) + (5 * (lvl - 9));

            var statTotal = stats.reduce(function(a, b) { return (a + b); }, 0);

            return (total === statTotal);
        };

        var lvl = parseInt(self.level);
        if (!isValidStats(lvl, db_player.stats))
        {
          if (lvl < 10) {
            self.stats.attack = lvl*2;
      			self.stats.defense = lvl*2;
      			self.stats.health = lvl*2;
            self.stats.energy = lvl*2;
      			self.stats.luck = lvl*2;

            self.stats.free = 0;
          }
          else {
            self.stats.attack = 18;
      			self.stats.defense = 18;
      			self.stats.health = 18;
            self.stats.energy = 18;
      			self.stats.luck = 18;

            self.stats.free = (lvl-9)*5;
          }
        }
        else {
          self.stats.attack = db_player.stats[0];
          self.stats.defense = db_player.stats[1];
          self.stats.health = db_player.stats[2];
          self.stats.energy = db_player.stats[3];
          self.stats.luck = db_player.stats[4];

          self.stats.free = db_player.stats[5];
        }

        // if quests old format create empty.
        // if quests new but id not a Number delete.
        if (Array.isArray(db_player.completeQuests)) {
            self.quests.completeQuests = {}
        }
        else {
          for (var id in db_player.completeQuests)
          {
            if (!Number(id))
              delete db_player.completeQuests[id];
          }
          self.quests.completeQuests = db_player.completeQuests;
        }

        self.setHpMax();
        self.setEpMax();

    		//console.info("self.stats.health="+self.stats.health);
        self.resetBars();
    		//console.info("self.stats.hp="+self.stats.hp);
    		self.setMoveRate(500);

        if (db_player.skills.length === 1) {
          for(var i =0; i < SkillData.Skills.length; ++i)
            db_player.skills[i] = 0;
        }
        self.skillHandler.setSkills(self, db_player.skills);

        // Needs to convert shortcut into optimum data structure while
        // remaining compatibiltity with old structures.
        if (Array.isArray()) {
          for (var shortcut of db_player.shortcuts)
          {
            if (shortcut[0] >= 6)
              continue;

            if (shortcut)
              self.shortcuts[shortcut[0]] = shortcut;
          }
        } else {
          for (var sid in db_player.shortcuts)
          {
            if (sid >= 6)
              continue;

            var shortcut = db_player.shortcuts[sid];
            if (shortcut)
              self.shortcuts[sid] = shortcut;
          }
        }

        self.attackTimer = Date.now();

        //console.info("playerId: "+self.id);
    },

    handleInventoryEat: function(item, slot){
      var self = this;
      var kind = item.itemKind;

      if(!this.consumeTime.isOver())
          return;

      var amount;

      var itemData = ItemTypes.KindData[kind];
      this.consumeTime.duration = itemData.cooldown * 1000;

      if (itemData.typemod === "health")
      {
    		amount = itemData.modifier;
    		if(!this.hasFullHealth()) {
    			this.modHp(amount);
    		}
      }
      else if (itemData.typemod === "healthpercent")
      {
      	amount = ~~(this.stats.hpMax * itemData.modifier/100);
    		if(!this.hasFullHealth()) {
    			this.modHp(amount);
    		}
      }
      if (itemData.typemod === "energy")
      {
    		amount = itemData.modifier;
    		if(!this.hasFullEnergy()) {
    			this.modEp(amount);
    		}
      }
      this.inventory.takeOutItems(slot, 1);
    },

/*
  modHp: function (hp) {
    if (this.isDead)
      return;

    var msg = this._super(hp);
    this.sendChangePoints(hp, 0);
    return msg;
  },

  modEp: function (ep) {
    var msg = this._super(ep);
    this.sendChangePoints(0, ep);
    return msg;
  },
*/

  sendChangePoints: function (health, energy) {
    this.map.entities.sendNeighbours(this, new Messages.ChangePoints(this, health, energy));
  },

  getHpMax: function () {
  	var hp = 300 + (this.stats.health * 100);
    return hp;
  },

  getEpMax: function () {
  	var ep = 300 + (this.stats.energy * 100);
    return ep;
  },

  /*drop: function (item,x,y) {
  	//console.info(JSON.stringify(item));
      //console.info("drop x:"+x+",y:"+y);
  	if (item) {
          console.info("drop x:"+x+",y:"+y);
          return new Messages.Drop(item, x, y);
      }
  },*/
  getWeapon: function () {
    return this.equipment.getWeapon();
  },

  getWeaponLevel: function () {
    var weapon = this.getWeapon();
    if (!weapon)
      return 0;
    var weaponData = ItemTypes.KindData[weapon.itemKind];
    return Types.getWeaponLevel(this.stats.exp[weaponData.type]);
  },

  baseCrit: function() {
    var itemDiff = this.level*2;
    var item = this.getWeapon();
    if (item) {
      itemDiff = (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
    }
    var statDiff = this.stats.attack + (this.stats.luck*2);
    var chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
    //console.info("player - baseCrit: "+chance);
    //var chance_out = (chance / 5).toFixed(0)+"%";
    //return chance_out;
    return chance;
  },

  baseCritDef: function() {
    var itemDiff = this.level*2;
    for (var id in this.equipment.rooms) {
      if (id === 4) continue;
      var item = this.equipment.rooms[id];
      if (item) {
        itemDiff += (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
      }
    }
    var statDiff = this.stats.defense + (this.stats.luck*2);
    var chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
    //console.info("player - baseCritDef: "+chance);
    //var chance_out = (chance / 5).toFixed(0)+"%";
    //return chance_out;
    return chance;
  },

  baseDamage: function(defender) {
    var dealt, dmg;
    var weapon = this.getWeapon();
    var level = this.level;

    dealt = ~~(weapon ? (ItemTypes.getData(weapon.itemKind).modifier * 3 + weapon.itemNumber * 2) : level);

    var lvl = Types.getAttackLevel(this.stats.exp.attack);
    var power = ((lvl / 50) + 1);

    power *= ((this.getWeaponLevel() / 50) + 1);

    // Weapon Durability affects Damage.
    if (weapon) {
      dealt = ~~(dealt * ((weapon.itemDurability / weapon.itemDurabilityMax * 0.5) + 0.5));
    }

    // Players Stat affects Damage.
    var mods = (this.stats.mod && this.stats.mod.attack ?
      this.stats.mod.attack : 0);
    dealt += ~~((this.stats.attack*3)+mods) + this.stats.luck;

    var noobLvl = 12;
    var noobMulti = 1 + Math.max(0,(noobLvl-this.level) * (1/this.level));

    var min = ~~(level*power*noobMulti*4);
    var max = ~~(min*1.15);

    dmg = Utils.randomRangeInt(min, max) + dealt;

    if (this.stats.mod && this.stats.mod.damage)
      dmg += this.stats.mod.damage;

    if (defender && defender instanceof Mob)
    {
      var type = this.getWeaponType();
      if (type) {
        var mod = defender.data.modDamage[type];
        dmg = ~~(dmg * mod);
      }
    }

    min = ~~(min + dealt);
    max = ~~((max + dealt) * 3);

    //return [min,max];
    return dmg;
  },


  baseDamageDef: function(defender) {
    var dealt = 0, dmg = 0;

    var level = this.level+3;
    //console.info("baseDamageDef:");

    dealt = level;
    for (var id in this.equipment.rooms)
    {
      var item = this.equipment.rooms[id];
      if (item) {
        var eq_multi = (id === 1) ? 4 : 2;
        var def = (ItemTypes.getData(item.itemKind).modifier * eq_multi + item.itemNumber * eq_multi);
        dealt += ~~(def * ((item.itemDurability / item.itemDurabilityMax * 0.5) + 0.5));
      }
    }

    //console.info("dealt="+dealt);
    var lvl = Types.getDefenseLevel(this.stats.exp.defense);
    var power = ((lvl / 50) + 1);
    //console.info("power="+power);
    var min = ~~(level*power);
    var max = ~~(min*2);

    //console.info("dealtrange="+dealt);
    // Players Stat affects Damage.
    var mods = (this.mod ? this.stats.mod.defense : 0);
    dealt += ~~((this.stats.defense*4)+mods) + this.stats.luck;

    //console.info("dealtstats="+dealt);

    dmg = Utils.randomRangeInt(min, max) + dealt;

    min = ~~(min + dealt);
    max = ~~((max+dealt) * 1.75);

    //return [min,max];
    return dmg;
  },

  modifyGold: function(gold, type) {
    type = type || 0;
    if (this.gold[type]+gold < 0)
      return false;

    this.gold[type] += parseInt(gold);

    this.sendPlayer(new Messages.Gold(this));
    if (gold === 0) {
      //this.sendPlayer(new Messages.Notify("CHAT", "GOLD_ZERO"));
    } else if (gold > 0)
      this.sendPlayer(new Messages.Notify("CHAT", "GOLD_ADDED", [gold]));
    else {
      gold *= -1;
      this.sendPlayer(new Messages.Notify("CHAT", "GOLD_REMOVED", [gold]));
    }
    return true;
  },

  modifyGems: function(diff) {
    diff = parseInt(diff);
    if ((this.user.gems - diff) < 0)
    {
      this.connection.send((new Messages.Notify("SHOP", "SHOP_NOGEMS")).serialize());
      return false;
    }
    this.user.gems += diff;
    this.connection.send((new Messages.Gold(this)).serialize());
    return true;
  },

  sendToUserServer: function (msg) {
    if (this.world)
      this.world.send(msg.serialize());
    else {
      console.warn("Player, sendToUserServer called without world being set. "+JSON.stringify(msg));
    }
  },

  save: function (update) {
    console.info("Player - save, name:"+this.name);

    if (this.connection.worldHandler)
      this.connection.worldHandler.savePlayer(this, update);
    else {
      console.warn("Player, save called without worldHandler being set. ");
    }
  },

  isArcher: function () {
    var weapon = this.getWeapon();
    if (weapon && ItemTypes.isArcherWeapon(weapon.itemKind)) {
      return true;
    }
    return false;
  },

  setRange: function() {
    this.setAttackRange(1);
    if (this.isArcher()) {
      this.setAttackRange(10);
    }
  },

  // data = time, interrupted. path
  movePath: function (data, path)
  {
    var x=path[0][0], y=path[0][1],
      x2=path[path.length-1][0], y2=path[path.length-1][1],
      time=data[0],
      interrupted=data[1];

    this.idleTimer.restart();

    console.info("set path");

    if (this.keyMove) {
      this.move(this.orientation, 0, this.ex, this.ey);
    }

    this.sx = this.x;
    this.sy = this.y;
    this.ex = x2;
    this.ey = y2;

    this.forceStop();
    if (!this.map.entities.pathfinder.isValidPath(path))
      return;

    this.setPath(path);
    this.startMovePathTime = time;
  },

  move: function (nm) {
    //nm = self.nextMove;
    if (!nm)
      return;

    var time=nm[0], state=nm[1], o=nm[2], x=nm[3], y=nm[4];
    console.info("nm:"+JSON.stringify(nm));

    this.idleTimer.restart();

    if (this.moving_callback)
    {
      clearTimeout(this.moving_callback);
      this.moving_callback = null;
    }

    /*if (state === 3) {
      this.setPosition(x,y);
      this.forceStop();
      return;
    }*/

    if (state === 1) {
        var delay = 0;
        this.startMoveTime = time;

        var execMove = function (p) {
          if (p.movement.inProgress) {
            p.forceStop();
          }
          p.moving_timeout = null;
          p.startMoving = true;
//          self.moveOrientation = o;
          p.orientation = o;
          p.keyMove = true;
          return;
        };
        //if (delay <= 0)
          execMove(this);
        //else
          //this.moving_timeout = setTimeout(execMove, delay);
    }
    else if (state === 0) {
      /*if (!(this.sx === x && this.sy === y)) {
        try { throw new Error(); } catch (e) { console.error(e.stack); }
      }*/

      //this.startMoveTime = time;
      this.ex = x;
      this.ey = y;
      var a = (x === this.x && y === this.y);
      var b = (this.sx === x && this.sy === y);

      if (a || b) {
        //console.info("player.move: this.moving_timeout cleared.");
        //clearTimeout(this.moving_timeout);
        this.fixMove(x,y);
        console.info("player.move, resetMove - x:"+x+", y:"+y);
        console.info("player.move, resetMove - this.x:"+this.x+", this.y:"+this.y);
        return;
      }

      // If a stop is recieved before the movement completes,
      // validate the path, and if it's legal fix then stop.
      if ((this.x === x && this.y !== y) || (this.x !== x && this.y === y)) {
        var path = [[this.x,this.y],[x,y]];
        if (this.isValidGridPath(path, this.startMoveTime)) {
          this.fixMove(x, y);
        }
        return;
      }

      console.warn("player.move: not stopping.");
      console.warn("player.move, stop - x:"+x+", y:"+y);
      console.warn("player.move, stop - this.x:"+this.x+", this.y:"+this.y);
    }
  },

/* ITEM STORE FUNCTIONS */
  getStoredItem: function (type, slot, count) {
    var store = this.itemStore[type];

    var rooms = store.rooms;

    //console.info("inventory: "+JSON.stringify(this.player.inventory.rooms[index]));
    if (slot < 0 || slot >= rooms.length)
      return null;

    var item = rooms[slot];
    if (!item)
      return;

    var count2 = rooms[slot].itemNumber;
    if(ItemTypes.isLootItem(item.itemKind) || ItemTypes.isConsumableItem(item.itemKind)) {
      if (count > 0 && count2 > 0 && count2 < count)
          item = store.takeOutItems(slot, count2);
    }
    return item;
  },

  swapItem: function (slot, slot2) {
    //console.info(JSON.stringify(slot));
    //console.info(JSON.stringify(slot2));
    var store1 = this.itemStore[slot[0]];
    var store2 = this.itemStore[slot2[0]];
    var room1 = store1.rooms;
    var rs1 = room1[slot[1]];
    if (!rs1)
      return;

    // if equipment and item is equipment set the correct index.
    if (slot2[0] === 2 && rs1) {
      slot2[1] = store2.getItemTypeIndex(rs1);
    }

    var room2 = store2.rooms;
    var rs2 = null;
    if (slot2[1] >= 0)
      rs2 = room2[slot2[1]];

    if (rs1 === rs2)
      return;

    var splitItem = function (slot, slot2, rs1)
    {
      if (slot[2] > 0 && slot[2] < rs1.itemNumber && ItemTypes.isStackedItem(rs1.itemKind))
      {
        rs1.itemNumber -= slot[2];
        store1.setItem(slot[1], rs1);
        var rs2 = Object.assign(new ItemRoom(), rs1);
        rs2.itemNumber = slot[2];
        store2.setItem(slot2[1], rs2);
        return true;
      }
      return false;
    };

    if (rs2)
    {
      if (!store2.combineItem(rs1, rs2)) {
        var tmp = rs2;
        if (store2.checkItem(slot2[1], rs1) && store1.checkItem(slot[1], rs2))
        {
          store2.setItem(slot2[1], rs1);
          store1.setItem(slot[1], rs2);
        }
      }
    }
    else if (slot2[1] >= 0) {

      if (!splitItem(slot, slot2, rs1)) {
        if (store2.setItem(slot2[1], rs1))
          store1.setItem(slot[1], null);
      }
    }
    else {
      if (store2.putItem(rs1) !== -1)
        store1.setItem(slot[1], null);
    }

    if((slot && slot[0] === 2 && slot[1] === 4) ||
       (slot2 && slot2[0] === 2 && slot2[1] === 4))
    {
      this.broadcastSprites();
    }
  },

  broadcastSprites: function () {
    var s1 = this.getSprite(0);
    this.setSprite(0, s1);
    var s2 = this.getSprite(1);
    this.setSprite(1, s2);
    this.packetHandler.broadcast(new Messages.setSprite(this, s1, s2), false);
  },

  handleStoreEmpty: function (slot, item) {
    var kind = item.itemKind;
    var store = this.itemStore[slot[0]];
    var index = slot[1];
    var count = slot[2];

    if (slot[0] === 2) {
      console.error("handleStoreEmpty - Cannot empty equipment store.");
      return;
    }

    var itemRoom = store.rooms[slot[1]];
    var newItemRoom = Object.assign(new ItemRoom(), itemRoom);
    var item = this.map.entities.createItem(newItemRoom, this.x, this.y);
    count = Utils.clamp(1, itemRoom.itemNumber, count);

    if(!ItemTypes.isEquippable(kind)) {
      item.room.itemNumber = count;
      store.takeOutItems(index, count);
    } else {
      store.makeEmptyItem(index);
    }

    this.map.entities.sendNeighbours(this, item.spawn());
    this.knownIds.push(item.id);
    this.world.loot.handleItemDespawn(item);
  },

  sendCurrentMove: function () {
    var msg = new Messages.Move(this, this.orientation, 0, this.x, this.y);
    this.map.entities.sendNeighbours(this, msg);
  },

  dropGold: function () {
    var level = this.level;
    var count = Math.ceil(Math.random() * level * 5 + level);
    count = Math.min(count, this.gold[0]);
    this.modifyGold(-count);
    return count;
  },

  respawn: function () {
    this.isDead = false;
    //this.isDying = false;
    this.freeze = false;
    //this.hasEnteredGame = true;
    this.resetBars();

  },

  setPosition: function (x, y) {
    //console.info("setPosition - x:"+x+",y:"+y);
    //try { throw new Error(); } catch (e) { console.info(e.stack); }
    this._super(x,y);

    if (this.holdingBlock)
    {
      var pos = this.getTilePositionNextTo();
      this.holdingBlock.setPosition(pos[0], pos[1]);
    }
  },

  isInScreen: function (pos) {
    return (~~(Math.abs(this.x - pos[0])/G_TILESIZE) <= ~~(G_SCREEN_WIDTH/2) &&
            ~~(Math.abs(this.y - pos[1])/G_TILESIZE) <= ~~(G_SCREEN_HEIGHT/2));
  },

  hasWeaponType: function (type) {
    type = type || "any";
    if (type === "any")
        return true;

    var weapon = this.equipment.getWeapon();
    if (!weapon)
      return false;

    if (type) {
      return this.getWeaponType() === type;
    }
    return ItemTypes.isHarvestWeapon(weapon.itemKind);
  },

  getWeaponType : function () {
    var weapon = this.equipment.getWeapon();
    if (!weapon)
      return null;
    return ItemTypes.getType(weapon.itemKind);
  },

  // type 0=Armor, 1=Weapon
  setSprite: function (type, id) {
    if (type === 0) {
      if (this.isArcher())
        this.sprites[2] = id;
      else
        this.sprites[0] = id;
    }
    else if (type === 1)
    {
      if (this.isArcher())
        this.sprites[3] = id;
      else
        this.sprites[1] = id;
    }
  },

  // type 0=Armor, 1=Weapon
  getSprite: function (type) {
    var item = null;
    if (type === 1) {
      item = this.equipment.getWeapon();
      if (item) {
        return ItemTypes.getSpriteCode(item.itemKind);
      } else {
        if (this.isArcher())
          return 50;
        else
          return 0;
      }
    }
    else if (type === 0) {
      if (this.isArcher())
        return this.sprites[2];
      else
        return this.sprites[0];
    }
  },

  _harvest: function (x, y, callback, duration) {
    var p = this;

    var valid = p._checkHarvest(x, y);
    if (!valid) {
      p._abortHarvest(x, y);
      return;
    }

    var px = p.x, py = p.y;
    var type = p.getWeaponType();

    p.isHarvesting = true;

    var exp = this.stats.exp.logging;
    if (type === "hammer")
      exp = this.stats.exp.mining;

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
    var p = this;
    if (!p.isNextTooPosition(x,y))
      return false;

    if (!p.hasWeaponType())
      return false;

    return true;
  },

  onHarvestEntity: function (entity) {
    var self = this;
    var res = true;

    /*var type = this.getWeaponType();
    if (!type) {
      res = false;
    }*/
    var type = entity.weaponType;
    if (!this.hasWeaponType(type)) {
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
    var p = this;
    p.map.entities.sendNeighbours(p, new Messages.Harvest(p, 2, x, y));
    p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_INVALID"));
  },

  onHarvest: function (x, y) {
    var p = this;
    var gp = Utils.getGridPosition(x,y);

    time = p.map.entities.harvest[gp.gx + "_" + gp.gy];

    var res = true;
    var type = p.getWeaponType();
    if (!type) {
      res = false;
    }
    if (!this.map.isHarvestTile(gp, type)) {
      p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_WRONG_TYPE", type));
      res = false;
    }

    if (time && (Date.now() - time) < 60000) {
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
      if (p.inventory.hasRoom()) {
        var kind;
        if (p.getWeaponType() === "axe")
          kind = 320;
        var item = new ItemRoom([kind, 1, 0, 0]);
        if (self.inventory.putItem(item) === -1)
          return;
        var data = ItemTypes.getData(item.itemKind);
        p.sendPlayer(new Messages.Notify("CHAT", "HARVEST_ADDED", data.name));
      }
    }, duration);
  },

  resetMove: function (x,y) {
    try { throw new Error(); } catch(err) { console.error(err.stack); }
    this.fixMove(x,y);
    this.sendCurrentMove();
  },

  fixMove: function (x,y) {
    //try { throw new Error(); } catch(err) { console.warn(err.stack); }
    //this.interrupted = false;
    this.forceStop();
    this.setPosition(x, y);
  },

  sendPlayer: function (msg) {
    this.map.entities.sendToPlayer(this, msg);
  },

  sendToPlayer: function (player, msg) {
    this.map.entities.sendToPlayer(player, msg);
  },

  onKilled: function (callback) {
    this.on_killed_callback = callback;
  },

  onTeleport: function (callback) {
    this.on_teleport_callback = callback;
  },

  handleTeleport: function () {
      if (this.on_teleport_callback)
        this.on_teleport_callback();
  },

  hasMoveThrottled: function (delay) {
    if ((Date.now() - this.lastMoveThrottle) < delay)
      return true;

    this.lastMoveThrottle = Date.now();

    return false;
  },

  getXP: function () {
    return 20 * this.level;
  },

  setMap: function (map) {
    this.map.entities.removeSpatial(this);
    //this.packetHandler.setMap(map);
    this.map = map;
  },

  forceStop: function() {
    this.orientation = 0;
    this._forceStop();
    this.keyMove = false;

    this.sx = this.x;
    this.sy = this.y;

    this.ex = -1;
    this.ey = -1;
  },

  modHp: function (hp) {
    if (this.isDead)
      return;

    var msg = this._super(hp);
    this.sendChangePoints(hp, 0);
    return msg;
  },

  modEp: function (ep) {
    var msg = this._super(ep);
    this.sendChangePoints(0, ep);
    return msg;
  },

  getSubPath: function (x,y) {
    x = x || this.x;
    y = y || this.y;

    var path = this.map.entities.pathfinder.getSubPath(this.path, x, y);
    return path;
  },

  interruptPath: function (x, y) {
    if (this.isMovingPath()) {
      //p.abort_pathing_callback(x, y);
      this.setPosition(x,y);
      this.interrupted = true;
      this.forceStop();
    }
  },

  isValidGridPath: function (path, time) {
    var pathfinder = this.map.entities.pathfinder;
    if (!pathfinder.isValidPath(path)) {
      console.warn("isValidGridPath: isValidPath false.");
      this.resetMove(this.x,this.y);
      return false;
    }

    if (!pathfinder.isValidGridPath(this.map.grid, path, true)) {
      console.warn("handleMovePath: no valid path.");
      this.resetMove(this.x,this.y);
      return false;
    }

    console.info("player - isValidGridPath: "+JSON.stringify(path));
    if (time) {
      var dist = pathfinder.getPathDistance(path);
      if (pathfinder.isDistanceTooFast(this.tick, dist, time)) {
        console.warn("handleMovePath: no valid path.");
        this.resetMove(this.x,this.y);
        return false;
      }
    }

    return true;
  }

});
