var Character = require('../entity/character'),
  Chest = require('../entity/chest'),
  Mob = require('../entity/mob'),
  Node = require('../entity/node'),
  Messages = require("../message"),
  Formulas = require("../formulas"),
  formatCheck = require("../format").check,
  SkillHandler = require("../skillhandler"),
  PartyHandler = require("./partyhandler"),
  ShopHandler = require("./shophandler");

module.exports = PacketHandler = Class.extend({
  init: function(user, player, connection, worldServer, map) {
    this.user = user;
    this.player = player;
    this.connection = connection;
    this.world = this.server = worldServer;
    this.map = player.map;
    this.entities = player.map.entities;
    this.partyHandler = new PartyHandler(this);
    this.shopHandler = new ShopHandler(this);

    //this.loadedPlayer = false;
    //this.formatChecker = new FormatChecker();

    var self = this;

    //this.connection.off('msg', this.player.user.listener);
    this.connection.listen(function(message) {
      console.info("recv="+JSON.stringify(message));
      var action = parseInt(message[0]);

      if (action)
      if(!formatCheck(message)) {
          self.connection.close("Invalid "+Types.getMessageTypeAsString(action)+" message format: "+message);
          return;
      }
      message.shift();

      self.user.lastPacketTime = Date.now();

      /*switch (action) {
        case Types.UserMessages.UW_LOAD_USER_INFO:
          self.handleLoadUserInfo(message);
          return;
        case Types.UserMessages.UW_LOAD_PLAYER_INFO:
          self.handleLoadPlayerInfo(message);
          return;
        case Types.UserMessages.UW_LOAD_PLAYER_QUESTS:
          self.handleLoadPlayerQuests(message);
          return;
        case Types.UserMessages.UW_LOAD_PLAYER_ACHIEVEMENTS:
          self.handleLoadPlayerAchievements(message);
          return;
        case Types.UserMessages.UW_LOAD_PLAYER_ITEMS:
          self.handleLoadPlayerItems(message);
          return;
      }*/

      switch (action) {
        case Types.Messages.BI_SYNCTIME:
          self.handleSyncTime(message);
          break;

        case Types.Messages.CW_REQUEST:
          self.handleRequest(message);
          break;

        case Types.Messages.CW_WHO:
          //console.info("Who: " + self.player.name);
          //console.info("list: " + message);
          self.handleWho(message);
          break;

        case Types.Messages.CW_CHAT:
          self.handleChat(message);
          break;

        case Types.Messages.CW_MOVE:
          self.handleMoveEntity(message);
          break;

        case Types.Messages.CW_MOVEPATH:
          self.handleMovePath(message);
          break;

        case Types.Messages.CW_ATTACK:
          //console.info("Player: " + self.player.name + " hit: " + message[1]);
          self.handleAttack(message);
          break;

        case Types.Messages.CW_ITEMSLOT:
          self.handleItemSlot(message);
          break;

        case Types.Messages.CW_STORESELL:
          //console.info("Player: " + self.player.name + " store sell: " + message[1]);
          self.shopHandler.handleStoreSell(message);
          break;
        case Types.Messages.CW_STOREBUY:
          //console.info("Player: " + self.player.name + " store buy: " + message[1] + " " + message[2] + " " + message[3]);
          self.shopHandler.handleStoreBuy(message);
          break;
        case Types.Messages.CW_CRAFT:
          //console.info("Player: " + self.player.name + " store buy: " + message[1] + " " + message[2] + " " + message[3]);
          self.shopHandler.handleCraft(message);
          break;
        case Types.Messages.CW_APPEARANCEUNLOCK:
          self.handleAppearanceUnlock(message);
          break;
        case Types.Messages.CW_LOOKUPDATE:
          self.handleLookUpdate(message);
          break;
        case Types.Messages.CW_AUCTIONSELL:
          //console.info("Player: " + self.player.name + " auction sell: " + message[0]);
          self.shopHandler.handleAuctionSell(message);
          break;

        case Types.Messages.CW_AUCTIONBUY:
          //console.info("Player: " + self.player.name + " auction buy: " + message[0]);
          self.shopHandler.handleAuctionBuy(message);
          break;

        case Types.Messages.CW_AUCTIONOPEN:
          //console.info("Player: " + self.player.name + " auction open: " + message[0]);
          self.shopHandler.handleAuctionOpen(message);
          break;

        case Types.Messages.CW_AUCTIONDELETE:
          //console.info("Player: " + self.player.name + " auction delete: " + message[0]);
          self.shopHandler.handleAuctionDelete(message);
          break;

        case Types.Messages.CW_STORE_MODITEM:
          //console.info("Player: " + self.player.name + " store enchant: " + message[0]);
          self.shopHandler.handleStoreModItem(message);
          break;

// TODO - Fix CHaracter Info
        case Types.Messages.CW_CHARACTERINFO:
          //console.info("Player character info: " + self.player.name);
          self.handleCharacterinfo(message);
          break;

        case Types.Messages.CW_TELEPORT_MAP:
          self.handleTeleportMap(message);
          break;
        case Types.Messages.CW_LOOT:
          self.handleLoot(message);
          break;
        case Types.Messages.CW_TALKTONPC:
          self.handleTalkToNPC(message);
          break;
        case Types.Messages.CW_QUEST:
          self.handleQuest(message);
          break;
        case Types.Messages.CW_GOLD:
          self.handleGold(message);
          break;
        case Types.Messages.CW_STATADD:
          self.handleStatAdd(message);
          break;
        case Types.Messages.CW_SKILL:
          self.handleSkill(message);
          break;
        case Types.Messages.CW_SHORTCUT:
          self.handleShortcut(message);
          break;
        case Types.Messages.CW_BLOCK_MODIFY:
          self.handleBlock(message);
          break;

        case Types.Messages.CW_PARTY:
          self.handleParty(message);
          break;

        case Types.Messages.CW_HARVEST:
          self.handleHarvest(message);
          break;

        case Types.Messages.CW_USE_NODE:
          self.handleUseNode(message);
          break;

        default:
          if (self.message_callback)
            self.player.message_callback(message);
          break;
      }
    });

    this.connection.onClose(function() {
      console.info("Player: " + self.player.name + " has exited the world.");

      self.player.save();

      console.info("REMOVING PLAYER FROM WORLD.");

      if (self.exit_callback) {
        console.info("exit callback.");
        self.exit_callback(self.player);
      }

      console.info("onClose - called");
      clearTimeout(this.disconnectTimeout);
      this.close("onClose");

    });

  },

  setMap: function (map) {
      this.map = map;
      this.entities = map.entities;
  },

  timeout: function() {
    this.connection.sendUTF8("timeout");
    this.connection.close("Player was idle for too long");
  },

  broadcast: function(message, ignoreSelf) {
    if (this.broadcast_callback) {
      this.broadcast_callback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  },

  sendPlayer: function (message) {
    this.entities.sendToPlayer(this.player, message);
  },

  onExit: function(callback) {
    console.info("packetHandler, onExit.");
    this.exit_callback = callback;
    /*try {
    throw new Error()
    }
    catch (e) { console.info(e.stack); }*/
  },

  onMove: function(callback) {
    this.move_callback = callback;
  },

  onMessage: function(callback) {
    this.message_callback = callback;
  },

  onBroadcast: function(callback) {
    this.broadcast_callback = callback;
  },

  sendToPlayer: function (player, message) {
    this.map.entities.sendToPlayer(player, message);
  },

  send: function(message) {
    this.connection.send(message);
  },

  handleCharacterInfo: function (message) {
    this.sendPlayer(new Messages.CharacterInfo(this.player));
  },

  handleSyncTime: function (message) {
    console.info("handleSyncTime");
    var clientTime = parseInt(message[0]);
    //this.sendPlayer(new Messages.SyncTime(clientTime));
    this.send([Types.Messages.BI_SYNCTIME, clientTime, Date.now()]);
  },

  handleChat: function(message) {
    var msg = Utils.sanitize(message[0]);
    console.info("Chat: " + this.player.name + ": " + msg);

    if ((new Date()).getTime() > this.player.chatBanEndTime) {
      this.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATMUTED"]);
      return;
    }

    if (msg && (msg !== "" || msg !== " ")) {
      msg = msg.substr(0, 256); //Will have to change the max length
      var command = msg.split(" ", 3)
      switch (command[0]) {
        case "/w":
          this.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATMUTED"]);
          break;
        default:
          this.server.pushWorld(new Messages.Chat(this.player, msg));
          break;

      }
    }
  },

  handleQuest: function (msg) {
    console.info("handleQuest");
    var npcId = parseInt(msg[0]);
    var questId = parseInt(msg[1]);
    var status = parseInt(msg[2]);

    var npc = this.entities.getEntityById(npcId);
    if (!this.player.isInScreen(npc)) {
      console.info("player not close enough to NPC!");
      return;
    }

    if (status == 1)
      npc.entityQuests.acceptQuest(this.player, questId);
    else {
      npc.entityQuests.rejectQuest(this.player, questId);
    }
  },

  handleTalkToNPC: function(message) { // 30
    console.info("handleTalkToNPC");
    var type = parseInt(message[0]);
    var npcId = parseInt(message[1]);

    var npc = this.entities.getEntityById(npcId);
    if (!npc.isWithinDistEntity(this.player, 24)) {
      console.info("player not close enough to NPC!");
      return;
    }

    if (npc)
      npc.talk(this.player);
  },

  handleBankStore: function(message) {
    var itemIndex = parseInt(message[0]);

    var p = this.player;
    if (itemIndex >= 0 && itemIndex < p.inventory.maxNumber) {
      var item = p.inventory.rooms[itemIndex];
      //console.info("bankitem: " + JSON.stringify(item));
      if (item && item.itemKind) {
        var slot = p.bank.getEmptyIndex();
        //console.info("slot=" + slot);
        if (slot >= 0) {
          p.bank.putItem(item);
          p.inventory.takeOutItems(itemIndex, item.itemNumber);
        }
      }
    }
  },

  handleBankRetrieve: function(message) {
    var bankIndex = parseInt(message[0]);

    var p = this.player;
    if (bankIndex >= 0 && bankIndex < p.bank.maxNumber) {
      var item = p.bank.rooms[bankIndex];
      if (item && item.itemKind) {
        var slot = p.inventory.getEmptyIndex();
        if (slot >= 0) {
          p.inventory.putItem(item);
          p.bank.takeOutItems(bankIndex, item.itemNumber);
        }
      }
    }
    this.sendPlayer(new Messages.Gold(p));
  },

  handleAppearanceUnlock: function(message) {
    var appearanceIndex = parseInt(message[0]);
    var priceClient = parseInt(message[1]);

    if (appearanceIndex < 0 || appearanceIndex >= AppearanceData.Data.length)
      return;

    var itemData = AppearanceData.Data[appearanceIndex];
    if (!itemData)
      return;

    if (!(itemData.type == "armorarcher" || itemData.type == "armor"))
      return;

    var price = this.server.looks.prices[appearanceIndex];
    if (price != priceClient) {
      this.sendPlayer(new Messages.Notify("SHOP", "SHOP_MISMATCH", [itemData.name]));
      this.server.looks.sendLooks(this.player);
      return;
    }

    var gemCount = 0;

    if (appearanceIndex >= 0) {
      gemCount = this.player.user.gems;

      console.info("gemCount=" + gemCount);

      if (gemCount >= price) {
        this.player.user.looks[appearanceIndex] = 1;
        this.player.modifyGems(-price);
        this.server.looks.prices[appearanceIndex] += 100;

        this.sendPlayer(new Messages.Notify("SHOP", "SHOP_SOLD", [itemData.name]));
        this.server.looks.sendLooks(this.player);
      } else {
        this.sendPlayer(new Messages.Notify("SHOP", "SHOP_NOGEMS"));
      }
    }
  },

  handleLookUpdate: function(message) {
    var type = parseInt(message[0]),
      id = parseInt(message[1]);

    var p = this.player;
    if (id < 0 || id >= AppearanceData.Data.length)
      return;
    if (type < 0 || type > 1)
      return;

    var itemData = AppearanceData.Data[id];
    if (!itemData)
      return;

    if (!(itemData.type == "armorarcher" || itemData.type == "armor"))
      return;

    var appearance = this.player.user.looks[id];
    if (appearance == 1) {
      if (type == 0) {
        p.setSprite(0, id);
      }
    }

    p.broadcastSprites();
    /*var s1 = p.getSprite(0);
    var s2 = p.getSprite(1);
    this.broadcast(new Messages.setSprite(p, s1, s2));*/
  },


// param 1 - action type.
// type 0 eat.
// type 1 equip.
// type 2 move item.
// type 3 drop item.
// type 4 store item.

// param 2 - slot type.
// slot 0 inventory.
// slot 1 equipment.
// slot 2 bank.

// param 3 slot index. (0-48).
// param 4 count of items.

// param 5 - slot type 2.
// param 6 - slot index 2.
// param 7 - count of items 2.

  handleItemSlot: function(msg) { // 28
    var self = this;
    var action = parseInt(msg[0]);

    if (this.player.isDying || this.player.isDead)
      return;

    // slot type, slot index, slot count.
    var slot = [parseInt(msg[1]), parseInt(msg[2]), parseInt(msg[3])];
    if (slot[0] == 2 && slot[1] > this.player.equipment.maxNumber)
      return;
    var item = null;
    if (slot[1] >= 0)
      item = this.player.getStoredItem(slot[0], slot[1], slot[2]);

    var slot2 = null;
    if (msg.length == 6)
    {
      slot2 = [parseInt(msg[4]), parseInt(msg[5])];
      if (slot[0] == slot2[0] && slot[1] == slot2[1])
        return;
    }
    if (action === 0) {
      this.player.handleInventoryEat(item, slot[1]);
    }
    else if (action === 1) {
      this.player.swapItem(slot, slot2);
    }
    else if (action === 2) { // drop item.
      this.player.handleStoreEmpty(slot, item);
    }
  },

  handleLoot: function(message) {
    console.info("handleLoot");

    item = this.entities.getEntityById(parseInt(message[0]));
    if (!item) {
      console.info("no item.");
      return;
    }

    var x = parseInt(message[1]),
        y = parseInt(message[2]);

    if (!this.player.isWithinDist(x,y,24)) {
      console.info("Player is not close enough to item.")
      return;
    }

    console.info("item="+item.toString());
    if (item.enemyDrop)
      console.info("enemyDrop");

    if (item instanceof Item) {
      if (this.player.inventory.putItem(item.room) >= 0) {
        this.server.taskHandler.processEvent(this.player, PlayerEvent(EventType.LOOTITEM, item, 1));
        this.broadcast(item.despawn(), false);
        this.entities.removeEntity(item);
      }
    }
  },

  handleAttack: function(message) {
    console.info("handleAttack");
    var self = this;
    var time = parseInt(message[0]);
    var p = this.player;

    if (p.isDying || p.isDead)
      return;

    if (p.movement.inProgress) {
      p.attackQueue.push(message);
    } else {
      self.handleHitEntity(p, message);
    }
  },

  processAttack: function () {
    //console.info("processAttack");
    var self = this;
    var p = this.player;

    if (p.movement.inProgress) {
      for (var msg of p.attackQueue)
      {
        console.info("processAttack, handle hit");
        self.handleHitEntity(p, msg);
      }
    }
    this.player.attackQueue = [];
  },

  handleHitEntity: function(sEntity, message) { // 8
    console.info("handleHitEntity");
    //var self = this;

    console.info("message: "+JSON.stringify(message));
    var targetId = parseInt(message[1]),
        orientation = parseInt(message[2]),
        skillId = parseInt(message[3]);

    if (targetId < 0) {
      console.warn("invalid targetId");
      return;
    }

    var tEntity = this.entities.getEntityById(targetId);
    if (!tEntity) {
      console.warn("invalid entity");
      return;
    }

    //console.warn("attackDuration: "+(Date.now() - sEntity.attackTimer));
    var attackTime = Date.now() - sEntity.attackTimer;
    if (attackTime < ATTACK_INTERVAL) {
      console.warn("attack interval");
      return;
    }

    // If PvP then both players must be level 20 or higher.
    if (tEntity instanceof Player && sEntity instanceof Player &&
        (sEntity.level.base < 20 || tEntity.level.base < 20 ||
          Math.abs(sEntity.level.base-tEntity.level.base) > 10))
    {
      console.warn("pvp invalid diff");
      return;
    }

    if (tEntity.aiState == mobState.RETURNING)
      return;

    if (tEntity.invincible) {
      this.sendPlayer(new Messages.Notify("CHAT","COMBAT_TARGETINVINCIBLE"));
      console.warn("target invincible");
      return;
    }

// TODO fill sEntity, tEntity.

    //console.info("player.x:"+this.player.x+",this.player.y:"+this.player.y+",mob.x"+mob.x+",mob.y:"+mob.y);
    if (this.map.isColliding(sEntity.x, sEntity.y)) {
      console.warn("char.isColliding("+sEntity.id+","+sEntity.x+","+sEntity.y+")");
      return;
    }

    if (skillId >= 0) {
      this.handleSkill([skillId, targetId, tEntity.x, tEntity.y]);
    }

    sEntity.setOrientation(orientation);
    sEntity.engage(tEntity);

    if (sEntity == this.player) {
      if (!sEntity.canReach(tEntity)) {
        console.info("Player not close enough!");
        console.info("p.x:" + sEntity.x + ",p.y:" + sEntity.y);
        console.info("e.x:" + tEntity.x + ",e.y:" + tEntity.y);
        console.info("dx:"+Math.abs(sEntity.x-tEntity.x)+",dy:"+Math.abs(sEntity.y-tEntity.y));
        return;
      }

      if (!sEntity.attackedTime.isOver()) {
        console.warn("attackedTime is not over.");
        return;
      }
      sEntity.isHarvesting = false;
      sEntity.lastAction = Date.now();
    }

    sEntity.isBlocking = false;
    sEntity.attackedTime.duration = 500;
    sEntity.hasAttacked = true;

    if (sEntity === this.player && tEntity instanceof Mob) {
      this.player.tut.attack = true;
    }

    if (sEntity instanceof Player && tEntity instanceof Mob) {
      tEntity.mobAI.checkHitAggro(tEntity, sEntity);
    }

    if (sEntity.effectHandler) {
      sEntity.effectHandler.interval(3,0);
    }
    var damageObj = this.calcDamage(sEntity, tEntity, null, 0); // no skill
    if (sEntity.effectHandler) {
      sEntity.effectHandler.interval(4, damageObj.damage);
      for (var skillEffect in sEntity.effectHandler.skillEffects)
      {
        for (var target in skillEffect.targets) {
          var damage = target.mod.damage;
          target.mod.damage = 0;
          this.dealDamage(sEntity, target, damage, 0);
        }
      }
    }
    this.dealDamage(sEntity, tEntity, damageObj.damage, damageObj.crit);

    if (sEntity.attackTimer)
      sEntity.attackTimer = Date.now();

    if (sEntity.effectHandler) {
      sEntity.effectHandler.interval(5,0);
    }
  },

  calcDamage: function(sEntity, tEntity, skill, attackType) {
    var damageObj = {
      damage: 0,
      crit: 0,
      dot: 0
    };

    damageObj.damage = Math.round(Formulas.dmg(sEntity, tEntity, Date.now()));
    if (damageObj.damage == 0)
      return damageObj;

    var canCrit = Formulas.crit(sEntity, tEntity);
    if (canCrit) {
      damageObj.damage *= 2;
      damageObj.crit = 1;
    }
    if (sEntity.mod.dr > 0 && !sEntity.hasFullHealth()) {
      var amount = Math.ceil(damageObj.damage * (sEntity.mod.dr / 100));
      sEntity.regenHealthBy(amount);
      if (sEntity instanceof Player)
        this.sendPlayer(sEntity, sEntity.health());
    }

    return damageObj;
  },

// TODO - Fix entity vars.
  dealDamage: function(sEntity, tEntity, dmg, crit) {
    if (!tEntity) return;

    if (tEntity instanceof Mob)
      tEntity.aggroPlayer(sEntity);

    this.server.handleDamage(tEntity, sEntity, -dmg, crit);
    if (sEntity instanceof Player)
      sEntity.weaponDamage += dmg;

    this.server.handleHurtEntity(tEntity, sEntity);
    console.info("DAMAGE OCCURED "+dmg);
    //console.info("dmg="+dmg);
    if (tEntity instanceof Player) {
      //tEntity.stats.hp -= dmg;
      if (tEntity.isDead) {
        if (sEntity == self.player)
          self.entities.sendBroadcast(new Messages.Notify("CHAT","COMBAT_PLAYERKILLED", [sEntity.name, tEntity.name]));

        sEntity.pStats.pk++;
        tEntity.pStats.pd++;
      }
      //self.server.broadcastAttacker(sEntity);
    }
  },

  handleShortcut: function(message) {
    var slot = parseInt(message[0]);
    var type = parseInt(message[1]);
    var shortcutId = parseInt(message[2]);

    if (slot < 0 || slot > 7)
      return;

    if (type == 2) {
      if (shortcutId < 0 || shortcutId >= SkillData.Skills.length)
        return;
    }

    this.player.shortcuts[slot] = [slot, type, shortcutId];
  },

  handleSkill: function(message) {
    var skillId = parseInt(message[0]),
        targetId = parseInt(message[1]),
        x = parseInt(message[2]),
        y = parseInt(message[3]),
        p = this.player;

    if (skillId < 0 || skillId >= p.skills.length)
      return;

    var skill = p.skills[skillId];

    // Perform the skill.
    var target;
    //console.info("targetId="+targetId);
    if (targetId) {
      target = this.entities.getEntityById(targetId);
      if (!target)
        return;
    }
    //console.info("targetid="+targetId);

    // Make sure the skill is ready.
    if (!skill.isReady())
      return;

    //console.info ("skill.skillLevel="+skill.skillLevel);
    //console.info ("type="+type);

    p.effectHandler.cast(skillId, targetId, x, y);

    skill.tempXP = Math.min(skill.tempXP++,1);

    this.handleSkillEffects(p, target);
  },

  handleSkillEffects: function (source, target)
  {
    var effects = [];
    if (!source.effects)
      return;

    for (let [k,v] of Object.entries(source.effects))
    {
      if (v == 1)
        effects.push(parseInt(k));
    }
    this.entities.sendToPlayer(source, new Messages.SkillEffects(source, effects));
    effects = [];

    if (!target) return;

    for (let [k,v] of Object.entries(target.effects))
    {
      if (v == 1)
        effects.push(parseInt(k));
    }
    this.entities.sendToPlayer(source, new Messages.SkillEffects(target, effects));

  },

  // TODO map enforce for all calls.
  handleMoveEntity: function(message) {
    console.info("handleMoveEntity");
    //console.info("message="+JSON.stringify(message));
    var time = parseInt(message[0]),
      entityId = parseInt(message[1]),
      state = parseInt(message[2]),
      orientation = parseInt(message[3]),
      x = parseInt(message[4]) || -1,
      y = parseInt(message[5]) || -1;

    var p = this.player;
    if (entityId != p.id)
      return;

    if (p.map.isColliding(x, y)) {
      console.warn("char.isColliding("+p.id+","+x+","+y+")");
      return;
    }

    if (state == 2) {
      if (p.isMovingPath() && p.fullpath) {
        p.abort_pathing_callback(x, y);
        p.forceStop();
      }
      return;
    }

    var arr = [time, state, orientation, x, y];
    if (state) {
      p.move([time, false, p.orientation, x, y]);
      if (!p.checkStartMove(x,y))
        return;
    }
    p.move(arr);

    var msg = new Messages.Move(p, orientation, state, x, y);
    this.entities.sendNeighbours(p, msg, p);

    if (this.move_callback)
      this.move_callback();
  },

  handleMovePath: function(message) {
    console.info("handleMovePath");
    console.info("message="+JSON.stringify(message));
    var time = parseInt(message[0]),
      entityId = parseInt(message[1]),
      orientation = parseInt(message[2]),
      interrupted = (parseInt(message[3]) == 0) ? false : true;
      message.splice(0,4);
    var path = message[0];

    var p = this.player;
    if (entityId != p.id)
      return;

    console.info(JSON.stringify(path));

    var x = path[0][0],
        y = path[0][1];

    if (!p.checkStartMove(x,y))
      return;

    if (p.mapStatus < 2)
      return;

    if (!this.entities.pathfinder.checkValidPath(path)) {
      console.warn("handleMovePath: checkValidPath false.");
      p.resetMove(p.x,p.y);
      return;
    }

    if (!this.entities.pathfinder.isValidPath(p.map.grid, path)) {
      console.warn("handleMovePath: no valid path.");
      p.resetMove(p.x,p.y);
      return;
    }

    /*if (p.x != x || p.y != y) {
      console.warn("handleMovePath: invalid start coords.");
      return;
    }*/

    p.movePath([time, interrupted], path);

    var msg = new Messages.MovePath(p, path);
    this.entities.sendNeighbours(p, msg);
  },

  // TODO - enterCallback x,y not being overridden sometimes,
  // and sending to wrong Map.
  handleTeleportMap: function(msg) {
    console.info("handleTeleportMap");
    var self = this;
    var mapId = parseInt(msg[0]),
        status = parseInt(msg[1]);
    console.info("status="+status);
    var x = parseInt(msg[2]), y = parseInt(msg[3]);
    var p = this.player;
    if (status <= 0)
    {
      x = -1;
      y = -1;
    }

    var mapInstanceId = null;
    var mapName = null;

    if (mapId < 0 || mapId >= self.server.maps.length)
    {
      console.info("Map non-index");
      return;
    }

    var map = self.server.maps[mapId];
    if (!(map && map.ready)) {
      console.info("Map non-existant or not ready");
      return;
    }

    console.warn("mapIndex: p.map.mapIndex:"+map.index);
    if (status == 0) {
      p.pushSpawns = false;
      p.forceStop();
      p.mapStatus = 0;
      this.handleClearMap();

      this.entities.removePlayer(this.player);

      var finishTeleportMaps = function (mapId) {
        //console.info("real mapId: " + mapId);
        p.map = map;
        self.setMap(map);

        var pos = {x: p.x, y: p.y};
        console.info("handleTeleportMap - x: "+x+",y:"+y);

        console.warn("mapIndex: p.map.mapIndex:"+map.index);
        if (typeof p.prevPosX === "undefined" &&
            typeof p.prevPosY === "undefined")
        {
          pos = self.map.getRandomStartingPosition();
        }
        else if (p.map.mapIndex === 0)
        {

          p.prevPosX = p.x;
          p.prevPosY = p.y;
          pos = self.map.getRandomStartingPosition();
        }
        else if (p.map.mapIndex === 1)
        {
          pos = {x: p.prevPosX, y: p.prevPosY};
        }
        else {
          pos = self.map.getRandomStartingPosition();
        }

        self.entities.addPlayer(p);

        p.ex = p.sx = pos.x;
        p.ey = p.sy = pos.y;
        p.setPosition(pos.x, pos.y);
        p.move([Date.now(),3,1,pos.x,pos.y]);

        console.info("trying to send.");
        self.send([Types.Messages.WC_TELEPORT_MAP, mapId, 1, p.x, p.y]);
      };

      pos = map.enterCallback(p);
      finishTeleportMaps(mapId)
    }
    else if (status == 1) {
      p.mapStatus = 2;
      self.handleSpawnMap(mapId, p.x, p.y);

      self.send([Types.Messages.WC_TELEPORT_MAP, mapId, 2, p.x, p.y]);
    }
  },

  handleSpawnMap: function(mapId, x, y) {
    var p = this.player;

    p.knownIds = [];

    p.setPosition(x,y);
    this.entities.processWho(p);
    this.entities.sendNeighbours(p, new Messages.Spawn(p), p);
  },

  handleClearMap: function() {
    this.player.clearTarget();

    this.player.handleTeleport();
    this.entities.removeEntity(this.player);
  },

  handleStatAdd: function(message) {
    var self = this;
    var attribute = parseInt(message[0]),
        points = parseInt(message[1]);
    var p = this.player;

    if (points < 0 || points > p.stats.free)
      return;

    if (attribute < 0 || attribute > 4)
      return;

    switch (attribute) {
      case 1:
        p.stats.attack += points;
        break;
      case 2:
        p.stats.defense += points;
        break;
      case 3:
        p.stats.health += points;
        break;
      case 4:
        p.stats.luck += points;
        break;
    }
    p.stats.free -= points;
    p.resetBars();
    this.sendPlayer(new Messages.StatInfo(p));
  },

  handleGold: function (message) {
    var type = parseInt(message[0]),
        gold = parseInt(message[1]),
        type2 = parseInt(message[2]);

    if (gold < 0)
      return;

    if (gold > 9999999) {
      this.sendPlayer(new Messages.Notify("GOLD","MAX_TRANSFER"));
      return;
    }

    if (gold > this.player.gold[type])
    {
      this.sendPlayer(new Messages.Notify("GOLD","INSUFFICIENT_GOLD"));
      return;
    }

    // Transfer to bank.
    if (type===0 && type2===1)
    {
      if (!this.player.modifyGold(-gold, 0))
        return;
      this.player.modifyGold(gold, 1);
    }

    // Withdraw from bank.
    if (type===1 && type2===0)
    {
      if (!this.player.modifyGold(-gold, 1))
        return;
      this.player.modifyGold(gold, 0);
    }
  },

  handleBlock: function (msg) {
    var type = parseInt(msg[0]),
        id = parseInt(msg[1]),
        x = parseInt(msg[2]),
        y = parseInt(msg[3]);

    var p = this.player;

    var block = this.map.entities.getEntityById(id);
    if (!block || !(block instanceof Block))
      return;
    if (!p.isNextTooEntity(block))
      return;

    if (type == 0) // pickup
    {
      p.holdingBlock = block;
    }
    else if (type == 1) //place
    {
      x = Utils.roundTo(x, G_TILESIZE);
      y = Utils.roundTo(y, G_TILESIZE);

      if (this.map.isColliding(x, y))
        return;

      block.setPosition(x, y);
      block.update(this.player);
      p.holdingBlock = null;
    }
    var msg = new Messages.BlockModify(block, p.id, type);
    this.entities.sendNeighbours(p, msg, p);
  },

  handleRequest: function (msg) {
    var type = parseInt(msg);

    switch (type) {
      case 0: // CW_APPEARANCELIST
        this.handleAppearanceList(msg);
        break;
      case 1: // CW_PLAYER_REVIVE
        this.handleRevive(msg);
        break;
      case 2: // CW_PLAYERINFO
        this.handlePlayerInfo(msg);
        break;
      case 3: // CW_WHO REQUEST
        this.entities.processWho(this.player);
        break;
    }
  },

  handleAppearanceList: function (msg) {
    this.server.looks.sendLooks(this.player);
  },

  handleRevive: function(msg) {
    var p = this.player;
    if (p.isDead == true) {
      console.info("handled Revive!!");
      p.revive();
      this.entities.sendNeighbours(p, new Messages.Spawn(p), p);
      var msg = new Messages.Move(p, p.orientation, 2, p.x, p.y);
      this.sendPlayer(msg);
    }
  },

  handlePlayerInfo: function (msg) {
    this.sendPlayer(new Messages.PlayerInfo(this.player));
  },

  handleWho: function(message) {
    var ids = [];
    if (message.length > 0)
      ids = message;

    for(var id of ids)
      this.player.knownIds.splice(this.player.knownIds.indexOf(id), 1);
  },

  handleParty: function (msg) {
    var partyType = msg.shift();
    switch (partyType) {
      case 1:
        this.partyHandler.handleInvite(msg);
        break;
      case 2:
        this.partyHandler.handleKick(msg);
        break;
      case 3:
        this.partyHandler.handleLeader(msg);
        break;
      case 4:
        this.partyHandler.handleLeave(msg);
        break;
    }
  },

  handleHarvest: function (msg) {
    var self = this;
    var x=msg[0], y=msg[1];
    this.player.onHarvest(x,y);
  },

  handleUseNode: function (msg) {
    var id=parseInt(msg[0]);
    var entity = this.entities.getEntityById(id);
    this.player.onHarvestEntity(entity);
  },

});
