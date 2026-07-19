
/* global log, databaseHandler, QuestStatus, SkillData */
import Character from './character.js';
import Messages from "../message.js";
import SkillHandler from "../skillhandler.js";
import SkillEffectHandler from "../effecthandler.js";
import PacketHandler from "../packets/packethandler.js";
import PlayerQuests from "./components/playerquests.js";
import PlayerHarvest from "./components/playerharvest.js";
import PlayerItems from "./components/playeritems.js";
import PlayerCombat from "./components/playercombat.js";
import Timer from '../timer.js';
import Utils from '../utils.js';
import { Types, ItemTypes } from '../common.js';
import _ from 'underscore';
import SkillData from '../data/skilldata.js';
import { G_TILESIZE, G_SCREEN_WIDTH, G_SCREEN_HEIGHT, G_DEBUG } from '../main.js';

class Player extends Character {
    constructor(world, user, connection) {
        const map = world.maps[0];
        super(connection.id, Types.EntityTypes.PLAYER, 1, 0, 0, map, 0);
        const self = this;

        this.user = user;
        this.world = world;

        this.map = map;

        this.mapStatus = 0;
        this.mapIndex = 0;

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


        this.skillHandler = new SkillHandler(this);

        this.moveSpeed = 500;
        this.setMoveRate(this.moveSpeed);

        this.attackedTime = new Timer(500);
        this.attackQueue = null;

        this.attackSkill = [];
        this.attackTimer = 0;

        this.idleTimer = new Timer(300000);

        // FIX: movement (hasMoveThrottled) and attacks (attackedTime) are
        // both rate-limited, but chat had no cooldown at all -- a client
        // could send CW_CHAT as fast as the socket allowed, and every
        // message is broadcast to the whole world (sendWorld), so this was
        // an easy flood vector. 500ms mirrors the existing attack cooldown.
        this.chatCooldown = new Timer(500);

        this.quests = new PlayerQuests(this);
        this.harvest = new PlayerHarvest(this);
        this.items = new PlayerItems(this);
        this.combat = new PlayerCombat(this);

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

        this.config = {};
        this.config.screenWidth = 50;
        this.config.screenHeight = 50;
    }

    start(connection) {
      this.connection = connection;
      this.id = connection.id;

      this.packetHandler = new PacketHandler(this);
      this.packetHandler.loadedPlayer = true;

      this.world.connect_callback(this);
      this.sendPlayerToClient();
    }

    // FIX: was an empty stub. removeEntity() (map/mapentities.js) calls
    // destroy() on every entity it removes -- Mob.destroy() already uses
    // that hook to clean up its own combat state (forgetEveryone/
    // clearTarget/endEffects), but Player never did anything equivalent.
    // Since map/mapentities.js's removePlayer() (reached from every
    // disconnect, via worldserver.js's packetHandler.onExit) is the only
    // place a player is actually removed, and nothing else ever told mobs
    // attacking a departed player to let go: any mob whose target was this
    // player kept `target.isDead === false` forever (isDead is only set by
    // die(), never by disconnect) and stayed locked onto a ghost -- landing
    // "damage" that drops loot for nobody, and via mobai.js's checkAggro()
    // early-returning while hasTarget() is true, making that mob
    // permanently unavailable to aggro any real nearby player. This is not
    // a rare edge case -- "player disconnects mid-fight" (tab close,
    // connection drop) happens constantly on a live server.
    // clean() (Character, inherited) disengages/idles every attacker
    // currently targeting this player; removeTarget() releases whatever
    // this player was themselves attacking (mirroring Mob.destroy()'s own
    // clearTarget()); endEffects() stops any buffs/DOTs still active on
    // this player from continuing to tick against a now-gone entity.
    destroy() {
      this.clean();
      this.removeTarget();
      this.endEffects();
    }

    getState() {
      const basestate = this._getBaseState();
      const sprite1 = this.getSprite(0), sprite2 = this.getSprite(1);

      const state = [this.level,
        this.stats.hp,
        this.stats.hpMax,
        0,
        sprite1, sprite2,
  	    0, 0];

      return basestate.concat(state);
    }

