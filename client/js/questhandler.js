/* global Types, Class, _, questSerial */

define(['data/npcdata', 'data/questdata', 'data/mobdata', 'data/itemlootdata'],
  function(NpcData, QuestData, MobData, ItemLoot)
{
  var QuestHandler = Class.extend({
    init: function(game) {
      this.game = game;
      this.hideDelay = 5000; //How long the notification shows for.
      this.showlog = false;

      var self = this;
      this.closeButton = $('#questCloseButton');
      this.closeButton.click(function(event) {
        self.toggleShowLog();
      });
    },

    show: function() {
      this.quests = this.game.player.quests;
    },

    getNPCQuest: function(questId) {
      return _.find(this.quests, function(q) {
        return q.id === questId;
      });
    },

    toggleShowLog: function() {
      this.showlog = !this.showlog;
      if (this.showlog) {
        this.questReloadLog();
        this.questShowLog();
      } else {
        this.questHideLog();
      }
    },

    questReloadLog: function() {
      this.quests = game.player.quests;
      var self = this;
      $("#questLogInfo tbody").find("tr:gt(0)").remove();

      var questIds = Object.keys(this.quests);
      for (var i = 0; i < questIds.length; ++i) {
        var quest = this.quests[questIds[i]];
        if (quest.status == 2) {
          $('#questLogInfo .qd'+quest.id).remove();
          continue;
        }

        var progress = (quest.count + " / " + quest.object.count);
        if (quest.type==QuestType.GETITEMKIND)
        {
          progress = (quest.count + " / " + quest.object2.count);
        }

        var spriteName;
        var itemData;
        var idName;
        if (quest.type==QuestType.GETITEMKIND)
        {
          var kind = quest.object2.kind;
          itemData = ItemLoot[kind];
          var spriteName = itemData.sprite;
    			spriteName = game.sprites["itemloot"].file;
          idName = itemData.name.toLowerCase();
        }
        if (quest.type==QuestType.KILLMOBKIND)
        {
          var mobData = MobData.Kinds[quest.object.kind];
          spriteName = mobData.spriteName;
          idName = spriteName.toLowerCase();
        }
        if (quest.type==QuestType.USENODE)
        {
          spriteName = "nodeset"+quest.object.kind;
          idName = spriteName.toLowerCase()+"_node"+quest.data1;
        }

        var sprite = this.game.spritesets[0][spriteName];
        var sprite_content = "<div class=\"img quest-img-%idName%\"></div>"
        if (quest.type==QuestType.USENODE)
        {
          sprite_content = "<div class=\"img quest-img-%idName%\" style=\"background-image: url('"+sprite.filepath+"')\"></div>"
        }
        else if (quest.type==QuestType.GETITEMKIND)
        {
          sprite_content = "<div class=\"img quest-img-%idName%\" style=\"background-image: url('img/2/sprites/%sprite%')\"></div>"
        }
        else if (quest.type==QuestType.KILLMOBKIND)
        {
          sprite_content = "<div class=\"img quest-img-%idName%\" style=\"background-image: url('"+sprite.filepath+"')\"></div>"
          //sprite_content = "<div class=\"img quest-img-%idName%\" style=\"background-image: url('img/2/sprites/%sprite%.png')\"></div>"
        }

        sprite_content = sprite_content.replace(/%idName%/g, idName);
        sprite_content = sprite_content.replace(/%sprite%/g, spriteName);

        $('#questLogInfo tbody').append(
          "<tr id='qd"+quest.id+"'>" +
            "<td class='frame-stroke1'>" + sprite_content + "</td>" +
            "<td class='frame-stroke1'>" + quest.summary + "</td>" +
            "<td class='frame-stroke1'>" + progress + "</td>" +
          "</tr>");

        if (quest.type==QuestType.GETITEMKIND) {
          $('.quest-img-' + idName).css({
            'background-position': '-' + (itemData.offset[0] * 32) + 'px -' + (itemData.offset[1] * 32) + 'px',
            'width': "32px",
            'height': "32px"});
        }
        if (quest.type==QuestType.KILLMOBKIND) {
          var x = ((sprite.animationData['idle_down'].length - 1) * sprite.width)*2+sprite.width/2;
          var y = ((sprite.animationData['idle_down'].row) * sprite.height)*2+sprite.height/2;

          var offset = '-' + x + 'px -' + y + 'px';
          $('.quest-img-' + idName).css({
            "background-position": offset,
            "width": (sprite.width)+"px",
            "height": (sprite.height)+"px"});
        }
        if (quest.type==QuestType.USENODE) {
          var animName = "node"+quest.data1;
          var x = ((sprite.animationData[animName].length - 1) * sprite.width)*2+sprite.width/2;
          var y = ((sprite.animationData[animName].row) * sprite.height)*2+sprite.height/2;

          var offset = '-' + x + 'px -' + y + 'px';
          $('.quest-img-' + idName).css({
            "background-position": offset,
            "width": (sprite.width)+"px",
            "height": (sprite.height)+"px"});
        }
      }
    },

    questShowLog: function() {
      //alert("called");
      $('#questlog').css('display', 'block');
      $('#questCloseButton').css('display', 'block');
    },

    questHideLog: function() {
      $('#questlog').css('display', 'none');
      $('#questCloseButton').css('display', 'none');
    },

    handleQuest: function(quest) {
      this.quests = this.game.player.quests;
      var type = quest.status;
      var htmlStr = '';

      if (type === 0) {
        htmlStr = '<p><h2>Quest Found</h2></p><p>' + quest.summary + '</p>';
        game.userAlarm.alarm(htmlStr, this.hideDelay);
        this.questReloadLog();
      }
      else if (type === 2)
      {
        htmlStr = '<p><h2>Quest Completed</h2></p><p>' + quest.summary + '</p>';
        game.userAlarm.alarm(htmlStr, this.hideDelay);
        quest = null;
        this.questReloadLog();
      }

      if (this.showlog) {
        this.questReloadLog();
        this.questShowLog();
      }
    },

    talkToNPC: function(npc) {
      this.game.client.sendTalkToNPC(npc.type, npc.id);
    }
  });
  return QuestHandler;
});
