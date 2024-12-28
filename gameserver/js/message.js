var _ = require('underscore');
var cls = require('./lib/class');
//var Quest = require('./quest');

var Messages = {};
module.exports = Messages;

var Message = cls.Class.extend({

});

Messages.Spawn = Message.extend({
    init: function (entity) {
    	this.entity = entity;
    },
    serialize: function () {
        var spawn = [Types.Messages.WC_SPAWN];
        return spawn.concat(this.entity.getState());
    }
});

Messages.Despawn = Message.extend({
    init: function (entity) {
        this.id = entity.id;
        this.mapIndex = entity.map.index;
        this.x = entity.x;
        this.y = entity.y;

    },
    serialize: function () {
        return [Types.Messages.WC_DESPAWN, this.id,
                this.mapIndex, this.x, this.y];
    }
});

Messages.SwapSprite = Message.extend({
    init: function (entity, animId) {
    	this.entity = entity;
      //this.spriteId = spriteId;
      this.animId = animId;
    },
    serialize: function () {
        return [Types.Messages.WC_SWAPSPRITE,
          this.entity.id, this.entity.kind, this.animId];
    }
});

Messages.Move = Message.extend({
    init: function (entity, orientation, state, x, y) {
        this.time = Date.now(),
        this.entity = entity,
        this.orientation = orientation;
        this.state = state;
        this.x = x || this.entity.x;
        this.y = y || this.entity.y;
    },
    serialize: function () {
        return [Types.Messages.WC_MOVE,
            this.time,
            this.entity.map.index,
            this.entity.id,
        		parseInt(this.orientation),
        		this.state,
            this.entity.moveSpeed,
            this.x,
            this.y];
    }
});

Messages.MovePath = Message.extend({
    init: function (entity, path) {
        this.time = Date.now(),
        this.entity = entity,
        this.path = path,
        this.orientation = entity.orientation;
    },
    serialize: function () {
        return ([Types.Messages.WC_MOVEPATH,
              this.time,
              this.entity.map.index,
            	this.entity.id,
          		parseInt(this.orientation),
              this.entity.interrupted = (this.entity.interrupted ? 1 : 0),
              this.entity.moveSpeed,
            ]).concat(this.path);
    }
});

/*Messages.Attack = Message.extend({
    init: function(attackerId, targetId) {
        this.attackerId = attackerId;
        this.targetId = targetId;
    },
    serialize: function() {
        return [Types.Messages.WC_ATTACK,
            this.attackerId,
            this.targetId];
    }
});*/


/*Messages.Health = Message.extend({
    init: function (id, points, isRegen) {
    	  this.id = id;
        this.points = points;
        this.isRegen = isRegen;
    },
    serialize: function() {
        var health = [Types.Messages.WC_HEALTH,
                      this.id, this.points];
        if (this.isRegen)
            health.push(1);
        return health;
    }
});*/

Messages.ChangePoints = Message.extend({
    init: function(entity, modhp, modep) {
        this.id = entity.id;
        this.hp = entity.stats.hp;
        this.hpMax = entity.stats.hpMax;
        this.ep = entity.stats.ep || 0;
        this.epMax = entity.stats.epMax || 0;
        this.modhp = modhp;
        this.modep = modep;
    },
    serialize: function() {
        return [Types.Messages.WC_CHANGEPOINTS,
          this.id,
          this.hp, this.hpMax, this.modhp,
          this.ep, this.epMax, this.modep];
    }
});

Messages.Error = Message.extend({
  init: function(message) {
    this.message = message;
  },
  serialize: function() {
    return [Types.Messages.WC_ERROR,
            this.message];
  }
});

Messages.Notify = Message.extend({
  init: function(group, message, vars) {
    this.group = group;
    this.message = message;
    this.vars = vars || [];
  },
  serialize: function() {
    var arr =[Types.Messages.WC_NOTIFY,
        this.group,
        this.message]
    return arr.concat(this.vars);
  }
});

Messages.Dialogue = Message.extend({
    init: function (npc, langcode, vars) {
        this.id = npc.id;
        this.langcode = langcode;
        this.vars = vars || [];
    },
    serialize: function () {
        return [Types.Messages.WC_DIALOGUE, this.id, this.langcode].concat(this.vars);
    }
});

Messages.Quest = Message.extend({
    init: function(quest) {
        this.quest = quest;
    },
    serialize: function(){
        var arr = this.quest.toClient();
        return ([Types.Messages.WC_QUEST]).concat(arr);
    }
});

Messages.Achievement = Message.extend({
    init: function(achievement) {
        this.achievement = achievement;
    },
    serialize: function(){
        var arr = this.achievement.toClient(this.achievement);
        return ([Types.Messages.WC_ACHIEVEMENT]).concat(arr);
    }
});