    send(message) {
        this.connection.send(message);
    }

    resetBars() {
      const hp = this.stats.hp;
      const ep = this.stats.ep;
      const hpDiff = this.stats.hpMax - hp;
      const epDiff = this.stats.epMax - ep;
      this.modHp(hpDiff);
      this.modEp(epDiff);
      //this.map.entities.sendNeighbours(this, new Messages.ChangePoints(this, hpDiff, epDiff));
    }


    onKillEntity(entity, damage, dealt) {
      damage = damage || 0;
      dealt = dealt || 0;

      const ratio = (damage / entity.stats.hpMax);

      let xp = ~~(entity.getXP() * ratio);

      const diff = 10;
      const div = 1/diff;
      const mod = 1 + div + Utils.clamp(-diff,diff,(entity.level - this.level)) * div;
      // NOTE: was a second `var xp = ...` -- redeclaring is a no-op under
      // `var` (same binding), but `let` forbids redeclaring in the same
      // scope. This is a genuine reassignment (xp built from its own prior
      // value), so it's just `xp =` here, not a second `let`.
      xp = ~~(xp * mod);

      this.incExp(xp);
      this.incWeaponExp(xp);

      const weaponSlot = 4;
      const armorDamage = Math.min(5, Math.ceil(dealt / 300));
      log.info("player - armorDamage:" + armorDamage);
      // FIX: `it` from a for...in loop is always a string, so `it ===
      // weaponSlot` (a number) never matched -- the weapon slot was never
      // excluded from this armor-degrade loop, so the weapon got degraded
      // and given "armor" XP here in addition to the explicit weapon-degrade
      // code a few lines below. Coerce to a number before comparing.
      for (const it in this.items.equipment.rooms) {
        if (Number(it) === weaponSlot)
          continue;

        if (!this.items.equipment.rooms[it])
          continue;
        //log.info("armor: "+this.equipment[it].toString());
        if (armorDamage > 0)
        {
            if (this.items.equipment.degradeItem(it, 1))
              this.items.equipment.addExperience(it, armorDamage);
        }
      }
      this.armorDamage = 0;

      // Degrade weapon if over threshold.
      const weaponDamage = Math.min(5, Math.ceil(damage / 2000));
      if (weaponDamage > 0)
      {
          if (this.items.equipment.degradeItem(weaponSlot, 1))
            this.items.equipment.addExperience(weaponSlot, weaponDamage);
      }
      //target.addWeaponExp(target.weaponDamage);
      this.weaponDamage = 0;

      //this.damageCount[entity.id] = 0;
      //this.dealtCount[entity.id] = 0;
    }

    onDamage(attacker, hpMod, epMod, crit, effects) {
      let hpDiff = this.stats.hp;
      super.onDamage(attacker, hpMod, epMod, crit, effects);
      hpDiff = hpDiff - this.stats.hp;

      attacker.onHitEntity(this, hpDiff);

      if (this.stats.hp <= 0)
      {
        // FIX: this callback is a plain function passed to underscore's
        // _.each, so `this` is undefined inside it (ES modules are always
        // strict mode). Reading `this.id` threw a TypeError here on
        // essentially every player death. Capture `self` before the loop and
        // reference the dying player's id through it instead.
        const self = this;
        // SIMPLIFY/PERF: `attackers` is a Map now (see character.js
        // constructor) -- underscore's _.each() reads plain-object keys via
        // Object.keys(), which is always empty for a Map, so the old
        // `_.each(this.attackers, ...)` here would have silently iterated
        // zero attackers after that change. Iterating .values() directly
        // avoids that trap entirely.
        for (const attacker of this.attackers.values()) {
          // FIX/PERF: knownIds is a plain array of numeric entity ids (see
          // mapentities.js addPlayer/addEntity -> knownIds.push(entity.id)),
          // not an object keyed by id -- `delete attacker.knownIds[self.id]`
          // was deleting (at best) an unrelated numeric index, so this dying
          // player's id was never actually removed from the attacker's
          // known-entities list. Worse, `delete` on an array index leaves a
          // hole behind, which knocks V8 out of fast "packed array" mode for
          // every future read of that array for the rest of its lifetime --
          // paid by processWho() (mapentities.js), the single most
          // frequently invoked query in the game, since it reads
          // player.knownIds on essentially every move/attack/chat/spawn.
          // Utils.removeFromArray() (the same helper packethandler.js
          // already uses to forget ids the client has un-learned) does the
          // actual removal without leaving a hole.
          if (attacker.hasOwnProperty("knownIds"))
            Utils.removeFromArray(attacker.knownIds, self.id);

        }
        this.die(attacker);
      }
    }

