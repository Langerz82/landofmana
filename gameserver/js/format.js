import { Types } from './common.js';
import _ from 'underscore';
/* global NotifyData */

const itemKindMax = 999;
const itemNumberMax = 100;
const itemDurabilityMax = 1000;
const itemExperienceMax = 9999999;
const itemPriceMax = 99999999;
const itemStoreMax = 96;
const itemInventoryMax = 50;
const itemBankMax = 96;
const itemEquipmentMax = 5;
const itemStoreTypeMax = 2;

const craftIdMax = 99;
const craftItemCount = 100;

const auctionEntriesMax = 9999;
const auctionActionMax = 3;

const achievementIndexMax = 99;
const achievementRankMax = 10;
const achievementCountMax = 999999;

const skillsXPMax = 999999999;
const mapsCountMax = 10;
const mapCoordsMax = 16384;
const mapIndexMax = 9;
const orientationsMax = 4;
const entityIdMax = 99999;
const mapStatusMax = 3;

var questCountMax = 999;
const questIdMax = 999999999999999;
const questTypeMax = 9;
const questNpcIdMax = 100;
var questCountMax = 99;
const questStatusMax = 5;
const questStrDataLen = 32;

const questObjectTypeMax = 9;
const questObjectKindMax = 999;
const questObjectCountMax = 999;
const questObjectChanceMax = 2000;
const questObjectLevelMax = 999;

const entityTypeNPCMin = 5;
const entityTypeNPCMax = 6;

const shortcutIndexMax = 6;
const shortcutTypeMax = 2;
const shortcutTypeIdMax = 999;

const usernameLenMin = 2;
const usernameLenMax = 16;
const userHashLenMin = 120;
const userHashLenMax = 120;
const playerHashLenMax = 128;

const playerNameLenMin = 2;
const playerNameLenMax = 16;
const playerColorsMaxLen = 6;
const playerSpritesMax = 999;
const playerPVPStatsMax = 999999;
const playerXpMax = 999999999;
const playerSkillXpMax = 999999999;
const playerStatPointsMax = 1000;
const playerStatFreePointsMax = 6000;
const playerGoldMax = 999999999;
const playerGemMax = 99999;
const playerLooksTotal = 177;
const playerLooksTotalCost = 10000;
const playerStatMax = 5;
const playerSkillMax = 50;
const playerPartyMax = 6;
const playerShortcutsMax = 7;
const playerShortcutsType = 2;

const worldNameLenMin = 2;
const worldNameLenMax = 16;
const worldUsersCountMin = 2;
const worldUsersCountMax = 1000;
const userServerPasswordLenMin = 10;
const userServerPasswordLenMax = 128;
const maxWorldCount = 10;
const maxPlayersPerUser = 20;
const worldKeyLenMin = 2;
const worldKeyLenMax = 16;

const serverAddressLenMin = 7;
const serverAddressLenMax = 15;
const serverPortMin = 1024;
const serverPortMax = 65535;
const serverProtocolLenMin = 2;
const serverProtocolLenMax = 2;


const userBansTotal = 1000;
const banDateMin = 1730000000000;
const banDateMax = 1800000000000;

const serverDateMin = 1730000000000;
const serverDateMax = 1800000000000;

const maxChatLength = 256;

const isTypeValid = function (fmt,msg) {
  if (Array.isArray(fmt)) {
    const res = _isTypeValid(fmt[0],msg);
    if (!res) {
      //console.info("_isTypeValid = false");
      return false;
    }

    if (fmt[0] === 'no' || fmt[0] === 'so')
    {
      //console.info("format is optional and ok.");
      return true;
    }

    const cfn = (fmt[0] === 'n' && msg >= fmt[1] && msg <= fmt[2]);
    if (cfn) {
      //console.info("format is number and in range.");
      return true;
    }

    const cfs = (fmt[0] === 's' && msg.length >= fmt[1] && msg.length <= fmt[2]);
    if (cfs) {
      //console.info("format is string and in range.");
      return true;
    }

    const cfa = (fmt[0] === 'array' && msg.length >= fmt[1] && msg.length <= fmt[2]);
    if (cfa) {
      //console.info("format is Array and in length.");
      return true;
    }

    const cfo = (fmt[0] === 'object' && Object.keys(msg).length >= fmt[1] && Object.keys(msg).length <= fmt[2]);
    if (cfo) {
      //console.info("format is Object and in keys range.");
      return true;
    }
  }
  else {
    return _isTypeValid(fmt,msg);
  }
};

