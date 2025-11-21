var _ = require('underscore');

var itemKindMax = 999;
var itemNumberMax = 100;
var itemDurabilityMax = 1000;
var itemExperienceMax = 9999999;
var itemPriceMax = 99999999;
var itemStoreMax = 96;
var itemInventoryMax = 50;
var itemBankMax = 96;
var itemEquipmentMax = 5;
var itemStoreTypeMax = 2;

var craftIdMax = 99;
var craftItemCount = 100;

var auctionEntriesMax = 9999;
var auctionActionMax = 3;

var achievementIndexMax = 99;
var achievementRankMax = 10;
var achievementCountMax = 999999;

var skillsXPMax = 999999999;
var mapsCountMax = 10;
var mapCoordsMax = 16384;
var orientationsMax = 4;
var entityIdMax = 99999;
var mapStatusMax = 3;

var questCountMax = 999;
var questIdMax = 999999999999999;
var questTypeMax = 9;
var questNpcIdMax = 100;
var questCountMax = 99;
var questStatusMax = 5;
var questStrDataLen = 32;

var questObjectTypeMax = 9;
var questObjectKindMax = 999;
var questObjectCountMax = 999;
var questObjectChanceMax = 2000;
var questObjectLevelMax = 999;

var entityTypeNPCMin = 5;
var entityTypeNPCMax = 6;

var shortcutIndexMax = 8;
var shortcutTypeMax = 2;
var shortcutTypeIdMax = 999;

var usernameLenMin = 2;
var usernameLenMax = 16;
var userHashLenMin = 120;
var userHashLenMax = 120;
var playerHashLenMax = 128;

var playerNameLenMin = 2;
var playerNameLenMax = 16;
var playerColorsMaxLen = 6;
var playerSpritesMax = 999;
var playerPVPStatsMax = 999999;
var playerXpMax = 999999999;
var playerSkillXpMax = 999999999;
var playerStatPointsMax = 1000;
var playerStatFreePointsMax = 6000;
var playerGoldMax = 999999999;
var playerGemMax = 99999;
var playerLooksTotal = 177;
var playerLooksTotalCost = 10000;
var playerStatMax = 5;
var playerSkillMax = 50;
var playerPartyMax = 6;
var playerShortcutsMax = 7;
var playerShortcutsType = 2;

var worldNameLenMin = 2;
var worldNameLenMax = 16;
var worldUsersCountMin = 2;
var worldUsersCountMax = 1000;
var userServerPasswordLenMin = 10;
var userServerPasswordLenMax = 128;
var maxWorldCount = 10;
var maxPlayersPerUser = 20;
var worldKeyLenMin = 2;
var worldKeyLenMax = 16;

var serverAddressLenMin = 7;
var serverAddressLenMax = 15;
var serverPortMin = 1024;
var serverPortMax = 65535;
var serverProtocolLenMin = 2;
var serverProtocolLenMax = 2;


var userBansTotal = 1000;
var banDateMin = 1730000000000;
var banDateMax = 1800000000000;

var serverDateMin = 1730000000000;
var serverDateMax = 1800000000000;

var maxChatLength = 256;

var isTypeValid = function (fmt,msg) {
  if (Array.isArray(fmt)) {
    var res = _isTypeValid(fmt[0],msg);
    if (!res) {
      //console.info("_isTypeValid = false");
      return false;
    }

    if (fmt[0] === 'no' || fmt[0] === 'so')
    {
      //console.info("format is optional and ok.");
      return true;
    }

    var cfn = (fmt[0] === 'n' && msg >= fmt[1] && msg <= fmt[2]);
    if (cfn) {
      //console.info("format is number and in range.");
      return true;
    }

    var cfs = (fmt[0] === 's' && msg.length >= fmt[1] && msg.length <= fmt[2]);
    if (cfs) {
      //console.info("format is string and in range.");
      return true;
    }

    var cfa = (fmt[0] === 'array' && msg.length >= fmt[1] && msg.length <= fmt[2]);
    if (cfa) {
      //console.info("format is Array and in length.");
      return true;
    }

    var cfo = (fmt[0] === 'object' && Object.keys(msg).length >= fmt[1] && Object.keys(msg).length <= fmt[2]);
    if (cfo) {
      //console.info("format is Object and in keys range.");
      return true;
    }
  }
  else {
    return _isTypeValid(fmt,msg);
  }
};

var _isTypeValid = function (fmt, msg) {

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

(function () {
    FormatChecker = Class.extend({
        init: function () {
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
              ['n',-1,mapCoordsMax]],
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
        },

        checkFormatData: function (fmt, msg) {
            var tfmt = (Array.isArray(fmt)) ? fmt[0] : fmt;
            var t = isTypeValid(tfmt, msg);
            if (!t) {
              console.info("isType not type or invalid.");
              return false;
            }

            var cfa = (fmt[0] === 'array');
            if (cfa) {
              console.info("format is Array and in length.");
              if (fmt[3]) {
                for(var i=0; i < msg.length; ++i) {
                  var res = this.checkFormat(fmt[3], [msg[i]], true);
                  if (!res) return false;
                }
              }
            }

            var cfo = (fmt[0] === 'object');
            if (cfo) {
              console.info("format is Object and in keys range.");
              if (fmt[3]) {
                for (var id in msg[i]) {
                  var res = this.checkFormat(fmt[3], msg[i][id]);
                  if (!res) return false;
                }
              }
            }
            return true;
        },

        checkFormat: function (format, message, ignoreLength) {
          var self = this;
          //var format = format || this.formats[type];
          var ignoreLength = ignoreLength || false;

          if (format) {
              console.info("message:"+message);
              console.info("format:"+format);
              if (!ignoreLength && message.length !== format.length) {
                  console.info("checkFormat - length incorrect. fmt:"+JSON.stringify(message)+", msg:"+JSON.stringify(format));
                  return false;
              }

              var fmt = (Array.isArray(format[0])) ? format[0][0] : format[0];

              // handle empty arrays.
              if (fmt==='array' && Array.isArray(message) && message.length===0) {
                  return (Array.isArray(fmt)) ? (fmt[1]===0) : true;
              }

              // handle empty objects.
              if (fmt==='object' && typeof(message) === 'object' && Object.keys(message).length===0) {
                  return (Array.isArray(fmt)) ? (fmt[1]===0) : true;
              }

              for (var i = 0, n = format.length; i < n; i += 1) {
                  var res = this.checkFormatData(format[i], message[i]);
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
        },

        check: function (msg) {
            var self = this;

            console.info("msg:"+JSON.stringify(msg));
            var message = msg.slice(0);
            var type = message.shift();
            var format = this.formats[type];

            console.info("msg: "+JSON.stringify(message));
            console.info("type: "+type);
            if (format)
            {
                console.info("checkFormat type:"+type);
                var res = this.checkFormat(format, message, true);
                return res;
            }
            else if (type === Types.Messages.CW_ITEMSLOT)
            {
              console.info("type CW_ITEMSLOT");
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
        },
    });

    var checker = new FormatChecker();

    exports.check = checker.check.bind(checker);
})();