    getLevel() {
      return Types.getLevel(this.stats.exp.base);
    }

    getAttackLevel() {
      return Types.getAttackLevel(this.stats.exp.attack);
    }

    getDefenseLevel() {
      return Types.getDefenseLevel(this.stats.exp.defense);
    }

    incExp(gotexp)
    {
      let incExp = parseInt(gotexp);

      incExp = Math.ceil(incExp * this.getExpBonus());

      const prevLvl = this.getLevel();
      this.stats.exp.base = parseInt(this.stats.exp.base) + parseInt(incExp);
      const lvl = this.getLevel();
      this.sendPlayer(new Messages.Stat("exp.base", this.stats.exp.base, incExp));

      this.level = Types.getLevel(this.stats.exp.base);
      if(prevLvl !== lvl) {
      	this.levelUp(prevLvl);
      }

      return incExp;
    }

    incAttackExp(gotexp){
    	let incExp = parseInt(gotexp);

  		incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

      const prevLvl = this.getAttackLevel();
    	this.stats.exp.attack = parseInt(this.stats.exp.attack) + parseInt(incExp);
      const lvl = this.getAttackLevel();
      if(prevLvl !== lvl) {
      	this.sendPlayer(new Messages.LevelUp("attack", lvl, this.stats.exp.attack));
      }
      return incExp;
    }

    incDefenseExp(gotexp){
    	let incExp = parseInt(gotexp);

		  incExp = Math.ceil(incExp * this.getExpBonus());

      const prevLvl = this.getDefenseLevel();
    	this.stats.exp.defense = parseInt(this.stats.exp.defense) + parseInt(incExp);
      const lvl = this.getDefenseLevel();
      if(prevLvl !== lvl) {
      	this.sendPlayer(new Messages.LevelUp("defense", lvl, this.stats.exp.defense));
      }
      return incExp;
    }

    incWeaponExp(gotexp){
    	let incExp = parseInt(gotexp);

  		incExp = Math.ceil(incExp * this.getExpBonus() * 0.25);

      const type = this.items.getWeaponType();
      if (!this.stats.exp.hasOwnProperty(type))
        return null;

      let xp = parseInt(this.stats.exp[type]);
      const plvl = Types.getWeaponLevel(xp);
      xp = xp + incExp;
      const clvl = Types.getWeaponLevel(xp);
      this.stats.exp[type] = xp;
      if(plvl !== clvl) {
        this.sendPlayer(new Messages.LevelUp(type, clvl, xp));
      }
      return incExp;
    }

    getExpBonus()
    {
      const self = this;
      let bonus = 1;
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
    }

    levelUp(prevLevel) {
      for (let i=prevLevel; i < this.level; ++i)
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
    }

