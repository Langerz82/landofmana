import _ from 'underscore';
import { Types } from './common.js';
//import Utils from './utils.js';

const Messages = {};
export default Messages;

class Message {

}

Messages.SyncTime = class extends Message {
    constructor(localtime) {
        super();
    	this.localtime = localtime;
    }
    serialize() {
        return [Types.Messages.BI_SYNCTIME,
          this.localtime, Date.now()];
    }
};

Messages.Spawn = class extends Message {
    constructor(entity) {
        super();
    	this.entity = entity;
    }
    serialize() {
        var spawn = [Types.Messages.WC_SPAWN];
        return spawn.concat(this.entity.getState());
    }
};

Messages.Despawn = class extends Message {
    constructor(entity) {
        super();
        this.id = entity.id;
        this.mapIndex = entity.map.index;
        this.x = entity.x;
        this.y = entity.y;

    }
    serialize() {
        return [Types.Messages.WC_DESPAWN, this.id,
                this.mapIndex, this.x, this.y];
    }
};

/*Messages.SwapSprite = class extends Message {
    constructor(entity, animId) {
        super();
    	this.entity = entity;
      //this.spriteId = spriteId;
      this.animId = animId;
    }
    serialize() {
        return [Types.Messages.WC_SWAPSPRITE,
          this.entity.id, this.entity.kind, this.animId];
    }
};*/

Messages.Move = class extends Message {
    constructor(entity, orientation, state, x, y) {
        super();
        this.time = Date.now(),
        this.entity = entity,
        this.orientation = orientation;
        this.state = state;
        this.x = x || this.entity.x;
        this.y = y || this.entity.y;
    }
    serialize() {
        return [Types.Messages.WC_MOVE,
            this.time,
            this.entity.map.index,
            this.entity.id,
        		parseInt(this.orientation, 10),
        		this.state,
            this.entity.moveSpeed,
            this.x,
            this.y];
    }
};

Messages.MovePath = class extends Message {
    constructor(entity, path) {
        super();
        this.time = Date.now(),
        this.entity = entity,
        this.path = path,
        this.orientation = entity.orientation;
    }
    serialize() {
        return ([Types.Messages.WC_MOVEPATH,
              this.time,
              this.entity.map.index,
            	this.entity.id,
          		parseInt(this.orientation, 10),
              this.entity.interrupted = (this.entity.interrupted ? 1 : 0),
              this.entity.moveSpeed,
            ]).concat(this.path);
    }
};

Messages.ChangePoints = class extends Message {
    constructor(entity, modhp, modep) {
        super();
        this.id = entity.id;
        this.hp = entity.stats.hp;
        this.hpMax = entity.stats.hpMax;
        this.ep = entity.stats.ep || 0;
        this.epMax = entity.stats.epMax || 0;
        this.modhp = modhp;
        this.modep = modep;
    }
    serialize() {
        return [Types.Messages.WC_CHANGEPOINTS,
          this.id,
          this.hp, this.hpMax, this.modhp,
          this.ep, this.epMax, this.modep];
    }
};

Messages.Error = class extends Message {
  constructor(message) {
    super();
    this.message = message;
  }
  serialize() {
    return [Types.Messages.WC_ERROR,
            this.message];
  }
};

Messages.Notify = class extends Message {
  constructor(group, message, vars) {
    super();
    this.group = group;
    this.message = message;
    this.vars = vars || [];
  }
  serialize() {
    var arr =[Types.Messages.WC_NOTIFY,
        this.group,
        this.message]
    return arr.concat(this.vars);
  }
};

Messages.Dialogue = class extends Message {
    constructor(npc, langcode, vars) {
        super();
        this.id = npc.id;
        this.langcode = langcode;
        this.vars = vars || [];
    }
    serialize() {
        return [Types.Messages.WC_DIALOGUE, this.id, this.langcode].concat(this.vars);
    }
};

/*Messages.DialogueQuest = class extends Messages.Dialogue {
  constructor(npc, langcode, questId, vars) {
      super();
      this.id = npc.id;
      this.langcode = langcode;
      this.questId = questId;
      this.vars = vars || [];
  }
};*/

Messages.Quest = class extends Message {
    constructor(quest) {
        super();
        this.quest = quest;
    }
    serialize(){
        var arr = this.quest.toClient();
        return ([Types.Messages.WC_QUEST]).concat(arr);
    }
};

Messages.Achievement = class extends Message {
    constructor(achievement) {
        super();
        this.achievement = achievement;
    }
    serialize(){
        var arr = this.achievement.toClient(this.achievement);
        return ([Types.Messages.WC_ACHIEVEMENT]).concat(arr);
    }
};

Messages.Log = class extends Message {
    constructor(message) {
        super();
        this.message = message;
        this.message.unshift(Types.Messages.WC_LOG);
    }
    serialize() {
        return this.message;
    }
};