/*Messages.Drop = Message.extend({
    init: function (item, x, y) {
        this.item = item;
        this.x = x || this.mob.x;
        this.y = y || this.mob.y;
    },
    serialize: function() {
        var drop = [Types.Messages.WC_DROP,
                    this.item.map.index,
                    this.item.id,
                    this.item.room.itemKind,
                    this.item.room.itemNumber,
                    this.x,
        	    	    this.y];
        return drop;
    }
});*/


Messages.Log = Message.extend({
    init: function(message) {
        this.message = message;
        this.message.unshift(Types.Messages.WC_LOG);
    },
    serialize: function() {
        return this.message;
    }
});


Messages.SkillLoad = Message.extend({
    init: function(index, exp) {
        this.index = index;
        this.exp = exp;
    },
    serialize: function() {
        return [Types.Messages.WC_SKILLLOAD,
            this.index,
            this.exp];
    }
});

Messages.SkillEffects = Message.extend({
    init: function(player, effects) {
        this.id = player.id;
        this.effects = effects;
    },
    serialize: function() {
        return ([Types.Messages.WC_SKILLEFFECTS,
            this.id]).concat(this.effects);
    }
});

Messages.SkillXP = Message.extend({
    init: function(skillXPs) {
        this.skillXPs = skillXPs;
    },
    serialize: function() {
        var arr = [Types.Messages.WC_SKILLXP];
        arr.push(skillXPs.length);
        arr.concat(skillXPs);
        return arr;
    }
});

Messages.Chat = Message.extend({
    init: function (player, group, message) {
        this.playerId = player.id;
        this.group = group;
        this.message = message;
    },
    serialize: function () {
        return [Types.Messages.WC_CHAT,
                this.playerId,
                this.group,
                this.message];
    }
});

Messages.TeleportMap = Message.extend({
    init: function (entity, subIndex, status) {
        this.entity = entity,
        this.subIndex = subIndex,
        this.status = status;
    },
    serialize: function () {
        return [Types.Messages.WC_TELEPORT_MAP,
                this.entity.getMapIndex(),
        	      this.subIndex,
                this.status,
                this.entity.x,
                this.entity.y];
    }
});

// (entity1, entity2, hpMod, hp, maxHp, crit, effects)