    sendPlayerToClient()
    {
      const self = this;

      console.info("sendMessage");
      let sendMessage = [
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
          self.items.gold[0],
          self.items.gold[1],
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
      sendMessage.push(Object.keys(self.items.equipment.rooms).length);
      for(const equipIndex in self.items.equipment.rooms){
        const item = self.items.equipment.rooms[equipIndex];
        sendMessage = sendMessage.concat(item.toArray());
      }

      self.setRange();

      sendMessage.push(self.getSprite(0));
      sendMessage.push(self.getSprite(1));

      //console.info("inventory=" +JSON.stringify(self.inventory.rooms));

      console.info("sendMessage - Inventory");
      // Send All Inventory
      sendMessage.push(Object.keys(self.items.inventory.rooms).length);
      for(const invIndex in self.items.inventory.rooms){
        const item = self.items.inventory.rooms[invIndex];
        sendMessage = sendMessage.concat(item.toArray());
      }

      console.info("sendMessage - Bank");
      // Send All Bank
      sendMessage.push(Object.keys(self.items.bank.rooms).length);
      for(const bankIndex in self.items.bank.rooms){
        const item = self.items.bank.rooms[bankIndex];
        sendMessage = sendMessage.concat(item.toArray());
      }

// TODO - Make Quests work with new Class.
      // Send All Quests
      const quests = self.quests.quests.filter(function (q) { return q.status !== Types.QuestStatus.COMPLETE; });
      sendMessage.push(quests.length);
      for(let questIndex = 0; questIndex < quests.length; ++questIndex){
          const q = quests[questIndex];
          console.info(JSON.stringify(q));
          sendMessage = sendMessage.concat(q.toClient());
      }

      // SEND ACHIEVEMENTS
      const achievements = self.achievements;
      sendMessage.push(achievements.length);
      for(let achieveIndex = 0; achieveIndex < achievements.length; ++achieveIndex){
          const achievement = achievements[achieveIndex];
          console.info(JSON.stringify(achievement));
          sendMessage = sendMessage.concat(achievement.toClient(achievement));
      }

      // Send install skills
      self.effectHandler = new SkillEffectHandler(self);
      sendMessage.push(self.skills.length);
      // NOTE: there used to be an unused `var i = 0;` all the way up near
      // the top of this function (dead -- nothing read it before this loop
      // re-initialized `i` to 0 again anyway, since `var` is function-scoped
      // and this was the only real use). Removed it and scoped `i` to the
      // loop with `let`, which is block-scoped and can't leak/collide the
      // way the old function-wide `var i` could.
      for(let i=0; i < self.skills.length; ++i) {
        sendMessage.push(parseInt(self.skills[i].skillXP));
      }

      // Send load Skill slots.
      const len = Object.keys(self.shortcuts).length;
      sendMessage.push(len);
      let sc;
      for(const id in self.shortcuts) {
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
    }

    _loadMapState(db_player) {
        this.mapIndex = parseInt(db_player.map[0]);
        this.map = this.world.maps[this.mapIndex];
        this.x = parseInt(db_player.map[1]);
        this.y = parseInt(db_player.map[2]);
        this.orientation = parseInt(db_player.map[3]);
    }

    _loadSprites(db_player) {
        if (db_player.sprites.length === 2) {
          db_player.sprites[2] = 151;
          db_player.sprites[3] = 50;
        }
        // FIX: parseInt() was an Array.prototype monkey-patch; migrated to
        // Utils.ArrayParseInt() (see utils.js).
        this.sprites = Utils.ArrayParseInt(db_player.sprites);
        this.colors = db_player.colors;
    }

    _loadExp(db_player) {
        this.stats.exp.base = parseInt(db_player.exps[0]);
        this.stats.exp.attack = parseInt(db_player.exps[1]);
        this.stats.exp.defense = parseInt(db_player.exps[2]);
        this.stats.exp.move = parseInt(db_player.exps[3]);
        if (db_player.exps.length >= 8)
        {
          this.stats.exp.sword = parseInt(db_player.exps[4]);
          this.stats.exp.bow = parseInt(db_player.exps[5]);
          this.stats.exp.hammer = parseInt(db_player.exps[6]);
          this.stats.exp.axe = parseInt(db_player.exps[7]);
        }
        else {
          this.stats.exp.sword = 0;
          this.stats.exp.bow = 0;
          this.stats.exp.hammer = 0;
          this.stats.exp.axe = 0;
        }
        if (db_player.exps.length === 10)
        {
          this.stats.exp.logging = parseInt(db_player.exps[8]);
          this.stats.exp.mining = parseInt(db_player.exps[9]);
        } else {
          this.stats.exp.logging = 0;
          this.stats.exp.mining = 0;
        }

        this.level = Types.getLevel(this.stats.exp.base);
    }

    _loadGold(db_player) {
        // REFACTOR: db_player.gold[0]/[1] are already real numbers now --
        // userserver sends gold as a real [gold0, gold1] array, not a CSV
        // string (see userhandler.js's handleLoadPlayerInfo()), so this
        // parseInt() is no longer an actual string-to-number parse. Kept
        // (with a radix and `|| 0` fallback, matching how gold_0/gold_1 are
        // guarded everywhere else on the userserver side) as cheap defensive
        // coercion rather than trusting the wire payload outright.
        this.items.gold[0] = parseInt(db_player.gold[0], 10) || 0;
        this.items.gold[1] = parseInt(db_player.gold[1], 10) || 0;
    }

    _loadPStats(db_player) {
        // FIX: parseInt() was an Array.prototype monkey-patch; migrated to
        // Utils.ArrayParseInt() (see utils.js).
        this.pStats = Utils.ArrayParseInt(db_player.pStats);

        db_player.stats = Utils.ArrayParseInt(db_player.stats);

        // Check to make sure stats are correct for level.
        const isValidStats = function (lvl, stats) {
            let total = 0;
            if (lvl < 10)
              total = lvl * 10;
            else
              total = (9 * 10) + (5 * (lvl - 9));

            const statTotal = stats.reduce(function(a, b) { return (a + b); }, 0);

            return (total === statTotal);
        };

        const lvl = parseInt(this.level);
        if (!isValidStats(lvl, db_player.stats))
        {
          if (lvl < 10) {
            this.stats.attack = lvl*2;
      			this.stats.defense = lvl*2;
      			this.stats.health = lvl*2;
            this.stats.energy = lvl*2;
      			this.stats.luck = lvl*2;

            this.stats.free = 0;
          }
          else {
            this.stats.attack = 18;
      			this.stats.defense = 18;
      			this.stats.health = 18;
            this.stats.energy = 18;
      			this.stats.luck = 18;

            this.stats.free = (lvl-9)*5;
          }
        }
        else {
          this.stats.attack = db_player.stats[0];
          this.stats.defense = db_player.stats[1];
          this.stats.health = db_player.stats[2];
          this.stats.energy = db_player.stats[3];
          this.stats.luck = db_player.stats[4];

          this.stats.free = db_player.stats[5];
        }
    }

    _loadQuests(db_player) {
        // if quests old format create empty.
        // if quests new but id not a Number delete.
        // FIX: db_player.completeQuests is `null`/`undefined` for any player
        // whose Redis hash never got a "completeQuests" field written (new
        // characters, or characters that never completed a quest -- see
        // redis.js's loadPlayerInfo(), where a missing hash field comes back
        // from hget() as `null`). That fell through to the `else` branch
        // below, which did `self.quests.completeQuests = db_player.completeQuests`
        // unconditionally -- assigning `null`/`undefined` straight onto the
        // player instead of defaulting to `{}`. The next save then sent
        // JSON.stringify(null) === "null" as the completeQuests field, which
        // userserver/js/format.js correctly rejects ("complete quests is not
        // an object"), and userserver/js/worldhandler.js's listener responds
        // to any format-check failure by closing the whole gameserver<->
        // userserver connection (self.connection.close(...)) -- not just
        // dropping that one save -- which is why a single player with an
        // uninitialized quest log could disconnect the entire gameserver.
        if (Array.isArray(db_player.completeQuests) || db_player.completeQuests == null) {
            this.quests.completeQuests = {}
        }
        else {
          for (const id in db_player.completeQuests)
          {
            if (!Number(id))
              delete db_player.completeQuests[id];
          }
          this.quests.completeQuests = db_player.completeQuests;
        }
    }

    _initDerivedStats() {
        this.setHpMax();
        this.setEpMax();

        this.resetBars();
        this.setMoveRate(500);
    }

    _loadSkills(db_player) {
        if (db_player.skills.length === 1) {
          for(let i =0; i < SkillData.Skills.length; ++i)
            db_player.skills[i] = 0;
        }
        this.skillHandler.setSkills(this, db_player.skills);
    }

    _loadShortcuts(db_player) {
        // Needs to convert shortcut into optimum data structure while
        // remaining compatibiltity with old structures.
        // FIX: Array.isArray() was called with no argument, which is always
        // false -- so the old array-format shortcuts branch below was dead
        // code, and every account (including old array-format ones) fell
        // through to the object-keyed `else` branch, misreading an array's
        // numeric indices as slot ids. Passing db_player.shortcuts restores
        // the intended format check.
        if (Array.isArray(db_player.shortcuts)) {
          for (const shortcut of db_player.shortcuts)
          {
            if (shortcut[0] >= 6)
              continue;

            if (shortcut)
              this.shortcuts[shortcut[0]] = shortcut;
          }
        } else {
          for (const sid in db_player.shortcuts)
          {
            if (sid >= 6)
              continue;

            const shortcut = db_player.shortcuts[sid];
            if (shortcut)
              this.shortcuts[sid] = shortcut;
          }
        }
    }

// TODO - Fill db_player variable assignments.
    // SIMPLIFY: this used to be a single ~185-line function mixing map/
    // position restore, sprite migration, exp/level parsing, gold parsing,
    // a stat-total validity check, quest-log sanitization, skill loading,
    // and shortcut-format migration in one body. Broken into the named
    // steps above (each keeping its original FIX/NOTE comments) so each
    // concern can be read/tested on its own; call order and behavior are
    // unchanged.
    fillPlayerInfo(db_player)
    {
        this._loadMapState(db_player);
        this._loadSprites(db_player);
        this._loadExp(db_player);
        this._loadGold(db_player);

        this.isDead = false;

        this._loadPStats(db_player);
        this._loadQuests(db_player);
        this._initDerivedStats();
        this._loadSkills(db_player);
        this._loadShortcuts(db_player);

        this.attackTimer = Date.now();

        //console.info("playerId: "+this.id);
    }

  sendChangePoints(health, energy) {
    this.map.entities.sendNeighbours(this, new Messages.ChangePoints(this, health, energy));
  }

  getHpMax() {
  	const hp = 300 + (this.stats.health * 100);
    return hp;
  }

  getEpMax() {
  	const ep = 300 + (this.stats.energy * 100);
    return ep;
  }



  sendToUserServer(msg) {
    if (this.world)
      this.world.send(msg.serialize());
    else {
      console.warn("Player, sendToUserServer called without world being set. "+JSON.stringify(msg));
    }
  }

  save(update) {
    console.info("Player - save, name:"+this.name);

    if (this.connection.worldHandler)
      this.connection.worldHandler.savePlayer(this, update);
    else {
      console.warn("Player, save called without worldHandler being set. ");
    }
  }


  setRange() {
    this.setAttackRange(1);
    if (this.isArcher()) {
      this.setAttackRange(10);
    }
  }

  // data = time, interrupted. path
  movePath(data, path)
  {
    const x=path[0][0], y=path[0][1],
      x2=path[path.length-1][0], y2=path[path.length-1][1],
      time=data[0],
      interrupted=data[1];

    this.idleTimer.restart();

    // PERF: movePath() runs on every click-to-move path packet from every
    // player -- one of the two or three hottest packet types in the game
    // (see the "hottest path" PERF comments in map/mapentities.js's
    // processWho and callbacks/playercallback.js's checkStartMove). This
    // console.info fired unconditionally, unlike the equivalent per-packet
    // logging already gated behind G_DEBUG everywhere else in this
    // codebase (packethandler.js, playercallback.js, pathfinder.js).
    if (G_DEBUG)
        console.info("set path");

    this.sx = this.x;
    this.sy = this.y;
    this.ex = x2;
    this.ey = y2;

    this.forceStop();
    if (!this.map.entities.pathfinder.isValidPath(path))
      return;

    this.setPath(path);
    this.startMovePathTime = time;
  }

  move(nm) {
    //nm = self.nextMove;
    if (!nm)
      return;

    const time=nm[0], state=nm[1], o=nm[2], x=nm[3], y=nm[4];
    // PERF: move() runs on every CW_MOVE packet from every player -- the
    // single most frequent packet type in the game (every key-down/key-up).
    // JSON.stringify-ing the whole packet here on every call is real,
    // measurable cost paid whether or not anyone's watching the log; gated
    // behind G_DEBUG like the identical per-packet logging in
    // packethandler.js/playercallback.js.
    if (G_DEBUG)
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
        const delay = 0;
        this.startMoveTime = time;

        const execMove = function (p) {
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
      const a = (x === this.x && y === this.y);
      const b = (this.sx === x && this.sy === y);

      if (a || b) {
        //console.info("player.move: this.moving_timeout cleared.");
        //clearTimeout(this.moving_timeout);
        this.fixMove(x,y);
        // PERF: this is the ordinary "player stopped moving" branch, hit on
        // every released movement key from every player -- not an anomaly,
        // so (like the rest of this function) gated behind G_DEBUG instead
        // of logging unconditionally on every stop.
        if (G_DEBUG) {
            console.info("player.move, resetMove - x:"+x+", y:"+y);
            console.info("player.move, resetMove - this.x:"+this.x+", this.y:"+this.y);
        }
        return;
      }

      // If a stop is recieved before the movement completes,
      // validate the path, and if it's legal fix then stop.
      if ((this.x === x && this.y !== y) || (this.x !== x && this.y === y)) {
        const path = [[this.x,this.y],[x,y]];
        if (this.isValidGridPath(path, this.startMoveTime)) {
          this.fixMove(x, y);
        }
        return;
      }

      // PERF/NOTE: this is the actual anomaly signal (client-reported stop
      // position didn't match any of the accepted cases above), so the
      // single summary line stays unconditional -- matching the convention
      // used by playercallback.js's correctMove() for the same kind of
      // desync warning. The coordinate dump is gated behind G_DEBUG since
      // it's diagnostic detail, not the signal itself.
      console.warn("player.move: not stopping.");
      if (G_DEBUG) {
          console.warn("player.move, stop - x:"+x+", y:"+y);
          console.warn("player.move, stop - this.x:"+this.x+", this.y:"+this.y);
      }
    }
  }

  broadcastSprites() {
    const s1 = this.getSprite(0);
    this.setSprite(0, s1);
    const s2 = this.getSprite(1);
    this.setSprite(1, s2);
    this.packetHandler.broadcast(new Messages.setSprite(this, s1, s2), false);
  }

  sendCurrentMove() {
    const msg = new Messages.Move(this, this.orientation, 0, this.x, this.y);
    this.map.entities.sendNeighbours(this, msg);
  }

  respawn() {
    this.isDead = false;
    //this.isDying = false;
    this.freeze = false;
    //this.hasEnteredGame = true;
    this.resetBars();

  }

  setPosition(x, y) {
    //console.info("setPosition - x:"+x+",y:"+y);
    //try { throw new Error(); } catch (e) { console.info(e.stack); }
    super.setPosition(x,y);

    if (this.holdingBlock)
    {
      const pos = this.getTilePositionNextTo();
      this.holdingBlock.setPosition(pos[0], pos[1]);
    }
  }

  isInScreen(pos) {
    return (~~(Math.abs(this.x - pos[0])/G_TILESIZE) <= ~~(G_SCREEN_WIDTH/2) &&
            ~~(Math.abs(this.y - pos[1])/G_TILESIZE) <= ~~(G_SCREEN_HEIGHT/2));
  }

  // type 0=Armor, 1=Weapon
  setSprite(type, id) {
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
  }

  // type 0=Armor, 1=Weapon
  getSprite(type) {
    let item = null;
    if (type === 1) {
      item = this.items.equipment.getWeapon();
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
  }

  resetMove(x,y) {
    // PERF: resetMove() is the server's "reject/correct this move" path --
    // called from packethandler.js's handleMoveEntity/handleMovePath on
    // every throttle violation, invalid path, or speed-hack rejection, and
    // from playercallback.js's abortPathing on every too-fast path
    // interrupt. All of those are routine outcomes under ordinary network
    // jitter/lag, not just malicious clients, so this ran on a fairly
    // frequent, everyday path. Capturing a full stack trace (throw+catch)
    // purely to log it is real, avoidable cost; gated behind G_DEBUG like
    // the equivalent diagnostic-only stack captures elsewhere in the
    // codebase (e.g. map/mapentities.js's findPath).
    if (G_DEBUG) {
        try { throw new Error(); } catch(err) { console.error(err.stack); }
    }
    this.fixMove(x,y);
    this.sendCurrentMove();
  }

  fixMove(x,y) {
    //try { throw new Error(); } catch(err) { console.warn(err.stack); }
    //this.interrupted = false;
    this.forceStop();
    this.setPosition(x, y);
  }

  sendPlayer(msg) {
    this.map.entities.sendToPlayer(this, msg);
  }

  sendToPlayer(player, msg) {
    this.map.entities.sendToPlayer(player, msg);
  }

  onKilled(callback) {
    this.on_killed_callback = callback;
  }

  onTeleport(callback) {
    this.on_teleport_callback = callback;
  }

  handleTeleport() {
      if (this.on_teleport_callback)
        this.on_teleport_callback();
  }

  hasMoveThrottled(delay) {
    if ((Date.now() - this.lastMoveThrottle) < delay)
      return true;

    this.lastMoveThrottle = Date.now();

    return false;
  }

  getXP() {
    return 20 * this.level;
  }

  setMap(map) {
    this.map.entities.removeSpatial(this);
    this.map = map;
  }

  forceStop() {
    this.orientation = 0;
    this._forceStop();
    this.keyMove = false;

    this.sx = this.x;
    this.sy = this.y;

    this.ex = -1;
    this.ey = -1;
  }

  modHp(hp) {
    if (this.isDead)
      return;

    const msg = super.modHp(hp);
    this.sendChangePoints(hp, 0);
    return msg;
  }

  modEp(ep) {
    const msg = super.modEp(ep);
    this.sendChangePoints(0, ep);
    return msg;
  }

  getSubPath(x,y) {
    x = x || this.x;
    y = y || this.y;

    const path = this.map.entities.pathfinder.getSubPath(this.path, x, y);
    return path;
  }

  interruptPath(x, y) {
    if (this.isMovingPath()) {
      //p.abort_pathing_callback(x, y);
      this.setPosition(x,y);
      this.interrupted = true;
      this.forceStop();
    }
  }

  isValidGridPath(path, time) {
    const pathfinder = this.map.entities.pathfinder;
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

    // PERF: isValidGridPath() runs on every player click-to-move path
    // request -- this JSON.stringify ran unconditionally, unlike the
    // equivalent per-path-request logging elsewhere in the codebase
    // (pathfinder.js, mapentities.js) which is already gated behind G_DEBUG.
    if (G_DEBUG)
      console.info("player - isValidGridPath: "+JSON.stringify(path));
    if (time) {
      const dist = pathfinder.getPathDistance(path);
      if (pathfinder.isDistanceTooFast(this.tick, dist, time)) {
        console.warn("handleMovePath: no valid path.");
        this.resetMove(this.x,this.y);
        return false;
      }
    }

    return true;
  }

  isArcher() {
    const weapon = this.items.getWeapon();
    if (weapon && ItemTypes.isArcherWeapon(weapon.itemKind)) {
      return true;
    }
    return false;
  }

  dropGold() {
    const p = this;

    const level = p.level;
    let count = Math.ceil(Math.random() * level * 5 + level);
    count = Math.min(count, this.items.gold[0]);
    this.items.modifyGold(-count);
    return count;
  }

}

export default Player;
