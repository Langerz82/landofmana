
module.exports = BanManager = Class.extend({
  init: function (world) {
    this.world = world;
    this.userBans = {};
  },

  saveBans: function () {
      var now = Date.now();

      var data = [];
      for (var username in this.userBans)
      {
          var banTime = this.userBans[username];
          if (banTime < now)
            continue;

          var rec = username+","+banTime;
          data.push(rec);
      }
      return data;
  },

  loadBans: function (msg) {
      var now = Date.now();

      for(var rec of msg) {
        var ban = rec.split(",");
        if (now > (ban[1]))
          continue;
        this.userBans[ban[0]] = ban[1];
      }
  },

  isUserBanned: function (username) {
    if (this.userBans.hasOwnProperty(username) &&
      this.userBans[username] > Date.now())
    {
        return true;
    }
    return false;
  },

  banplayer: function (name, duration) {
    name = name.toLowerCase();
    var player = this.world.getPlayerByName(name);
    if (!player) {
      console.info("worldServer, banplayer: player not in world.");
      return;
    }
    var username = player.user.name;
    this.banuser(username, duration);
  },

  banuser: function (username, duration) {
    duration *= 86400 * 1000;
    this.userBans[username] = Date.now() + duration;
  },

  save: function () {
    if (this.world.userHandler) {
      var data = this.saveBans();
      this.world.userHandler.sendBansData(data);
      return true;
    }
    else {
      console.info("worldserver, save: userHandler not set");
    }
    return false;
  }
});