Messages.Damage = Message.extend({
    init: function (data) {
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
    },
    serialize: function () {
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
});

Messages.StatInfo = Message.extend({
    init: function(player) {
        this.player = player;
    },
    serialize: function() {
      var data = [Types.Messages.WC_STATINFO,
      	    this.player.stats.attack,
      	    this.player.stats.defense,
      	    this.player.stats.health,
      	    this.player.stats.energy,
      	    this.player.stats.luck,
      	    this.player.stats.free,
      ];
      return data;
    }
});

Messages.UpdateLook = Message.extend({
    init: function(player) {
        this.player = player;
    },
    serialize: function() {
      return [Types.Messages.WC_LOOKUPDATE,
            this.player.id,
            this.player.sprites[0],
      	    this.player.sprites[1],
      	    this.player.colors[0],
      	    this.player.colors[1]];
    }
});

Messages.AppearanceList = Message.extend({
    init: function(user, looks) {
        this.looks = Utils.BinArrayToBase64(user.looks);
        this.prices = looks.prices;
    },
    serialize: function() {
        return [Types.Messages.WC_APPEARANCE, this.looks].concat(this.prices);
    }
});

// type 0 - INVENTORY
// type 1 - BANK
// type 2 - EQUIPMENT

Messages.ItemSlot = Message.extend({
  init: function(type, items) {
    this.type = type;
    this.items = items;
  },
  serialize: function() {
  		var msg = [Types.Messages.WC_ITEMSLOT,
        this.type,
        this.items.length];
        for (var item of this.items) {
          var arr = null;
          if (item.itemKind == -1)
            arr = [item.slot, item.itemKind];
          else {
            //log.warn("Messages.ItemSlot - item:" + JSON.stringify(item));
            arr = item.toArray();
          }
          msg = msg.concat(arr);
        }
      return msg;
   }
});

Messages.ItemLevelUp = Message.extend({
  init: function(index, item) {
    this.index = index;
    this.item = item;
  },
  serialize: function() {
  	if (this.item) {
    	return [Types.Messages.WC_ITEMLEVELUP,
    		this.index,
    		this.item.itemNumber,
    		this.item.itemExperience];
  	}
  }
});

/*Messages.Kill = Message.extend({
    init: function (entity, exp) {
        this.entity = entity;
        //this.level = level;
        //this.exp = exp;
    },
    serialize: function () {
        return [Types.Messages.WC_KILL,
                this.entity ? this.entity.id : -1];
    }
});*/

Messages.Stat = Message.extend({
    init: function (type, value, change) {
        this.type = type;
        this.value = value;
        this.change = change;
    },
    serialize: function () {
        return [Types.Messages.WC_STAT,
                this.type,
                this.value,
                this.change];
    }
});

Messages.LevelUp = Message.extend({
    init: function (type, level, exp) {
        this.type = type;
        this.level = level;
        this.exp = exp;
    },
    serialize: function () {
        return [Types.Messages.WC_LEVELUP,
                this.type,
                this.level,
                this.exp];
    }
});

Messages.List = Message.extend({
    init: function (ids) {
        this.ids = ids;
    },
    serialize: function () {
        var list = this.ids;
        list.unshift(Types.Messages.WC_LIST);
        //console.info(JSON.stringify(list));
        return list;
    }
});

Messages.AuctionOpen = Message.extend({
    init: function (itemData) {
        this.itemData = itemData;
    },
    serialize: function () {
        return this.itemData;
    }
});

Messages.Speech = Message.extend({
    init: function (entity, kind, value) {
       this.entityid = entity.id;
    	 this.kind = kind;
    	 this.value = value;
    },
    serialize: function () {
        return [Types.Messages.WC_SPEECH, this.entityid, this.kind, this.value];
    }
});

Messages.Gold = Message.extend({
	init: function (player) {
		this.invgold = player.gold[0];
    this.bankgold = player.gold[1];
    this.gems = player.user.gems;
	},
	serialize: function () {
		return [Types.Messages.WC_GOLD, this.invgold, this.bankgold,
          this.gems];
  }
});

Messages.BlockModify = Message.extend({
    init: function (entity, id, state) {
    	this.entity = entity;
      this.id = id;
      this.state = state;
    },
    serialize: function () {
        var spawn = [Types.Messages.WC_SPAWN, this.id, this.state];
        return spawn.concat(this.entity.getState());
    }
});

Messages.PartyInvite = Message.extend({
    init: function(id) {
        this.id = id;
    },
    serialize: function() {
        return [Types.Messages.WC_PARTY, 2, this.id];
    }
});

Messages.Party = Message.extend({
    init: function (members) {
        this.members = members;
    },
    serialize: function () {
        return [Types.Messages.WC_PARTY, 1].concat(this.members);
    }
});

Messages.PlayerInfo = Message.extend({
    init: function (player) {
        this.player = player;
    },
    serialize: function () {
        return [Types.Messages.WC_PLAYERINFO,
          this.player.exp.base,
          this.player.exp.attack,
          this.player.exp.defense,
          this.player.exp.sword,
          this.player.exp.bow,
          this.player.exp.hammer,
          this.player.exp.axe,
          this.player.exp.logging,
          this.player.exp.mining
        ];
    }
});

Messages.Looks = Message.extend({
    init: function (player) {
        this.player = player;
        this.sprite1 = player.sprites[0];
        this.sprite2 = player.getWeaponSprite();
        if (player.isArcher()) {
          this.sprite1 = player.sprites[2];
          //this.sprite2 = player.sprites[3];
        }
    },
    serialize: function () {
        return [Types.Messages.WC_LOOKS,
          this.player.id,
          (this.player.isArcher() ? 1 : 0), //].concat(this.player.sprites);
          this.sprite1,
          this.sprite2];
    }
});

Messages.setSprite = Message.extend({
    init: function (entity, sprite1, sprite2) {
        this.id = entity.id;
        this.sprite1 = sprite1;
        this.sprite2 = sprite2 || 0;
    },
    serialize: function () {
        return [Types.Messages.WC_SET_SPRITE,
          this.id,
          this.sprite1,
          this.sprite2];
    }
});

Messages.setAnimation = Message.extend({
    init: function (entity, animation) {
        this.id = entity.id;
        this.animation = animation;
    },
    serialize: function () {
        return [Types.Messages.WC_SET_ANIMATION,
          this.id,
          this.animation];
    }
});

Messages.Harvest = Message.extend({
    init: function (player, action, gx, gy, duration) {
        this.duration = duration || 0;
        this.id = player.id;
        this.action = action;
        this.gx = gx;
        this.gy = gy;
    },
    serialize: function () {
        var arr = [Types.Messages.WC_HARVEST,
          this.id,
          this.action,
          this.gx,
          this.gy];
        if (this.duration > 0)
          arr.push(this.duration);
        return arr;
    }
});