const _isTypeValid = function (fmt, msg) {

  if (fmt === 'n' && _.isNumber(Number(msg))) {
      //console.info("isType is number");
      return true;
  }
  if (fmt === 's' && _.isString(msg)) {
      //console.info("isType is string");
      return true;
  }
  if (fmt === 'no' && (_.isNull(msg) || _.isNumber(Number(msg)))) {
      //console.info("isType is optional number");
      return true;
  }
  if (fmt === 'so' && (_.isNull(msg) || _.isString(msg))) {
      //console.info("isType is optional string");
      return true;
  }
  if (fmt === 'array' && Array.isArray(msg)) {
      //console.info("isType is Array");
      return true;
  }
  if (fmt === 'object' && (typeof(msg) === 'object')) {
      //console.info("isType is Object");
      return true;
  }
  console.info("isType not type or invalid.");
  console.info("fmt:"+fmt);
  console.info("msg:"+JSON.stringify(msg));
  return false;
};

// NOTE: the original wrapped the code below in an IIFE purely to avoid
// polluting the (shared, sloppy-mode) global scope. ES modules already have
// their own module scope, so the IIFE is no longer necessary and has been
// removed; behavior is unchanged.
class FormatChecker {
    constructor() {
        this.formats = {};

        this.formats[Types.Messages.BI_SYNCTIME] = [
          ['n',serverDateMin,serverDateMax]],
// USER LOGIN PACKETS
        this.formats[Types.Messages.CW_CREATE_USER] = [
          ['s',usernameLenMin,usernameLenMax],
          ['s',userHashLenMin,userHashLenMax]],
        this.formats[Types.Messages.CW_LOGIN_USER] = [
          ['s',usernameLenMin,usernameLenMax],
          ['s',userHashLenMin,userHashLenMax]],
        this.formats[Types.Messages.CW_REMOVE_USER] = [
          ['s',usernameLenMin,usernameLenMax],
          ['s',userHashLenMin,userHashLenMax]],
        this.formats[Types.Messages.CW_CREATE_PLAYER] = [
          ['n',0,maxPlayersPerUser],
          ['s',playerNameLenMin,playerNameLenMax]],
        this.formats[Types.Messages.CW_LOGIN_PLAYER] = [
          ['s',playerNameLenMin,playerNameLenMax],
          ['s',0,playerHashLenMax]],
// END USER LOGIN PACKETS

        this.formats[Types.Messages.CW_APPEARANCEUNLOCK] = [
          ['n',0,playerLooksTotal],
          ['n',0,playerGemMax]],
        this.formats[Types.Messages.CW_ATTACK] = [
          ['n',serverDateMin,serverDateMax],
          ['n',0,entityIdMax],
          ['n',0,orientationsMax],
          ['n',-1,playerSkillMax]],
        this.formats[Types.Messages.CW_AUCTIONBUY] = [
          ['n',0,auctionEntriesMax],
          ['n',0,auctionActionMax]],
        this.formats[Types.Messages.CW_AUCTIONDELETE] = [
          ['n',0,auctionEntriesMax],
          ['n',0,auctionActionMax]],
        this.formats[Types.Messages.CW_AUCTIONOPEN] = [
          ['n',0,auctionActionMax]],
        this.formats[Types.Messages.CW_AUCTIONSELL] = [
          ['n',0,itemInventoryMax],
          ['n',0,itemPriceMax]],
        this.formats[Types.Messages.CW_BANKRETRIEVE] = [
          ['n',0,itemBankMax]],
        this.formats[Types.Messages.CW_BANKSTORE] = [
          ['n',0,itemInventoryMax]],
        this.formats[Types.Messages.CW_CHAT] = [
          ['s',1,maxChatLength]],
        this.formats[Types.Messages.CW_COLOR_TINT] = [
          ['n',0,1],['s',playerColorsMaxLen,playerColorsMaxLen]],
        this.formats[Types.Messages.CW_BLOCK_MODIFY] = [
          ['n',0,1], // type pickup/place
          ['n',0,entityIdMax],
          ['n',0,mapCoordsMax],
          ['n',0,mapCoordsMax]],
        this.formats[Types.Messages.CW_LOOKUPDATE] = [
          ['n',0,1], // type
          ['n',0,playerSpritesMax]],
        this.formats[Types.Messages.CW_LOOT] = [
          ['n',0,entityIdMax],
          ['n',0,mapCoordsMax],
          ['n',0,mapCoordsMax]],
        this.formats[Types.Messages.CW_MOVE] = [
          ['n',serverDateMin,serverDateMax],
          ['n',0,entityIdMax],
          ['n',0,2], // move type.
          ['n',0,orientationsMax],
          ['n',0,mapCoordsMax],
          ['n',0,mapCoordsMax]],
        this.formats[Types.Messages.CW_GOLD] = [
          ['n',0,1], // type (inventory,bank)
          ['n',0,playerGoldMax],
          ['n',0,1]], // type2 (inventory,bank)
        this.formats[Types.Messages.CW_STATADD] = [
          ['n',1,playerStatMax],
          ['n',1,1]], // stat point add
        this.formats[Types.Messages.CW_STOREBUY] = [
          ['n',1,3], // item type
          ['n',0,itemKindMax],
          ['n',0,itemNumberMax]],
        this.formats[Types.Messages.CW_CRAFT] = [
          ['n',0,craftIdMax],
          ['n',0,craftItemCount]],
        this.formats[Types.Messages.CW_STORE_MODITEM] = [
          ['n',0,2], // modType
          ['n',0,2], // type
          ['n',0,itemInventoryMax]],
        this.formats[Types.Messages.CW_STORESELL] = [
          ['n',0,itemStoreTypeMax],
          ['n',0,itemInventoryMax]],
        this.formats[Types.Messages.CW_TALKTONPC] = [
          ['n',entityTypeNPCMin,entityTypeNPCMax], // npc type but not used?
          ['n',0,entityIdMax]],
        this.formats[Types.Messages.CW_TELEPORT_MAP] = [
          ['n',0,mapStatusMax],
          ['n',0,1],
          ['n',-1,mapCoordsMax],
          ['n',-1,mapCoordsMax],
          ['n',-1,mapIndexMax]],
        this.formats[Types.Messages.CW_SKILL] = [
          ['n',0,playerSkillMax],
          ['n',0,entityIdMax]],
        this.formats[Types.Messages.CW_SHORTCUT] = [
          ['n',0,playerShortcutsMax],
          ['n',0,playerShortcutsType],
          ['n',0,itemKindMax]],
        this.formats[Types.Messages.CW_PARTY] = [
          ['n',0,4],
          ['so',0,playerPartyMax],
          ['no',0,3]],
        this.formats[Types.Messages.CW_HARVEST] = [
          ['n',0,mapCoordsMax],
          ['n',0,mapCoordsMax]],
        this.formats[Types.Messages.CW_USE_NODE] = [
          ['n',0,entityIdMax]],
        this.formats[Types.Messages.CW_QUEST] = [
          ['n',0,entityIdMax],
          ['n',0,questIdMax],
          ['n',0,questTypeMax]
        ],
        this.formats[Types.Messages.CW_MOVEPATH] = [
          ['n',serverDateMin,serverDateMax],
          ['n',0,entityIdMax],
          ['n',0,orientationsMax],
          ['n',0,1],
          ['array',2,16,[
            ['n',0,mapCoordsMax],
            ['n',0,mapCoordsMax]]
          ]],
        this.formats[Types.Messages.CW_WHO] = [['array',0,999,[
            ['n',0,entityIdMax]]
        ]];
        /*this.formats[Types.Messages.CW_ITEMSLOT] = [
          ['n',0,3],
          ['n',0,2],
          ['n',-1,this.inventoryMax],
          ['n',0,this.itemCountMax]
          ['no',0,2],
          ['no',-1,this.inventoryMax],
          ['no',0,this.itemCountMax]
        ];*/

// NOTE - The following need no paramateres so they are grouped into 1 packet type.
// CW_APPEARANCELIST
// CW_PLAYER_REVIVE
// CW_PLAYERINFO
// CW_WHO REQUEST
        this.formats[Types.Messages.CW_REQUEST] = [['n',0,3]]
    }

