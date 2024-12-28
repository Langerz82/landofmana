var _ = require('underscore');
var Types = require('../shared/js/gametypes');

var itemKindMax = 999;
var itemNumberMax = 100;
var itemDurabilityMax = 1000;
var itemExperienceMax = 9999999;
var itemPriceMax = 99999999;

var auctionEntriesMax = 9999;

var achievementIndexMax = 99;
var achievementRankMax = 10;
var achievementCountMax = 999999;

var skillsXPMax = 999999999;
var mapsCountMax = 10;
var mapCoordsMax = 16384;
var orientationsMax = 4;

var questIdMax = 999;
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

var shortcutIndexMax = 8;
var shortcutTypeMax = 2;
var shortcutTypeIdMax = 999;

var usernameLenMin = 2;
var usernameLenMax = 16;
var userHashLenMin = 120;
var userHashLenMax = 120;

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

var playerLooksTotal = 177;
var playerLooksTotalCost = 10000;

var userBansTotal = 1000;
var banDateMin = 1730000000000;
var banDateMax = 1800000000000;

var getItemSlots = function (type) {
  if (type==0) return 48;
  if (type==1) return 96;
  if (type==2) return 5;
  return 0;
};

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

  if (fmt === 'n' && _.isNumber(parseInt(msg))) {
      //console.info("isType is number");
      return true;
  }
  if (fmt === 's' && _.isString(msg)) {
      //console.info("isType is string");
      return true;
  }
  if (fmt === 'no' && (_.isNull(msg) || _.isNumber(parseInt(msg)))) {
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
            this.formats[Types.UserMessages.CU_CREATE_USER] = [
                ['s',usernameLenMin,usernameLenMax],
                ['s',userHashLenMin,userHashLenMax]];
            this.formats[Types.UserMessages.CU_LOGIN_USER] = [
                ['s',usernameLenMin,usernameLenMax],
                ['s',userHashLenMin,userHashLenMax]];
            this.formats[Types.UserMessages.CU_LOGIN_PLAYER] = [
                ['n',0,maxWorldCount],
                ['n',0,maxPlayersPerUser]];
            this.formats[Types.UserMessages.CU_CREATE_PLAYER] = [
                ['n',0,maxWorldCount],
                ['s',playerNameLenMin,playerNameLenMax]];

            this.formats[Types.UserMessages.WU_GAMESERVER_INFO] = [
                ['s',worldNameLenMin,worldNameLenMax],
                ['n',0,worldUsersCountMax],
                ['n',worldUsersCountMin,worldUsersCountMax],
                ['s',serverAddressLenMin,serverAddressLenMin],
                ['n',serverPortMin,serverPortMax],
                ['s',userServerPasswordLenMin,userServerPasswordLenMax],
                ['s',worldKeyLenMin,worldKeyLenMax]];
            this.formats[Types.UserMessages.WU_PLAYER_LOGGED_IN] = [
                ['s',usernameLenMin,usernameLenMax],
                ['s',playerNameLenMin,playerNameLenMax]];
            this.formats[Types.UserMessages.WU_SAVE_PLAYERS_LIST] = [
                ['array',0,worldUsersCountMax, [
                  ['s',playerNameLenMin,playerNameLenMax]] ]];
            this.formats[Types.UserMessages.WU_PLAYER_LOADED] = [
                ['s',serverProtocolLenMin,serverProtocolLenMax],
                ['s',serverAddressLenMin,serverAddressLenMax],
                ['n',serverPortMin,serverPortMax]];
            this.formats[Types.UserMessages.WU_SAVE_PLAYER_LOOKS] = [
                ['array',0,playerLooksTotal, [
                  ['n',0,playerLooksTotalCost]] ]];
            this.formats[Types.UserMessages.WU_SAVE_USER_BANS] = [
                ['array',0,userBansTotal, [
                  ['s',usernameLenMin,usernameLenMax],
                  ['n',banDateMin,banDateMax]] ]];
            this.formats[Types.UserMessages.WU_ADD_PLAYER_GOLD] = [
                ['s',playerNameLenMin,playerNameLenMax],
                ['n',0,playerGoldMax]];
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

        checkFormatCSV: function (index, msg, fmt) {
          console.info("fnCheckFormatCSV: index:"+index);
          if (!_.isString(msg)) {
            console.info("fnCheckFormatCSV: message not a string.");
            return false;
          }
          var arr = msg.split(",");
          if (arr.length != fmt.length)
          {
            console.info("fnCheckFormatCSV: message incorrect length.");
            console.info("fnCheckFormatCSV: arr.length:"+arr.length);
            return false;
          }
          var res = this.checkFormat(fmt, arr, false);
          if (!res) {
            console.info("fnCheckFormatCSV: message check format failed.");
            console.info("fnCheckFormatCSV: fmt:"+JSON.stringify(fmt));
            console.info("fnCheckFormatCSV: arr:"+JSON.stringify(arr));
            return false;
          }
          return true;
        },

        checkPlayerItems: function (msg, type) {
          console.info("fnItems: type:"+type);
          var arr = null;
          try {
            if (!_.isString(msg)) {
              console.info("fnItems: items data not a string.");
              return false;
            }
            arr = JSON.parse(msg);
          }
          catch (err) {
            console.info("fnItems: items data JSON parse failed.");
            return false;
          }

          if (!arr)
            console.info("fnItems: items data no data.");

          if (!Array.isArray(arr))
          {
            console.info("fnItems: items data not a array of items.");
            return false;
          }
          var fmt = [['array',0,getItemSlots(type),[
              ['n',0,getItemSlots(type)], // slot index.
              ['n',0,itemKindMax], // kind
              ['n',0,itemNumberMax], // stack number and magic number.
              ['n',0,itemDurabilityMax],
              ['n',0,itemDurabilityMax],
              ['n',0,itemExperienceMax]]
            ]];
          var res = this.checkFormat(fmt, [arr], true);
          if (!res) {
            console.info("fnItems: item array not correct format.");
            console.info(JSON.stringify(fmt));
            console.info(JSON.stringify(arr));
            return false;
          }
          return true;
        },

        checkFormat: function (format, message, ignoreLength) {
          var self = this;
          //var format = format || this.formats[type];
          var ignoreLength = ignoreLength || false;

          if (format) {
              //console.info("message:"+message);
              //console.info("format:"+format);
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

            //console.info("msg:"+msg);
            var message = msg.slice(0),
                type = message.shift(),
                format = format || this.formats[type];

            //console.info("type:"+type);
            if (type == Types.UserMessages.WU_SAVE_PLAYER_DATA)
            {
              console.info("WU_SAVE_PLAYER_DATA");
              if (message[0]) {
                var fmt = [['s',this.playerNameMin,this.playerNameMax]];
                var res = this.checkFormat(fmt, [message[0]], true);
                if (!res) {
                  console.info("message 0 failed.")
                  return false;
                }
              }

              if (!Array.isArray(message[1])) {
                console.info("message 1 not an array.")
                return false;
              }
              if (message[1].length != 7) {
                console.info("message 1 not length 7.")
                return false;
              }

              var data = null;
              var msg = message[1][0];
              if (msg) {
                fmt = [['s',this.usernameMin,this.usernameMax],['so',120,120],['n',0,99999],['s',45,45]];
                var res = this.checkFormat(fmt, msg, true);
                if (!res) {
                  console.info("message arr1-0 failed.")
                  return false;
                }
              }

              // Player Data.
              var msg = message[1][1];
              if (!Array.isArray(msg)) {
                console.info("message 1-1 not an array.")
                return false;
              }
              if (msg.length != 11) {
                console.info("message 1-1 not length 11.")
                return false;
              }
              if (!msg) {
                console.info("message[1][1] not defined.")
              }

              // map data
              var fmt = [
                ['n',0,mapsCountMax],
                ['n',0,mapCoordsMax],
                ['n',0,mapCoordsMax],
                ['n',0,orientationsMax]];
              var res = this.checkFormatCSV(1, msg[1], fmt);
              if (!res) {
                return false;
              }

              // stats data
              var fmt = [
                ['n',0,playerStatPointsMax],
                ['n',0,playerStatPointsMax],
                ['n',0,playerStatPointsMax],
                ['n',0,playerStatPointsMax],
                ['n',0,playerStatPointsMax],
                ['n',0,playerStatFreePointsMax]];
              var res = this.checkFormatCSV(2, msg[2], fmt);
              if (!res) {
                return false;
              }

              // exps data
              var fmt = [
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax],
                ['n',0,playerXpMax]];
              var res = this.checkFormatCSV(3, msg[3], fmt);
              if (!res) {
                return false;
              }

              // gold data
              var fmt = [
                ['n',0,playerGoldMax],
                ['n',0,playerGoldMax]];
              var res = this.checkFormatCSV(4, msg[4], fmt);
              if (!res) {
                return false;
              }

              // skills xp data
              var fmt = [
                ['n',0,playerSkillXpMax],
                ['n',0,playerSkillXpMax],
                ['n',0,playerSkillXpMax],
                ['n',0,playerSkillXpMax],
                ['n',0,playerSkillXpMax]];
              var res = this.checkFormatCSV(5, msg[5], fmt);
              if (!res) {
                return false;
              }

              // pvp stats data
              var fmt = [
                ['n',0,playerPVPStatsMax],
                ['n',0,playerPVPStatsMax]];
              var res = this.checkFormatCSV(6, msg[6], fmt);
              if (!res) {
                return false;
              }

              // sprites data
              var fmt = [
                ['n',0,playerSpritesMax],
                ['n',0,playerSpritesMax],
                ['n',0,playerSpritesMax],
                ['n',0,playerSpritesMax]];
              var res = this.checkFormatCSV(7, msg[7], fmt);
              if (!res) {
                return false;
              }

              // colors data
              var fmt = [
                ['s',0,playerColorsMaxLen],
                ['n',0,playerColorsMaxLen]];
              var res = this.checkFormatCSV(8, msg[8], fmt);
              if (!res) {
                return false;
              }

              // shortcuts data
              var data = msg[9];
              if (!_.isString(data)) {
                console.info("shortcuts data not a string.");
                return false;
              }
              try {
                obj = JSON.parse(data);
              } catch {
                console.info("shortcuts data, json parse invalid.");
                return false;
              }
              if (typeof(obj) !== 'object') {
                console.info("shortcuts data, data not object.");
                return false;
              }

              var len = Object.keys(obj).length;
              if (len > shortcutIndexMax) {
                console.info("shortcuts data, length longer than 8");
              }

              var fmt = [['object',0,shortcutIndexMax,[
                ['n',0,shortcutIndexMax],
                ['n',0,shortcutTypeMax],
                ['n',0,shortcutTypeIdMax]]
              ]];
              var res = this.checkFormat(fmt, [obj], true);
              if (!res) {
                console.info("shortcuts data, shortcut format failed.");
                console.info(JSON.stringify(fmt))
                console.info(JSON.stringify(tsc))
                return false;
              }

              // completeQuests data
              var arr;
              var data = msg[10];
              if (!_.isString(data)) {
                console.info("complete quests data not a string.");
                return false;
              }
              try {
                arr = JSON.parse(data);
              }
              catch {
                console.info("complete quests JSON parse error :"+JSON.stringify(data));
                return false;
              }
              console.warn("complete quests: arr:"+JSON.stringify(arr));
              if (typeof(arr) !== "object") {
                console.info("complete quests is not an object.");
                return false;
              }
              fmt = [['object',0,questIdMax, [
                ['no',0,questNpcIdMax],
                ['no',0,questIdMax]]
              ]];
              var res = this.checkFormat(fmt, [arr], true);
              if (!res) {
                console.info("complete quests format failed.");
                console.info(JSON.stringify(fmt))
                console.info(JSON.stringify(arr))
                return false;
              }

              // quests data.
              var arr = message[1][2];
              console.info(JSON.stringify(arr));
              if (!Array.isArray(arr)) {
                console.info("quests is not an array.");
                return false;
              }
              if (arr.length > 99) {
                console.info("quests is over 99.");
                return false;
              }

              var appendFmtObject = function (fmt) {
                return fmt.concat([
                    ['n',0,questObjectTypeMax], // object type
                    ['n',0,questObjectKindMax], // object kind
                    ['n',0,questObjectCountMax], // object count
                    ['n',0,questObjectChanceMax], // object chance
                    ['n',0,questObjectLevelMax], // object level min
                    ['n',0,questObjectLevelMax] // object level max
                ]);
              };

              for (var rec of arr) {
                fmt = [
                  ['n',0,questIdMax], // id
                  ['n',0,questTypeMax], // type
                  ['n',0,questNpcIdMax], // npcQuestId
                  ['n',0,questCountMax], // count
                  ['n',0,questStatusMax], // status
                  ['s',0,questStrDataLen], // data1
                  ['s',0,questStrDataLen] // data2
                ];
                if (rec.length === 13) {
                  fmt = appendFmtObject(fmt);
                }
                else if (rec.length === 19) {
                  fmt = appendFmtObject(fmt);
                }

                var res = this.checkFormat(fmt, rec, true);
                if (!res) {
                  console.info("quests format failed.");
                  console.info(JSON.stringify(fmt))
                  console.info(JSON.stringify(rec))
                  return false;
                }
              }

              // achievements data.
              var data = message[1][3];
              if (data) {
                if (!_.isString(data)) {
                  console.info("message arr1-3 is not a string.");
                  return false;
                }
                var arr = data.split(',');
                var count = arr.length;
                if (count % 3 != 0) {
                  console.info("message arr1-3 not correct achievement count.");
                  return false;
                }
                var fmt = [['array',0,achievementIndexMax,[
                    ['n',0,achievementIndexMax],
                    ['n',0,achievementRankMax],
                    ['n',0,achievementCountMax]]
                  ]];
                var res = this.checkFormat(fmt, [arr], true);
                if (!res) {
                  console.info("message arr1-3 checkFormat failed. i="+i);
                  console.info(JSON.stringify(fmt))
                  console.info(JSON.stringify(arr))
                  return false;
                }
              }

              // inventory data
              var data = message[1][4];
              if (data) {
                if (!this.checkPlayerItems(data, 0)) {
                  console.info("inventory data msg1-4 format failed. "+JSON.stringify(data));
                  return false;
                }
              }

              // bank data
              var data = message[1][5];
              if (data) {
                if (!this.checkPlayerItems(data, 1)) {
                  console.info("bank data msg1-5 format failed. "+JSON.stringify(data));
                  return false;
                }
              }

              // equipment data
              var data = message[1][6];
              if (data) {
                if (!this.checkPlayerItems(data, 2)) {
                  console.info("equipment data msg1-6 format failed. "+JSON.stringify(data));
                  return false;
                }
              }

              console.info("fmt:"+JSON.stringify(fmt));
              console.info("message:"+JSON.stringify(message));
              return true;
            }
            else if (type == Types.UserMessages.WU_SAVE_PLAYER_AUCTIONS) {
              console.info("WU_SAVE_PLAYER_AUCTIONS");
              var arr = message;
              var fmt = [['array',0,auctionEntriesMax,[
                ['s',0,playerNameLenMax], // playerName
                ['n',0,itemPriceMax], // sell price
                ['n',0,itemKindMax], // item kind
                ['n',0,itemNumberMax], // count/magic number
                ['n',0,itemDurabilityMax], // itemDurability
                ['n',0,itemDurabilityMax], // itemDurabilityMax
                ['n',0,itemExperienceMax]] // itemExperience
              ]];

              return this.checkFormat(fmt, [arr], true);
            }
            else if (type == Types.UserMessages.WU_SAVE_PLAYER_LOOKS)
            {
              console.info("WU_SAVE_PLAYER_LOOKS");
              var msg = message[0];
              if (!_.isString(msg)) {
                console.info("message is not a string.");
                return false;
              }
              var fmt = this.formats[type];
              var arr = msg.split(',');
              return this.checkFormat(fmt, [arr], true);
            }
            else if (this.formats[type])
            {
              var res = this.checkFormat(this.formats[type], message, true);
              return res;
            }
            else
            {
                try{ throw new Error(); } catch (err) { console.info(err.stack); }
                console.error('Unknown message type: ' + type);
                console.warn("message="+message);
                return false;
            }
        }
    });

    var checker = new FormatChecker();

    exports.check = checker.check.bind(checker);
})();
