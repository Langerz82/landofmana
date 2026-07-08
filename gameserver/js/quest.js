const getQuestObject = function(arr) {
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
  self.type = parseInt(arr[0], 10);
  self.kind = parseInt(arr[1], 10) || 0;
  self.count = parseInt(arr[2], 10) || 0;
  self.chance = parseInt(arr[3], 10) || 0;
  if (arr.length === 4)
    self.level = [0, 99];
  if (arr.length === 5)
    self.level = [parseInt(arr[4], 10),99];
  if (arr.length === 6)
    self.level = [parseInt(arr[4], 10),parseInt(arr[5], 10)];

  return self;
};

// NOTE: the original CommonJS file did `module.exports = getQuestObject`
// and then, further down, `module.exports = Quest = ...`, so the second
// assignment silently overwrote the first -- `require('./quest')` only ever
// resolved to `Quest`. That default-export behavior is preserved below;
// `getQuestObject` is additionally exposed as a named export (entityquests.js
// relies on it and previously reached it only because both files shared the
// same leaked global scope).
class Quest {
    constructor(qArray) {
      //qArray = qArray.parseInt(, 10);
      if (!qArray)
        return;

      this.id = parseInt(qArray[0], 10);
      this.type = parseInt(qArray[1], 10);
      this.npcQuestId = parseInt(qArray[2], 10);
      this.count = parseInt(qArray[3], 10) || 0;
      this.status = parseInt(qArray[4], 10) || 0;
      this.data1 = parseInt(qArray[5], 10) || 0;
      this.data2 = parseInt(qArray[6], 10) || 0;
      this.object = qArray[7] || null;
      this.object2 = qArray[8] || null;
    }

    assign(quest) {
      this.id = parseInt(quest.id, 10);
      this.type = parseInt(quest.type, 10);
      this.npcQuestId = parseInt(quest.npcQuestId, 10);
      this.count = parseInt(quest.count, 10);
      this.status = parseInt(quest.status, 10);
      this.data1 = parseInt(quest.data1, 10);
      this.data2 = parseInt(quest.data2, 10);
      this.object = quest.object;
      this.object2 = quest.object2;
    }

    toArray() {
      var cols = [parseInt(this.id, 10),
        parseInt(this.type, 10),
        parseInt(this.npcQuestId, 10),
        parseInt(this.count, 10),
        parseInt(this.status, 10),
        parseInt(this.data1, 10),
        parseInt(this.data2, 10)];

      if (this.object) {
        cols = cols.concat(this.object.toArray(this.object));
      }
      if (this.object2) {
        cols = cols.concat(this.object2.toArray(this.object2));
      }
      return cols;
    }

    toClient() {
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
    }

    toString() {
        return this.toArray().join(",");
    }
}

export { getQuestObject };
export default Quest;