Messages.SkillLoad = class extends Message {
    constructor(index, exp) {
        super();
        this.index = index;
        this.exp = exp;
    }
    serialize() {
        return [Types.Messages.WC_SKILLLOAD,
            this.index,
            this.exp];
    }
};

Messages.SkillEffects = class extends Message {
    constructor(player, effects) {
        super();
        this.id = player.id;
        this.effects = effects;
    }
    serialize() {
        return ([Types.Messages.WC_SKILLEFFECTS,
            this.id]).concat(this.effects);
    }
};

Messages.SkillXP = class extends Message {
    constructor(skillXPs) {
        super();
        this.skillXPs = skillXPs;
    }
    serialize() {
        var arr = [Types.Messages.WC_SKILLXP];
        arr.push(skillXPs.length);
        arr.concat(skillXPs);
        return arr;
    }
};

Messages.Chat = class extends Message {
    constructor(player, group, message) {
        super();
        this.playerId = player.id;
        this.group = group;
        this.message = message;
    }
    serialize() {
        return [Types.Messages.WC_CHAT,
                this.playerId,
                this.group,
                this.message];
    }
};

Messages.TeleportMap = class extends Message {
    constructor(entity, subIndex, status) {
        super();
        this.entity = entity,
        this.subIndex = subIndex,
        this.status = status;
    }
    serialize() {
        return [Types.Messages.WC_TELEPORT_MAP,
                this.entity.map.index,
        	      this.subIndex,
                this.status,
                this.entity.x,
                this.entity.y];
    }
};

// (entity1, entity2, hpMod, hp, maxHp, crit, effects)

Messages.Damage = class extends Message {
    constructor(data) {
        super();
        var attacker = data[0];
        var target = data[1];
        this.entity1 = attacker;
        this.entity2 = target;
        this.hpMod = data[2];
        this.hp = target.stats.hp;
        this.hpMax = target.stats.hpMax;
        this.epMod = data[3];
        this.ep = target.stats.ep || 0;
        this.epMax = target.stats.epMax || 0;
        this.crit = (data[4]) ? 1 : 0;
        this.effects = data[5];
    }
    serialize() {
        var arr = [Types.Messages.WC_DAMAGE,
          this.entity1.id,
          this.entity2.id,
          this.entity1.orientation,
          this.hpMod,
          this.hp,
          this.hpMax,
          this.epMod,
          this.ep,
          this.epMax,
  	      this.crit];
        if (Array.isArray(this.effects) && this.effects.length > 0)
          arr.concat(this.effects);
        return arr;
    }
};

Messages.StatInfo = class extends Message {
    constructor(player) {
        super();
        this.player = player;
    }
    serialize() {
      var stats = this.player.stats;
      var data = [Types.Messages.WC_STATINFO,
      	    stats.attack,
      	    stats.defense,
      	    stats.health,
      	    stats.energy,
      	    stats.luck,
      	    stats.free,
            stats.hp,
            stats.hpMax,
            stats.ep,
            stats.epMax
      ];
      return data;
    }
};

Messages.UpdateLook = class extends Message {
    constructor(player) {
        super();
        this.player = player;
    }
    serialize() {
      return [Types.Messages.WC_LOOKUPDATE,
            this.player.id,
            this.player.sprites[0],
      	    this.player.sprites[1],
      	    this.player.colors[0],
      	    this.player.colors[1]];
    }
};

Messages.AppearanceList = class extends Message {
    constructor(user, looks) {
        super();
        this.looks = Utils.BinArrayToBase64(user.looks);
        this.prices = looks.prices;
    }
    serialize() {
        return [Types.Messages.WC_APPEARANCE, this.looks].concat(this.prices);
    }
};

// type 0 - INVENTORY
// type 1 - BANK
// type 2 - EQUIPMENT

Messages.ItemSlot = class extends Message {
  constructor(type, items) {
    super();
    this.type = type;
    this.items = items;
  }
  serialize() {
  		var msg = [Types.Messages.WC_ITEMSLOT,
        this.type,
        this.items.length];
        for (var item of this.items) {
          var arr = null;
          if (item.itemKind === -1)
            arr = [item.slot, item.itemKind];
          else {
            //log.warn("Messages.ItemSlot - item:" + JSON.stringify(item));
            arr = item.toArray();
          }
          msg = msg.concat(arr);
        }
      return msg;
   }
};

Messages.ItemLevelUp = class extends Message {
  constructor(index, item) {
    super();
    this.index = index;
    this.item = item;
  }
  serialize() {
  	if (this.item) {
    	return [Types.Messages.WC_ITEMLEVELUP,
    		this.index,
    		this.item.itemNumber,
    		this.item.itemExperience];
  	}
  }
};

