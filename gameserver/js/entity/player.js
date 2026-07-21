
/* global log, databaseHandler, QuestStatus */
import Character from './character/character.js';
import Messages from "../message.js";
import SkillHandler from "../skillhandler.js";
import SkillEffectHandler from "../effecthandler/effecthandler.js";
import PacketHandler from "../packets/packethandler.js";
import PlayerQuests from "./components/playerquests.js";
import PlayerHarvest from "./components/playerharvest.js";
import PlayerItems from "./components/playeritems.js";
import PlayerCombat from "./components/playercombat.js";
import PlayerProgression from "./components/playerprogression.js";
import PlayerPersistence from "./components/playerpersistence.js";
import Timer from '../timer.js';
import Utils from '../utils.js';
import { Types, ItemTypes } from '../common.js';
import { G_TILESIZE, G_SCREEN_WIDTH, G_SCREEN_HEIGHT, G_DEBUG } from '../constants.js';

// Split out of this file -- leveling/XP moved to
// components/playerprogression.js, database load/restore moved to
// components/playerpersistence.js, and onKillEntity/dropGold moved into the
// existing components/playercombat.js (onDamage/modHp/modEp/resetBars
// stayed here: onDamage/modHp/modEp override Character and need
// `super.X()`, and resetBars -- despite initially moving to playercombat.js
// too -- turned out not to be a combat concept at all, see the NOTE on it
// below). Every method that had an external caller keeps its name and is
// still callable exactly the same way -- `player.X(...)` -- as a one-line
// delegate, so nothing outside this file needed to change.

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
        this.progression = new PlayerProgression(this);
        this.persistence = new PlayerPersistence(this);

        this.knownIds = [];

        this.sx = 0;
        this.sy = 0;
        this.ex = -1;
        this.ey = -1;


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
      return this.progression.getState();
    }

    send(message) {
        this.connection.send(message);
    }

    onKillEntity(entity, damage, dealt) {
      return this.combat.onKillEntity(entity, damage, dealt);
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
      return this.progression.getLevel();
    }

    getAttackLevel() {
      return this.progression.getAttackLevel();
    }

    getDefenseLevel() {
      return this.progression.getDefenseLevel();
    }

    incExp(gotexp) {
      return this.progression.incExp(gotexp);
    }

    incAttackExp(gotexp) {
      return this.progression.incAttackExp(gotexp);
    }

    incDefenseExp(gotexp) {
      return this.progression.incDefenseExp(gotexp);
    }

    incWeaponExp(gotexp) {
      return this.progression.incWeaponExp(gotexp);
    }

    getExpBonus() {
      return this.progression.getExpBonus();
    }

    levelUp(prevLevel) {
      return this.progression.levelUp(prevLevel);
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
      // FIX: this used to push Object.keys(self.items.equipment.rooms).length
      // as the item count, then loop `for...in` over every key -- including
      // slots that had been un-equipped and were left sitting there as
      // `null` (Equipment.makeEmptyItem() sets a slot to null rather than
      // actually removing its key -- same underlying pattern as
      // itemroomstore.js's ItemStore, see the _occupiedCount FIX comment
      // there) -- and called item.toArray() on them unconditionally.
      // getState() backs Messages.Spawn.serialize(), so any player who had
      // ever unequipped something would throw a TypeError here on every
      // subsequent login/respawn/spawn-to-nearby-player. Filtering out null
      // slots up front keeps the item list AND the pushed count consistent
      // with each other -- the client parses exactly `count` item entries
      // next, so a mismatch between the two would misalign every field
      // after this in the message, not just the equipment list.
      const equipItems = self.items.equipment.rooms.filter(Boolean);
      sendMessage.push(equipItems.length);
      for (const item of equipItems) {
        sendMessage = sendMessage.concat(item.toArray());
      }

      self.setRange();

      sendMessage.push(self.getSprite(0));
      sendMessage.push(self.getSprite(1));


      console.info("sendMessage - Inventory");
      // Send All Inventory
      // FIX: same bug as equipment above. `_occupiedCount` (itemroomstore.js)
      // already tracks the real number of occupied rooms incrementally, so
      // it's used for the pushed count here instead of the stale
      // Object.keys(rooms).length; the loop below still null-guards
      // defensively rather than assuming the two can never drift apart.
      sendMessage.push(self.items.inventory._occupiedCount);
      for(const item of self.items.inventory.rooms){
        if (!item) continue;
        sendMessage = sendMessage.concat(item.toArray());
      }

      console.info("sendMessage - Bank");
      // Send All Bank
      sendMessage.push(self.items.bank._occupiedCount);
      for(const item of self.items.bank.rooms){
        if (!item) continue;
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

    fillPlayerInfo(db_player) {
        return this.persistence.fillPlayerInfo(db_player);
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
          p.orientation = o;
          p.keyMove = true;
          return;
        };
          execMove(this);
    }
    else if (state === 0) {
      /*if (!(this.sx === x && this.sy === y)) {
        try { throw new Error(); } catch (e) { console.error(e.stack); }
      }*/

      this.ex = x;
      this.ey = y;
      const a = (x === this.x && y === this.y);
      const b = (this.sx === x && this.sy === y);

      if (a || b) {
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
    this.freeze = false;
    this.resetBars();

  }

  setPosition(x, y) {
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
    return this.progression.getXP();
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

  // NOTE: kept here rather than in components/playercombat.js -- it's built
  // directly from modHp/modEp above (same reasoning: not really a combat
  // concept), and its actual callers (respawn() below, progression.js's
  // levelUp(), persistence.js's _initDerivedStats()) are lifecycle/
  // progression/load, not combat. Mob has its own separate resetBars()
  // (mob.js), so this isn't shared Character behavior either.
  resetBars() {
    const hp = this.stats.hp;
    const ep = this.stats.ep;
    const hpDiff = this.stats.hpMax - hp;
    const epDiff = this.stats.epMax - ep;
    this.modHp(hpDiff);
    this.modEp(epDiff);
  }

  getSubPath(x,y) {
    x = x || this.x;
    y = y || this.y;

    const path = this.map.entities.pathfinder.getSubPath(this.path, x, y);
    return path;
  }

  interruptPath(x, y) {
    if (this.isMovingPath()) {
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
    return this.combat.dropGold();
  }

}

export default Player;
