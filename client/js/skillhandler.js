define(['entity/mob', 'data/skilldata', 'entity/character'], function(Mob, SkillData, Character) {

  var Skill = Class.extend({
    init: function(skillId) {
      this.level = 0;
      this.slots = [];
      this.skillId = skillId;
      this.data = SkillData.Data[skillId];
    },

    getName: function() {
      return this.skillData.name;
    },
    getLevel: function() {
      return this.level;
    },
    setLevel: function(value) {
      this.level = value;
    },

    clear: function() {},
    add: function(slot) {
      this.slots.push(slot);
    },
    remove: function(slot) {
      var index = this.slots.indexOf(slot);
      if (index >= 0) {
        this.slots.splice(index, 1);
      }
    }
  });

  //var SkillPassive = Skill.extend({});
  var SkillActive = Skill.extend({
    init: function(skillId) {
      this._super(skillId);

      this.cooltime = this.data.recharge / 1000;
    },

    execute: function() {
      var self = this;
      var player = game.player;

      if (Date.now() - this.cooldownTime < this.coolTime) {
        return false;
      }

      if (this.data.skillType == "attack") {
        player.attackSkill = this;
        this.activated = false;
        game.makePlayerInteractNextTo();
        player.attackSkill = null;
        if (!this.activated)
          return false;
        if (this.execute_callback)
          this.execute_callback(self);

      } else if (this.data.skillType == "target") {
        if (player.hasTarget() &&
              player.target instanceof Character) {
          if (this.execute_callback)
            this.execute_callback(self);
          game.client.sendSkill(this.skillId, player.target.id);

        } else {
          game.makePlayerInteractNextTo();
          return false;
        }
      } else if (this.data.skillType == "self") {
        if (this.execute_callback)
          this.execute_callback(self);
        game.client.sendSkill(this.skillId, 0);
      }

      this.cooldownTime = Date.now();
      //log.info("this.name="+this.name);
      player.skillHandler.pushActiveSkill(this);
      return true;
    },
  });

  var SkillFactory = {
    make: function(index) {
      if (index in SkillFactory.Skills) {
        return new SkillFactory.Skills[index](index);
      } else {
        return null;
      }
    }
  };

  SkillFactory.Skills = {};
  for (var i = 0; i < SkillData.Data.length; ++i) {
    var skillName = SkillData.Data[i].name;
    //log.info("skillName=" + skillName);
    SkillFactory.Skills[i] = SkillActive;
  };
  log.info("SKillFactory.Skills:" + JSON.stringify(SkillFactory.Skills));

  var SkillHandler = Class.extend({
    init: function(game) {
      this.game = game;
      this.skills = [];
      this.container = $('#skillcontainer');
      this.activeSkills = [];

      $('#skillsCloseButton').click(function () {
        ShortcutData = null;
      });
    },

    getSkill: function(skillId) {
      log.info("skillId="+skillId);
      return this.skills.In(skillId) ? this.skills[skillId] : null;
    },

    clear: function() {
    },

    addAll: function (skillExps) {
      sl = skillExps.length;
      for(var i = 0; i < sl; ++i)
      {
        this.add(i, skillExps[i]);
      }
    },

    execute: function (skillId) {
      return this.skills[skillId].execute();
    },

    add: function(skillId, exp) {
      //log.info("skillId:" + skillId);
      var skill = null;
      if (skillId in this.skills) {
        skill = this.skills[skillId];
      } else {
        skill = SkillFactory.make(skillId);
        //log.info("skill=" + JSON.stringify(skill));
        if (skill) {
          this.skills[skillId] = skill;
        }
      }
      if (skill) {
        skill.setLevel(Types.getSkillLevel(exp));
      }
      //alert(JSON.stringify(this.skills));
    },

    pushActiveSkill: function(activeSkill) {
      this.activeSkills.push(activeSkill);
    }
  });

  return SkillHandler;
});
