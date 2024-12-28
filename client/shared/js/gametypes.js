/* global bootKind, _, exports, module, Types */

EventType = {
  KILLMOB: 1,
  LOOTITEM: 2,
  KILLPLAYER: 3,
  DAMAGE: 4,
  USE_NODE: 5,
  HARVEST: 6
};

QuestType = {
  KILLMOBKIND: 1,
  GETITEMKIND: 2,
  KILLMOBS: 3,
  HIDEANDSEEK: 4,
  USENODE: 5
};

QuestStatus = {
  STARTED: 0,
  INPROGRESS: 1,
  COMPLETE: 2
};

InventoryMode = {
  MODE_NORMAL: 0,
  MODE_SELL: 1,
  MODE_REPAIR: 2,
  MODE_ENCHANT: 3,
  MODE_BANK: 4,
  MODE_AUCTION: 5
};

SkillEffects = {
  SkillType: {
    SELF: 0,
    TARGET: 1,
    ATTACK: 2
  },
  TargetType: {
    SELF: 0,
    ENEMY: 1,
    PLAYER_AOE: 2,
    ENEMY_AOE: 3
  },
  EffectStat: {
    HP: 0,
    EP: 1,
    ATTACK: 2,
    DEFENSE: 3,
    DAMAGE: 4,
    FREEZE: 5,
    MOVESPEED: 6
  }
};

Types = {
    UserMessages: {
      CU_CONNECT_USER: 1,
      CU_CREATE_USER: 2,
      CU_LOGIN_USER: 3,
      CU_CREATE_PLAYER: 4,
      CU_LOGIN_PLAYER: 5,
      CU_REMOVE_USER: 6,

      UC_WORLD_READY: 101,
      UC_WORLDS: 102,
      UC_VERSION: 103,
      UC_PLAYER_SUM: 104,
      UC_ERROR: 105,

      WU_CONNECT_WORLD: 501,
      WU_GAMESERVER_INFO: 502,
      WU_PLAYER_LOADED: 503,
      WU_SAVE_PLAYER_AUCTIONS: 504,
      WU_SAVE_PLAYER_LOOKS: 505,
      WU_SAVE_PLAYERS_LIST: 506,
      WU_SAVE_PLAYER_DATA: 507,

      UW_LOAD_PLAYER_AUCTIONS: 601,
      UW_LOAD_PLAYER_LOOKS: 602,
      UW_WORLD_SAVE: 603,
      UW_WORLD_CLOSE: 604,
      UW_LOAD_PLAYER_DATA: 605
    },

    Messages: {
      BI_SYNCTIME: 200,

      CW_LOGIN_PLAYER: 201,
      CW_ITEMSLOT: 202,
      CW_APPEARANCEUNLOCK: 203,
      CW_ATTACK: 204,
      CW_AUCTIONBUY: 205,
      CW_AUCTIONDELETE: 206,
      CW_AUCTIONOPEN: 207,
      CW_AUCTIONSELL: 208,
      CW_BANKRETRIEVE: 209,
      CW_BANKSTORE: 210,
      CW_CHAT: 211,
      CW_COLOR_TINT: 212,
      CW_BLOCK_MODIFY: 213,
      CW_GOLD: 214,
      CW_PARTY: 215,
      CW_HARVEST: 216,
      CW_USE_NODE: 217,
      CW_LOOKUPDATE: 218,
      CW_LOOT: 219,
      CW_MOVE: 220,
      CW_MOVEPATH: 221,
      CW_QUEST: 222,
      CW_STATADD: 223,
      CW_STOREBUY: 224,
      CW_STORE_MODITEM: 225,
      CW_STORESELL: 226,
      CW_TALKTONPC: 227,
      CW_CRAFT: 228,
      CW_TELEPORT_MAP: 229,
      CW_WHO: 230,
      CW_SKILL: 231,
      CW_SHORTCUT: 232,
      CW_REQUEST: 233,

      WC_ERROR: 300,
      WC_PLAYER: 301,
      WC_ACHIEVEMENT: 302,
      WC_AUCTIONOPEN: 303,
      WC_ITEMSLOT: 304,
      WC_CHANGEPOINTS: 305,
      WC_CHAT: 306,
      WC_COLOR_TINT: 307,
      WC_DAMAGE: 308,
      WC_DESPAWN: 309,
      WC_SWAPSPRITE: 310,
      WC_APPEARANCE: 311,
      WC_GOLD: 312,
      WC_PARTY: 313,
      WC_PLAYERINFO: 314,
      WC_ITEMLEVELUP: 315,
      WC_STAT: 316,
      WC_LEVELUP: 317,
      WC_LIST: 318,
      WC_LOOKS: 319,
      WC_LOG: 320,
      WC_HARVEST: 321,
      WC_MOVE: 322,
      WC_MOVEPATH: 323,
      WC_NOTIFY: 324,
      WC_QUEST: 325,
      WC_SKILLEFFECTS: 326,
      WC_SKILLLOAD: 327,
      WC_SPAWN: 328,
      WC_SPEECH: 329,
      WC_STATINFO: 330,
      WC_TELEPORT_MAP: 331,
      WC_SKILL_XP: 332,
      WC_DIALOGUE: 333,
      WC_SET_SPRITE: 334,
      WC_SET_ANIMATION: 335,
      WC_BLOCK_MODIFY: 336,
      WC_PLAYERINFO: 337,
      WC_VERSION: 338
    },

    Orientations: {
        NONE: 0,
        UP: 1,
        DOWN: 2,
        LEFT: 3,
        RIGHT: 4
    },

    EntityTypes: {
      NONE: 0,
      PLAYER: 1,
      MOB: 2,
      ITEM: 3,
      ITEMLOOT: 4,
      NPCSTATIC: 5,
      NPCMOVE: 6,
      CHEST: 7,
      BLOCK: 8,
      TRAP: 9,
      NODE: 10,
    },

    Keys: {
        ENTER: 13,
        UP: 38,
        DOWN: 40,
        LEFT: 37,
        RIGHT: 39,
        W: 87,
        A: 65,
        S: 83,
        D: 68,
        SPACE: 32,
        I: 73,
        H: 72,
        M: 77,
        P: 80,
        T: 84,
        Y: 89,
        KEYPAD_4: 100,
        KEYPAD_6: 102,
        KEYPAD_8: 104,
        KEYPAD_2: 98,
        KEY_0: 48,
        KEY_1: 49,
        KEY_2: 50,
        KEY_3: 51,
        KEY_4: 52,
        KEY_5: 53,
        KEY_6: 54,
        KEY_7: 55,
        KEY_8: 56,
        KEY_9: 57
    },

    Skills: {
      BLOODSUCKING: 1,
      RECOVERHEALTH: 2,
      HEALANDHEAL: 3,
      AVOIDATTACK: 4,
      ADDEXPERIENCE: 5,
      ATTACKWITHBLOOD: 6,
      CRITICALATTACK: 7,
      CRITICALRATIO: 8
    },

    PlayerClass: {
      FIGHTER: 0,
      ARCHER: 1,
      DEFENDER: 2,
      MAGE: 3
    },

    PlayerState: {
    	Roaming: 0,
    	Moving: 1,
    	Following: 2,
    	Aggro: 3,
    	Hurting: 4,
    	GettingItems: 5,
    	FollowPlayer: 6,
    },
};

