
/* global require, module, log, databaseHandler */
var Character = require('./character'),
    Messages = require("../message"),
    Formulas = require("../formulas"),
    Party = require("../party"),
    Bank = require("../items/bank"),
    Equipment = require("../items/equipment"),
    Inventory = require("../items/inventory"),
    SkillHandler = require("../skillhandler"),
    SkillEffectHandler = require("../effecthandler"),
    PacketHandler = require("../packethandler"),

    Quest = require("../quest");

module.exports = Player = Character.extend({
    init: function(world, user, connection) {
        var self = this;

        this.user = user;
        //this.main = worldServer;
        //this.server = main;
        //this.userHandler = worldServer.userHandler;
        this.world = world;
        this.server = world;
        //this.connection = connection;
        //this.worldHandler = this.connection.worldHandler;

        this.map = this.world.maps[0];

        this._super(connection.id, Types.EntityTypes.PLAYER, 1, 0, 0, this.map, 0);

        this.mapStatus = 0;
        this.mapIndex = 0;
        this.quests = [];
        this.gold = new Array(2);
        this.skillSlots = [];

        this.hasLoggedIn = false;
        this.hasEnteredGame = false;
        this.isDead = false;
        //this.haters = {};
        //this.lastCheckpoint = null;
        //this.formatChecker = new FormatChecker();
        //this.friends = {};
        //this.ignores = {};

        this.inventory = null;
        this.bank = null;
        this.equipment = null;
        this.itemStore = new Array(3);

        // New sub-stats
        this.exp = {
          base: 0,
          attack: 0,
          defense: 0,
          move: 0};

        this.level = {
          base: 0,
          attack: 0,
          defense: 0,
          move: 0};

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
          epMax: 0
        };
        this.mod = {
          attack: 0,
          defense: 0,
          damage: 0,
          health: 0
        };

        this.cooltimeTimeout = null;
        this.consumeTimeout = null;
        this.skillHandler = new SkillHandler(this);


        //this.hasFocus = true;
        this.moveSpeed = 500;
        this.setMoveRate(this.moveSpeed);

        this.attackedTime = new Timer(1000);
        this.attackQueue = [];
        this.moveQueue = [];
        this.stopQueue = [];

        //this.pClass = 0;

        this.attackSkill = [];
        this.attackTimer = 0;

        this.idleTimer = new Timer(300000);

    		this.playerController = new PlayerController(this);

      	this.onWelcomeReady = false;

      	this.tut = {};
      	this.tut.move = false;
      	this.tut.portal = false;
      	this.tut.attack = false;
      	this.tut.attack2 = false;
      	this.tut.buy = false;
      	this.tut.buy2 = false;
      	this.tut.equip = false;
      	this.tut.stats = false;

      	this.spawnsList = {};

      	this.lastAction = Date.now();

        this.knownIds = [];

        this.sx = 0;
        this.sy = 0;
        this.ex = -1;
        this.ey = -1;

        this.moveOrientation = 0;

        /*this.savedPlayer = false;
        this.savedQuests = false;
        this.savedInventory = false;
        this.savedEquipment = false;
        this.savedBank = false;*/
        this.savedAll = false;
        this.savedSection = 0;

        this.achievements = [];
        this.completeQuests = {};

        this.damageCount = {};
        this.dealtCount = {};
        this.pStats = [];
        this.sprites = [];
        this.colors = [];

        this.shortcuts = {};

        this.loaded = 0;
    },

    start: function (connection) {

      this.worldHandler = connection.worldHandler;
      this.connection = connection;
      this.id = connection.id;

      this.packetHandler = new PacketHandler(this.user, this, connection, this.world, this.map);
      this.packetHandler.loadedPlayer = true;

      this.sendPlayerToClient();
    },

    destroy: function() {
      var self = this;
    },

    getState: function() {
      var basestate = this._getBaseState();
      var sprite1 = this.getSprite(0), sprite2 = this.getSprite(1);

      var state = [this.level.base,
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
      this.resetHP();
      this.resetEP();
      this.map.entities.pushNeighbours(this, new Messages.ChangePoints(this, 0, 0));
    },

    questAboutKill: function(mob, quest) {
      var mobKind = mob.kind, mobLevel = mob.level;

      var a = (quest.count < quest.object.count);
      var b = (quest.type == QuestType.KILLMOBKIND && a && (mobKind == quest.object.kind));
      var c = (quest.type == QuestType.KILLMOBS && a);
      var d = (mob.level >= quest.object.level[0] && mob.level <= quest.object.level[1]);
      if((b || c) && d)
      {
          console.info("_questAboutKill - conditions met.")
          quest.data1 += ~~(mob.stats.xp / 1.5);
          if(++quest.count == quest.object.count) {
              this.questAboutKillComplete(quest);
          }
          else {
              this.progressQuest(quest);
          }
      }
    },

    questAboutUseNode: function(quest) {
      quest.count++;
      if(quest.count >= quest.object.count) {
        quest.count = quest.object.count;
        var xp = quest.object.count * 10 * this.level.base;
        this.completeQuest(quest, xp);
      } else {
        this.progressQuest(quest);
      }
    },

    questAboutItem: function(quest) {
        console.info(JSON.stringify(quest));
        var kind = quest.object2.kind+1000;
        var countItems = this.inventory.hasItemCount(kind);
        quest.count = countItems;
        this.progressQuest(quest);
    },

    questAboutFind: function(quest) {
        //console.info(JSON.stringify(quest));
        if(quest.count++ >= quest.object.count && quest.status == QuestStatus.INPROGRESS) {
          quest.count = quest.object.count;
          var xp = quest.object.count * 10 * this.level.base;
          this.completeQuest(quest, xp);
        }
    },

    questAboutItemComplete: function(quest, callback){

        if(quest.count >= quest.object2.count && quest.status==QuestStatus.INPROGRESS) {
          var kind = quest.object2.kind+1000;
          if(!this.inventory.hasItemCount(kind))
              return;

          this.inventory.removeItemKind(kind, quest.object2.count);
          var xp = quest.object2.count * 20 * this.level.base;
          this.completeQuest(quest, xp);
          if (callback)
            callback(quest);
          return true;
        }
        return false;
    },

    questAboutKillComplete: function (quest) {
      console.info("_questAboutKill - completed.");
      var xp = quest.data1;
      quest.status = QuestStatus.COMPLETE;
      this.completeQuest(quest, xp);
    },

    progressQuest: function (quest) {
      quest.status = QuestStatus.INPROGRESS;
      this.pushToPlayer(new Messages.Quest(quest));
    },

    completeQuest: function(quest, xp) {
      if (xp > 0) {
        this.incExp(xp);
        this.pushToPlayer(new Messages.Stat(1, this.exp.base, xp));
      }

      quest.status = QuestStatus.COMPLETE;
      this.pushToPlayer(new Messages.Quest(quest));
      this.completeQuests[quest.id] = quest.npcQuestId;
      this.quests.splice(this.quests.indexOf(quest), 1);
      delete quest;
    },

    foundQuest: function(quest){
    	  //console.info("foundQuest="+questId);
        this.quests.push(quest);
        quest.status = QuestStatus.STARTED;
        this.pushToPlayer(new Messages.Quest(quest));
    },

    hasNpcCompleteQuest: function (npcQuestId) {
      var q = null;
      for (var qid in this.completeQuests) {
        q = this.completeQuests[qid];
        if (q == npcQuestId)
          return true;
      }
      return false;
    },

    getQuestById: function (id) {
      for (var q of this.quests) {
        if (q.id == id) {
          return q;
        }
      }
      return null;
    },

    hasQuest: function (id) {
      for (var q of this.quests) {
        if (q.id == id) {
          return true;
        }
      }
      return false;
    },

    onKillEntity: function (entity) {
      var damage = entity.damageCount.hasOwnProperty(this.id) ? entity.damageCount[this.id] : 0;
      var dealt = entity.dealtCount.hasOwnProperty(this.id) ? entity.dealtCount[this.id] : 0;
      var ratio = (damage / entity.stats.hpMax);

      var xp = ~~(entity.stats.xp * ratio);
      var diff = 10;
      var div = 1/diff;
      var mod = 1 + div + Utils.clamp(-diff,diff,(entity.level - this.level.base)) * div;
      var xp = ~~(xp * mod);
      this.incExp(xp);
      this.incWeaponExp(~~(xp / 10));
      this.map.entities.pushToPlayer(this, new Messages.Stat(1, this.exp.base, xp));

      var weaponSlot = 4;
      var armorDamage = Math.min(5, Math.ceil(dealt / 1000));
      log.warn("armorDamage:" + armorDamage);
      for (var it in this.equipment.rooms) {
        if (it == weaponSlot)
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
      var weaponDamage = Math.min(5, Math.ceil(damage / 1000));
      if (weaponDamage > 0)
      {
          if (this.equipment.degradeItem(weaponSlot, 1))
            this.equipment.addExperience(weaponSlot, weaponDamage);
      }
      //target.addWeaponExp(target.weaponDamage);
      this.weaponDamage = 0;

      this.damageCount[entity.id] = 0;
      this.dealtCount[entity.id] = 0;
    },

    onDamage: function (attacker, hpMod, epMod, crit, effects) {
      var hp = this.stats.hp;
      var dmgRatio = (hpMod / this.stats.hpMax);
      log.info("dmgRatio: "+dmgRatio)
      this._super(attacker, hpMod, epMod, crit, effects);
      var hpDiff = hp - this.stats.hp;
      if (hpDiff > 0) {
        console.info ("onDamage hpMod:"+hpMod)
        attacker.onHitEntity(this, hpDiff);
        this.onHitByEntity(attacker, hpDiff);
      }
    },

    onHitEntity: function (target, dmg) {
      if (!this.dealtCount.hasOwnProperty(target.id))
        this.dealtCount[target.id] = 0;
      this.dealtCount[target.id] += dmg;
    },

    onHitByEntity: function (target, dmg) {
      if (!this.damageCount.hasOwnProperty(target.id))
        this.damageCount[target.id] = 0;
      this.damageCount[target.id] += dmg;
    },

    incExp: function (gotexp)
    {
      var incExp = parseInt(gotexp);

      incExp = Math.ceil(incExp * this.getExpBonus());

      this.exp.base = parseInt(this.exp.base) + parseInt(incExp);
      var origLevel = this.level.base;
      this.level.base = Types.getLevel(this.exp.base);
      if(origLevel !== this.level.base) {
      	this.levelUp();
      }
      return incExp;
    },

    incAttackExp: function(gotexp){
    	var incExp = parseInt(gotexp);

  		incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

    	this.exp.attack = parseInt(this.exp.attack) + parseInt(incExp);
      var origLevel = this.level.attack;
      this.level.attack = Types.getAttackLevel(this.exp.attack);
      if(origLevel !== this.level.attack) {
      	this.pushToPlayer(new Messages.LevelUp(2, this.level.attack, this.exp.attack));
      }
      return incExp;
    },

    incDefenseExp: function(gotexp){
    	var incExp = parseInt(gotexp);

		  incExp = Math.ceil(incExp * this.getExpBonus());

    	this.exp.defense = parseInt(this.exp.defense) + parseInt(incExp);

      var origLevel = this.level.defense;
      this.level.defense = Types.getDefenseLevel(this.exp.defense);
      if(origLevel !== this.level.defense) {
      	this.pushToPlayer(new Messages.LevelUp(3, this.level.defense, this.exp.defense));
      }
      return incExp;
    },

    incMoveExp: function(gotexp){
    	var incExp = parseInt(gotexp);

	    incExp = Math.ceil(incExp * this.getExpBonus());

  	  this.exp.move = parseInt(this.exp.move) + parseInt(incExp);

      var origLevel = this.level.move;
      this.level.move = Types.getMoveLevel(this.exp.move);
      if(origLevel !== this.level.move) {
      	this.pushToPlayer(new Messages.LevelUp(4, this.level.move, this.exp.move));
      	//this.setMoveRate(300-this.level.move);
      }
      return incExp;
    },

    incWeaponExp: function(gotexp){
    	var incExp = parseInt(gotexp);

  		incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

      var type = this.getWeaponType();
      if (!this.exp.hasOwnProperty(type))
        return null;

      var xp = parseInt(this.exp[type]);
      var plvl = Types.getWeaponLevel(xp);
      xp = xp + incExp;
      var clvl = Types.getWeaponLevel(xp);
      this.exp[type] = xp;
      if(plvl !== clvl) {
        var types = {
          10: "sword",
          11: "bow",
          12: "hammer",
          13: "axe",
        }
        this.pushToPlayer(new Messages.LevelUp(types[type], clvl, xp));
      }
      return incExp;
    },

    getExpBonus: function ()
    {
      var bonus = 1;
      if (this.party)
      {
        for (var player of this.party.players) {
          if (this.isInScreen([player.x,player.y]))
          {
            bonus += 0.1 * this.party.players.length;
          }
        }
      }
      return bonus;
    },

    levelUp: function () {
	    if (this.level.base < 10)
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
    	this.pushToPlayer(new Messages.StatInfo(this));

	    this.resetBars();
	    this.pushToPlayer(new Messages.ChangePoints(this, 0, 0));
	    this.pushToPlayer(new Messages.LevelUp(1, this.level.base, this.exp.base));

	    if (this.level.base == 10)
        {
        	// TODO update checks.
        	this.tutChat("TUTORIAL_SHOPBUY", 4, "buy");
        	this.tutChat("TUTORIAL_SHOPBUY2", 6, "buy2");
        }
	    if (this.level.base == 20)
        {
        	this.tutChat("TUTORIAL_STATS", 2, "stats");
        }
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
          self.exp.base,
          self.exp.attack,
          self.exp.defense,
          self.exp.move,
          self.exp.sword,
          self.exp.bow,
          self.exp.hammer,
          self.exp.axe,
          self.exp.logging,
          self.exp.mining,
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
      var quests = self.quests.filter(function (q) { return q.status !== QuestStatus.COMPLETE; });
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
      //self.skillHandler.setSkills(self, db_player.skills);
      self.effectHandler = new SkillEffectHandler(self);
      sendMessage.push(self.skills.length);
      for(var i=0; i < self.skills.length; ++i) {
        sendMessage.push(parseInt(self.skills[i].skillXP));
      }

      // Send load Skill slots.
      //self.shortcuts = db_player.shortcuts;
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
        //console.info(JSON.stringify(sendMessage));
        //self.send(sendMessage);
        self.connection.sendUTF8(sendMessage.join(","));

        self.hasEnteredGame = true;

      }
    },

// TODO - Fill db_player variable assignments.
    fillPlayerInfo: function(db_player)
    {
        var self = this;
        self.mapIndex = parseInt(db_player.map[0]);
        self.map =  self.server.maps[self.mapIndex];
        self.x = parseInt(db_player.map[1]);
        self.y = parseInt(db_player.map[2]);
        self.orientation = parseInt(db_player.map[3]);

        if (db_player.sprites.length == 2) {
          db_player.sprites[2] = 151;
          db_player.sprites[3] = 50;
        }
        self.sprites = db_player.sprites.parseInt();
        self.colors = db_player.colors;

        self.exp.base = parseInt(db_player.exps[0]);
        self.exp.attack = parseInt(db_player.exps[1]);
        self.exp.defense = parseInt(db_player.exps[2]);
        self.exp.move = parseInt(db_player.exps[3]);
        if (db_player.exps.length >= 8)
        {
          self.exp.sword = parseInt(db_player.exps[4]);
          self.exp.bow = parseInt(db_player.exps[5]);
          self.exp.hammer = parseInt(db_player.exps[6]);
          self.exp.axe = parseInt(db_player.exps[7]);
        }
        else {
          self.exp.sword = 0;
          self.exp.bow = 0;
          self.exp.hammer = 0;
          self.exp.axe = 0;
        }
        if (db_player.exps.length == 10)
        {
          self.exp.logging = parseInt(db_player.exps[8]);
          self.exp.mining = parseInt(db_player.exps[9]);
        } else {
          self.exp.logging = 0;
          self.exp.mining = 0;
        }

        self.level.base = Types.getLevel(self.exp.base);
        self.level.attack = Types.getAttackLevel(self.exp.attack);
        self.level.defense = Types.getDefenseLevel(self.exp.defense);
        self.level.move = Types.getMoveLevel(self.exp.move);

        //self.pClass = parseInt(db_player.pClass);
        //self.setClass(self.pClass);

        self.gold[0] = parseInt(db_player.gold[0]);
        self.gold[1] = parseInt(db_player.gold[1]);

        self.isDead = false;

    		self.pStats = db_player.pStats.parseInt();

        if (self.level.base < 10)
    		{
          var l = parseInt(self.level.base);
    			self.stats.attack = l*2;
    			self.stats.defense = l*2;
    			self.stats.health = l*2;
    			self.stats.energy = l*2;
    			self.stats.luck = l*2;
    			self.stats.free = 0;
    		}
        else {
          db_player.stats = db_player.stats.parseInt();
          self.stats.attack = db_player.stats[0];
          self.stats.defense = db_player.stats[1];
          self.stats.health = db_player.stats[2];
          self.stats.energy = db_player.stats[3];
          self.stats.luck = db_player.stats[4];
          self.stats.free = db_player.stats[5];
        }

        if (db_player.completeQuests)
          self.completeQuests = (db_player.completeQuests) ? db_player.completeQuests : {};
        //self.stats.hpMax = self.getHpMax();
        //self.stats.epMax = self.getEpMax();
        self.setHP();
        self.setEP();

    		//console.info("self.stats.health="+self.stats.health);
    		self.resetBars();
    		//console.info("self.stats.hp="+self.stats.hp);
    		self.setMoveRate(500-self.level.move);

        if (db_player.skills.length == 1) {
          for(var i =0; i < SkillData.Skills.length; ++i)
            db_player.skills[i] = 0;
        }
        self.skillHandler.setSkills(self, db_player.skills);

        // Needs to convert shortcut into optimum data structure while
        // remaining compatibiltity with old structures.
        if (Array.isArray()) {
          for (var shortcut of db_player.shortcuts)
          {
            if (shortcut)
              self.shortcuts[shortcut[0]] = shortcut;
          }
        } else {
          for (var sid in db_player.shortcuts)
          {
            var shortcut = db_player.shortcuts[sid];
            if (shortcut)
              self.shortcuts[sid] = shortcut;
          }
        }

        self.attackTimer = Date.now();
        self.server.connect_callback(self);

        //console.info("playerId: "+self.id);
    },

    tutChat: function(text, delay, check) {
		var self = this;
		var tutCheck = check;
    	setTimeout(function () {
    		if (self.map && self.map.entities &&
    			self.mapStatus >= 2 && self.tut[tutCheck] == false)
  			{
  				self.pushToPlayer(new Messages.Notify("TUTORIAL", text));
  				self.tut[tutCheck] = true;
  			}
  		},delay*5000);
    },

    handleInventoryEat: function(item, slot){
      var self = this;
      var kind = item.itemKind;

      if(this.consumeTimeout){
          return;
      } else{
          this.consumeTimeout = setTimeout(function(){
              self.consumeTimeout = null;
          }, 4000);
      }

      var amount;

      var itemData = ItemTypes.KindData[kind];

      if (itemData.typemod == "health")
      {
    		amount = itemData.modifier;
    		if(!this.hasFullHealth()) {
    			this.modHealthBy(amount);
    		}
      }
      else if (itemData.typemod == "healthpercent")
      {
      	amount = ~~(this.stats.hpMax * itemData.modifier/100);
    		if(!this.hasFullHealth()) {
    			this.modHealthBy(amount);
    		}
      }
      if (itemData.typemod == "energy")
      {
    		amount = itemData.modifier;
    		if(!this.hasFullEnergy()) {
    			this.modEnergyBy(amount);
    		}
      }
      this.inventory.takeOutItems(slot, 1);
    },

  modHealthBy: function (hp) {
    if (this.isDead)
      return;

    var msg = this._super(hp);
    this.sendChangePoints(hp, 0);
    return msg;
  },

  modEnergyBy: function (ep) {
    var msg = this._super(ep);
    this.sendChangePoints(0, ep);
    return msg;
  },

  sendChangePoints: function (health, energy) {
    this.map.entities.pushNeighbours(this, new Messages.ChangePoints(this, health, energy));
  },

  getHPMax: function () {
  	var hp = 300 + (this.stats.health * 50) + (this.stats.health * this.stats.health);
    return hp;
  },

  getEPMax: function () {
  	var ep = 500 + (this.stats.energy * 50);
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
    return Types.getWeaponLevel(this.exp[weaponData.type]);
  },

  /*addWeaponExp: function (damage) {
    var weapon = this.equipment.rooms[4];
    if (!weapon)
      return;
    var weaponData = ItemTypes.KindData[weapon.itemKind];
    this.exp[weaponData.type] += ~~(damage / 100);

    var xp = this.exp[weaponData.type];
    var types = {
      "sword":10,
      "bow":11,
      "hammer":12,
      "axe":13,
    }
    var lvl = Types.getWeaponLevel(xp)
    if (this.level[weaponData.type] != lvl) {
      var msg = new Messages.LevelUp(types[weaponData.type], lvl, xp);
      this.pushToPlayer(msg);
    }
    this.level[weaponData.type] = lvl;
  },*/

  baseCrit: function() {
    var itemDiff = this.level.base*2;
    var item = this.getWeapon();
    if (item) {
      itemDiff = (3*ItemTypes.getData(item.itemKind).modifier)+(item.itemNumber*2);
    }
    var statDiff = this.stats.attack + (this.stats.luck*2);
    var chance = Utils.clamp(0, 500, ~~(statDiff + itemDiff));
    console.info("player - baseCrit: "+chance);
    //var chance_out = (chance / 5).toFixed(0)+"%";
    //return chance_out;
    return chance;
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
    console.info("player - baseCritDef: "+chance);
    //var chance_out = (chance / 5).toFixed(0)+"%";
    //return chance_out;
    return chance;
  },

  baseDamage: function() {
    var dealt, dmg;
    var weapon = this.getWeapon();
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

    var rangeMulti = this.isArcher() ? 0.85 : 1;
    dmg = ~~(dmg * noobMulti * rangeMulti);

    min = ~~((min + dealt)*noobMulti*rangeMulti);
    max = ~~((max + dealt)*noobMulti*rangeMulti);

    //return [min,max];
    return dmg;
  },

  baseDamageDef: function() {
    var dealt = 0, dmg = 0;

    var level = this.level.base+3;
    console.info("baseDamageDef:");

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

    console.info("dealt="+dealt);
    var power = ((this.level.defense / 50) + 1);
    console.info("power="+power);
    var min = ~~(level*power);
    var max = ~~(min*2);

    console.info("dealtrange="+dealt);
    // Players Stat affects Damage.
    var mods = (this.mod ? this.mod.defense : 0);
    dealt += ~~((this.stats.defense+mods)*3) + this.stats.luck;

    console.info("dealtstats="+dealt);

    dmg = Utils.randomRangeInt(min, max) + dealt;

    min += dealt;
    max += dealt;
    //return [min,max];
    return dmg;
  },

  modifyGold: function(gold, type) {
    type = type || 0;
    if (this.gold[type]+gold < 0)
      return false;

    this.gold[type] += parseInt(gold);

    this.pushToPlayer(new Messages.Gold(this));
    if (gold > 0)
      this.pushToPlayer(new Messages.Notify("CHAT", "GOLD_ADDED", [gold]));
    else {
      gold *= -1;
      this.pushToPlayer(new Messages.Notify("CHAT", "GOLD_REMOVED", [gold]));
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

  saveSection: function () {
    console.info("SAVING SECTION: "+this.savedSection);
    if (++this.savedSection == 6) {
      console.info("SAVED PLAYER!!!!!: "+this.name);
      this.savedSection = 0;
    }
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

    if (this.worldHandler)
      this.worldHandler.savePlayer(this, update);
    else {
      console.warn("Player, save called without worldHandler being set. "+JSON.stringify(msg));
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

  setHP: function (val) {
    //this.stats.hpMax = this.stats.health * 30;
    //this.stats.hpMax = this.getHpMax();
    this._super(val);
  },

  setEP: function (val) {
    //this.stats.epMax = this.stats.energy * 30;
    //this.stats.ep = this.getEPMax();
    this._super(val);
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
      //return;
    }

    this.sx = this.x;
    this.sy = this.y;
    this.ex = this.x2;
    this.ey = this.y2;

    /*if (!(this.x == x && this.y == y)) {
      console.warn("movePath - Start Position not correct!");
      console.info("movePath - x:"+x+",y:"+y+",p.x:"+this.x+",p.y:"+this.y);
    }*/
    this.forceStop();
    //this.setPosition(x,y);
    orientation = this.getOrientationTo({x: path[1][0], y: path[1][1]});
    this.setOrientation(orientation);
    this.path = this.fullpath = path;
    this.step = 0;
    this.interrupted = interrupted;
    //this.estDelay = Date.now() - time;
    //this.startMovePathTime = Date.now();
    var delay = Utils.getLockDelay(time);
    //var delay=~~((Date.now()+G_UPDATE_INTERVAL)-(G_LATENCY + time));
    //this.unclampedDelay = delay;
    //delay=Utils.clamp(0, G_LATENCY, delay);
    //this.latencyDiff = Date.now() - time;
    this.startMovePathTime = time;
    console.warn("time:"+time+",now:"+Date.now()+",diff:"+(Date.now()-time));
    //var delay=Utils.clamp(0, G_LATENCY, G_LATENCY+(time-Date.now()));
    console.warn("movePath: delay:"+delay);

    if (delay > 0)
      this.setFreeze(delay, function (p) {
        //p.startMovePathTime = Date.now();
        /*if (!(p.x == x && p.y == y))
        {
          console.error("PLAYER NOT IN CORRECT POSITION");
          console.info("p.x:"+p.x+",p.y:"+p.y);
          console.info("c.x:"+x+",c.y:"+y);
          p.resetMove(p.x,p.y);
          return;
        }*/
      });
  },

  move: function (nm) {
    var p = self = this;

    //nm = self.nextMove;
    if (!nm)
      return;

    var time=nm[0], state=nm[1], o=nm[2], x=nm[3], y=nm[4];
    console.info("nm:"+JSON.stringify(nm));

    if (this.isMovingPath()) {
      //entity.stopInPath(x,y);
      return;
    }

    this.idleTimer.restart();

    if (this.moving_callback)
    {
      clearTimeout(this.moving_callback);
      this.moving_callback = null;
    }

    if (state == 3) {
      this.moveOrientation = 0;
      this.sx = x;
      this.sy = y;
      this.ex = -1;
      this.ey = -1;
      this.keyMove = false;
      this.setPosition(x,y);
      this.nextMove = null;
      return;
    }

    if (state==1) {
        var delay = Utils.getLockDelay(time);
        console.warn("delay="+delay);
        //var delay=Math.max(~~((G_LATENCY + time)-(Date.now()+G_UPDATE_INTERVAL)),0);
        //this.latencyDiff = Date.now() - time;
        //this.startMoveTime = time + delay;
        this.sx = this.x;
        this.sy = this.y;
        this.ex = -1;
        this.ey = -1;
        this.startMoveTime = time;
        console.warn("time:"+time+",now:"+Date.now()+",diff:"+(Date.now()-time));

        var execMove = function () {
          if (self.movement.inProgress) {
            self.forceStop();
          }
          self.moving_timeout = null;
          self.startMoving = true;
          self.moveOrientation = o;
          self.keyMove = true;
          //self.startMoveTime = Date.now();
          //self.startMoveSysTime = Date.now() + delay;
          return;
        };
        if (delay <= 0)
          execMove();
        else
          this.moving_timeout = setTimeout(execMove, delay);

        this.nextMove = null;

    }

    if (state == 0) {
      console.info("move - x: "+x+", y: "+y);
      //try { throw new Error(); } catch(err) { console.info(err.stack); }
      this.ex = x;
      this.ey = y;
      var a = (x == this.x && y == this.y);
      var b = (this.sx == x && this.sy == y);
      //var c = (this.nsx == x && this.nsy == y);

      console.info("move: x="+x+",y="+y);
      console.info("move: this.x="+this.x+",this.y="+this.y);
      console.info("move: this.sx="+this.sx+",this.sy="+this.sy);
      //console.info("move: this.nsx="+this.nsx+",this.nsy="+this.nsy);

      if (a || b) {
        clearTimeout(this.moving_timeout);
        this.setPosition(x,y);
        this.forceStopMove();
        return;
      }

      var path = [[this.sx,this.sy],[x,y]];
      if(!this.map.entities.pathfinder.isValidPath(this.map.grid, path)) {
        console.warn("INVALID PATH.");
        console.warn("invalidPath: "+JSON.stringify(path));
        this.setPosition(this.x,this.y);
        this.forceStopMove();
      }

      //var tMoves = [[this.sx,this.sy],[x,y]];
      if (this.map.entities.pathfinder.isPathTicksTooFast(this, path, this.startMoveTime))
      {
        this.setPosition(this.sx,this.sy);
      } else {
        this.setPosition(x,y);
      }
      this.forceStopMove();
      this.keyMove = false;
      this.nextMove = null;
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
    console.info(JSON.stringify(slot));
    console.info(JSON.stringify(slot2));
    var store1 = this.itemStore[slot[0]];
    var store2 = this.itemStore[slot2[0]];
    var room1 = store1.rooms;
    var rs1 = room1[slot[1]];
    if (!rs1)
      return;

    // if equipment and item is equipment set the correct index.
    if (slot2[0] == 2 && rs1) {
      slot2[1] = store2.getItemTypeIndex(rs1);
    }

    var room2 = store2.rooms;
    var rs2 = null;
    if (slot2[1] >= 0)
      rs2 = room2[slot2[1]];

    if (rs1 == rs2)
      return;

    if (rs2)
    {
      if (!this.inventory.combineItem(rs1, rs2)) {
        var tmp = rs2;
        if (store2.checkItem(slot2[1], rs1) && store1.checkItem(slot[1], rs2))
        {
          store2.setItem(slot2[1], rs1);
          store1.setItem(slot[1], rs2);
        }
      }
    }
    else if (slot2[1] >= 0) {
      if (store2.setItem(slot2[1], rs1))
        store1.setItem(slot[1], null);
    }
    else {
      if (store2.putItem(rs1) != -1)
        store1.setItem(slot[1], null);
    }

    if((slot && slot[0] == 2 && slot[1] == 4) ||
       (slot2 && slot2[0] == 2 && slot2[1] == 4))
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

    if (slot[0] == 2) {
      console.error("handleStoreEmpty - Cannot empty equipment store.");
      return;
    }

    var itemRoom = store.rooms[slot[1]];
    //var newItemRoom = new ItemRoom();
    //newItemRoom.assign(itemRoom);
    var newItemRoom = Object.assign(new ItemRoom(), itemRoom);
    var item = this.map.entities.createItem(newItemRoom, this.x, this.y);
    count = Utils.clamp(1, itemRoom.itemNumber, count);

    if(!ItemTypes.isEquippable(kind)) {
      item.room.itemNumber = count;
      store.takeOutItems(index, count);
    } else {
      store.makeEmptyItem(index);
    }

    this.map.entities.pushNeighbours(this, item.spawn());
    this.knownIds.push(item.id);
    this.server.handleItemDespawn(item);
  },

  sendCurrentMove: function () {
    var msg = new Messages.Move(this, this.moveOrientation, 0, this.x, this.y);
    this.map.entities.pushNeighbours(this, msg);
  },

  dropGold: function () {
    var count = Math.ceil(Math.random() * this.level.base * 5 + this.level.base);
    count = Math.min(count, this.gold[0]);
    this.modifyGold(-count);
    return count;
  },

  revive: function () {
    this.isDead = false;
    this.isDying = false;
    this.hasEnteredGame = true;
    this.resetBars();

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

  isInScreen: function (pos) {
    return (~~(Math.abs(this.x - pos[0])/G_TILESIZE) <= ~~(G_SCREEN_WIDTH/2) &&
            ~~(Math.abs(this.y - pos[1])/G_TILESIZE) <= ~~(G_SCREEN_HEIGHT/2));
  },

  hasWeaponType: function (type) {
    type = type || "any";
    if (type == "any")
        return true;

    var weapon = this.equipment.getWeapon();
    if (!weapon)
      return false;

    if (type) {
      return this.getWeaponType() == type;
    }
    return ItemTypes.isHarvestWeapon(weapon.itemKind);
  },

  getWeaponType : function () {
    var weapon = this.equipment.getWeapon();
    if (!weapon)
      return null;
    var data = ItemTypes.KindData[weapon.itemKind];
    return data.type;
  },

  // type 0=Armor, 1=Weapon
  setSprite: function (type, id) {
    if (type == 0) {
      if (this.isArcher())
        this.sprites[2] = id;
      else
        this.sprites[0] = id;
    }
    if (type == 1)
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
    if (type == 1) {
      item = this.equipment.getWeapon();
      if (item) {
        return ItemTypes.getSpriteCode(item.itemKind);
      } else {
        if (this.isArcher())
          return this.sprites[3];
        else
          return this.sprites[1];
      }
    }
    if (type == 0) {
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

    var exp = this.exp.logging;
    if (type == "hammer")
      exp = this.exp.mining;

    var durationMod = Utils.clamp(0.1, 1, (1 - Types.getSkillLevel(exp)/20));
    duration = ~~(duration * durationMod);
    clearTimeout(p.harvestTimeout);
    p.harvestTimeout = setTimeout(function () {
        var complete = true;

        if (!p.isHarvesting)
          complete = false;

        if (!(p.x == px && p.y == py))
          complete = false;

        if (!p.hasWeaponType(type))
          complete = false;

        if (!complete) {
          p._abortHarvest(x, y);
          return;
        }

        if (callback)
          callback(p);

        p.map.entities.pushNeighbours(p, new Messages.Harvest(p, 2, x, y));
    }, duration);

    p.map.entities.pushNeighbours(p, new Messages.Harvest(p, 1, x, y), p);
    p.pushToPlayer( new Messages.Harvest(p, 1, x, y, duration));
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
      this.pushToPlayer(new Messages.Notify("CHAT", "HARVEST_WRONG_TYPE", type));
      res = false;
    }

    var x= entity.x, y=entity.y;
    if (!res) {
      this._abortHarvest(x, y);
      return;
    }

    var duration = 5000 + (entity.level*1000);
    this._harvest(x, y, function (p) {
      p.server.taskHandler.processEvent(p, PlayerEvent(EventType.USE_NODE, entity, 1));

      if (type == "hammer")
        p.exp.mining += 10;
      entity.die();
      var item = p.server.getDrop(p, entity, false);
      if (item && item instanceof Item)
      {
          item.x = x;
          item.y = y;
          p.server.handleItemDespawn(item);
      }
      return;
    }, duration);
  },

  _abortHarvest: function (x,y) {
    var p = this;
    p.map.entities.pushNeighbours(p, new Messages.Harvest(p, 2, x, y));
    p.pushToPlayer(new Messages.Notify("CHAT", "HARVEST_INVALID"));
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
      p.pushToPlayer(new Messages.Notify("CHAT", "HARVEST_WRONG_TYPE", type));
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
      p.server.taskHandler.processEvent(p, PlayerEvent(EventType.HARVEST, p, 1));
      if (p.getWeaponType() == "axe")
        p.exp.logging += 10;
      p.map.entities.harvest[gp.gx + "_" + gp.gy] = Date.now();
      if (p.inventory.hasRoom()) {
        var kind;
        if (p.getWeaponType() == "axe")
          kind = 320;
        var item = new ItemRoom([kind, 1, 0, 0]);
        if (self.inventory.putItem(item) == -1)
          return;
        var data = ItemTypes.getData(item.itemKind);
        p.pushToPlayer(new Messages.Notify("CHAT", "HARVEST_ADDED", data.name));
      }
    }, duration);
  },

  resetMove: function (x,y) {
    this.forceStop();
    this.setPosition(x, y);
    this.sx = x;
    this.sy = y;
    this.sendCurrentMove();
    this.ex = -1;
    this.ey = -1;
  },

  pushToPlayer: function (msg) {
    this.map.entities.pushToPlayer(this, msg);
  }
});
