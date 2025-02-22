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

      /*for(var index = 0; index < this.slots.length; index++) {
          this.slots[index].setLevel(value);
      }*/
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
  var SkillPassive = Skill.extend({});
  var SkillActive = Skill.extend({
    init: function(skillId) {
      this._super(skillId);

      this.cooltime = this.data.recharge / 1000;
      this.cooltimeCounter = 0;
      this.cooltimeTickHandle = null;
      this.cooltimeDoneHandle = null;

      this.executingHandler = null;
    },

    clear: function() {
      if (this.cooltimeTickHandle) {
        clearInterval(this.cooltimeTickHandle);
        this.cooltimeTickHandle = null;
      }
      if (this.cooltimeDoneHandle) {
        clearTimeout(this.cooltimeDoneHandle);
        this.cooltimeDoneHandle = null;
      }
    },
    execute: function() {
      var self = this;

      if (this.cooltimeDoneHandle) {
        game.chathandler.addNotification('Wait for cooldown.');
        return;
      }
      if (this.data.skillType == "attack") {
        if (!this.cooltimeDoneHandle &&
          game.player.hasTarget() &&
          game.player.target instanceof Character) {
          if (this.execute_callback)
            this.execute_callback(self, game);
          else {
            if (!game.makePlayerAttack(game.player.target, this.skillId))
              return false;
          }
        } else {
          game.chathandler.addNotification('No target chosen.');
          return false;
        }
      } else if (this.data.skillType == "target") {
        if (!this.cooltimeDoneHandle &&
          game.player.hasTarget() &&
          game.player.target instanceof Character) {
          if (this.execute_callback)
            this.execute_callback(self, game);
          else {
            game.client.sendSkill(this.skillId, game.player.target.id);
          }
        } else {
          game.chathandler.addNotification('No target chosen.');
          return false;
        }
      } else if (this.data.skillType == "self") {
        if (!this.cooltimeDoneHandle)
          if (this.execute_callback) {
            log.info("execute_callback");
            this.execute_callback(self, game);
          }
        else {
          game.client.sendSkill(this.skillId, 0);
        }
      }

      this.cooldown(this.cooltime);

      //game.player.skillHandler.cooldownSlots(this);


      //log.info("this.name="+this.name);
      game.player.skillHandler.pushActiveSkill(this);
      return true;
    },

    cooldown: function (time) {
      var self = this;

      this.cooltimeCounter = time;

      var funcCooldown = function () {
        if (self.cooltimeCounter >= 0) {
          self.cooltimeCounter -= 1;

          for (var slot of self.slots) {
            slot.tick(self);
            if (self.cooltimeCounter == 0)
              slot.done();
          }
        } else {
          clearInterval(self.cooltimeTickHandle);
          self.cooltimeTickHandle = null;
        }
      };

      clearTimeout(this.cooltimeTickHandle);
      this.cooltimeTickHandle = setInterval(funcCooldown, 1000);

      funcCooldown();
    },

    tick: function(game) {},

    done: function(game) { self.cooltimeCounter = 0; },

    onExecuting: function(handler) {
      this.executingHandler = handler;
    }
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

  var SkillSlot = Class.extend({
    init: function(parent, index, skillId) {
      //this.game = game;
      this.parent = parent;
      this.index = parseInt(index);
      this.skillId = parseInt(skillId);
      this.background = $('#skill'+ index);
      this.body = $('#skill'+ index + 'Body');
      this.cooltime = $('#skill' + index + 'Cooltime');
      this.levels = [];
      this.data = SkillData.Data[skillId];

      if (game.renderer.tablet || game.renderer.mobile) {
        this.body.html("");
      }

      var self = this;
      this.body.data('slot', this.index);

      this.background.bind('click tap'), function (event) {
        self.body.trigger("click");
      }

      this.assign(skillId);

      var onShortcut = function (slot) {
        if (ShortcutData)
        {
          var index = ShortcutData.index;
          slot = parseInt(slot);
          index = parseInt(index);
          //game.client.sendSkillInstall(slot, index);
          game.shortcuts.install(2, slot, index);
          //game.player.skillHandler.install(slot, index);
          game.skillDialog.page.clearHighlight();
          ShortcutData = null;
        }
      };

      this.body.on('click tap', function(event) {
        log.info("click");
        if (!ShortcutData)
          self.execute();
        else
          onShortcut($(this).data('slot'));
        event.stopPropagation();
      });

      this.body.unbind('dragover').bind('dragover', function(event) {
          event.preventDefault();
      });
      this.body.unbind('drop').bind('drop', function(event) {
        onShortcut($(this).data('slot'));
      });
    },

    clear: function() {
      if (this.skill) {
        this.skill.clear();
        this.cooltime.css('display', 'none');
      }
    },
    hideShortcut: function() {
      this.body.css({
        'background-image': '',
        'background-position': ''
      });
      this.body.attr('title', '');
    },

    displayShortcut: function() {
      if (this.skill) {
        var scale = game.renderer.mobile ? 1 : game.renderer.getUiScaleFactor();
        var position = this.data.iconOffset;
        log.info("this.name=" + this.data.name);
        this.body.css({
          'background-image': 'url("img/' + scale + '/misc/skillicons.png")',
          'background-position': (-position[0] * 24 * scale) + "px " + (-position[1] * 24 * scale) + "px",
          'background-repeat': 'no-repeat'
        });
      }
    },

    assign: function(skillId) {
      if (this.skill) {
        this.skill.remove(this);
      }

      this.skill = this.parent.getSkill(skillId);
      if (this.skill) {
        this.skill.add(this);

        //var self = this;
        var scale = game.renderer.getScaleFactor();
        this.displayShortcut();
        this.body.attr('title', name);

        this.setLevel(this.skill.level);

        /*if ((this.skill instanceof SkillActive) && this.skill.cooltimeDoneHandle) {
          this.execute_(this.skill);
        }*/

        //var counter = this.skill.cooltimeCounter;
        //if (counter > 0)
          //this.cooldown(counter);

      } else {
        this.body.css({
          'background-image': '',
          'background-position': ''
        });
        this.body.attr('title', '');
      }
    },
    execute: function() {
      var executed;

      if (!this.skill)
        return false;
      /*for (var slotSkill of this.parent.skillSlots) {
        if (slotSkill.skillId != this.skillId) continue;
          slotSkill.cooltime.css('display', 'none');
      }*/

      if (this.skill && (this.skill instanceof SkillActive)) {
        return this.skill.execute(this.parent.game);

        //if (executed)
        //this.cooldown(this.skill.cooltimeCounter);
      }

      /*for (var slot of this.skill.slots) {
        //if (slot.skillId != this.skillId)
          //continue;
        slot.cooldown(this.skill.cooltimeCounter);
      }*/
    },

    execute_: function(skill) {
      /*if (skill.cooltime > 0) {
        this.cooltime.css('display', 'block');
        this.tick(skill);
      }*/
    },
    /*cooldown: function(time) {
      if (time > 0) {
        //clearInterval(this.skill.cooltimeTickHandle);
        //if (time < 2) time = 2;
        this.skill.cooltimeCounter = time;
        this.cooltime.css('display', 'block');
        this.cooltime.html('' + time.toFixed(0));
        //this.skill.cooldown(time);
        //this.tick(this.skill);
      }
    },*/
    tick: function(skill) {
      //var timeLeft = skill.cooltimeCounter.toFixed(0);
      //this.cooltime.html('' + timeLeft);
    },

    done: function () {
      //this.cooltime.css('display', 'none');
    }
  });

  var SkillHandler = Class.extend({
    init: function(game) {
      this.game = game;
      this.skills = [];
      this.container = $('#skillcontainer');
      this.activeSkills = [];

      //for (var index = 0; index < 6; index++) {
        //this.skillSlots.push(new SkillSlot(this.game, this, index, -1));
        //this.skillSlots[index].assign();
      //}

      var self = this;
      self.isDragging = false;

      this.container.bind("touchstart", function(ev) {
        self.isClicked = true;
      });
      this.container.mousedown(function() {
        self.isClicked = true;
      });

      this.container.mousemove(function() {
        self.isDragging = true;
      });

      this.container.mouseup(function(event) {
        self.isDragging = false;
        self.isClicked = false;
      });
      this.container.bind("touchend", function(ev) {
        self.isDragging = false;
        self.isClicked = false;
      });

    },

    moveShortcuts: function() {
      this.container.css({
        "left": this.game.mouse.x + "px",
        "top": this.game.mouse.y + "px"
      });
    },

    displayShortcuts: function() {
    },

    hideShortcuts: function() {

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

    add: function(skillId, exp) {
      //log.info("skillId:" + skillId);
      var skill = null;
      if (skillId in this.skills) {
        skill = this.skills[skillId];
      } else {
        skill = SkillFactory.make(skillId);
        //log.info("skill=" + JSON.stringify(skill));
        if (skill) {
          if (skill instanceof SkillActive) {
            var self = this;
            skill.onExecuting(function(sender) {
              self.game.chathandler.addNotification('You have to wait for ' + sender.name + ' to cool down.');
            });
          }
          this.skills[skillId] = skill;
        }
      }
      if (skill) {
        skill.setLevel(Types.getSkillLevel(exp));
      }
      //alert(JSON.stringify(this.skills));
    },

// TODO FIX BROKEN AS FUCK!!


    /*execute: function(index) {
      //var index = [81, 69, 82, 84].indexOf(key); // q, e, r, t
      var executed = this.skillSlots[index].execute();
      if (executed)
      {
        for (var i = 0; i < this.skillSlots.length; i++) {
          if (i != index) continue;
          if (this.skillSlots[i].skill && this.skillSlots[i].skill.cooltimeCounter < 2)
            this.skillSlots[i].cooldown(2);
        }
      }
    },*/

    pushActiveSkill: function(activeSkill) {
      this.activeSkills.push(activeSkill);
    },
    showActiveSkill: function() {
      /*var skill = this.activeSkills.shift();
      if (!skill)
        return;

      var scale = game.renderer.getIconScaleFactor();
      var position = skill.data.iconOffset;

      $("#currentSkill").css({
        'background-image': 'url("img/' + scale + '/misc/skillicons.png")',
        'background-position': (-position[0] * 24 * scale * 0.75) + "px " + (-position[1] * 24 * scale * 0.75) + "px",
        'background-repeat': 'no-repeat',
        'background-size': (360 * 0.75) + "px " + (336 * 0.75) + "px"
      });
      if (!$("#currentSkill").is(":visible"))
        $("#currentSkill").fadeIn(500);

      if ($("#currentSkill").is(":visible"))
        $("#currentSkill").fadeOut(1000);*/
    }

  });

  return SkillHandler;
});