    checkFormatData(fmt, msg) {
        const tfmt = (Array.isArray(fmt)) ? fmt[0] : fmt;
        const t = isTypeValid(tfmt, msg);
        if (!t) {
          console.info("isType not type or invalid.");
          return false;
        }

        const cfa = (fmt[0] === 'array');
        if (cfa) {
          console.info("format is Array and in length.");
          if (fmt[3]) {
            for(var i=0; i < msg.length; ++i) {
              const res = this.checkFormat(fmt[3], [msg[i]], true);
              if (!res) return false;
            }
          }
        }

        const cfo = (fmt[0] === 'object');
        if (cfo) {
          console.info("format is Object and in keys range.");
          if (fmt[3]) {
            for (const id in msg[i]) {
              const res = this.checkFormat(fmt[3], msg[i][id]);
              if (!res) return false;
            }
          }
        }
        return true;
    }

    checkFormat(format, message, ignoreLength) {
      const self = this;
      //var format = format || this.formats[type];
      var ignoreLength = ignoreLength || false;

      if (format) {
          //console.info("message:"+message);
          //console.info("format:"+format);
          if (!ignoreLength && message.length !== format.length) {
              //console.info("checkFormat - length incorrect. fmt:"+JSON.stringify(message)+", msg:"+JSON.stringify(format));
              return false;
          }

          const fmt = (Array.isArray(format[0])) ? format[0][0] : format[0];

          // handle empty arrays.
          if (fmt==='array' && Array.isArray(message) && message.length===0) {
              return (Array.isArray(fmt)) ? (fmt[1]===0) : true;
          }

          // handle empty objects.
          if (fmt==='object' && typeof(message) === 'object' && Object.keys(message).length===0) {
              return (Array.isArray(fmt)) ? (fmt[1]===0) : true;
          }

          for (let i = 0, n = format.length; i < n; i += 1) {
              const res = this.checkFormatData(format[i], message[i]);
              if (!res) return false;
          }
          return true;
      }
      else {
          console.error('Unknown message type. ');
          console.warn('message: ' + JSON.stringify(message));
          console.warn('format: ' + JSON.stringify(format));
          return false;
      }
    }

    check(msg) {
        const self = this;

        //console.info("msg:"+JSON.stringify(msg));
        const message = msg.slice(0);
        const type = message.shift();
        var format = this.formats[type];

        //console.info("msg: "+JSON.stringify(message));
        //console.info("type: "+type);
        if (format)
        {
            //console.info("checkFormat type:"+type);
            const res = this.checkFormat(format, message, true);
            return res;
        }
        else if (type === Types.Messages.CW_ITEMSLOT)
        {
          //console.info("type CW_ITEMSLOT");
          var format = [
            ['n',0,2],
            ['n',0,2],
            ['n',-1,this.inventoryMax],
            ['n',0,this.itemCountMax]
          ];
          if (message.len === 7) {
            format = format.concat([
              ['no',0,2],
              ['no',-1,this.inventoryMax],
              ['no',0,this.itemCountMax]]);
          }
          return this.checkFormat(format, message, true);
        }
        else
        {
            try{ throw new Error(); } catch (err) { console.info(err.stack); }
            console.error('Unknown message type: ' + type);
            console.warn("msg="+JSON.stringify(msg));
            return false;
        }
    }

}

const checker = new FormatChecker();

export const check = checker.check.bind(checker);