Messages.Stat = class extends Message {
    constructor(type, value, change) {
        super();
        this.type = type;
        this.value = value;
        this.change = change;
    }
    serialize() {
        return [Types.Messages.WC_STAT,
                this.type,
                this.value,
                this.change];
    }
};

Messages.LevelUp = class extends Message {
    constructor(type, level, exp) {
        super();
        this.type = type;
        this.level = level;
        this.exp = exp;
    }
    serialize() {
        return [Types.Messages.WC_LEVELUP,
                this.type,
                this.level,
                this.exp];
    }
};

Messages.List = class extends Message {
    constructor(ids) {
        super();
        this.ids = ids;
    }
    serialize() {
        var list = this.ids;
        list.unshift(Types.Messages.WC_LIST);
        //console.info(JSON.stringify(list));
        return list;
    }
};

Messages.AuctionOpen = class extends Message {
    constructor(itemData) {
        super();
        this.itemData = itemData;
    }
    serialize() {
        return this.itemData;
    }
};

Messages.Speech = class extends Message {
    constructor(entity, kind, value) {
        super();
       this.entityid = entity.id;
    	 this.kind = kind;
    	 this.value = value;
    }
    serialize() {
        return [Types.Messages.WC_SPEECH, this.entityid, this.kind, this.value];
    }
};

Messages.Gold = class extends Message {
	constructor(player) {
	    super();
		this.invgold = player.items.gold[0];
    this.bankgold = player.items.gold[1];
    this.gems = player.user.gems;
	}
	serialize() {
		return [Types.Messages.WC_GOLD, this.invgold, this.bankgold,
          this.gems];
  }
};

Messages.BlockModify = class extends Message {
    constructor(entity, id, state) {
        super();
    	this.entity = entity;
      this.id = id;
      this.state = state;
    }
    serialize() {
        var spawn = [Types.Messages.WC_SPAWN, this.id, this.state];
        return spawn.concat(this.entity.getState());
    }
};

Messages.PartyInvite = class extends Message {
    constructor(id) {
        super();
        this.id = id;
    }
    serialize() {
        return [Types.Messages.WC_PARTY, 2, this.id];
    }
};

Messages.Party = class extends Message {
    constructor(members) {
        super();
        this.members = members;
    }
    serialize() {
        return [Types.Messages.WC_PARTY, 1].concat(this.members);
    }
};

Messages.PlayerInfo = class extends Message {
    constructor(player) {
        super();
        this.player = player;
    }
    serialize() {
        return [Types.Messages.WC_PLAYERINFO,
          this.player.stats.exp.base,
          this.player.stats.exp.attack,
          this.player.stats.exp.defense,
          this.player.stats.exp.sword,
          this.player.stats.exp.bow,
          this.player.stats.exp.hammer,
          this.player.stats.exp.axe,
          this.player.stats.exp.logging,
          this.player.stats.exp.mining
        ];
    }
};

/*Messages.Looks = class extends Message {
    constructor(player) {
        super();
        this.player = player;
        this.sprite1 = player.sprites[0];
        this.sprite2 = player.getWeaponSprite();
        if (player.isArcher()) {
          this.sprite1 = player.sprites[2];
          //this.sprite2 = player.sprites[3];
        }
    }
    serialize() {
        return [Types.Messages.WC_LOOKS,
          this.player.id,
          (this.player.isArcher() ? 1 : 0), //].concat(this.player.sprites);
          this.sprite1,
          this.sprite2];
    }
};*/

Messages.setSprite = class extends Message {
    constructor(entity, sprite1, sprite2, animName) {
        super();
        this.id = entity.id;
        this.sprite1 = sprite1;
        this.sprite2 = sprite2;
        this.animName = animName;
    }
    serialize() {
        var arr = [Types.Messages.WC_SET_SPRITE,
          this.id,
          this.sprite1];
        if (typeof(this.sprite2) !== 'undefined')
          arr.push(this.sprite2);
        if (typeof(this.animName) !== 'undefined')
          arr.push(this.animName);
        return arr;
    }
};

Messages.setAnimation = class extends Message {
    constructor(entity, animation) {
        super();
        this.id = entity.id;
        this.animation = animation;
    }
    serialize() {
        return [Types.Messages.WC_SET_ANIMATION,
          this.id,
          this.animation];
    }
};

Messages.Harvest = class extends Message {
    constructor(player, action, gx, gy, duration) {
        super();
        this.duration = duration || 0;
        this.id = player.id;
        this.action = action;
        this.gx = gx;
        this.gy = gy;
    }
    serialize() {
        var arr = [Types.Messages.WC_HARVEST,
          this.id,
          this.action,
          this.gx,
          this.gy];
        if (this.duration > 0)
          arr.push(this.duration);
        return arr;
    }
};
