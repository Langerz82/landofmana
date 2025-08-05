
define(['data/npcdata', 'data/questdata', 'data/mobdata', 'data/itemlootdata'],
  function(NpcData, QuestData, MobData, ItemLoot)
{
  var getQuestObject = function(arr) {
    var self = {};
    self.toArray = function (obj) {
      return [obj.type,
        obj.kind,
        obj.count];
    };
    self.toClient = function (obj) {
      return [obj.type,
        obj.kind,
        obj.count];
    }
    self.type = arr[0];
    self.kind = arr[1] || 0;
    self.count = arr[2] || 0;
    return self;
  };

    var Quest = Class.extend({
        init: function(arr) {
           this.update(arr);
        },

        update: function(arr) {
          var arr = arr.parseInt();

          this.id = arr[0];
          this.type = arr[1];
          this.npcQuestId = arr[2];
          this.count = arr[3];
          this.status = arr[4];
          this.data1 = arr[5];
          this.data2 = arr[6];
          if (!isNaN(arr[7]))
            this.object = getQuestObject([arr[7],arr[8],arr[9]]);
          this.object2 = null;
          if (arr.length === 13 && !isNaN(arr[10]))
            this.object2 = getQuestObject([arr[10],arr[11],arr[12]]);
          this.setDesc();
        },

        setDesc: function(desc) {
          var questType;

          var questLang = lang.data["QUESTS"][parseInt(this.id).toString()];
          var summaryIndex;
          if (questLang)
          {
            desc = desc || questLang[this.status];
          }
          else {
            switch (this.type) {
              case QuestType.HIDEANDSEEK:
                questType = "QUESTS_FIND";
                summaryIndex = "HIDEANDSEEK";
                break;
              case QuestType.KILLMOBKIND:
                questType = "QUESTS_MOB";
                summaryIndex = "KILLMOBKIND";
                break;
              case QuestType.GETITEMKIND:
                questType = "QUESTS_ITEM";
                summaryIndex = "GETITEMKIND";
                break;
              case QuestType.USENODE:
                questType = "QUESTS_NODE";
                summaryIndex = "USENODE";
                break;
            }
            var langData = lang.data[questType];
            desc = desc || langData[0][this.status];
          }
          if (!desc) {
            this.desc="";
            return;
          }

          if (!Array.isArray(desc))
            desc = [[0, desc]];

          var i=0;
          for (var d of desc)
          {
            var txt = Array.isArray(d) ? d[1] : d;
            txt = this.setTextTemplate(txt);
            desc[i++] = [Array.isArray(d) ? d[0] : 0, txt];
          }
          this.desc = desc;

          var sum = lang.data['QUEST_SUMMARY'];
          var summary = sum.hasOwnProperty(this.id) ? sum[this.id] : sum[summaryIndex];
          this.summary = this.setTextTemplate(summary);
        },

        setTextTemplate: function (txt) {
          if (this.type==QuestType.GETITEMKIND)
          {
            if (this.object2) {
              var itemLootData = ItemLoot[(this.object2.kind)];
              txt = txt.replace(/%name%/g, itemLootData.name.capitalizeFirstLetter());
              txt = txt.replace(/%count%/g, this.object2.count);
            }
            if (this.object) {
              var mobData = MobData.Kinds[this.object.kind];
              if (mobData)
                txt = txt.replace(/%name2%/g, mobData.key.capitalizeFirstLetter());
            }
          }
          if (this.type==QuestType.KILLMOBKIND)
          {
            if (this.object) {
              var mobData = MobData.Kinds[this.object.kind];
              txt = txt.replace(/%name%/g, mobData.key.capitalizeFirstLetter());
              txt = txt.replace(/%count%/g, this.object.count);
              //d = d.replace('%level%', mobData.minLevel);
            }
          }
          if (this.type==QuestType.HIDEANDSEEK)
          {
            if (this.object) {
              var npcData = NpcData.Kinds[this.object.kind];
              txt = txt.replace('%name%', npcData.name);
            }
          }
          if (this.type==QuestType.USENODE)
          {
            if (this.object) {
              txt = txt.replace(/%count%/g, this.object.count);
            }
          }
          txt = txt.replace('%count2%', this.count);
          return txt;
        }
    });
    return Quest;
});
