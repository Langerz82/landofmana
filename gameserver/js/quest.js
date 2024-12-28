var cls = require('./lib/class');

module.exports = getQuestObject = function(arr) {
  var self = {};
  self.toArray = function (obj) {
    return [obj.type,
      obj.kind,
      obj.count,
      obj.chance,
      obj.level[0],
      obj.level[1]];
  };
  self.toClient = function (obj) {
    return [obj.type,
      obj.kind,
      obj.count];
  }
  self.type = parseInt(arr[0]);
  self.kind = parseInt(arr[1]) || 0;
  self.count = parseInt(arr[2]) || 0;
  self.chance = parseInt(arr[3]) || 0;
  if (arr.length == 4)
    self.level = [0, 99];
  if (arr.length == 5)
    self.level = [parseInt(arr[4]),99];
  if (arr.length == 6)
    self.level = [parseInt(arr[4]),parseInt(arr[5])];

  return self;
};

module.exports = Quest = cls.Class.extend({
    init: function(qArray) {
      //qArray = qArray.parseInt();
      if (!qArray)
        return;

      this.id = parseInt(qArray[0]);
      this.type = parseInt(qArray[1]);
      this.npcQuestId = parseInt(qArray[2]);
      this.count = parseInt(qArray[3]) || 0;
      this.status = parseInt(qArray[4]) || 0;
      this.data1 = parseInt(qArray[5]) || 0;
      this.data2 = parseInt(qArray[6]) || 0;
      this.object = qArray[7] || null;
      this.object2 = qArray[8] || null;
    },

    assign: function (quest) {
      this.id = parseInt(quest.id);
      this.type = parseInt(quest.type);
      this.npcQuestId = parseInt(quest.npcQuestId);
      this.count = parseInt(quest.count);
      this.status = parseInt(quest.status);
      this.data1 = parseInt(quest.data1);
      this.data2 = parseInt(quest.data2);
      this.object = quest.object;
      this.object2 = quest.object2;
    },

    toArray: function () {
      var cols = [parseInt(this.id),
        parseInt(this.type),
        parseInt(this.npcQuestId),
        parseInt(this.count),
        parseInt(this.status),
        parseInt(this.data1),
        parseInt(this.data2)];

      if (this.object) {
        cols = cols.concat(this.object.toArray(this.object));
      }
      if (this.object2) {
        cols = cols.concat(this.object2.toArray(this.object2));
      }
      return cols;
    },

    toClient: function () {
      var cols = [this.id,
        this.type,
        this.npcQuestId,
        this.count,
        this.status,
        this.data1,
        this.data2];
      if (this.object) {
        cols = cols.concat(this.object.toClient(this.object));
      }
      else {
        cols = cols.concat([0,0,0]);
      }
      if (this.object2) {
        cols = cols.concat(this.object2.toClient(this.object2));
      }
      else {
        cols = cols.concat([0,0,0]);
      }
      return cols;
    },

    toString: function () {
        return this.toArray().join(",");
    }
});