var EntityTypes = Types.EntityTypes;

Types.expForLevel = [];
Types.defenseExp = [];
Types.attackExp = [];
Types.moveExp = [];
Types.skillExp = [];
Types.weaponExp = [];

Types.expForLevel[0] = 0;
Types.defenseExp[0] = 0;
Types.attackExp[0] = 0;
Types.moveExp[0] = 0;
Types.skillExp[0] = 0;
Types.weaponExp[0] = 0;

for(i=1; i < 50; i++){
    var points = Math.floor((i * 300) * Math.pow(1.5, i / 5.));
    console.info("level_"+i+"="+points);
    Types.expForLevel[i] = points;
    Types.defenseExp[i] = (points * 10)+50;
    Types.attackExp[i] = (points * 10)+50;
    Types.moveExp[i] = (points * 5)+20;
    Types.skillExp[i] = ~~(points / 1.5);
    Types.weaponExp[i] = (points * 10)+50;
};


Types.getLevel = function(exp){
    if (typeof(exp)=='undefined' || exp==0) return 1;
    for(var i=1; i < 200; i++){
        if(exp < Types.expForLevel[i]){
            return i;
        }
    }
    return 50;
};

Types.getAttackLevel = function(exp){
    if (exp==0) return 1;
    for(var i=1; i < 200; i++){
        if(exp < Types.attackExp[i]){
            return i;
        }
    }
    return 50;
};

Types.getDefenseLevel = function(exp){
    if (exp==0) return 1;
    for(var i=1; i < 200; i++){
        if(exp < Types.defenseExp[i]){
            return i;
        }
    }
    return 50;
};

Types.getMoveLevel = function(exp){
    if (exp==0) return 1;
    for(var i=1; i < 200; i++){
        if(exp < Types.moveExp[i]){
            return i;
        }
    }
    return 50;
};

Types.getWeaponLevel = function(exp){
    if (exp==0) return 1;
    for(var i=1; i < 200; i++){
        if(exp < Types.weaponExp[i]){
            return i;
        }
    }
    return 50;
};

Types.getSkillLevel = function(exp, level) {
    level = level || 1;
    if (typeof(exp)=='undefined' || exp==0) return 1;
    for(var i=level; i < 20; i++){
        if(exp < Types.skillExp[i]){
            return i;
        }
    }
    return 20;
};

Types.isPlayer = function(kind) {
	if (kind === 1 || kind === 222)
		return true;
	return false;
};

Types.getOrientationAsString = function(orientation) {
    switch(orientation) {
        case Types.Orientations.LEFT: return "left"; break;
        case Types.Orientations.RIGHT: return "right"; break;
        case Types.Orientations.UP: return "up"; break;
        case Types.Orientations.DOWN: return "down"; break;
    }
};

Types.getMessageTypeAsString = function(type) {
    var typeName;
    _.each(Types.Messages, function(value, name) {
        if(value === type) {
            typeName = name;
        }
    });
    if(!typeName) {
        typeName = "UNKNOWN";
    }
    return typeName;
};


if(!(typeof exports === 'undefined')) {
    module.exports = Types;
}
